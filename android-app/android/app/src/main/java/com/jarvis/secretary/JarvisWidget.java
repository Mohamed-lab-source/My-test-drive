package com.jarvis.secretary;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** Home-screen HUD: live clock, three status lines the app keeps fresh, tap to talk. */
public class JarvisWidget extends AppWidgetProvider {

    static final String PREFS = "jarvis_widget";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, build(ctx));
    }

    static RemoteViews build(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.jarvis_widget);
        v.setTextViewText(R.id.widget_line1, p.getString("line1", "STANDING BY"));
        v.setTextViewText(R.id.widget_line2, p.getString("line2", "Tap to talk"));
        v.setTextViewText(R.id.widget_line3, p.getString("line3", ""));
        PendingIntent pi = PendingIntent.getActivity(ctx, 12, Summon.intentFor(ctx, "com.jarvis.secretary.TALK"),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
        return v;
    }

    static void refresh(Context ctx, String l1, String l2, String l3) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("line1", l1).putString("line2", l2).putString("line3", l3).apply();
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        mgr.updateAppWidget(new ComponentName(ctx, JarvisWidget.class), build(ctx));
    }
}
