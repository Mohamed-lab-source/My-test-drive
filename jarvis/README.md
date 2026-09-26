# Jarvis — your personal AI secretary

A web app that installs on your Android phone like a real app. No app store,
no coding. Voice + text chat, morning briefings, calendar, reminders, and
commute checks.

## 1. Get the app onto your phone

1. Go to your repo on GitHub → **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **GitHub Actions**. (One click, that's it.)
3. Wait a minute for the "Deploy Jarvis to GitHub Pages" action to finish (check the **Actions** tab).
4. GitHub gives you a link like `https://<your-username>.github.io/<repo-name>/`.
5. Open that link **in Chrome on your Android phone**.
6. Tap the **⋮** menu (top right of Chrome) → **Add to Home screen** → **Install**.
7. You now have a "Jarvis" icon on your home screen. Tap it — it opens full-screen, like a real app.

## 2. Give it a brain (free, ~2 minutes)

Jarvis needs a free Gemini API key to think and talk.

1. On your phone or computer, go to **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**.
2. Sign in with your Google account.
3. Tap **Create API key**.
4. Copy the key.
5. Open Jarvis → tap the ⚙️ **Settings** icon → paste the key into **Gemini API Key**.

That's it — free tier is generous enough for daily personal use.

## 3. Connect your Google Calendar (optional but recommended)

This step needs a one-time "Client ID" from Google. It's clicking through
screens, not writing code — takes about 3 minutes.

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**, sign in with the same Google account as your Calendar.
2. Click the project dropdown at the top → **New Project** → name it "Jarvis" → **Create**.
3. In the search bar, type **"Google Calendar API"** → open it → click **Enable**.
4. In the left sidebar, go to **APIs & Services → OAuth consent screen**.
   - User type: **External** → **Create**.
   - Fill in an app name ("Jarvis"), your email in the two email fields → **Save and Continue** through the remaining steps (scopes and test users can be left as default) → **Back to Dashboard**.
   - Under **Test users**, add your own Google email so you're allowed to sign in.
5. Go to **APIs & Services → Credentials** → **Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add your GitHub Pages URL from step 1 (e.g. `https://yourname.github.io`).
   - Click **Create**.
6. Copy the **Client ID** (ends in `.apps.googleusercontent.com`).
7. In Jarvis → Settings, paste it into **Google OAuth Client ID**, then tap **Connect Google Calendar** and sign in.

If you skip this, Jarvis still works for chat, weather, commute, and reminders — it just won't see your real calendar.

## 4. Set your locations

In Settings, fill in:
- **Home Location** — used for weather and as the commute start point
- **Work / Commute Destination** — used for the daily commute estimate

## 5. Using it

- **Chat tab** — type or tap the mic and talk. Ask things like:
  - "What's on my calendar today?"
  - "Book a dentist appointment tomorrow at 4pm"
  - "Remind me to call Ahmed at 6"
  - "How's traffic to work right now?"
- **Briefing tab** — tap "Get My Morning Briefing" for a spoken summary of weather, today's schedule, commute, and open reminders.
- **Reminders tab** — add/manage reminders directly.

## Known limits of a web app (honest section)

- **No true background wake word.** Android doesn't allow web pages to listen
  for "Hey Jarvis" while the screen is off or another app is open — that
  requires a native app with special OS permissions. Jarvis listens great
  while it's open on screen (tap the mic, or set "Always listening" in
  Settings).
- **Reminders fire while the app is open** (or was opened within ~24h of the
  due time, since the timer is set in-browser). For rock-solid background
  push reminders, a small always-on server piece would be the next upgrade —
  ask if you want that built next.
- All your data (API key, reminders, chat history) is stored **only on your
  phone**, in the browser. Nothing is sent anywhere except directly to
  Google/Gemini when Jarvis needs to answer something.

## What's next

Natural upgrades from here, roughly in order of impact:
1. Reliable background reminder push (needs a tiny free server, e.g. on Cloudflare Workers)
2. Email triage (Gmail API, same OAuth pattern as Calendar)
3. WhatsApp/SMS drafting via Android share-sheet integration
4. A proper wake-word using Android's Quick Tap / Assistant integration
