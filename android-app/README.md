# Jarvis — native Android app

A real Android app (an APK you install directly on your phone — no Play
Store, no PWA, no browser tab). Voice + text chat, morning briefings, real
Google Calendar, commute checks, and reminders that fire as genuine OS
notifications even when the app is closed.

Brain: **Grok** (xAI). Voice: your phone's native speech recognizer and
text-to-speech.

## 1. Get the APK

Every push to this project automatically builds the APK on GitHub's
servers (no Android tooling needed on your end):

1. Go to the repo's **Actions** tab → open the latest **"Build Jarvis APK"** run.
2. Once it's green, scroll to **Artifacts** → download **jarvis-debug-apk**
   (or check the repo's **Releases** page for the always-current
   `jarvis-latest` release with the APK attached).
3. Transfer `app-debug.apk` to your phone (email it to yourself, Google
   Drive, USB cable — whatever's easiest).
4. On your phone, tap the file to install. Android will warn about
   "installing from unknown sources" the first time — tap **Settings** in
   that prompt and allow it for the app you're installing from (e.g. Files,
   Chrome, Gmail). This warning is normal for any app installed outside
   the Play Store, including this one.
5. Open **Jarvis** from your app drawer. It's a real app icon now.

## 2. Give it a brain — Grok API key

Jarvis needs an xAI API key. **Note: unlike Gemini, Grok has no free
tier** — it's pay-per-token, billed to your xAI account. You chose Grok
over Gemini for its higher/less-restrictive rate limits; just know it
costs money per use (typically cents per conversation for personal use).

1. Go to **[console.x.ai](https://console.x.ai)** → sign in → **API Keys** → **Create API Key**.
2. Add a bit of credit to your xAI billing (required before the key works).
3. Copy the key.
4. Open Jarvis → ⚙️ Settings → paste it into **xAI (Grok) API Key**.

## 3. Connect your Google Calendar (optional but recommended)

This needs a one-time OAuth client from Google Cloud — clicking through
screens, no code. About 3 minutes. Note the app type is **Desktop app**
(not "Web application" — that matters for how the sign-in flow works from
inside a real Android app).

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**, sign in with your Google account.
2. Click the project dropdown → **New Project** → name it "Jarvis" → **Create**.
3. Search **"Google Calendar API"** → open it → **Enable**.
4. Go to **APIs & Services → OAuth consent screen**.
   - User type: **External** → **Create**.
   - Fill in app name ("Jarvis") and your email → **Save and Continue** through the remaining screens.
   - Under **Test users**, add your own Google email.
5. Go to **APIs & Services → Credentials** → **Create Credentials → OAuth client ID**.
   - Application type: **Desktop app**.
   - Name it anything → **Create**.
6. Copy the **Client ID** and **Client Secret** it shows you.
7. In Jarvis → Settings, paste both into **Google Calendar**, then tap
   **Connect Google Calendar**. This opens Google sign-in in your phone's
   browser (this is normal and required — Google blocks sign-in inside
   apps directly for security). Sign in, approve, and you'll be dropped
   back into Jarvis, connected.

Skip this and Jarvis still handles chat, weather, commute, and reminders —
it just won't see your real calendar.

## 4. Set your locations

In Settings: **Home Location** (for weather + commute start) and **Work /
Commute Destination** (for the daily drive-time estimate).

## 5. Using it

- **Chat tab** — type or tap 🎤 and talk. Try:
  - "What's on my calendar today?"
  - "Book a dentist appointment tomorrow at 4pm"
  - "Remind me to call Ahmed at 6"
  - "How's traffic to work right now?"
- **Briefing tab** — tap "Get My Morning Briefing" for a spoken rundown of
  weather, schedule, commute, and open reminders.
- **Reminders tab** — add/manage reminders. These fire as real Android
  notifications, even if Jarvis isn't open — this is the one thing the
  earlier web-app version couldn't reliably do.

## Rebuilding after changes

Nothing to do on your end — every push to `android-app/` re-triggers the
GitHub Action and produces a fresh APK automatically. Just re-download
from Actions/Releases when you want the update, and reinstall (Android
will treat it as updating the existing app, as long as the app ID hasn't
changed).

## What's next

1. A signed release build (this build is a debug APK — functionally
   identical, just not cryptographically signed for the Play Store; fine
   for installing directly on your own phone)
2. Email triage (Gmail API, same OAuth pattern as Calendar)
3. WhatsApp/SMS drafting via Android's native share/intent system
4. A true "Hey Jarvis" wake word using Android's always-on hotword APIs
