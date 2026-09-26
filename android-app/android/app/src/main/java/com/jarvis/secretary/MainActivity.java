package com.jarvis.secretary;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceActionsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
