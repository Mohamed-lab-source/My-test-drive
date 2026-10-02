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

### 2.3 — presence & personality

| | What it does |
|---|---|
| Boot sequence | First open of the day runs a systems check (Groq link, voice, Google, message watch, memory, power). Tap to skip. |
| Summon acknowledgement | Summoned from anywhere, he answers "Yes, sir?" before listening. Short phrases are cached so they play instantly. |
| Home-screen shortcuts | Long-press the Jarvis icon: **Talk to Jarvis**, **Briefing**, **Planner**. |
| Typewriter replies | Replies type out at speaking pace when voiced, quickly when read. |
| Voice-reactive core | With the ElevenLabs voice, the arc reactor pulses with his actual voice. |
| Faster premium voice | Long replies are spoken sentence by sentence; he starts talking after the first. If the premium voice fails midway, the phone voice finishes the sentence. |
| HUD themes | Arc Reactor, Mark III (red & gold), Stealth, Vibranium: Settings → HUD theme. |
| HUD widgets | Weather at home, next event, and unread messages under the telemetry line. |
| Suggestion chips | One-tap prompts that change with the time of day. |
| Personality dial | Reserved, Classic JARVIS, or Full Stark. |
| Manners & archive | Time-aware manners, and he knows his own history ("Wake up, daddy's home", "I am Iron Man", House Party Protocol). |
| Arabic | Settings → "I speak to Jarvis in" → Arabic (Egypt). He replies in whichever language you use; "خلاص" or "شكرا" ends a conversation. |
| Episodic memory | Older conversation is folded into a short running summary, so he remembers what you talked about days ago. |
| Activity log | Planner → Activity Log, or ask "what have you done today?" |
| Meeting heads-up | A notification ten minutes before each calendar event. |
| Low-battery warnings | Spoken once each at 20%, 10% and 5% as it drains, not in every reply. |
| Silent mode | "Silent mode on": replies are written, not spoken, with a haptic tap instead (MUTED in the HUD). |
| Emergency protocol | Settings → Emergency protocol. "Jarvis, emergency" texts that person your location and calls them. He never calls emergency services himself (123 ambulance, 122 police). |
| Works offline | With no network, or when Groq is out of budget, he still handles the torch, timers, alarms, volume, notes, lists, Do Not Disturb, opening apps, the time and the battery. |
| Haptics | Small vibrations on listening, actions and warnings (can be turned off). |

**Free tier, handled better.** Requests now use brisk reasoning and a capped reply length, and search results are trimmed. When the main model hits Groq's per-minute limit, Jarvis switches instantly to the other free model, which has its own separate budget. The "thinking faster than the free tier allows" message should now be rare. Replies that came back doubled ("Netflix, sir.Netflix, sir.") are collapsed.

### 2.4 — "Hey Jarvis"

Settings → **"Hey Jarvis"** → switch on **Listen for "Hey Jarvis"**. Then say "Hey Jarvis" from anywhere.

