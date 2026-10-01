package com.jarvis.secretary;

import android.content.Context;

import com.k2fsa.sherpa.onnx.GeneratedAudio;
import com.k2fsa.sherpa.onnx.OfflineTts;
import com.k2fsa.sherpa.onnx.OfflineTtsConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Jarvis's offline voice: Kokoro v1.0 ("Daniel", British male) running on the
 * phone through sherpa-onnx. The ~117 MB voice pack is downloaded once into
 * the app's private storage; after that, speech needs no network at all.
 */
final class KokoroVoice {
    static final String PACK = "jarvis-voice-daniel";
    private static OfflineTts tts;

    interface Progress { void update(int percent); }

    private KokoroVoice() {}

    static File packDir(Context ctx) { return new File(ctx.getFilesDir(), PACK); }

    static boolean installed(Context ctx) {
        File d = packDir(ctx);
        return new File(d, "model.int8.onnx").length() > 50_000_000L
            && new File(d, "voices.bin").exists() && new File(d, "tokens.txt").exists()
            && new File(d, "espeak-ng-data/en_dict").exists();
    }

    /** Downloads the zip and unpacks it; replaces any earlier copy. */
    static void download(Context ctx, String url, Progress progress) throws IOException {
        File zip = new File(ctx.getCacheDir(), PACK + ".zip");
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(20000);
        c.setReadTimeout(60000);
        int code = c.getResponseCode();
        if (code >= 300 && code < 400) { // cross-host redirect (GitHub → its CDN)
            String loc = c.getHeaderField("Location");
            c.disconnect();
            c = (HttpURLConnection) new URL(loc).openConnection();
            c.setConnectTimeout(20000);
            c.setReadTimeout(60000);
            code = c.getResponseCode();
        }
        if (code != 200) throw new IOException("Download failed (HTTP " + code + ")");
        long total = c.getContentLengthLong();
        try (InputStream in = new BufferedInputStream(c.getInputStream()); OutputStream out = new BufferedOutputStream(new FileOutputStream(zip))) {
            byte[] buf = new byte[65536];
            long done = 0;
            int n, last = -1;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                done += n;
                int pct = total > 0 ? (int) (done * 90 / total) : -1;
                if (pct != last) { last = pct; progress.update(pct); }
            }
        } finally {
            c.disconnect();
        }
        release();
        File base = ctx.getFilesDir();
        deleteRecursive(packDir(ctx));
        String root = base.getCanonicalPath() + File.separator;
        try (ZipInputStream zin = new ZipInputStream(new BufferedInputStream(new java.io.FileInputStream(zip)))) {
            ZipEntry e;
            byte[] buf = new byte[65536];
            while ((e = zin.getNextEntry()) != null) {
                File out = new File(base, e.getName());
                if (!out.getCanonicalPath().startsWith(root)) throw new IOException("Bad entry in voice pack");
                if (e.isDirectory()) { out.mkdirs(); continue; }
                out.getParentFile().mkdirs();
                try (OutputStream o = new BufferedOutputStream(new FileOutputStream(out))) {
                    int n;
                    while ((n = zin.read(buf)) > 0) o.write(buf, 0, n);
                }
            }
        } finally {
            zip.delete();
        }
        progress.update(100);
        if (!installed(ctx)) throw new IOException("The voice pack looks incomplete; try again.");
    }

    static synchronized OfflineTts engine(Context ctx) {
        if (tts != null) return tts;
        File d = packDir(ctx);
        OfflineTtsKokoroModelConfig kokoro = new OfflineTtsKokoroModelConfig();
        kokoro.setModel(new File(d, "model.int8.onnx").getAbsolutePath());
        kokoro.setVoices(new File(d, "voices.bin").getAbsolutePath());
        kokoro.setTokens(new File(d, "tokens.txt").getAbsolutePath());
        kokoro.setDataDir(new File(d, "espeak-ng-data").getAbsolutePath());
        kokoro.setLexicon(new File(d, "lexicon-gb-en.txt").getAbsolutePath());
        kokoro.setLang("en");
        OfflineTtsModelConfig model = new OfflineTtsModelConfig();
        model.setKokoro(kokoro);
        model.setNumThreads(Math.max(2, Math.min(4, Runtime.getRuntime().availableProcessors() - 2)));
        OfflineTtsConfig config = new OfflineTtsConfig();
        config.setModel(model);
        config.setMaxNumSentences(1);
        tts = new OfflineTts(null, config); // null asset manager = load from files
        return tts;
    }

    static synchronized void release() {
        if (tts != null) { try { tts.release(); } catch (Throwable ignored) {} tts = null; }
    }

    /** Speaks into a WAV file and returns it. */
    static File synthesize(Context ctx, String text, int speaker, float speed, String name) throws IOException {
        GeneratedAudio audio = engine(ctx).generate(text, speaker, speed);
        File out = new File(ctx.getCacheDir(), name);
        writeWav(out, audio.getSamples(), audio.getSampleRate());
        return out;
    }

    static void deleteRecursive(File f) {
        if (f.isDirectory()) { File[] kids = f.listFiles(); if (kids != null) for (File k : kids) deleteRecursive(k); }
        f.delete();
    }

    private static void writeWav(File file, float[] samples, int rate) throws IOException {
        int dataLen = samples.length * 2;
        ByteBuffer b = ByteBuffer.allocate(44 + dataLen).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes()).putInt(36 + dataLen).put("WAVE".getBytes());
        b.put("fmt ".getBytes()).putInt(16).putShort((short) 1).putShort((short) 1).putInt(rate).putInt(rate * 2).putShort((short) 2).putShort((short) 16);
        b.put("data".getBytes()).putInt(dataLen);
        for (float s : samples) b.putShort((short) Math.max(-32768, Math.min(32767, Math.round(s * 32767f))));
        try (FileOutputStream o = new FileOutputStream(file)) { o.write(b.array()); }
    }
}
