package com.jarvis.secretary;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Set when Jarvis is opened for a purpose: summoned as the device
    // assistant (long-press home/power, assistant gesture, headset button) or
    // via a home-screen shortcut. The JS side consumes it: "talk" starts
    // listening, "briefing" plays the briefing, "planner" opens the Planner.
    private static volatile String pendingAction = null;
    private static volatile boolean inForeground = false;

    static String consumePendingAction() {
        String action = pendingAction;
        pendingAction = null;
        return action;
    }

    /** Used by the "Hey Jarvis" service when it wakes him. */
    static void queueAction(String action) {
        pendingAction = action;
    }

    static boolean isInForeground() {
        return inForeground;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceActionsPlugin.class);
        super.onCreate(savedInstanceState);
    }

    // BridgeActivity also routes the launch intent through here from onCreate,
    // so this covers both a cold start and an already-running app.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String action = actionFor(intent);
        if (action != null) {
            pendingAction = action;
            DeviceActionsPlugin.emitAssist();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        inForeground = true;
    }

    @Override
    public void onPause() {
        inForeground = false;
        super.onPause();
    }

    private static String actionFor(Intent intent) {
        if (intent == null || intent.getAction() == null) return null;
        String action = intent.getAction();
        if (Intent.ACTION_ASSIST.equals(action)
            || Intent.ACTION_VOICE_COMMAND.equals(action)
            || "android.intent.action.SEARCH_LONG_PRESS".equals(action)
            || "com.jarvis.secretary.TALK".equals(action)) return "talk";
        if ("com.jarvis.secretary.BRIEFING".equals(action)) return "briefing";
        if ("com.jarvis.secretary.PLANNER".equals(action)) return "planner";
        return null;
    }
}
