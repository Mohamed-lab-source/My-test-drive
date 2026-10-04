# Khroga — Setup Guide (Windows)

Follow these steps **in order**. Every command goes into **PowerShell**.
Copy-paste them exactly. If a step fails, look at **Troubleshooting** at the bottom.

> ⚠️ This new app uses the same Firebase project (`khroga-74d82`) as the old one.
> When you deploy it (step 6), the **old app on your phone will stop working
> properly**. That's expected — the new app replaces it. Your old project folder
> on your computer is not touched.

---

## Step 0 — Tools (one time)

You already have Flutter and Node. Install the two Firebase tools:

```powershell
npm install -g firebase-tools
dart pub global activate flutterfire_cli
```

Close PowerShell and open it again so the new tools are found.

## Step 1 — Get the code

1. Install **GitHub Desktop** from https://desktop.github.com and sign in.
2. **File → Clone repository** → pick `My-test-drive` → Clone.
   It goes to something like `C:\Users\misho\Documents\GitHub\My-test-drive`.
3. In GitHub Desktop, switch to the branch **`ccr-c4b16a16-ljyoly`**
   (top bar → "Current branch").

Then in PowerShell:

```powershell
cd C:\Users\misho\Documents\GitHub\My-test-drive
flutter pub get
```

## Step 2 — Make the GitHub project private

GitHub → `My-test-drive` → **Settings** → bottom **Danger Zone** →
**Change visibility → Make private**.

## Step 3 — Connect the app to Firebase

```powershell
firebase login
flutterfire configure --project=khroga-74d82 --platforms=android,ios
```

When it asks about the Android app, let it **register a new app**
(`com.khroga.khroga`). This replaces `lib/firebase_options.dart` and creates
`android/app/google-services.json`. You only do this once.

## Step 4 — Turn on sign-in

In the **Firebase console** (https://console.firebase.google.com → khroga-74d82):

1. **Authentication → Sign-in method** → make sure **Google** and
   **Anonymous** are both **Enabled**.
2. Google sign-in needs your computer's fingerprint. Run:

   ```powershell
   cd android
   .\gradlew signingReport
   cd ..
   ```

   Find the line `SHA1: AA:BB:...` under `Variant: debug` and copy it.
3. Firebase console → ⚙️ **Project settings** → your Android app
   `com.khroga.khroga` → **Add fingerprint** → paste → Save.
4. Run `flutterfire configure --project=khroga-74d82 --platforms=android,ios`
   again (so the app picks up the fingerprint).

## Step 5 — Add the secret keys (one time)

**Gemini key** (for AI plans): get one at https://aistudio.google.com/apikey

```powershell
firebase functions:secrets:set GEMINI_API_KEY
```

Paste the key when asked (it won't show while you paste — that's normal).

**Places key** (for place photos): Google Cloud Console → **APIs & Services →
Library** → enable **Places API (New)**. Then **Credentials → Create
credentials → API key**. Open the new key and set:
- Application restrictions: **None**
- API restrictions: **Restrict key → Places API (New)**

```powershell
firebase functions:secrets:set PLACES_API_KEY
```

> Why "None"? The old 403 errors most likely came from a key restricted to
> **Android apps**. Google rejects those keys when the *server* uses them.

## Step 6 — Put the server code and security rules online

```powershell
cd functions
npm install
npm test
cd ..
firebase deploy --only "firestore,functions"
```

`npm test` must say `# fail 0`. At the end of the deploy you must see
**`Deploy complete!`** and a `✔` for each function (generatePlan, joinGroup,
etc.). If it says "Skipped (No changes detected)", that's fine.

## Step 7 — Load your real places

Your old project has ~200 researched places. Copy the file:

- **From:** `C:\Users\misho\Downloads\khroga\khroga\assets\data\places.json`
- **To:**   `C:\Users\misho\Documents\GitHub\My-test-drive\functions\data\places.json`
  (replace the empty file that's there)

Check it first. This uploads nothing:

```powershell
cd functions
npm run seed -- --dry
```

It lists how many places are ready and which ones it skipped and why.
Then give the script permission to write to your database:

1. Firebase console → ⚙️ Project settings → **Service accounts** →
   **Generate new private key** → save it as `C:\Users\misho\khroga-key.json`
   (**outside** the project folder — never put it on GitHub).
2. Upload:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\misho\khroga-key.json"
npm run seed
cd ..
```

## Step 8 — Run it on your phone

Plug in your Android phone, then:

```powershell
flutter run
```

To build an APK to share: `flutter build apk --release`
(file: `build\app\outputs\flutter-apk\app-release.apk`).

---

## Adding more real places

1. Edit `functions\data\discover_queries.txt` (one search per line, e.g.
   `cairo | escape rooms in Heliopolis`).
2. Run:

```powershell
cd functions
$env:PLACES_API_KEY="paste-your-places-key"
npm run discover
```

3. Look at `functions\data\discovered.json`. These are real Google results.
4. `npm run discover -- --merge` adds the new ones to `places.json` (skips duplicates).
5. `npm run seed` uploads them.

For your `candidate_places.csv` list:
`npm run discover -- --csv C:\path\to\candidate_places.csv`

---

## Troubleshooting

| What you see | What to do |
|---|---|
| App opens with a red "Firebase is not configured" error | Do step 3. |
| "Google sign-in failed" | Do step 4 (fingerprint), then `flutter clean` and `flutter run`. |
| Plans say "Our AI planner was busy" | The Gemini key is missing or wrong. Redo step 5, then step 6. You still get a real plan; it's just not AI-written. |
| "We couldn't find places matching that" | No places loaded yet. Do step 7. |
| Photos don't show | Check the Places key (step 5). Photos are optional, so the app still works. |
| Build fails with Java/Gradle errors | `Get-Process java -ErrorAction SilentlyContinue \| Stop-Process -Force` then `flutter clean` then try again. |
| `npm run seed` says "default credentials" | Redo step 7 part 1, and run the `$env:...` line in the **same** PowerShell window. |
| See server errors | Firebase console → **Functions → Logs**. |
