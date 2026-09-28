package com.jarvis.secretary;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.util.Log;

import org.tensorflow.lite.Interpreter;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayDeque;
import java.util.Arrays;

/**
 * "Hey Jarvis" — an always-on wake word, fully on the phone.
 *
 * Uses openWakeWord's pretrained "hey jarvis" model (github.com/dscripka/openWakeWord;
 * code Apache-2.0, models CC BY-NC-SA 4.0: personal, non-commercial use). 16 kHz
 * audio in 80 ms chunks → mel spectrogram model → speech embedding model
 * (76 mel frames → 96 values) → wake word model (last 16 embeddings → score).
 * No audio leaves the phone. Runs as a foreground service (Android requires
 * the persistent notification for background microphone use) and steps
 * aside whenever Jarvis himself is listening, since two apps can't reliably
 * share the microphone.
 */
public class WakeWordService extends Service {

    private static final String TAG = "JarvisWake";
    private static final String CHANNEL = "jarvis_wake";
    private static final String CHANNEL_ALERT = "jarvis_wake_alert";
    private static final int NOTIF_ID = 7001;
    private static final int ALERT_ID = 7002;
    private static final int SAMPLE_RATE = 16000;
    private static final int CHUNK = 1280;          // 80 ms
    private static final int CONTEXT = 480;         // 3 extra hops for the mel window
    private static final int MEL_FRAMES = 76;
    private static final int EMBEDDINGS = 16;
    private static final int WARMUP_CHUNKS = 20;
    private static final float THRESHOLD = 0.5f;

    private static volatile boolean running = false;
    private static volatile long pausedUntil = 0;

    private volatile boolean stopRequested = false;
    private Thread worker;

    static boolean isRunning() { return running; }

    /** Release the microphone for up to {@code ms} (Jarvis is listening himself). */
    static void pause(long ms) { pausedUntil = System.currentTimeMillis() + ms; }

    static void resume() { pausedUntil = 0; }

