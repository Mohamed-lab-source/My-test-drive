package com.jarvis.secretary;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Background watchers: every ~30 minutes, even with Jarvis closed, checks
 * price thresholds (stocks, crypto, FX, 21k gold in EGP) and rain ahead,
 * and notifies once when a condition is met.
 */
public class WatchWorker extends Worker {

    static final String PREFS = "jarvis_watch";
    private static final String CHANNEL = "jarvis_watch";
    private static final String WORK = "jarvis-watchers";

    public WatchWorker(@NonNull Context ctx, @NonNull WorkerParameters params) { super(ctx, params); }

    static void sync(Context ctx, String watchesJson) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        p.edit().putString("watches", watchesJson).apply();
        boolean any = false;
        try { any = new JSONArray(watchesJson).length() > 0; } catch (Exception ignored) {}
        WorkManager wm = WorkManager.getInstance(ctx);
        if (!any) { wm.cancelUniqueWork(WORK); return; }
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(WatchWorker.class, 30, TimeUnit.MINUTES)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build();
        wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.UPDATE, req);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray watches;
        try { watches = new JSONArray(p.getString("watches", "[]")); } catch (Exception e) { return Result.success(); }
        JSONObject fired;
        try { fired = new JSONObject(p.getString("fired", "{}")); } catch (Exception e) { fired = new JSONObject(); }
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        Double egp = null;
        for (int i = 0; i < watches.length(); i++) {
            JSONObject w = watches.optJSONObject(i);
            if (w == null) continue;
            String id = w.optString("id");
            String kind = w.optString("kind");
            try {
                if ("rain".equals(kind)) {
                    if (today.equals(fired.optString(id, ""))) continue;
                    JSONObject f = getJson("https://api.open-meteo.com/v1/forecast?latitude=" + w.getDouble("lat") + "&longitude=" + w.getDouble("lon")
                        + "&hourly=precipitation_probability&forecast_hours=12");
                    JSONArray probs = f.getJSONObject("hourly").getJSONArray("precipitation_probability");
                    int max = 0;
                    for (int k = 0; k < probs.length(); k++) max = Math.max(max, probs.optInt(k, 0));
                    if (max >= w.optInt("threshold", 60)) {
                        notify(ctx, i, "Rain ahead", "Up to " + max + "% chance of rain in the next 12 hours. Umbrella, sir.");
                        fired.put(id, today);
                    }
                    continue;
                }
                if (fired.has(id)) continue; // price watches fire once
                double value;
                if ("gold21".equals(kind)) {
                    if (egp == null) egp = yahoo("EGP=X");
                    value = yahoo("GC=F") * egp / 31.1034768 * 0.875;
                } else {
                    value = yahoo(w.getString("symbol"));
                }
                boolean hit = w.has("above") ? value >= w.getDouble("above") : w.has("below") && value <= w.getDouble("below");
                if (hit) {
                    String label = w.optString("label", w.optString("symbol"));
                    String dir = w.has("above") ? "crossed above " + fmt(w.getDouble("above")) : "dropped below " + fmt(w.getDouble("below"));
                    notify(ctx, i, label + " " + dir, "Now " + fmt(value) + ", sir.");
                    fired.put(id, fmt(value) + "|" + System.currentTimeMillis());
                }
            } catch (Exception ignored) {}
        }
        p.edit().putString("fired", fired.toString()).putLong("lastRun", System.currentTimeMillis()).apply();
        return Result.success();
    }

    private static String fmt(double v) {
        return v >= 100 ? String.format(Locale.US, "%,.0f", v) : String.format(Locale.US, "%,.2f", v);
    }

    private static double yahoo(String symbol) throws Exception {
        JSONObject j = getJson("https://query1.finance.yahoo.com/v8/finance/chart/" + java.net.URLEncoder.encode(symbol, "UTF-8") + "?range=1d&interval=1d");
        return j.getJSONObject("chart").getJSONArray("result").getJSONObject(0).getJSONObject("meta").getDouble("regularMarketPrice");
    }

    private static JSONObject getJson(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) JarvisPersonalAssistant");
        try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream()))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            return new JSONObject(sb.toString());
        } finally {
            c.disconnect();
        }
    }

    private static void notify(Context ctx, int idx, String title, String text) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Jarvis watchers", NotificationManager.IMPORTANCE_HIGH));
        PendingIntent pi = PendingIntent.getActivity(ctx, 30 + idx, Summon.intentFor(ctx, "android.intent.action.MAIN"),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(ctx, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build();
        nm.notify(7200 + idx, n);
    }
}
