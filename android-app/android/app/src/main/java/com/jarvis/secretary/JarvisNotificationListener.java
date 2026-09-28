package com.jarvis.secretary;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;

import com.getcapacitor.JSObject;

import org.json.JSONTokener;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;

/**
 * Jarvis's eyes on the phone: sees incoming messages from chat apps, keeps
 * the recent ones (with their direct-reply action) so Jarvis can read them
 * back and answer them by voice, and announces them out loud.
 *
 * When the app is on screen, new messages go to the JS side (which can
 * announce them in the premium voice). When it isn't, this service
 * announces them itself with the device voice, following the user's
 * announce setting (off / headphones only / always).
 *
 * Settings are read straight from the Capacitor Preferences store
 * ("CapacitorStorage", keys prefixed "jarvis:", values JSON-encoded).
 */
public class JarvisNotificationListener extends NotificationListenerService {

    static final class Entry {
        String id;
        String key;
        String pkg;
        String app;
        String from;
        String text;
        long time;
        Notification.Action replyAction;
    }

    private static final int MAX_ENTRIES = 60;
    private static final LinkedList<Entry> recent = new LinkedList<>();
    private static long counter = 0;

    private static final Set<String> MESSAGING_APPS = new HashSet<>(Arrays.asList(
        "com.whatsapp", "com.whatsapp.w4b", "org.telegram.messenger", "org.thunderdog.challegram",
        "com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms",
        "com.facebook.orca", "com.facebook.mlite", "com.instagram.android", "com.snapchat.android",
        "com.discord", "com.Slack", "com.viber.voip", "org.thoughtcrime.securesms",
        "com.microsoft.teams", "com.google.android.apps.dynamite", "jp.naver.line.android",
        "com.skype.raider", "com.imo.android.imoim"
    ));

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private static volatile JarvisNotificationListener connected;

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        connected = this;
        tts = new TextToSpeech(this, status -> ttsReady = status == TextToSpeech.SUCCESS);
    }

    @Override
    public void onListenerDisconnected() {
        connected = null;
        shutdownTts();
        super.onListenerDisconnected();
    }

    /**
     * Do Not Disturb, via the listener's own privilege: an enabled
     * notification listener may change the interruption filter without the
     * separate DND-access permission. "Priority only" keeps alarms working.
     * Returns false when the listener isn't connected (access not granted).
     */
    static boolean setDoNotDisturb(boolean on) {
        JarvisNotificationListener l = connected;
        if (l == null) return false;
        l.requestInterruptionFilter(on ? INTERRUPTION_FILTER_PRIORITY : INTERRUPTION_FILTER_ALL);
        return true;
    }

    static Boolean isDoNotDisturbOn() {
        JarvisNotificationListener l = connected;
        if (l == null) return null;
        return l.getCurrentInterruptionFilter() != INTERRUPTION_FILTER_ALL;
    }

    @Override
    public void onDestroy() {
        shutdownTts();
        super.onDestroy();
    }

    private void shutdownTts() {
        if (tts != null) {
            tts.shutdown();
            tts = null;
            ttsReady = false;
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String pkg = sbn.getPackageName();
        if (pkg.equals(getPackageName())) return;
        Notification n = sbn.getNotification();
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        if (sbn.isOngoing()) return;
        boolean isMessage = MESSAGING_APPS.contains(pkg) || Notification.CATEGORY_MESSAGE.equals(n.category);
        if (!isMessage) return;

        Bundle extras = n.extras;
        CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence text = extras.getCharSequence(Notification.EXTRA_TEXT);
        String from = title != null ? title.toString() : null;

        // MessagingStyle notifications carry the actual latest message and,
        // in group chats, who sent it.
        Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messages != null && messages.length > 0 && messages[messages.length - 1] instanceof Bundle) {
            Bundle last = (Bundle) messages[messages.length - 1];
            CharSequence lastText = last.getCharSequence("text");
            CharSequence sender = last.getCharSequence("sender");
            if (lastText != null) text = lastText;
            if (sender != null && from != null && !sender.toString().equals(from)) {
                from = sender + " (" + from + ")";
            } else if (sender != null && from == null) {
                from = sender.toString();
            }
        }
        if (from == null || text == null) return;
        String body = text.toString().trim();
        if (body.isEmpty() || body.matches("^\\d+ new messages?$")) return;

        Entry entry = new Entry();
        entry.key = sbn.getKey();
        entry.pkg = pkg;
        entry.app = appLabel(pkg);
        entry.from = from;
        entry.text = body;
        entry.time = System.currentTimeMillis();
        entry.replyAction = findReplyAction(n);

        synchronized (recent) {
            // Chat apps re-post the same notification as it updates; skip exact repeats.
            for (Entry e : recent) {
                if (e.key.equals(entry.key) && e.text.equals(entry.text)) return;
            }
            entry.id = Long.toString(++counter);
            recent.addFirst(entry);
            while (recent.size() > MAX_ENTRIES) recent.removeLast();
        }

        boolean headphones = headphonesConnected();
        if (MainActivity.isInForeground()) {
            JSObject data = toJs(entry);
            data.put("headphones", headphones);
            DeviceActionsPlugin.emitNotification(data);
        } else {
            maybeAnnounce(entry, headphones);
        }
    }

    private void maybeAnnounce(Entry entry, boolean headphones) {
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String mode = pref(prefs, "announceMode", "headphones");
        // VIPs ("always tell me when Mom messages") are announced whatever the mode.
        boolean vip = isVip(prefs, entry.from);
        if (!vip && "off".equals(mode)) return;
        if (!vip && "headphones".equals(mode) && !headphones) return;
        if (tts == null || !ttsReady) return;

        String address = pref(prefs, "address", "sir");
        String spokenAddress = address.isEmpty() ? "" : Character.toUpperCase(address.charAt(0)) + address.substring(1) + ", ";
        String text = entry.text.length() > 160 ? entry.text.substring(0, 157) + "..." : entry.text;
        String line = spokenAddress + entry.app + " from " + entry.from + ": " + text;

        String voiceName = pref(prefs, "voiceName", "");
        if (!voiceName.isEmpty()) {
            try {
                for (Voice v : tts.getVoices()) {
                    if (v.getName().equals(voiceName)) { tts.setVoice(v); break; }
                }
            } catch (Exception ignored) {}
        }
        tts.setPitch(prefFloat(prefs, "pitch", 1.0f));
        tts.setSpeechRate(prefFloat(prefs, "rate", 1.0f));
        tts.speak(line, TextToSpeech.QUEUE_ADD, null, "jarvis-" + entry.id);
    }

    private static Notification.Action findReplyAction(Notification n) {
        if (n.actions != null) {
            for (Notification.Action a : n.actions) {
                if (a.getRemoteInputs() != null && a.getRemoteInputs().length > 0) return a;
            }
        }
        try {
            for (Notification.Action a : new Notification.WearableExtender(n).getActions()) {
                if (a.getRemoteInputs() != null && a.getRemoteInputs().length > 0) return a;
            }
        } catch (Exception ignored) {}
        return null;
    }

    private boolean headphonesConnected() {
        AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return false;
        for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            int t = d.getType();
            if (t == AudioDeviceInfo.TYPE_WIRED_HEADSET || t == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
                || t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || t == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
                || t == AudioDeviceInfo.TYPE_USB_HEADSET || t == AudioDeviceInfo.TYPE_BLE_HEADSET) {
                return true;
            }
        }
        return false;
    }

    private String appLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(info).toString();
        } catch (Exception e) {
            return "A message";
        }
    }

    private static boolean isVip(SharedPreferences prefs, String from) {
        String raw = prefs.getString("jarvis:vips", null);
        if (raw == null || from == null) return false;
        try {
            org.json.JSONArray arr = new org.json.JSONArray(raw);
            String f = from.toLowerCase();
            for (int i = 0; i < arr.length(); i++) {
                String v = arr.optString(i, "").toLowerCase().trim();
                if (!v.isEmpty() && (f.equals(v) || f.contains(v))) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    private static String pref(SharedPreferences prefs, String key, String fallback) {
        String raw = prefs.getString("jarvis:" + key, null);
        if (raw == null) return fallback;
        try {
            Object value = new JSONTokener(raw).nextValue();
            return value == null ? fallback : value.toString();
        } catch (Exception e) {
            return fallback;
        }
    }

    private static float prefFloat(SharedPreferences prefs, String key, float fallback) {
        try {
            return Float.parseFloat(pref(prefs, key, Float.toString(fallback)));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    static JSObject toJs(Entry e) {
        JSObject o = new JSObject();
        o.put("id", e.id);
        o.put("app", e.app);
        o.put("from", e.from);
        o.put("text", e.text);
        o.put("time", e.time);
        o.put("canReply", e.replyAction != null);
        return o;
    }

    static List<Entry> snapshot() {
        synchronized (recent) {
            return new ArrayList<>(recent);
        }
    }

    static Entry find(String id) {
        synchronized (recent) {
            for (Entry e : recent) if (e.id.equals(id)) return e;
        }
        return null;
    }
}
