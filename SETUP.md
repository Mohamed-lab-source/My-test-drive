# Khroga — Setup (browser only, about 15 minutes)

You only do this **once**. No PowerShell and no installing anything.
GitHub's computers do the rest: they create the server, the database and the
keys, add real places from Google, and build the app for your phone.

---

## 1. Make the GitHub project private (recommended)

GitHub → `My-test-drive` → **Settings** → scroll to the bottom (**Danger Zone**) →
**Change visibility → Make private**.

## 2. Create your Firebase project

1. Go to https://console.firebase.google.com and sign in with your Google account.
2. **Create a project** → name it `Khroga` → you can turn **off** Google
   Analytics → **Create project**.

## 3. Turn on billing (required by Google for the server)

1. In your new project, click **Upgrade** (bottom left) → choose **Blaze**
   (pay as you go) → add your card.
2. When it offers a **budget alert**, set one (for example $5) so you're emailed
   if costs ever go up. A small test app normally costs **$0–1 a month**:
   Google's free allowance covers most of it.

## 4. Turn on sign-in

In the Firebase console: **Build → Authentication → Get started**, then:

1. Click **Anonymous** → switch **Enable** on → **Save**.
2. **Add new provider → Google** → switch **Enable** on → choose your email
   as the support email → **Save**.

## 5. Make a key for GitHub

This key lets GitHub set up your project for you.

1. Open https://console.cloud.google.com/iam-admin/serviceaccounts and pick
   your **Khroga** project at the top.
2. **+ Create service account** → name: `github-builder` → **Create and continue**.
3. **Role**: type `Owner` and choose **Owner** → **Continue** → **Done**.
4. Click the new `github-builder` account → **Keys** tab → **Add key → Create
   new key → JSON → Create**. A `.json` file downloads.

## 6. Give the key to GitHub

1. GitHub → `My-test-drive` → **Settings → Secrets and variables → Actions**.
2. **New repository secret**.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: open the downloaded `.json` file with **Notepad**, select
     everything (Ctrl+A), copy, paste here.
3. **Add secret**. Then **delete the downloaded file** from your computer.

## 7. Start the build

Tell Claude **"done"** and it starts the build for you. Or do it yourself:
GitHub → **Actions** → the latest **Khroga** run → **Re-run all jobs**.

The first run takes about **15–20 minutes**.

## 8. Install the app

1. GitHub → **Actions** → open the finished **Khroga** run (green ✔).
2. Scroll to **Artifacts** → click **khroga-apk** → it downloads a zip.
3. Send the zip to your phone, unzip it, tap `app-release.apk`. If Android asks,
   allow **Install unknown apps**.

---

## Later

- **Every change Claude makes** builds a new app automatically. Get it from
  **Actions → latest run → Artifacts**.
- **More places:** GitHub → Actions → **Khroga** → **Run workflow** → tick
  *Search Google again for more real places*. (This button only appears once
  the workflow is on the main branch. Until then, just ask Claude.)
- **Something went wrong?** Open the run in **Actions**. The step with the red ✖
  says what failed. Copy that text to Claude.
