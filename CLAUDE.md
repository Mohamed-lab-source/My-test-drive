# Khroga — notes for Claude

AI outing planner for Egypt (Cairo / Giza / Alexandria). Built from scratch in
Oct 2026. The owner asked for a clean start with nothing from an earlier app,
so don't bring in old data, files or project ids.

## The owner

Mohamed is **non-technical** and doesn't use PowerShell. Explain changes in
plain language. He uses an Android phone.

## Must be FREE

The owner does not want Khroga to cost anything. Keep it on the Firebase
**Spark** plan (no billing account): no Cloud Functions, no Secret Manager, no
Google Places API, no Cloud Storage, nothing that needs Blaze. If a feature
seems to need a paid service, say so and propose a free alternative instead.

## THE rule

**Never fabricate place data, prices, menus, reviews or coordinates.** Every
fact comes from OpenStreetMap (or, later, real user submissions). Unknown =
`null`, shown as unknown. Test fixtures may use obviously fake names, but
nothing fake may ever reach `assets/data/places.json` or Firestore.

How the code enforces it (keep it this way):
- The AI only picks place ids from a candidate list the app builds
  (`lib/planner/planner.dart`). `validatePlan` drops unknown ids, and
  `stripPrices` removes any sentence that mentions money.
- Stop facts (name, coordinates, area, cuisine) are copied from our data in
  `buildStops`, never from the AI.
- If Gemini fails twice (or there's no key), `fallbackPlan` builds the plan
  from real candidates.
- The places converter (`tool/fetch_osm_places.mjs`) only copies map tags.
  `quality` is a ranking signal (how documented an entry is) and is never
  shown as a rating.

## How it runs

- **Places** are downloaded from OpenStreetMap (Overpass) during the GitHub
  build and bundled as `assets/data/places.json` (cached weekly). The committed
  file is an empty placeholder. Credit "© OpenStreetMap contributors" is shown
  in the app (`OsmCredit`).
- **Plans** are made on the phone (`PlansRepository.generate`): weather from
  Open-Meteo, AI from Gemini (free tier, key passed with
  `--dart-define=GEMINI_API_KEY`, restricted to the Android app via the
  X-Android-Package / X-Android-Cert headers), saved to `users/{uid}/plans`.
- **Groups, friends, usernames** are written directly by the app. All the
  safety lives in `firestore.rules`: unique usernames via `/usernames`,
  invite codes via `/joinCodes` (get only, no list), join = add only yourself,
  add friend only if the friendship is accepted (`lastAddedUid`), organizer
  deletes the group, its messages and its code.
- **No push notifications** (they'd need a paid server).

## Setup (browser only, see SETUP.md)

He creates a Firebase project (Spark), turns on Anonymous + Google sign-in,
and puts a service-account key in the GitHub secret
`FIREBASE_SERVICE_ACCOUNT`. `.github/workflows/khroga.yml` does the rest:
enables the free APIs, creates the database, deploys rules, creates the
app-restricted Gemini key, registers the Android app with the test key's
fingerprints, downloads places, and builds the APK (artifact `khroga-apk`).
Without the secret it still builds a "not connected" test APK.

## Layout

```
lib/
  app/theme.dart        all colors/spacing (KColors, KSpace): redesigns start here
  app/router.dart       go_router, 4 tabs: Plan, Explore, Groups, Friends
  models/               place.dart, plan.dart, social.dart
  planner/planner.dart  pure planning logic (tested in test/planner_test.dart)
  planner/services.dart Open-Meteo + Gemini calls
  data/                 repositories + providers.dart
  features/             auth, plan, explore, groups, friends, profile
  widgets/              common.dart, launchers.dart
  firebase_options.dart placeholder; CI generates the real one
assets/data/places.json bundled places (placeholder in git)
tool/fetch_osm_places.mjs      OpenStreetMap downloader (+ .test.mjs)
tool/gen_firebase_options.mjs  google-services.json → lib/firebase_options.dart
firestore.rules         security rules
rules-test/             emulator tests for the rules
android/app/khroga-test.keystore  shared TEST signing key (SHA-1 FD:0F:A7:73:...)
```

## Checks to run before pushing

```bash
flutter analyze && flutter test
node --test tool/fetch_osm_places.test.mjs
cd rules-test && npm install && npm test   # needs Java + firebase-tools
```

## Gotchas

- Pill shapes use `StadiumBorder` (never `ContinuousRectangleBorder` at big radii).
- Never commit real Firebase config or keys; CI generates them at build time.
- Firestore rules on queries: a query must filter on what the rule checks
  (e.g. `memberUids array-contains uid`).
- This cloud environment can't reach `dl.google.com` or the OpenStreetMap
  servers, so Android builds and place downloads only run on GitHub. Check
  results with the GitHub Actions tools.

## Not built yet

Localization (Arabic first), user-submitted menus/prices, crowd check-ins,
"where is everyone" map, location share, custom accent color, iOS build,
photos (could use Wikimedia Commons, free).
