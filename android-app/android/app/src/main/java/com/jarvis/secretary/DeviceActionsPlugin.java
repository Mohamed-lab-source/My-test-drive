package com.jarvis.secretary;

import android.app.PendingIntent;
import android.app.RemoteInput;
import android.app.SearchManager;
import android.app.role.RoleManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.app.ActivityManager;
import android.database.Cursor;
import android.media.AudioManager;
import android.os.Environment;
import android.os.StatFs;
import android.provider.CallLog;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.provider.Settings;
import android.telephony.PhoneNumberUtils;
import android.telephony.TelephonyManager;
import android.view.KeyEvent;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.provider.AlarmClock;
import android.telephony.SmsManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

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
        @Permission(strings = { android.Manifest.permission.READ_CALL_LOG }, alias = "calllog"),
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

    /* ------------------------------------------------------------------ *
     * Plumbing for native -> JS events
     * ------------------------------------------------------------------ */
    private static volatile DeviceActionsPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    static void emitAssist() {
        DeviceActionsPlugin p = instance;
        if (p != null) p.notifyListeners("assist", new JSObject());
    }

    static void emitNotification(JSObject data) {
        DeviceActionsPlugin p = instance;
        if (p != null) p.notifyListeners("notification", data);
    }

    private boolean tryStart(Intent intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException | SecurityException e) {
            return false;
        }
    }

    /* ------------------------------------------------------------------ *
     * Summon from anywhere — Jarvis as the device's assistant app
     * ------------------------------------------------------------------ */
    @PluginMethod
    public void consumeAssistLaunch(PluginCall call) {
        String action = MainActivity.consumePendingAction();
        JSObject ret = new JSObject();
        ret.put("assist", action != null);
        ret.put("action", action);
        call.resolve(ret);
    }

    @PluginMethod
    public void getAssistantStatus(PluginCall call) {
        boolean held = false;
        if (Build.VERSION.SDK_INT >= 29) {
            RoleManager rm = getContext().getSystemService(RoleManager.class);
            if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_ASSISTANT)) held = rm.isRoleHeld(RoleManager.ROLE_ASSISTANT);
        }
        JSObject ret = new JSObject();
        ret.put("isDefault", held);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAssistantSettings(PluginCall call) {
        boolean ok = tryStart(new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS))
            || tryStart(new Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
            || tryStart(new Intent(Settings.ACTION_SETTINGS));
        if (ok) call.resolve(); else call.reject("Couldn't open assistant settings");
    }

    /* ------------------------------------------------------------------ *
     * Running the phone
     * ------------------------------------------------------------------ */
    @PluginMethod
    public void openApp(PluginCall call) {
        String name = call.getString("name", "").trim().toLowerCase(Locale.ROOT);
        if (name.isEmpty()) { call.reject("Which app?"); return; }
        PackageManager pm = getContext().getPackageManager();
        Intent main = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> apps = pm.queryIntentActivities(main, 0);
        ResolveInfo best = null;
        String bestLabel = null;
        int bestScore = 0;
        for (ResolveInfo ri : apps) {
            String label = ri.loadLabel(pm).toString();
            String l = label.toLowerCase(Locale.ROOT);
            int score = l.equals(name) ? 3 : l.startsWith(name) ? 2 : l.contains(name) ? 1 : 0;
            if (score > bestScore) { best = ri; bestLabel = label; bestScore = score; }
        }
        if (best == null) { call.reject("No installed app called \"" + name + "\""); return; }
        Intent launch = pm.getLaunchIntentForPackage(best.activityInfo.packageName);
        if (launch == null || !tryStart(launch)) { call.reject("Couldn't open " + bestLabel); return; }
        JSObject ret = new JSObject();
        ret.put("opened", bestLabel);
        call.resolve(ret);
    }

    @PluginMethod
    public void playMusic(PluginCall call) {
        String query = call.getString("query", "").trim();
        if (query.isEmpty()) {
            sendMediaKey(KeyEvent.KEYCODE_MEDIA_PLAY);
            JSObject ret = new JSObject();
            ret.put("resumed", true);
            call.resolve(ret);
            return;
        }
        Intent intent = new Intent(MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH);
        intent.putExtra(MediaStore.EXTRA_MEDIA_FOCUS, "vnd.android.cursor.item/*");
        intent.putExtra(SearchManager.QUERY, query);
        if (!tryStart(intent)) { call.reject("No music app on this phone handles voice search"); return; }
        JSObject ret = new JSObject();
        ret.put("playing", query);
        call.resolve(ret);
    }

    private void sendMediaKey(int keyCode) {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        long now = SystemClock.uptimeMillis();
        am.dispatchMediaKeyEvent(new KeyEvent(now, now, KeyEvent.ACTION_DOWN, keyCode, 0));
        am.dispatchMediaKeyEvent(new KeyEvent(now, now, KeyEvent.ACTION_UP, keyCode, 0));
    }

    @PluginMethod
    public void mediaControl(PluginCall call) {
        String action = call.getString("action", "play_pause");
        int code;
        if ("play".equals(action)) code = KeyEvent.KEYCODE_MEDIA_PLAY;
        else if ("pause".equals(action)) code = KeyEvent.KEYCODE_MEDIA_PAUSE;
        else if ("next".equals(action)) code = KeyEvent.KEYCODE_MEDIA_NEXT;
        else if ("previous".equals(action)) code = KeyEvent.KEYCODE_MEDIA_PREVIOUS;
        else code = KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE;
        sendMediaKey(code);
        JSObject ret = new JSObject();
        ret.put("sent", action);
        call.resolve(ret);
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        int pct = Math.max(0, Math.min(100, call.getInt("percent", 50)));
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        try {
            int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            am.setStreamVolume(AudioManager.STREAM_MUSIC, Math.round(max * pct / 100f), AudioManager.FLAG_SHOW_UI);
        } catch (SecurityException e) {
            call.reject("Android won't let me change the volume while Do Not Disturb is on");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("volume", pct);
        call.resolve(ret);
    }

    @PluginMethod
    public void navigate(PluginCall call) {
        String dest = call.getString("destination", "").trim();
        if (dest.isEmpty()) { call.reject("Navigate where?"); return; }
        String mode = call.getString("mode", "driving");
        String m = "walking".equals(mode) ? "w" : "bicycling".equals(mode) ? "b" : "d";
        Intent maps = new Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=" + Uri.encode(dest) + "&mode=" + m));
        maps.setPackage("com.google.android.apps.maps");
        boolean ok = tryStart(maps) || tryStart(new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(dest))));
        if (!ok) { call.reject("No maps app installed"); return; }
        JSObject ret = new JSObject();
        ret.put("navigatingTo", dest);
        call.resolve(ret);
    }

    @PluginMethod
    public void openWhatsAppChat(PluginCall call) {
        String number = call.getString("number", "").trim();
        String message = call.getString("message", "");
        if (number.isEmpty()) { call.reject("A phone number is required"); return; }
        String digits = toE164(number).replaceAll("[^0-9]", "");
        Uri uri = Uri.parse("https://wa.me/" + digits + (message.isEmpty() ? "" : "?text=" + Uri.encode(message)));
        Intent wa = new Intent(Intent.ACTION_VIEW, uri).setPackage("com.whatsapp");
        Intent waBiz = new Intent(Intent.ACTION_VIEW, uri).setPackage("com.whatsapp.w4b");
        if (!(tryStart(wa) || tryStart(waBiz) || tryStart(new Intent(Intent.ACTION_VIEW, uri)))) {
            call.reject("WhatsApp isn't installed");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("opened", true);
        call.resolve(ret);
    }

    // Local numbers ("010...") need a country code for wa.me; use the SIM's.
    private String toE164(String raw) {
        if (raw.startsWith("+")) return raw;
        if (raw.startsWith("00")) return "+" + raw.substring(2);
        TelephonyManager tm = (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
        String iso = tm != null ? tm.getSimCountryIso() : "";
        if ((iso == null || iso.isEmpty()) && tm != null) iso = tm.getNetworkCountryIso();
        if (iso == null || iso.isEmpty()) iso = Locale.getDefault().getCountry();
        String formatted = PhoneNumberUtils.formatNumberToE164(raw, iso.toUpperCase(Locale.ROOT));
        return formatted != null ? formatted : raw;
    }

    @PluginMethod
    public void openSettingsPanel(PluginCall call) {
        String panel = call.getString("panel", "");
        Intent intent;
        boolean q = Build.VERSION.SDK_INT >= 29;
        switch (panel) {
            case "wifi": intent = new Intent(q ? Settings.Panel.ACTION_WIFI : Settings.ACTION_WIFI_SETTINGS); break;
            case "internet": intent = new Intent(q ? Settings.Panel.ACTION_INTERNET_CONNECTIVITY : Settings.ACTION_WIRELESS_SETTINGS); break;
            case "bluetooth": intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS); break;
            case "volume": intent = new Intent(q ? Settings.Panel.ACTION_VOLUME : Settings.ACTION_SOUND_SETTINGS); break;
            case "nfc": intent = new Intent(q ? Settings.Panel.ACTION_NFC : Settings.ACTION_NFC_SETTINGS); break;
            case "display": intent = new Intent(Settings.ACTION_DISPLAY_SETTINGS); break;
            default: intent = new Intent(Settings.ACTION_SETTINGS);
        }
        if (!tryStart(intent)) { call.reject("Couldn't open that panel"); return; }
        JSObject ret = new JSObject();
        ret.put("opened", panel);
        call.resolve(ret);
    }

    @PluginMethod
    public void webSearch(PluginCall call) {
        String query = call.getString("query", "").trim();
        Intent search = new Intent(Intent.ACTION_WEB_SEARCH);
        search.putExtra(SearchManager.QUERY, query);
        boolean ok = tryStart(search)
            || tryStart(new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + Uri.encode(query))));
        if (ok) call.resolve(); else call.reject("No browser available");
    }

    /* ------------------------------------------------------------------ *
     * Watching the phone — incoming messages via JarvisNotificationListener
     * ------------------------------------------------------------------ */
    private boolean notificationAccessGranted() {
        String flat = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        ComponentName me = new ComponentName(getContext(), JarvisNotificationListener.class);
        return flat != null && flat.contains(me.flattenToString());
    }

    @PluginMethod
    public void getNotificationAccess(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", notificationAccessGranted());
        call.resolve(ret);
    }

    @PluginMethod
    public void openNotificationAccessSettings(PluginCall call) {
        boolean ok = false;
        if (Build.VERSION.SDK_INT >= 30) {
            Intent detail = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            detail.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                new ComponentName(getContext(), JarvisNotificationListener.class).flattenToString());
            ok = tryStart(detail);
        }
        if (!ok) ok = tryStart(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
        if (ok) call.resolve(); else call.reject("Couldn't open notification access settings");
    }

    @PluginMethod
    public void openAppDetails(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        if (tryStart(intent)) call.resolve(); else call.reject("Couldn't open app info");
    }

    @PluginMethod
    public void getRecentNotifications(PluginCall call) {
        if (!notificationAccessGranted()) {
            call.reject("NO_ACCESS");
            return;
        }
        long cutoff = System.currentTimeMillis() - call.getInt("sinceMinutes", 180) * 60_000L;
        JSArray list = new JSArray();
        for (JarvisNotificationListener.Entry e : JarvisNotificationListener.snapshot()) {
            if (e.time >= cutoff) list.put(JarvisNotificationListener.toJs(e));
        }
        JSObject ret = new JSObject();
        ret.put("messages", list);
        call.resolve(ret);
    }

    @PluginMethod
    public void replyToNotification(PluginCall call) {
        String id = call.getString("id", "");
        String text = call.getString("message", "");
        JarvisNotificationListener.Entry e = JarvisNotificationListener.find(id);
        if (e == null) { call.reject("That message isn't available any more; it may have been dismissed"); return; }
        if (e.replyAction == null) { call.reject(e.app + " doesn't allow direct replies from notifications"); return; }
        RemoteInput[] inputs = e.replyAction.getRemoteInputs();
        Intent fill = new Intent();
        Bundle results = new Bundle();
        for (RemoteInput ri : inputs) results.putCharSequence(ri.getResultKey(), text);
        RemoteInput.addResultsToIntent(inputs, fill, results);
        try {
            e.replyAction.actionIntent.send(getContext(), 0, fill);
        } catch (PendingIntent.CanceledException ex) {
            call.reject("That conversation was closed; open " + e.app + " to reply");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("replied", e.from);
        ret.put("app", e.app);
        call.resolve(ret);
    }

    /* ------------------------------------------------------------------ *
     * Call log
     * ------------------------------------------------------------------ */
    @PluginMethod
    public void getCallLog(PluginCall call) {
        if (getPermissionState("calllog") != PermissionState.GRANTED) {
            requestPermissionForAlias("calllog", call, "callLogPermsCallback");
            return;
        }
        readCallLog(call);
    }

    @PermissionCallback
    private void callLogPermsCallback(PluginCall call) {
        if (getPermissionState("calllog") == PermissionState.GRANTED) readCallLog(call);
        else call.reject("Call log permission was denied. It can be granted in App info → Permissions → Call logs.");
    }

    private void readCallLog(PluginCall call) {
        int limit = Math.max(1, Math.min(50, call.getInt("limit", 15)));
        boolean onlyMissed = Boolean.TRUE.equals(call.getBoolean("onlyMissed", false));
        String[] projection = { CallLog.Calls.NUMBER, CallLog.Calls.CACHED_NAME, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION };
        String selection = onlyMissed ? CallLog.Calls.TYPE + " = " + CallLog.Calls.MISSED_TYPE : null;
        JSArray calls = new JSArray();
        try (Cursor c = getContext().getContentResolver().query(CallLog.Calls.CONTENT_URI, projection, selection, null, CallLog.Calls.DATE + " DESC")) {
            while (c != null && c.moveToNext() && calls.length() < limit) {
                JSObject o = new JSObject();
                String name = c.getString(1);
                int type = c.getInt(2);
                o.put("number", c.getString(0));
                o.put("name", name == null || name.isEmpty() ? null : name);
                o.put("type", type == CallLog.Calls.MISSED_TYPE ? "missed" : type == CallLog.Calls.INCOMING_TYPE ? "incoming"
                    : type == CallLog.Calls.OUTGOING_TYPE ? "outgoing" : type == CallLog.Calls.REJECTED_TYPE ? "rejected" : "other");
                o.put("time", c.getLong(3));
                o.put("durationSec", c.getLong(4));
                calls.put(o);
            }
        } catch (SecurityException e) {
            call.reject("Call log permission was denied");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("calls", calls);
        call.resolve(ret);
    }

    /* ------------------------------------------------------------------ *
     * Do Not Disturb (through the notification listener's privilege)
     * ------------------------------------------------------------------ */
    @PluginMethod
    public void setDoNotDisturb(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        if (!JarvisNotificationListener.setDoNotDisturb(on)) {
            call.reject("NO_ACCESS");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("doNotDisturb", on);
        call.resolve(ret);
    }

    /* ------------------------------------------------------------------ *
     * Diagnostics
     * ------------------------------------------------------------------ */
    @PluginMethod
    public void getSystemStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("device", Build.MANUFACTURER + " " + Build.MODEL);
        ret.put("android", Build.VERSION.RELEASE);
        StatFs fs = new StatFs(Environment.getDataDirectory().getPath());
        ret.put("storageFreeGB", Math.round(fs.getAvailableBytes() / 1e8) / 10.0);
        ret.put("storageTotalGB", Math.round(fs.getTotalBytes() / 1e8) / 10.0);
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mem = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mem);
        ret.put("ramFreeGB", Math.round(mem.availMem / 1e8) / 10.0);
        ret.put("ramTotalGB", Math.round(mem.totalMem / 1e8) / 10.0);
        ret.put("lowMemory", mem.lowMemory);
        Intent battery = getContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (battery != null) {
            int level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            ret.put("batteryPercent", level >= 0 && scale > 0 ? Math.round(100f * level / scale) : -1);
            ret.put("batteryTempC", battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) / 10.0);
            int health = battery.getIntExtra(BatteryManager.EXTRA_HEALTH, 0);
            ret.put("batteryHealth", health == BatteryManager.BATTERY_HEALTH_GOOD ? "good"
                : health == BatteryManager.BATTERY_HEALTH_OVERHEAT ? "overheating"
                : health == BatteryManager.BATTERY_HEALTH_DEAD ? "dead" : "unknown");
        }
        ret.put("uptimeHours", Math.round(SystemClock.elapsedRealtime() / 360000.0) / 10.0);
        Boolean dnd = JarvisNotificationListener.isDoNotDisturbOn();
        if (dnd != null) ret.put("doNotDisturb", dnd);
        call.resolve(ret);
    }

    /* ---------------- "Hey Jarvis" wake word ---------------- */

    @PluginMethod
    public void setWakeWord(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        Context ctx = getContext();
        Intent svc = new Intent(ctx, WakeWordService.class);
        if (!enabled) {
            ctx.stopService(svc);
            JSObject ret = new JSObject();
            ret.put("running", false);
            call.resolve(ret);
            return;
        }
        if (Build.VERSION.SDK_INT < 26) { call.reject("UNSUPPORTED"); return; }
        svc.putExtra("sensitivity", call.getString("sensitivity", "normal"));
        WakeWordService.setSensitivity(call.getString("sensitivity", "normal"));
        if (ctx.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            call.reject("NO_MIC");
            return;
        }
        try {
            ctx.startForegroundService(svc);
        } catch (Exception e) {
            call.reject("Could not start listening: " + e.getMessage());
            return;
        }
        JSObject ret = new JSObject();
        ret.put("running", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void setWakeWordPaused(PluginCall call) {
        if (Boolean.TRUE.equals(call.getBoolean("paused", true))) {
            WakeWordService.pause(call.getInt("ms", 60000));
        } else {
            WakeWordService.resume();
        }
        JSObject ret = new JSObject();
        ret.put("running", WakeWordService.isRunning());
        call.resolve(ret);
    }

    @PluginMethod
    public void getWakeWordStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", WakeWordService.isRunning());
        ret.put("canPopUp", Build.VERSION.SDK_INT < 29 || Settings.canDrawOverlays(getContext()));
        ret.put("stage", WakeWordService.stage);
        ret.put("error", WakeWordService.lastError);
        ret.put("level", WakeWordService.level);
        ret.put("peakScore", WakeWordService.peakScore);
        ret.put("detections", WakeWordService.detections);
        ret.put("lastDetection", WakeWordService.lastDetection);
        ret.put("lastWakeRoute", WakeWordService.lastWakeRoute);
        android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        ret.put("batteryUnrestricted", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(ret);
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (!tryStart(i)) {
            Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (!tryStart(fallback)) { call.reject("Could not open battery settings"); return; }
        }
        call.resolve();
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open the setting: " + e.getMessage());
        }
    }

    /* ---------------- Screen time ---------------- */

    private boolean hasUsageAccess() {
        android.app.AppOpsManager ops = (android.app.AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        if (ops == null) return false;
        int mode = Build.VERSION.SDK_INT >= 29
            ? ops.unsafeCheckOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), getContext().getPackageName())
            : ops.checkOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), getContext().getPackageName());
        return mode == android.app.AppOpsManager.MODE_ALLOWED;
    }

    /** Foreground time per app between start and end, built from resume/pause events (more exact than daily buckets). */
    @PluginMethod
    public void getAppUsage(PluginCall call) {
        if (!hasUsageAccess()) { call.reject("NO_ACCESS"); return; }
        long end = call.getLong("end", System.currentTimeMillis());
        long start = call.getLong("start", end - 24L * 3600 * 1000);
        android.app.usage.UsageStatsManager usm = (android.app.usage.UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) { call.reject("Usage stats unavailable"); return; }
        java.util.HashMap<String, Long> total = new java.util.HashMap<>();
        java.util.HashMap<String, Long> openedAt = new java.util.HashMap<>();
        java.util.HashMap<String, Integer> opens = new java.util.HashMap<>();
        android.app.usage.UsageEvents events = usm.queryEvents(start, end);
        android.app.usage.UsageEvents.Event e = new android.app.usage.UsageEvents.Event();
        String current = null;
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            String pkg = e.getPackageName();
            int type = e.getEventType();
            if (type == 1) { // ACTIVITY_RESUMED / MOVE_TO_FOREGROUND
                if (current != null && !current.equals(pkg) && openedAt.containsKey(current)) {
                    total.put(current, total.getOrDefault(current, 0L) + (e.getTimeStamp() - openedAt.remove(current)));
                }
                if (!pkg.equals(current)) opens.put(pkg, opens.getOrDefault(pkg, 0) + 1);
                openedAt.put(pkg, e.getTimeStamp());
                current = pkg;
            } else if (type == 2 || type == 23) { // ACTIVITY_PAUSED / ACTIVITY_STOPPED
                Long t0 = openedAt.remove(pkg);
                if (t0 != null) total.put(pkg, total.getOrDefault(pkg, 0L) + (e.getTimeStamp() - t0));
                if (pkg.equals(current)) current = null;
            }
        }
        for (java.util.Map.Entry<String, Long> open : openedAt.entrySet()) {
            total.put(open.getKey(), total.getOrDefault(open.getKey(), 0L) + (end - open.getValue()));
        }
        PackageManager pm = getContext().getPackageManager();
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        java.util.HashSet<String> launchers = new java.util.HashSet<>();
        for (ResolveInfo ri : pm.queryIntentActivities(home, 0)) launchers.add(ri.activityInfo.packageName);
        JSArray apps = new JSArray();
        long sum = 0;
        java.util.ArrayList<java.util.Map.Entry<String, Long>> sorted = new java.util.ArrayList<>(total.entrySet());
        sorted.sort((a, b) -> Long.compare(b.getValue(), a.getValue()));
        for (java.util.Map.Entry<String, Long> en : sorted) {
            String pkg = en.getKey();
            long ms = en.getValue();
            if (ms < 60000 || launchers.contains(pkg) || pkg.equals("com.android.systemui")) continue;
            sum += ms;
            if (apps.length() >= 15) continue;
            String label = pkg;
            try { label = pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString(); } catch (Exception ignored) {}
            JSObject a = new JSObject();
            a.put("app", label);
            a.put("package", pkg);
            a.put("minutes", Math.round(ms / 60000.0));
            a.put("opens", opens.getOrDefault(pkg, 0));
            apps.put(a);
        }
        JSObject ret = new JSObject();
        ret.put("totalMinutes", Math.round(sum / 60000.0));
        ret.put("apps", apps);
        call.resolve(ret);
    }

    @PluginMethod
    public void openUsageAccessSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        if (Build.VERSION.SDK_INT >= 29) i.setData(Uri.parse("package:" + getContext().getPackageName()));
        if (!tryStart(i) && !tryStart(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))) { call.reject("Could not open the setting"); return; }
        call.resolve();
    }

    /* ---------------- Ringer & brightness ---------------- */

    @PluginMethod
    public void setRingerMode(PluginCall call) {
        String mode = call.getString("mode", "normal");
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        android.app.NotificationManager nm = (android.app.NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        int target = "silent".equals(mode) ? AudioManager.RINGER_MODE_SILENT
            : "vibrate".equals(mode) ? AudioManager.RINGER_MODE_VIBRATE : AudioManager.RINGER_MODE_NORMAL;
        try {
            am.setRingerMode(target);
        } catch (SecurityException e) {
            // Leaving or entering silent needs "Do Not Disturb access".
            if (nm != null && !nm.isNotificationPolicyAccessGranted()) {
                tryStart(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS));
                call.reject("NO_POLICY_ACCESS");
                return;
            }
            call.reject("Couldn't change the ringer: " + e.getMessage());
            return;
        }
        int now = am.getRingerMode();
        JSObject ret = new JSObject();
        ret.put("ringer", now == AudioManager.RINGER_MODE_SILENT ? "silent" : now == AudioManager.RINGER_MODE_VIBRATE ? "vibrate" : "normal");
        call.resolve(ret);
    }

    @PluginMethod
    public void setBrightness(PluginCall call) {
        if (!Settings.System.canWrite(getContext())) {
            Intent i = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
            tryStart(i);
            call.reject("NO_WRITE_SETTINGS");
            return;
        }
        android.content.ContentResolver cr = getContext().getContentResolver();
        JSObject ret = new JSObject();
        if (Boolean.TRUE.equals(call.getBoolean("auto", false))) {
            Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC);
            ret.put("brightness", "auto");
            call.resolve(ret);
            return;
        }
        int pct = Math.max(1, Math.min(100, call.getInt("percent", 50)));
        Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL);
        // The slider feels logarithmic: map percent onto a gentle curve over 0-255.
        int value = (int) Math.round(255 * Math.pow(pct / 100.0, 2.2));
        Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS, Math.max(1, value));
        if (getActivity() != null) {
            final float level = Math.max(0.01f, value / 255f);
            getActivity().runOnUiThread(() -> {
                android.view.WindowManager.LayoutParams lp = getActivity().getWindow().getAttributes();
                lp.screenBrightness = level;
                getActivity().getWindow().setAttributes(lp);
            });
        }
        ret.put("brightness", pct);
        call.resolve(ret);
    }

    /* ---------------- Home-screen widget ---------------- */

    @PluginMethod
    public void updateWidget(PluginCall call) {
        JarvisWidget.refresh(getContext(), call.getString("line1", ""), call.getString("line2", ""), call.getString("line3", ""));
        call.resolve();
    }

    /* ---------------- Wake-up call ---------------- */

    @PluginMethod
    public void setWakeUpCall(PluginCall call) {
        android.content.SharedPreferences.Editor e = getContext().getSharedPreferences(WakeUpReceiver.PREFS, Context.MODE_PRIVATE).edit();
        e.putBoolean("enabled", Boolean.TRUE.equals(call.getBoolean("enabled", true)));
        e.putInt("hour", call.getInt("hour", 7));
        e.putInt("minute", call.getInt("minute", 0));
        e.putString("days", call.getString("days", "1234567"));
        e.apply();
        long next;
        try {
            next = WakeUpReceiver.schedule(getContext());
        } catch (SecurityException se) {
            // Android 12+: exact alarms need "Alarms & reminders" permission.
            if (Build.VERSION.SDK_INT >= 31) tryStart(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName())));
            call.reject("NO_EXACT_ALARM");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("next", next);
        call.resolve(ret);
    }

    /* ---------------- Lock the phone ---------------- */

    @PluginMethod
    public void lockPhone(PluginCall call) {
        android.app.admin.DevicePolicyManager dpm = (android.app.admin.DevicePolicyManager) getContext().getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(getContext(), JarvisAdmin.class);
        if (dpm == null) { call.reject("Unavailable"); return; }
        if (Boolean.TRUE.equals(call.getBoolean("checkOnly", false))) {
            JSObject ret = new JSObject();
            ret.put("enabled", dpm.isAdminActive(admin));
            call.resolve(ret);
            return;
        }
        if (!dpm.isAdminActive(admin)) {
            Intent i = new Intent(android.app.admin.DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            i.putExtra(android.app.admin.DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin);
            i.putExtra(android.app.admin.DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Lets Jarvis lock the screen when you ask. Nothing else.");
            tryStart(i);
            call.reject("NEEDS_ADMIN");
            return;
        }
        dpm.lockNow();
        call.resolve();
    }

    @PluginMethod
    public void removeLockPermission(PluginCall call) {
        android.app.admin.DevicePolicyManager dpm = (android.app.admin.DevicePolicyManager) getContext().getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(getContext(), JarvisAdmin.class);
        if (dpm != null && dpm.isAdminActive(admin)) dpm.removeActiveAdmin(admin);
        call.resolve();
    }

    /* ---------------- Vision: on-device labels + text ---------------- */

    @PluginMethod
    public void analyzeImage(PluginCall call) {
        String b64 = call.getString("base64", "");
        if (b64 == null || b64.isEmpty()) { call.reject("No image"); return; }
        int comma = b64.indexOf(',');
        if (b64.startsWith("data:") && comma > 0) b64 = b64.substring(comma + 1);
        android.graphics.Bitmap bmp;
        try {
            byte[] bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
            bmp = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) { call.reject("Couldn't read the photo"); return; }
        if (bmp == null) { call.reject("Couldn't read the photo"); return; }
        final android.graphics.Bitmap photo = bmp;
        com.google.mlkit.vision.common.InputImage image = com.google.mlkit.vision.common.InputImage.fromBitmap(photo, 0);
        com.google.mlkit.vision.label.ImageLabeler labeler = com.google.mlkit.vision.label.ImageLabeling.getClient(
            new com.google.mlkit.vision.label.defaults.ImageLabelerOptions.Builder().setConfidenceThreshold(0.55f).build());
        labeler.process(image).addOnCompleteListener(labelTask -> {
            JSArray labels = new JSArray();
            if (labelTask.isSuccessful() && labelTask.getResult() != null) {
                for (com.google.mlkit.vision.label.ImageLabel l : labelTask.getResult()) {
                    JSObject o = new JSObject();
                    o.put("label", l.getText());
                    o.put("confidence", Math.round(l.getConfidence() * 100));
                    labels.put(o);
                }
            }
            labeler.close();
            com.google.mlkit.vision.text.TextRecognizer reader = com.google.mlkit.vision.text.TextRecognition.getClient(
                com.google.mlkit.vision.text.latin.TextRecognizerOptions.DEFAULT_OPTIONS);
            reader.process(image).addOnCompleteListener(textTask -> {
                if (!labelTask.isSuccessful() && !textTask.isSuccessful()) {
                    // Play Services fetches the models on first use; until then both fail.
                    Exception err = textTask.getException() != null ? textTask.getException() : labelTask.getException();
                    reader.close();
                    call.reject("MODEL_NOT_READY: " + (err != null ? err.getMessage() : "unknown"));
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("labels", labels);
                String text = textTask.isSuccessful() && textTask.getResult() != null ? textTask.getResult().getText() : "";
                ret.put("text", text.length() > 3000 ? text.substring(0, 3000) : text);
                ret.put("width", photo.getWidth());
                ret.put("height", photo.getHeight());
                reader.close();
                call.resolve(ret);
            });
        });
    }

    /* ---------------- Background watchers ---------------- */

    @PluginMethod
    public void setWatches(PluginCall call) {
        JSArray list = call.getArray("watches", new JSArray());
        WatchWorker.sync(getContext(), list.toString());
        call.resolve();
    }

    @PluginMethod
    public void getWatchState(PluginCall call) {
        android.content.SharedPreferences p = getContext().getSharedPreferences(WatchWorker.PREFS, Context.MODE_PRIVATE);
        JSObject ret = new JSObject();
        ret.put("fired", p.getString("fired", "{}"));
        ret.put("lastRun", p.getLong("lastRun", 0));
        call.resolve(ret);
    }

    @PluginMethod
    public void clearWatchFired(PluginCall call) {
        android.content.SharedPreferences p = getContext().getSharedPreferences(WatchWorker.PREFS, Context.MODE_PRIVATE);
        String id = call.getString("id", "");
        try {
            org.json.JSONObject fired = new org.json.JSONObject(p.getString("fired", "{}"));
            fired.remove(id);
            p.edit().putString("fired", fired.toString()).apply();
        } catch (Exception ignored) {}
        call.resolve();
    }

    /* ---------------- Offline voice (Kokoro "Daniel") ---------------- */

    private static final java.util.concurrent.ExecutorService voiceExec = java.util.concurrent.Executors.newSingleThreadExecutor();
    private static int voiceSeq = 0;

    @PluginMethod
    public void voiceStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("installed", KokoroVoice.installed(getContext()));
        ret.put("crashed", KokoroVoice.crashedWhileLoading(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void voiceClearCrash(PluginCall call) {
        KokoroVoice.clearCrashFlag(getContext());
        call.resolve();
    }

    @PluginMethod
    public void voiceDownload(PluginCall call) {
        String url = call.getString("url", "");
        new Thread(() -> {
            try {
                KokoroVoice.download(getContext(), url, pct -> {
                    JSObject p = new JSObject();
                    p.put("percent", pct);
                    notifyListeners("voiceProgress", p);
                });
                call.resolve();
            } catch (Throwable t) {
                call.reject(t.getMessage() != null ? t.getMessage() : t.toString());
            }
        }, "jarvis-voice-download").start();
    }

    @PluginMethod
    public void voiceWarmup(PluginCall call) {
        voiceExec.execute(() -> {
            try { KokoroVoice.engine(getContext()); call.resolve(); }
            catch (Throwable t) { call.reject(String.valueOf(t.getMessage())); }
        });
    }

    @PluginMethod
    public void voiceSpeak(PluginCall call) {
        String text = call.getString("text", "");
        int speaker = call.getInt("speaker", 24);
        float speed = call.getFloat("speed", 1.0f);
        if (!KokoroVoice.installed(getContext())) { call.reject("NOT_INSTALLED"); return; }
        voiceExec.execute(() -> {
            try {
                java.io.File f = KokoroVoice.synthesize(getContext(), text, speaker, speed, "kokoro-" + ((voiceSeq++) % 6) + ".wav");
                JSObject ret = new JSObject();
                ret.put("path", f.getAbsolutePath());
                call.resolve(ret);
            } catch (Throwable t) {
                call.reject(t.getMessage() != null ? t.getMessage() : t.toString());
            }
        });
    }

    @PluginMethod
    public void voiceDelete(PluginCall call) {
        voiceExec.execute(() -> {
            KokoroVoice.release();
            KokoroVoice.deleteRecursive(KokoroVoice.packDir(getContext()));
            call.resolve();
        });
    }
}
