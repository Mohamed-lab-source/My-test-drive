# Khroga — Setup (free, browser only, about 10 minutes)

**Khroga costs nothing.** It uses Google's free **Spark** plan, which needs no
card at all, so Google has no way to charge you. If you ever see a button
saying **Upgrade** or **Blaze**, ignore it.

You only do this **once**. No PowerShell and no installing anything.

---

## 1. Make the GitHub project private (recommended)

GitHub → `My-test-drive` → **Settings** → scroll to the bottom (**Danger Zone**) →
**Change visibility → Make private**.

## 2. Create your Firebase project (free)

1. Go to https://console.firebase.google.com and sign in with your Google account.
2. **Create a project** → name it `Khroga` → you can turn **off** Google
   Analytics → **Create project**.
3. It starts on the free **Spark** plan. Leave it that way. **Don't add a card.**

## 3. Turn on sign-in

In the Firebase console: **Build → Authentication → Get started**, then:

1. Click **Anonymous** → switch **Enable** on → **Save**.
2. **Add new provider → Google** → switch **Enable** on → choose your email
   as the support email → **Save**.

## 4. Make a key for GitHub

This key lets GitHub set up your project for you.

1. Open https://console.cloud.google.com/iam-admin/serviceaccounts and pick
   your **Khroga** project at the top.
2. **+ Create service account** → name: `github-builder` → **Create and continue**.
3. **Role**: type `Owner` and choose **Owner** → **Continue** → **Done**.
4. Click the new `github-builder` account → **Keys** tab → **Add key → Create
   new key → JSON → Create**. A `.json` file downloads.

## 5. Give the key to GitHub

1. GitHub → `My-test-drive` → **Settings → Secrets and variables → Actions**.
2. **New repository secret**.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: open the downloaded `.json` file with **Notepad**, select
     everything (Ctrl+A), copy, paste here.
3. **Add secret**. Then **delete the downloaded file** from your computer.

## 6. Start the build

Tell Claude **"done"** and it starts the build for you. Or do it yourself:
GitHub → **Actions** → the latest **Khroga** run → **Re-run all jobs**.
It takes about **10–15 minutes**.

## 7. Install the app

1. GitHub → **Actions** → open the finished **Khroga** run (green ✔).
2. Scroll to **Artifacts** → click **khroga-apk** → it downloads a zip.
3. Send the zip to your phone, unzip it, tap `app-release.apk`. If Android asks,
   allow **Install unknown apps**.

---

## What's free, and what that means

| Part | Free service | Note |
|---|---|---|
| Accounts, groups, chat | Firebase Spark plan | Free allowance is far more than a test app uses. If it's ever used up, the app pauses until the next day. It never charges. |
| Places | OpenStreetMap | Real names, locations, hours, phones and websites. No photos or star ratings. |
| AI plans | Gemini free tier | If the AI is busy or unavailable, the app still builds a plan from real places. |
| Weather | Open-Meteo | Free, no key. |

Because there's no paid server, **the phone doesn't buzz for new chat
messages**. Messages show up live while the app is open.

## Later

- **Every change Claude makes** builds a new app automatically. Get it from
  **Actions → latest run → Artifacts**.
- **Places refresh** from OpenStreetMap once a week automatically.
- **Something went wrong?** Open the run in **Actions**. The step with the red ✖
  says what failed. Copy that text to Claude.
