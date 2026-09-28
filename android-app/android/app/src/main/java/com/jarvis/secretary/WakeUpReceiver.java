package com.jarvis.secretary;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import java.util.Calendar;

/** Jarvis's wake-up call: an exact daily alarm that brings him up to brief the user. Re-armed after a reboot. */
public class WakeUpReceiver extends BroadcastReceiver {

    static final String ACTION = "com.jarvis.secretary.WAKEUP_ALARM";
    static final String PREFS = "jarvis_wakeup";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        if (ACTION.equals(a)) {
            schedule(ctx); // tomorrow's
            Summon.open(ctx, "wakeup", "com.jarvis.secretary.WAKEUP", "Good morning", "Tap to hear your briefing");
        } else if (Intent.ACTION_BOOT_COMPLETED.equals(a) || "android.intent.action.MY_PACKAGE_REPLACED".equals(a)) {
            schedule(ctx);
        }
    }

    /** Schedules the next occurrence from saved settings; returns its time, or 0 if off. */
    static long schedule(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent fire = PendingIntent.getBroadcast(ctx, 21, new Intent(ctx, WakeUpReceiver.class).setAction(ACTION),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(fire);
        if (!p.getBoolean("enabled", false)) return 0;
        int hour = p.getInt("hour", 7), minute = p.getInt("minute", 0);
        String days = p.getString("days", "1234567"); // Calendar.SUNDAY=1 … SATURDAY=7
        Calendar c = Calendar.getInstance();
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        c.set(Calendar.HOUR_OF_DAY, hour);
        c.set(Calendar.MINUTE, minute);
        if (c.getTimeInMillis() <= System.currentTimeMillis()) c.add(Calendar.DAY_OF_YEAR, 1);
        for (int i = 0; i < 7 && days.indexOf(Character.forDigit(c.get(Calendar.DAY_OF_WEEK), 10)) < 0; i++) c.add(Calendar.DAY_OF_YEAR, 1);
        PendingIntent show = PendingIntent.getActivity(ctx, 22, Summon.intentFor(ctx, "com.jarvis.secretary.WAKEUP"),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.setAlarmClock(new AlarmManager.AlarmClockInfo(c.getTimeInMillis(), show), fire);
        return c.getTimeInMillis();
    }
}
