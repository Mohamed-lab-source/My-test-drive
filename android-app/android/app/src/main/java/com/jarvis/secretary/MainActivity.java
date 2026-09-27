package com.jarvis.secretary;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Set when Jarvis is summoned as the device assistant (long-press home or
    // power, the assistant gesture, or a headset's voice-command button);
    // the JS side consumes it and starts listening immediately.
    private static volatile boolean pendingAssist = false;
    private static volatile boolean inForeground = false;

    static boolean consumePendingAssist() {
        boolean was = pendingAssist;
        pendingAssist = false;
        return was;
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
        if (isAssistIntent(intent)) {
            pendingAssist = true;
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

    private static boolean isAssistIntent(Intent intent) {
        if (intent == null || intent.getAction() == null) return false;
        String action = intent.getAction();
        return Intent.ACTION_ASSIST.equals(action)
            || Intent.ACTION_VOICE_COMMAND.equals(action)
            || "android.intent.action.SEARCH_LONG_PRESS".equals(action);
    }
}
