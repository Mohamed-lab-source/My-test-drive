# Khroga — notes for Claude

AI outing planner for Egypt (Cairo / Giza / Alexandria). Built from scratch in
Oct 2026. The owner asked for a clean start with nothing from an earlier app,
so don't bring in old data, files or project ids.

## The owner

Mohamed is **non-technical**. Explain changes in plain language, say which
files changed and give exact PowerShell commands to run. He works on Windows
with an Android phone and doesn't use PowerShell. Setup is browser-only
(`SETUP.md`): he creates a Firebase project and puts a service-account key in
the GitHub secret `FIREBASE_SERVICE_ACCOUNT`; the GitHub workflow
`.github/workflows/khroga.yml` does everything else (enables APIs, creates the
database, API key and function secrets, deploys rules + functions, fills places
from Google on the first run, registers the Android app, builds the APK).
Keep SETUP.md accurate when anything about setup changes.

## THE rule

**Never fabricate place data, prices, menus, reviews or coordinates.** Every
fact must come from Khroga's researched data, Google Places, or real user
submissions. Unknown = `null`, shown as unknown. `avgCostPerPerson` is
user-submitted only. Test fixtures may use obviously fake names, but nothing
fake may ever reach `functions/data/places.json` or Firestore.

How the code enforces it (keep it this way):
- The AI only picks `placeId`s from a candidate list the server builds
  (`functions/src/planner.ts`). `validateAiPlan` drops any unknown id, and
  `stripPrices` removes any sentence that mentions money.
- Stop facts (name, coords, rating, cost) are copied from the database in
  `buildStops`, never from the AI.
- If Gemini fails twice, `fallbackPlan` builds a plan from real candidates.
- Plans are written only by the server; rules block clients from creating or
  editing them.

## Layout

```
lib/
  app/theme.dart        all colors/spacing (KColors, KSpace) — redesigns start here
  app/router.dart       go_router, 4 tabs: Plan, Explore, Groups, Friends
  models/               place.dart, plan.dart, social.dart (groups, friends, profiles)
  data/                 repositories + providers.dart (all Riverpod providers)
  features/             auth, plan, explore, groups, friends, profile
  widgets/common.dart   AsyncView, EmptyState, BusyButton, friendlyError, ...
  widgets/launchers.dart  maps / Uber / DiDi / inDrive / phone / web links
functions/
  src/planner.ts        pure planning logic (tested)
  src/external.ts       Gemini, Open-Meteo, Places photo calls
  src/index.ts          callable functions
  scripts/              seed.ts, discoverPlaces.ts, normalize.ts
  data/places.json      merged real places (filled by the workflow from Google)
  data/discover_queries.txt  Google searches used to find places
  test/                 node:test tests
firestore.rules         security rules
rules-test/             emulator tests for the rules
tool/gen_firebase_options.mjs  builds lib/firebase_options.dart from google-services.json (CI)
.github/workflows/khroga.yml   server setup + APK build (artifact: khroga-apk)
android/app/khroga-test.keystore  shared TEST signing key (SHA-1 FD:0F:A7:73:...)
```

## Data model (Firestore)

- `places/{id}` — read-only to clients. Fields: name, category, city, area,
  address, lat/lng (nullable), googlePlaceId, rating, ratingCount, priceLevel
  (0–4, Google), avgCostPerPerson (user-submitted), photos [{url | name, attribution}],
  openingHours [Google weekday strings], parentMallId, website, phone, indoor, source.
- `users/{uid}` (private: fcmTokens) and `users/{uid}/plans/{id}` (server-written).
- `publicProfiles/{uid}` — displayName, photoUrl, username (server-set).
- `usernames/{name}`, `joinCodes/{code}` — server-only.
- `friendships/{a_b}` — uids sorted, requestedBy, status pending|accepted.
- `groups/{id}` — ownerUid, memberUids, joinCode, scheduledAt, planTitle,
  planStops (snapshot), rsvp {uid: going|maybe|no}, freeUids, lastMessage.
  `groups/{id}/messages/{id}` — uid, name, text, createdAt.

Server-only actions (Cloud Functions): generatePlan, placePhotos,
claimUsername, createGroup, joinGroup, addFriendToGroup, leaveGroup,
deleteGroup, notifyGroupMessage. Region `us-central1`.

## Checks to run before pushing

```bash
flutter analyze && flutter test
cd functions && npm test
cd rules-test && npm install && npm test   # needs Java + firebase-tools
```

## Gotchas

- Pill shapes use `StadiumBorder` (never `ContinuousRectangleBorder` at big radii).
- `lib/firebase_options.dart` in git is a placeholder (also defines
  `googleWebClientId`); the workflow generates the real one at build time.
  Never commit real Firebase config or keys.
- `firebase deploy` may say "Skipped (No changes detected)" — not an error.
- Places API keys used by the server must NOT have Android-app restrictions (403).
- Firestore rules on queries: a query must filter on what the rule checks
  (e.g. `memberUids array-contains uid`).
- This cloud environment can't reach `dl.google.com`, so Android builds can't
  run here — verify with `flutter analyze` / tests and let Mohamed build.

## Not built yet

Localization (Arabic first), user-submitted menus/prices, crowd check-ins,
"where is everyone" map, Heading-There location share, InstaPay, custom
accent color, iOS build.
