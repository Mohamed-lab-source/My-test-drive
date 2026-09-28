package com.jarvis.secretary;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

/** Brings Jarvis to the front for an action, from anywhere (alarm, tile, widget). */
final class Summon {
    private static final String CHANNEL = "jarvis_summon";

    private Summon() {}

    static Intent intentFor(Context ctx, String intentAction) {
        return new Intent(ctx, MainActivity.class)
            .setAction(intentAction)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
    }

    /**
     * Opens Jarvis directly when Android allows it (app in front, or "display over
     * other apps" granted); otherwise shows a full-screen / heads-up notification.
     */
    static void open(Context ctx, String action, String intentAction, String title, String text) {
        MainActivity.queueAction(action);
        if (MainActivity.isInForeground()) { DeviceActionsPlugin.emitAssist(); return; }
        Intent open = intentFor(ctx, intentAction);
        boolean canPopUp = Build.VERSION.SDK_INT < 29 || Settings.canDrawOverlays(ctx);
        if (canPopUp) {
            try { ctx.startActivity(open); return; } catch (Exception ignored) {}
        }
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Jarvis calls", NotificationManager.IMPORTANCE_HIGH));
        PendingIntent pi = PendingIntent.getActivity(ctx, intentAction.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(ctx, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle(title)
            .setContentText(text)
            .setCategory(Notification.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setFullScreenIntent(pi, true)
            .build();
        nm.notify(7100, n);
    }
}
