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
}
