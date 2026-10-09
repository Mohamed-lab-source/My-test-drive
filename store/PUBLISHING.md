# Publishing Khroga on Google Play — step by step

Everything happens in your browser (phone or computer). Do the steps in order.

## 1. Make your private signing key (once, 5 minutes)
1. GitHub → your project → **Actions** → **Khroga** → **Run workflow**.
2. Tick **"Make my private Play Store signing key"** → **Run workflow**.
3. When it finishes (1–2 minutes), open that run → **Artifacts** → download **release-key-KEEP-PRIVATE**.
4. Follow `READ-ME-FIRST.txt` inside: make two secrets in GitHub (Settings → Secrets and variables → Actions):
   - `KHROGA_RELEASE_KEYSTORE` = all the text in `KHROGA_RELEASE_KEYSTORE.txt`
   - `KHROGA_RELEASE_PASSWORD` = all the text in `KHROGA_RELEASE_PASSWORD.txt`
5. Save both files somewhere private (e.g. Google Drive). Then delete the download on GitHub.
6. Push any change (or **Run workflow** without ticking anything). From now on each build also makes
   **khroga-play-store-bundle** (the `.aab` file you upload to Google Play).

## 2. Open a Google Play developer account ($25 once)
play.google.com/console → sign up as a **personal** account → pay $25 → verify your identity
(Google asks for ID and a phone number; it can take a few days).

## 3. Create the app
Play Console → **Create app** → name "Khroga: Outing Planner Egypt", app (not game), **free**.

Fill in the **App content** pages using the files in this folder:
- **Privacy policy:** `https://<your-project-id>.web.app/privacy.html`
  (your project id is the part before `.firebaseapp.com` in Firebase; for this project it's `khroga-5d5e8`)
- **App access:** everything works as a guest.
- **Ads:** no ads.
- **Content rating:** answers in `content-rating.md`.
- **Target audience:** 18 and over (see `content-rating.md`).
- **Data safety:** answers in `data-safety.md`.
- **Account deletion URL:** `https://<your-project-id>.web.app/delete-account.html`

**Store listing:** texts in `listing.md` (English + Arabic), icon `icon-512.png`, banner `feature-graphic.png`,
and 4–8 screenshots from your phone.

## 4. Closed test (required: 12+ testers for 14 days)
1. Play Console → **Testing → Closed testing** → create a track → upload the newest `.aab`
   (GitHub → Actions → latest Khroga run → Artifacts → **khroga-play-store-bundle**; unzip it first).
2. Add your testers' Gmail addresses (at least 12) and send them the opt-in link.
3. They install Khroga from the Play Store and keep it for **14 days**. Ask them to try it and send
   problems with "Report a problem or idea" in the app.

## 5. Let Google sign-in work for Play Store installs (important)
Google Play signs the app with its own key. After your first upload:
1. Play Console → **Test and release → App integrity → App signing**.
2. Copy the **SHA-1** and **SHA-256** of the **App signing key certificate**.
3. Make two more GitHub secrets: `PLAY_APP_SIGNING_SHA1` and `PLAY_APP_SIGNING_SHA256` (paste them as shown, with colons).
4. Run the workflow again. It registers them with Firebase and the AI key. Until you do this,
   "Continue with Google" won't work in the Play Store version (guests still work).

## 5b. Check that Khroga links open the app
Khroga's share links (`https://<project>.web.app/p/…`, `/j/…`, `/s?…`) open the app when Google has
checked our website's `/.well-known/assetlinks.json` (the build publishes it with every key's
fingerprint). After step 5 and one more build:
1. Play Console → **Grow users → Deep links**. Our web address should show **Verified** (it can take a day).
2. If it says not verified, run the workflow once more (it re-publishes the file) and check again.
Links still work without this: Android just asks which app to use.

## 6. Go public
After 14 days with 12+ testers, Play Console shows **Apply for production**. Answer the short questions
about your test, then submit. Google's review usually takes a few days.

## What to write in "What's new" for each update
See `store/release-notes.md` (English and Arabic, under 500 characters each).

## Ideas that help people find Khroga
- Ask testers to share a plan as a **picture** to their WhatsApp status: it shows the Khroga web address.
- Share group invites as links in your WhatsApp groups: friends tap and join.
- After launch, reply to Play Store reviews (Play Console → Ratings and reviews). It improves ranking.
- The app asks for a rating only after 3 happy moments (a loved plan, a saved plan, joining a group),
  at most once every 90 days, so it never nags.

## Every update after that
Push changes → the build makes a new `.aab` with a higher version number → upload it in Play Console
(Production or Testing) → submit.
