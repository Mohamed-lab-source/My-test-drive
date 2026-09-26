package com.jarvis.secretary;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.provider.AlarmClock;
import android.telephony.SmsManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

/**
 * Native "hands" for Jarvis: the real device actions that make it feel like
 * an assistant instead of a chat window.
 *
 * dialNumber/sendSms/setAlarm/setTimer use standard Android intents — they
 * hand off to the dialer/messaging/clock app's own UI, so the user still
 * taps to confirm and no dangerous permission is needed. sendSmsDirect and
 * callNumberDirect skip that confirmation entirely (the user asked for
 * this): they require the SEND_SMS / CALL_PHONE runtime permissions, which
 * are fine to self-grant on a personal sideloaded app but would be
 * Play-Store-restricted permissions on a publicly distributed app.
 */
@CapacitorPlugin(
    name = "DeviceActions",
    permissions = {
        @Permission(strings = { android.Manifest.permission.SEND_SMS }, alias = "sms"),
        @Permission(strings = { android.Manifest.permission.CALL_PHONE }, alias = "call"),
    }
)
public class DeviceActionsPlugin extends Plugin {

    @PluginMethod
    public void dialNumber(PluginCall call) {
        String number = call.getString("number");
        if (number == null || number.isEmpty()) {
            call.reject("A phone number is required");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(number)));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        JSObject ret = new JSObject();
        ret.put("opened", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void sendSms(PluginCall call) {
        String number = call.getString("number");
        String message = call.getString("message", "");
        if (number == null || number.isEmpty()) {
            call.reject("A phone number is required");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(number)));
        intent.putExtra("sms_body", message);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        JSObject ret = new JSObject();
        ret.put("opened", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void callNumberDirect(PluginCall call) {
        if (getPermissionState("call") != PermissionState.GRANTED) {
            requestPermissionForAlias("call", call, "callPermsCallback");
            return;
        }
        placeCall(call);
    }

    @PermissionCallback
    private void callPermsCallback(PluginCall call) {
        if (getPermissionState("call") == PermissionState.GRANTED) {
            placeCall(call);
        } else {
            call.reject("Call permission was denied. Ask the user to grant it in Android Settings, or use dial_number instead.");
        }
    }

    private void placeCall(PluginCall call) {
        String number = call.getString("number");
        if (number == null || number.isEmpty()) {
            call.reject("A phone number is required");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + Uri.encode(number)));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        JSObject ret = new JSObject();
        ret.put("calling", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void sendSmsDirect(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermsCallback");
            return;
        }
        transmitSms(call);
    }

    @PermissionCallback
    private void smsPermsCallback(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            transmitSms(call);
        } else {
            call.reject("SMS permission was denied. Ask the user to grant it in Android Settings, or use send_sms instead.");
        }
    }

    private void transmitSms(PluginCall call) {
        String number = call.getString("number");
        String message = call.getString("message", "");
        if (number == null || number.isEmpty()) {
            call.reject("A phone number is required");
            return;
        }
        try {
            SmsManager smsManager = SmsManager.getDefault();
            ArrayList<String> parts = smsManager.divideMessage(message);
            smsManager.sendMultipartTextMessage(number, null, parts, null, null);
            JSObject ret = new JSObject();
            ret.put("sent", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Couldn't send the text: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setAlarm(PluginCall call) {
        Integer hour = call.getInt("hour");
        Integer minute = call.getInt("minute");
        String label = call.getString("label", "Jarvis reminder");
        if (hour == null || minute == null) {
            call.reject("hour and minute are required");
            return;
        }
        Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM);
        intent.putExtra(AlarmClock.EXTRA_HOUR, hour);
        intent.putExtra(AlarmClock.EXTRA_MINUTES, minute);
        intent.putExtra(AlarmClock.EXTRA_MESSAGE, label);
        intent.putExtra(AlarmClock.EXTRA_SKIP_UI, false);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        JSObject ret = new JSObject();
        ret.put("opened", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void setTimer(PluginCall call) {
        Integer seconds = call.getInt("seconds");
        String label = call.getString("label", "Jarvis timer");
        if (seconds == null || seconds <= 0) {
            call.reject("A positive number of seconds is required");
            return;
        }
        Intent intent = new Intent(AlarmClock.ACTION_SET_TIMER);
        intent.putExtra(AlarmClock.EXTRA_LENGTH, seconds);
        intent.putExtra(AlarmClock.EXTRA_MESSAGE, label);
        intent.putExtra(AlarmClock.EXTRA_SKIP_UI, true);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void setFlashlight(PluginCall call) {
        Boolean on = call.getBoolean("on", true);
        CameraManager cameraManager = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
        try {
            String torchId = null;
            for (String id : cameraManager.getCameraIdList()) {
                CameraCharacteristics chars = cameraManager.getCameraCharacteristics(id);
                Boolean hasFlash = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (hasFlash != null && hasFlash) {
                    torchId = id;
                    break;
                }
            }
            if (torchId == null) {
                call.reject("This device has no flashlight");
                return;
            }
            cameraManager.setTorchMode(torchId, on);
            JSObject ret = new JSObject();
            ret.put("on", on);
            call.resolve(ret);
        } catch (CameraAccessException e) {
            call.reject("Couldn't access the flashlight: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getBatteryStatus(PluginCall call) {
        IntentFilter filter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        Intent battery = getContext().registerReceiver(null, filter);
        JSObject ret = new JSObject();
        if (battery == null) {
            ret.put("level", -1);
            ret.put("charging", false);
            call.resolve(ret);
            return;
        }
        int level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        int status = battery.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL;
        int percent = (level >= 0 && scale > 0) ? Math.round(100f * level / scale) : -1;
        ret.put("level", percent);
        ret.put("charging", charging);
        call.resolve(ret);
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("A URL is required");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        JSObject ret = new JSObject();
        ret.put("opened", true);
        call.resolve(ret);
    }
}
