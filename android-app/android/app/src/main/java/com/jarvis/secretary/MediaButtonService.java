package com.jarvis.secretary;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import android.view.KeyEvent;

/**
 * "On the go" — summon Jarvis with a Bluetooth headset button.
 *
 * Holds an active MediaSession so a press of the headset's call/play button
 * (KEYCODE_HEADSETHOOK / MEDIA_PLAY_PAUSE / VOICE_ASSIST) brings Jarvis up to
 * listen, even with the screen off and the app in the background — the same
 * route the "Hey Jarvis" wake word uses. Runs as a light foreground service
 * so the session stays alive. (While another app is actively playing media it
 * may own the media buttons; the headset's dedicated assistant button still
 * reaches Jarvis through the system assistant role.)
 */
public class MediaButtonService extends Service {

    private static final String TAG = "JarvisMedia";
    private static final String CHANNEL = "jarvis_onthego";
    private static final String CHANNEL_ALERT = "jarvis_onthego_alert";
    private static final int NOTIF_ID = 7300;
    private static final int ALERT_ID = 7301;

    private static volatile boolean running = false;
    private MediaSession session;
    private long lastPress = 0;

    static boolean isRunning() { return running; }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannels();
        Notification n = buildOngoing();
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIF_ID, n);
            }
        } catch (Exception e) {
            Log.w(TAG, "could not start in foreground", e);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (session == null) setupSession();
        running = true;
        return START_STICKY;
    }

    private void setupSession() {
        session = new MediaSession(this, "JarvisOnTheGo");
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setPlaybackState(new PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_PAUSE)
            .setState(PlaybackState.STATE_PAUSED, 0, 0f)
            .build());
        session.setCallback(new MediaSession.Callback() {
            @Override
            public boolean onMediaButtonEvent(Intent mediaButtonIntent) {
                KeyEvent ke = mediaButtonIntent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                if (ke != null && ke.getAction() == KeyEvent.ACTION_DOWN) {
                    switch (ke.getKeyCode()) {
                        case KeyEvent.KEYCODE_HEADSETHOOK:
                        case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                        case KeyEvent.KEYCODE_MEDIA_PLAY:
                        case KeyEvent.KEYCODE_VOICE_ASSIST:
                            summon();
                            return true;
                    }
                }
                return super.onMediaButtonEvent(mediaButtonIntent);
            }
            @Override public void onPlay() { summon(); }
            @Override public void onPause() { summon(); }
        });
        try { session.setActive(true); } catch (Exception e) { Log.w(TAG, "setActive failed", e); }
    }

    /** Bring Jarvis up to listen — mirrors WakeWordService.onWake(). */
    private void summon() {
        long now = SystemClock.elapsedRealtime();
        if (now - lastPress < 800) return;   // one summon per press, ignore key repeats
        lastPress = now;

        try { WakeWordService.pause(120_000); } catch (Exception ignored) {}
        MainActivity.queueAction("talk");
        if (MainActivity.isInForeground()) { DeviceActionsPlugin.emitAssist(); return; }

        Intent open = new Intent(this, MainActivity.class)
            .setAction("com.jarvis.secretary.TALK")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        boolean canPopUp = Build.VERSION.SDK_INT < 29 || Settings.canDrawOverlays(this);
        if (canPopUp) {
            try { startActivity(open); return; } catch (Exception e) { Log.w(TAG, "could not open Jarvis", e); }
        }
        PendingIntent pi = PendingIntent.getActivity(this, 5, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
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

    @Override
    public void onDestroy() {
        running = false;
        if (session != null) {
            try { session.setActive(false); session.release(); } catch (Exception ignored) {}
            session = null;
        }
        super.onDestroy();
    }

    private Notification buildOngoing() {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 4, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Jarvis is on the go")
            .setContentText("Press your headset button to talk")
            .setOngoing(true)
            .setContentIntent(pi)
            .build();
    }

    private void createChannels() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel quiet = new NotificationChannel(CHANNEL, "Jarvis on the go", NotificationManager.IMPORTANCE_LOW);
        quiet.setShowBadge(false);
        nm.createNotificationChannel(quiet);
        NotificationChannel alert = new NotificationChannel(CHANNEL_ALERT, "Jarvis headset wake-ups", NotificationManager.IMPORTANCE_HIGH);
        nm.createNotificationChannel(alert);
    }
}
