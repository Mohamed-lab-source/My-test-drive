package com.jarvis.secretary;

import android.app.Application;
import android.content.Context;

import java.io.PrintWriter;
import java.io.StringWriter;

/** Saves any uncaught crash so the next launch can show what happened. */
public class JarvisApp extends Application {
    static final String PREFS = "jarvis_crash";

    @Override
    public void onCreate() {
        super.onCreate();
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                StringWriter sw = new StringWriter();
                error.printStackTrace(new PrintWriter(sw));
                String trace = sw.toString();
                getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putString("trace", "Thread: " + thread.getName() + "\n" + (trace.length() > 6000 ? trace.substring(0, 6000) : trace))
                    .putLong("at", System.currentTimeMillis())
                    .commit();
            } catch (Throwable ignored) {}
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }
}