- The wake word is detected **on the phone** with [openWakeWord](https://github.com/dscripka/openWakeWord)'s pretrained "hey jarvis" model (models CC BY-NC-SA 4.0, personal use). No audio is sent anywhere until he wakes.
- Android requires a small permanent notification while this is on, and it uses some battery.
- Tap **Let Jarvis pop up over other apps** and allow it, so he opens instantly from any screen. Without it, Android only allows a "Yes, sir? Tap to talk" notification.
- The wake-word listener steps aside whenever Jarvis is listening to you himself, then resumes.

Microphone reliability: if the recognizer reports it's busy (common just after speech), Jarvis now retries once. A stalled Groq or ElevenLabs request times out instead of leaving him deaf to taps, and tapping the core while he's thinking says so.

### 2.5 — ten more abilities

| | Try saying |
|---|---|
| Interpreter | "Be my interpreter with this waiter" (Arabic ⇄ English, or French, Turkish, and more). Each side speaks in turn; say "stop" to end. |
| Prayer times | "When is Maghrib?" Egyptian General Authority method. Settings → Prayer time notifications for an alert at each prayer. |
| Spending | "I spent 200 pounds on lunch", "How much did I spend this week?", "Delete that last expense". Planner → Spending. |
| Habits | "I went to the gym", "How's my gym streak?" Tick habits off in Planner → Habits. |
| Important dates | "Omi's birthday is March 14th": a reminder the evening before and the morning of, every year. |
| Goodnight / Good morning | "Goodnight, Jarvis, alarm at 7": Do Not Disturb, torch off, volume down, alarm, and tomorrow's rundown. "Good morning" reverses it and briefs you. |
| Focus mode | "Focus for 45 minutes on the report": Do Not Disturb plus a countdown in the HUD, and a debrief when time's up. |
| Saved spots | "Remember where I parked", later "Take me to my car". |
| Read a link | Copy a link, then "Summarise this article". |
| Find my phone | "Hey Jarvis, where are you?": full-volume chime and flashing torch. Tap the core to stop. Works offline. |

### 2.6 — finding places properly

Places now resolve through a chain: exact coordinates → "here" → saved places ("home", "work", "البيت") → Google Maps links (short share links are followed) → OpenStreetMap search → Photon search → city names. Addresses that aren't found as written are retried in simpler forms and reported as approximate.

- **Settings → Home / Work:** type an address or landmark, or paste a Google Maps share link. Jarvis checks it immediately and shows what he found. Or stand there and tap **📍 Here**.
- **Say** "this is my home", "save this as the gym", or "set work to <address or link>".
- **Commute** starts from where you are now, includes a Google Maps directions link, and says plainly that the estimate has no live traffic.

### 2.7 — ten more, and a conversation that keeps flowing

**Talk flow:**
- A moment's silence or a misheard phrase no longer ends the conversation; Jarvis listens again. He gives up only after two silences in a row, or three right after he's asked you a question.
- Offline or error replies get one more try.
- "stop the music" or "never mind the alarm" are requests, not goodbyes. Only a short sign-off ("that's all", "thanks Jarvis", "خلاص") ends the conversation.

| | Try saying |
|---|---|
| Football | "How did Al Ahly do?", "When's the next Zamalek match?", "Premier League scores" |
| Gold | "What's the price of 21 karat gold?" (per gram in EGP; spot price, shops differ) |
| Qur'an | "Read me the first ayah of Al-Kahf", "Play Surah Al-Kahf" (Alafasy; tap the core to stop) |
| Hijri calendar | "What's the Hijri date?", "How many days until Ramadan?" |
| Screen time | "How long was I on TikTok today?" (asks once for Usage access) |
| Sleep | Logged automatically from "goodnight" and "good morning"; "How have I been sleeping?" |
| Evening debrief | Settings → Evening debrief, or "Give me my evening debrief" |
| Leave-by alerts | For calendar events with a location: "Time to leave" notification with drive time plus a traffic buffer |
| Birthdays | "Import birthdays from my contacts" |
| Ringer & brightness | "Put my phone on vibrate", "Dim the screen to 20%", "Auto brightness" (asks once for permission) |

### 2.8 — trackers

A new **Trackers** tab brings everything together: water, medications, habits, body & fitness, goals, spending, bills & debts, and the car.

| | Try saying |
|---|---|
| Water | "I drank a glass of water" (instant, works offline), "Set my water goal to 10", "Remind me to drink water". Or tap the drops. |
| Workouts | "I ran 5 km in 28 minutes", "Bench press 3 sets of 8 at 60 kg". Personal records are called out. |
| Weight | "I weigh 82.5", "My goal is 78 kg" (trend chart in the tab) |
| Mood | "Feeling 4 out of 10, stressed about work"; weekly average and best/worst days |
| Medications | "Remind me to take vitamin D at 9 am and 9 pm"; "I took my pills" (instant); missed doses are flagged |
| Car | "Filled 40 liters for 700, odometer 52300", "Oil change done at 52300": km/L, cost per km, next service |
| Bills | "Internet bill is 450 on the 5th": reminder the day before; "I paid the internet" (logged as spending) |
| Debts | "Ahmed owes me 500", "I owe Omi 200", "Ahmed paid me back 200" |
| Goals | "Goal: save 20000 for a laptop by March", "Add 3000 to the laptop fund" |
| Reports | "How's my health this week?", "What do I owe and what's due?" |

**Jarvis notices:** falling behind on water, a missed dose, a bill due within two days, the car nearing its service, a goal deadline close. He mentions each once, when it fits.

**Backup:** Settings → Backup → Export saves everything to a file (Drive, WhatsApp…); Restore brings it back on any phone. API keys and passwords are never included.

### 2.9 — the Stark pack

| | How |
|---|---|
| Visual answers | Weather, forecasts, routes (with Navigate), prices, gold, fixtures, prayer times, nearby places (tap to go), spending, screen time and the Hijri calendar appear as holographic cards in the chat. |
| Vision | "What am I looking at?", "Read this": the camera opens; on-device recognition of objects and English/Latin text. Arabic script isn't supported by the recognizer. |
| Wake-up call | Settings → Wake-up call, or "Wake me up at 6:30 on weekdays". At that time Jarvis opens himself with a chime and briefs you. Needs "pop up over other apps". |
| Lockdown | "Lock the phone" / "Lockdown protocol". Asks once for device-admin permission (lock only); remove it in Settings before uninstalling. |
| Diagnostics | "Run a full diagnostic": animated scan of battery health and heat, storage, memory, uptime, latency and a download speed test, then a spoken report. |
| Widget | Long-press the home screen → Widgets → Jarvis: live clock, power, what's next, water and meds. Tap to talk. |
| Quick Settings | Pull down the shade → edit → add the Jarvis tile. One tap to talk, from anywhere. |
| Driving mode | "I'm driving to Smart Village": messages read aloud, replies kept very short, navigation started. Off after 3 hours or "driving mode off". |
| Power | "Power connected, sir." when you plug in; "Fully charged." at 100%. |
| VIPs | "Always tell me when Mom messages": announced even when announcements are off. |

### 3.0 — operations

| | Try saying |
|---|---|
| Watchers | "Tell me when Bitcoin goes above 70,000", "…when 21k gold drops below 4,000", "…when the dollar goes above 55", "Let me know if it's going to rain". Checked about every 30 minutes in the background, even with Jarvis closed. "What are you watching?", "Stop the gold watch". |
| Meeting mode | "Record this meeting": continuous transcription until "end meeting" (or a tap), then a summary with decisions and action items saved to Notes. |
| Dictation | "Take a long note": everything you say until "stop dictation", cleaned up, titled and saved. |
| Portfolio | "I bought 100 shares of CIB at 80", "I have 0.05 bitcoin", "How's my portfolio?" EGX names (CIB, TMG, Fawry, EFG, Eastern…) resolve to the Egyptian Exchange. Also a card in Trackers. |
| Relationship radar | "Remind me to call Mom every week": nudges only if the call log shows you haven't. "Who haven't I spoken to in a while?" |
| Reminder buttons | Every reminder notification has Done and Snooze 10 min. |
| Live timers | Timers Jarvis sets count down in the HUD, and he says "Time's up". |
| Sound design | Subtle interface tones (Settings → Interface sounds). |
| On this day | "What happened on this day?" |
| Catch me up | "Catch me up": messages, missed calls, emails, overdue reminders, triggered alerts and tracker items since you last opened Jarvis. |

### 3.1 — offline Jarvis voice ("Daniel")

Settings → **Offline Jarvis voice: Daniel** → Download (about 117 MB, once). From then on Jarvis speaks in a British male neural voice that runs entirely on the phone: no internet, no limits, no ElevenLabs quota. Speed is adjustable, and there's a Test button. Arabic replies still use ElevenLabs (if on) or the phone's Arabic voice.

- Voice: Kokoro v1.0 "bm_daniel" (Apache-2.0), int8, run with sherpa-onnx (Apache-2.0).
- The pack is built by `.github/workflows/voice-pack.yml` (English-only subset of the upstream sherpa-onnx Kokoro pack) and published under the `jarvis-voice` release.
- The APK now targets 64-bit phones (arm64-v8a) only, to keep it small.

### 3.2 — Hub mode (tablet on a stand)

Settings → **Hub mode**. The app fills the screen with a JARVIS dashboard: big clock, date and Hijri date, weather, today's schedule, the next prayer, and a glance at your reminders and water. The screen is kept awake, and "Hey Jarvis" is switched on so you can talk to it from across the room (and have it play music or the Qur'an). Tap the glowing core to talk, or the ✕ to leave.

Fully on-device — nothing is shared between devices here. (Syncing your Jarvis across phone and tablet, and presence-triggered routines, are planned next.)

### 3.3 — the Lab pack

| | Try saying |
|---|---|
| Custom protocols | "Make a workshop protocol: Do Not Disturb on, volume 70, play focus music, and say 'Workshop online'". Then "Run workshop". Saved protocols also appear as one-tap buttons in the Planner. |
| Unit converter | "Convert 5 km to miles", "100 Fahrenheit in Celsius", "1 feddan in square metres" (offline) |
| Azkar & tasbeeh | "Morning azkar", "Evening azkar"; "Tasbeeh" counts one each time (buzzes at 33) |
| Decisions | "Flip a coin", "Roll a die", "Pick between koshary, pizza or shawarma" |
| Passwords | "Generate a strong password", "Give me a 4-word passphrase" (made on the phone, never stored) |
| Dates | "How many days until 20 December?", "What day is 2027-01-01?", "How old is someone born 1998-03-14?" |

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