    static boolean isPaused() { return System.currentTimeMillis() < pausedUntil; }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannels();
        Notification n = buildOngoing();
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            } else {
                startForeground(NOTIF_ID, n);
            }
        } catch (Exception e) {
            // e.g. restarted by the system while the app is in the background,
            // where Android no longer allows starting microphone access.
            Log.w(TAG, "could not start in foreground", e);
            stopSelf();
            return START_NOT_STICKY;
        }
        running = true;
        if (worker == null) {
            stopRequested = false;
            worker = new Thread(this::listenLoop, "jarvis-wake");
            worker.start();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopRequested = true;
        running = false;
        if (worker != null) worker.interrupt();
        worker = null;
        super.onDestroy();
    }

    /* ------------------------------------------------------------------ */

    private void listenLoop() {
        Interpreter mel = null, emb = null, kw = null;
        AudioRecord rec = null;
        try {
            Interpreter.Options opts = new Interpreter.Options().setNumThreads(1);
            mel = new Interpreter(loadModel("wakeword/melspectrogram.tflite"), opts);
            mel.resizeInput(0, new int[] {1, CHUNK + CONTEXT});
            mel.allocateTensors();
            emb = new Interpreter(loadModel("wakeword/embedding_model.tflite"), opts);
            kw = new Interpreter(loadModel("wakeword/hey_jarvis_v0.1.tflite"), opts);

            int[] melShape = mel.getOutputTensor(0).shape(); // [1, 1, 8, 32]
            float[][][][] melOut = new float[melShape[0]][melShape[1]][melShape[2]][melShape[3]];
            float[][] melIn = new float[1][CHUNK + CONTEXT];
            float[][][][] embIn = new float[1][MEL_FRAMES][32][1];
            float[][][][] embOut = new float[1][1][1][96];
            float[][][] kwIn = new float[1][EMBEDDINGS][96];
            float[][] kwOut = new float[1][1];

            short[] pcm = new short[CHUNK];
            float[] raw = melIn[0];
            ArrayDeque<float[]> frames = new ArrayDeque<>();
            ArrayDeque<float[]> embeddings = new ArrayDeque<>();
            int chunks = 0;
            long lastFire = 0;

            while (!stopRequested) {
                if (isPaused()) {
                    if (rec != null) { releaseRecorder(rec); rec = null; }
                    Thread.sleep(200);
                    continue;
                }
                if (rec == null) {
                    rec = openRecorder();
                    if (rec == null) { Thread.sleep(2000); continue; }
                    // Fresh start: same state openWakeWord begins from.
                    Arrays.fill(raw, 0f);
                    frames.clear();
                    for (int i = 0; i < MEL_FRAMES; i++) { float[] f = new float[32]; Arrays.fill(f, 1f); frames.add(f); }
                    embeddings.clear();
                    chunks = 0;
                }

                int got = 0;
                while (got < CHUNK && !stopRequested && !isPaused()) {
                    int n = rec.read(pcm, got, CHUNK - got);
                    if (n <= 0) break;
                    got += n;
                }
                if (got < CHUNK) {
                    releaseRecorder(rec);
                    rec = null;
                    if (!isPaused()) Thread.sleep(500);
                    continue;
                }

                System.arraycopy(raw, CHUNK, raw, 0, CONTEXT);
                for (int i = 0; i < CHUNK; i++) raw[CONTEXT + i] = pcm[i];

                mel.run(melIn, melOut);
                for (int t = 0; t < melShape[2]; t++) {
                    float[] f = new float[32];
                    for (int k = 0; k < 32; k++) f[k] = melOut[0][0][t][k] / 10f + 2f;
                    frames.add(f);
                }
                while (frames.size() > MEL_FRAMES) frames.poll();

                int r = 0;
                for (float[] f : frames) {
                    for (int k = 0; k < 32; k++) embIn[0][r][k][0] = f[k];
                    r++;
                }
                emb.run(embIn, embOut);
                embeddings.add(embOut[0][0][0].clone());
                while (embeddings.size() > EMBEDDINGS) embeddings.poll();
                chunks++;

                if (embeddings.size() == EMBEDDINGS && chunks > WARMUP_CHUNKS) {
                    int e = 0;
                    for (float[] v : embeddings) kwIn[0][e++] = v;
                    kw.run(kwIn, kwOut);
                    long now = System.currentTimeMillis();
                    if (kwOut[0][0] > THRESHOLD && now - lastFire > 3000) {
                        lastFire = now;
                        onWake();
                    }
                }
            }
        } catch (InterruptedException ignored) {
        } catch (Throwable t) {
            Log.e(TAG, "wake word loop stopped", t);
        } finally {
            if (rec != null) releaseRecorder(rec);
            if (mel != null) mel.close();
            if (emb != null) emb.close();
            if (kw != null) kw.close();
        }
    }

    private AudioRecord openRecorder() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return null;
        try {
            int min = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            AudioRecord rec = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, CHUNK * 2 * 4));
            if (rec.getState() != AudioRecord.STATE_INITIALIZED) { rec.release(); return null; }
            rec.startRecording();
            return rec;
        } catch (Exception e) {
            Log.w(TAG, "microphone unavailable", e);
            return null;
        }
    }

    private static void releaseRecorder(AudioRecord rec) {
        try { rec.stop(); } catch (Exception ignored) {}
        try { rec.release(); } catch (Exception ignored) {}
    }

    private ByteBuffer loadModel(String asset) throws Exception {
        try (InputStream in = getAssets().open(asset); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            byte[] bytes = out.toByteArray();
            ByteBuffer bb = ByteBuffer.allocateDirect(bytes.length).order(ByteOrder.nativeOrder());
            bb.put(bytes);
            bb.rewind();
            return bb;
        }
    }

    /* ------------------------------------------------------------------ */

    private void onWake() {
        // Jarvis is about to listen with the recognizer; get out of its way.
        // The app resumes us when the conversation ends (or after 2 minutes).
        pause(120_000);
        MainActivity.queueAction("talk");
        if (MainActivity.isInForeground()) {
            DeviceActionsPlugin.emitAssist();
            return;
        }
        Intent open = new Intent(this, MainActivity.class)
            .setAction("com.jarvis.secretary.TALK")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        boolean canPopUp = Build.VERSION.SDK_INT < 29 || Settings.canDrawOverlays(this);
        if (canPopUp) {
            try { startActivity(open); return; } catch (Exception e) { Log.w(TAG, "could not open Jarvis", e); }
        }
        // Without "display over other apps", Android blocks opening from the
        // background: show a heads-up notification that opens him on tap.
        PendingIntent pi = PendingIntent.getActivity(this, 2, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification alert = new Notification.Builder(this, CHANNEL_ALERT)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Yes, sir?")
            .setContentText("Tap to talk to Jarvis")
            .setCategory(Notification.CATEGORY_CALL)
            .setAutoCancel(true)
            .setTimeoutAfter(20_000)
            .setContentIntent(pi)
            .setFullScreenIntent(pi, true)
            .build();
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(ALERT_ID, alert);
    }

    private Notification buildOngoing() {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Jarvis is standing by")
            .setContentText("Say \"Hey Jarvis\" — listening happens on the phone only")
            .setOngoing(true)
            .setContentIntent(pi)
            .build();
    }

    private void createChannels() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel quiet = new NotificationChannel(CHANNEL, "Hey Jarvis listening", NotificationManager.IMPORTANCE_MIN);
        quiet.setShowBadge(false);
        nm.createNotificationChannel(quiet);
        NotificationChannel alert = new NotificationChannel(CHANNEL_ALERT, "Hey Jarvis wake-ups", NotificationManager.IMPORTANCE_HIGH);
        nm.createNotificationChannel(alert);
    }
}
