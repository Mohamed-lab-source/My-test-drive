# Jarvis — native Android app

A real Android app (an APK you install directly on your phone — no Play
Store, no PWA, no browser tab). Voice + text chat, morning briefings, real
Google Calendar and Gmail, commute checks, reminders that fire as genuine
OS notifications even when the app is closed, and real phone control —
calling and texting contacts by name, setting alarms and timers, and
flipping the flashlight.

Brain: **Groq** (free — GPT-OSS 120B by default, no credit card, no
bill). Voice: your phone's native speech recognizer and text-to-speech,
with an optional ElevenLabs premium voice (free tier, real male/female
voice picking) for something closer to an actual JARVIS sound.

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

## 5. Get an actual male JARVIS-style voice (optional)

Your phone's built-in text-to-speech gives Jarvis no way to know which
voices are male or female — Android just doesn't expose that. If Pitch
tuning on a phone voice isn't cutting it, ElevenLabs actually labels
voices by gender and accent, so this is the real fix:

1. Go to **[elevenlabs.io/app/sign-up](https://elevenlabs.io/app/sign-up)** — free, no card needed.
2. Sign in → click your avatar (bottom-left) → **API Keys** → **Create API Key** → copy it.
3. Jarvis → Settings → **Premium Voice** → paste the key → turn the toggle on.
4. Tap **⟳ Load** — the voice list fills in, sorted with male British voices first. Pick one, tap **▶️ Test**.

Free tier is about 10 minutes of speech a month — plenty for briefings and
short replies. If you run out, Jarvis automatically falls back to your
phone's voice rather than going silent.

## 6. Using it

### How Jarvis behaves

- **He speaks first.** Open the app and he gives you a one-or-two-sentence
  status: what's next, anything worth knowing (low battery, an event soon).
  At most once every 20 minutes; turn it off in Settings.
- **Tap the core to talk.** The arc reactor on the Jarvis tab is the
  microphone. After he answers out loud he keeps listening, so you can just
  talk back. Say "that's all" (or tap the core) to end the exchange.
  Conversation mode can be turned off in Settings.
- **He remembers you.** Tell him durable things ("Omi is my sister", "I hate
  meetings before ten") and he keeps them, and uses them. Settings shows
  everything he remembers, with a delete button for each.
- **He knows the moment.** Every message carries the real date, time,
  battery, and your open reminders, so "remind me in two hours" and "what's
  on tonight" work properly.
- **He looks things up.** Factual questions go to Wikipedia rather than
  relying on the model's memory.
- Settings → "How should Jarvis address you?" changes "sir" to anything you like.

### Jarvis everywhere (one-time setup, in Settings)

- **Summon from anywhere** → tap *Make Jarvis my assistant* → choose
  *Digital assistant app* → *Jarvis*. Now long-pressing home/power (or your
  phone's assistant gesture, or a Bluetooth headset button) opens Jarvis
  already listening, from any screen.
- **Watch my messages** → tap *Give Jarvis notification access* → turn on
  Jarvis. If the switch is greyed out, Android is blocking it because the app
  wasn't installed from the Play Store: tap *Open Jarvis app info* → ⋮ (top
  right) → *Allow restricted settings*, then try again.
  Then: "what did I miss?", "did Omi text me?", "reply to Omi: on my way"
  (sends straight into that WhatsApp/SMS thread, no tap).
- **Announce new messages aloud** → never / only with headphones (default) /
  always. With the app closed he still announces, in your phone's voice.
- **Running the phone** needs no setup: "open Spotify", "play some Arctic
  Monkeys", "next song", "volume to 40", "navigate home", "WhatsApp Ahmed
  that I'll be late", "turn on Wi-Fi" (Android only lets apps open the
  Wi-Fi/Bluetooth panel, so he brings it up for you to tap).

### 2.2 feature pack

| # | Feature | Try saying |
|---|---|---|
| 1 | Live web search | "What was the Ahly score last night?" |
| 2 | News headlines | "What's in the news?" / "Any news on the iPhone launch?" |
| 3 | Weather forecast | "Will it rain tomorrow?" / "What's the week looking like?" |
| 4 | Stocks & crypto | "How's Apple stock doing?" / "Bitcoin price" |
| 5 | Currency conversion | "100 dollars in Egyptian pounds" |
| 6 | Exact calculator | "What's 17.5% of 2,340?" |
| 7 | World clock | "What time is it in Tokyo?" |
| 8 | Where am I | "Where am I?" |
| 9 | Find nearby | "Nearest pharmacy" → "take me there" |
| 10 | Share location | "Send Omi my location" |
| 11 | Notes | "Note that the wifi password is ..." / "What was the wifi password?" |
| 12 | Lists | "Add milk and eggs to my shopping list" / "What's on it?" |
| 13 | Recurring reminders | "Remind me every weekday at 9:30 about standup" |
| 14 | Calendar, any day | "What's on Thursday?" / "Cancel my 3pm" |
| 15 | Read full emails | "Read me Sara's email" |
| 16 | Do Not Disturb | "Do not disturb for now" (needs notification access) |
| 17 | Missed calls | "Did I miss any calls?" |
| 18 | Clipboard | "Summarise what I just copied" / "Copy that address" |
| 19 | Protocols | "Create a night protocol: alarm at 7, do not disturb on, volume 20" → later just "Night protocol" |
| 20 | Daily briefing | Settings → *Daily briefing* at a time you pick; tap the notification and he reads it |
| + | Diagnostics | "Run diagnostics" |

Lists, notes, protocols, and reminders all show on the **Planner** tab.

**Why he doesn't send all 56 abilities every time:** Groq's free tier allows
8,000 tokens a minute. Sending every tool description on every request would
cost about 3,900 tokens each, so a two-step answer could hit the limit. Jarvis
now sends only the abilities that fit what you said (about 800-1,600 tokens)
and loads more himself when he needs them. If the limit is still hit, he
waits and retries instead of failing.

### Things to try

- **Jarvis tab** — tap the core and talk, or type. Try:
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
