# Jarvis — native Android app

A real Android app (an APK you install directly on your phone — no Play
Store, no PWA, no browser tab). Voice + text chat, morning briefings, real
Google Calendar and Gmail, commute checks, reminders that fire as genuine
OS notifications even when the app is closed, and real phone control —
calling and texting contacts by name, setting alarms and timers, and
flipping the flashlight.

Brain: **Groq** (free — GPT-OSS 120B by default, no credit card, no
bill). Voice: your phone's native speech recognizer and text-to-speech.

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

## 2. Give it a brain — Groq API key (free, no card)

Jarvis needs a Groq API key. Groq is genuinely free — no credit card, no
bill, ever. What you get instead of a bill is a rate limit (roughly 30
requests/minute depending on the model), which is more than enough for
normal personal use — you'll only ever hit it if you fire off requests
back-to-back.

1. Go to **[console.groq.com/keys](https://console.groq.com/keys)** → sign in with Google/GitHub (no card needed anywhere).
2. Click **Create API Key**.
3. Copy the key.
4. Open Jarvis → ⚙️ Settings → paste it into **Groq API Key**.

## 3. Connect your Google account — Calendar + Gmail (optional but recommended)

This needs a one-time OAuth client from Google Cloud — clicking through
screens, no code. About 3 minutes. Note the app type is **Desktop app**
(not "Web application" — that matters for how the sign-in flow works from
inside a real Android app).

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**, sign in with your Google account.
2. Click the project dropdown → **New Project** → name it "Jarvis" → **Create**.
3. Search **"Google Calendar API"** → open it → **Enable**. Then search
   **"Gmail API"** → open it → **Enable** too (Jarvis needs both).
4. Go to **APIs & Services → OAuth consent screen**.
   - User type: **External** → **Create**.
   - Fill in app name ("Jarvis") and your email → **Save and Continue** through the remaining screens.
   - Under **Test users**, add your own Google email.
5. Go to **APIs & Services → Credentials** → **Create Credentials → OAuth client ID**.
   - Application type: **Desktop app**.
   - Name it anything → **Create**.
6. Copy the **Client ID** and **Client Secret** it shows you.
7. In Jarvis → Settings, paste both into **Google Account**, then tap
   **Connect Google Account**. This opens Google sign-in in your phone's
   browser (this is normal and required — Google blocks sign-in inside
   apps directly for security). Sign in, approve — the consent screen will
   list both Calendar and Gmail access — and you'll be dropped back into
   Jarvis, connected.

Skip this and Jarvis still handles chat, weather, commute, reminders, and
phone control — it just won't see your real calendar or inbox.

## 4. Set your locations

In Settings: **Home Location** (for weather + commute start) and **Work /
Commute Destination** (for the daily drive-time estimate).

## 5. Using it

- **Chat tab** — type or tap 🎤 and talk. Try:
  - "What's on my calendar today?"
  - "Book a dentist appointment tomorrow at 4pm"
  - "Remind me to call Ahmed at 6"
  - "How's traffic to work right now?"
  - "Call Sarah" / "Text Ahmed and tell him I'm running late"
  - "Set an alarm for 7am" / "Set a 10 minute timer"
  - "What's in my inbox?" / "Email Sarah and tell her the report's attached"
  - "Turn on the flashlight" / "How much battery do I have?"
- **Briefing tab** — tap "Get My Morning Briefing" for a spoken rundown of
  weather, schedule, commute, open reminders, and unread email count. The
  **Quick Actions** row above it gives instant-tap flashlight, battery, and
  inbox checks without needing to ask. Tap ↗️ on a finished briefing to
  share it as text to any app.
- **Reminders tab** — add/manage reminders. These fire as real Android
  notifications, even if Jarvis isn't open — this is the one thing the
  earlier web-app version couldn't reliably do.

### How the phone-control actions work

`Call Sarah` and `Text Ahmed` look Sarah/Ahmed up in your phone's contacts
(you'll be asked to allow contacts access the first time). **By default,
Jarvis places the call or sends the text immediately — no tap needed.**
The first time it does either, Android will ask you to grant the
**Phone (Call)** and **SMS** permissions; allow both.

This is real, on your own device, and worth understanding:

- These are two of Android's most sensitive permissions. Granting them to
  an app you sideloaded yourself is fine; it's not something you'd want to
  grant to a random app from an app store.
- Jarvis is instructed to only act on what *you* type or say — never on
  text it reads elsewhere (an email, a calendar entry) even if that text
  looks like an instruction. Still, an LLM reading untrusted text (like
  email content) and then being able to place calls/send texts with zero
  confirmation is a real category of risk worth being aware of.
- **Settings → "Send & call directly"** is the kill switch: turn it off
  and Jarvis goes back to only pre-filling the dialer/messaging app for
  you to send yourself, with no permission needed.

Alarms and timers always just open your clock app (no permission needed
either way). Sending an email or creating a calendar event always happens
directly, same as before — Jarvis tells you what it sent/created.

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
2. Reading (not just acting on) incoming notifications, via Android's
   Notification Listener permission
3. A genuinely autonomous scheduled morning briefing (via
   `@capacitor/background-runner`) rather than one you tap to run
4. A true "Hey Jarvis" wake word using Android's always-on hotword APIs
