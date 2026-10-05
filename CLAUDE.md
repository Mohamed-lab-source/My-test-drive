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

- **Places** come from two free, real sources, combined during the GitHub
  build into `assets/data/places.json` (the committed file is an empty
  placeholder):
  1. OpenStreetMap via Overpass (`tool/fetch_osm_places.mjs`): rich facts
     (hours, wheelchair, floors, photos, mall outlines). Slow and often
     overloaded, so the result is cached and only re-downloaded when no
     cache exists or on a manual `refresh_places` run.
  2. Overture Maps (`tool/fetch_overture.py`, pyarrow, ~10 s): ~40k places
     in Greater Cairo + Alexandria, including shops inside malls. Merged by
     `tool/merge_overture.mjs`: maps categories, skips duplicates of OSM
     places, links venues to malls (outline, within 120 m, or address names
     the mall), dedupes malls listed twice, keeps shops only inside malls.
  Credits for both are shown in the app (`OsmCredit`).
- Places carry extra map facts in `details` (wheelchair, wifi, floor, cards…)
  and real photos from Wikimedia Commons (via OSM `wikimedia_commons`/`image`
  or Wikidata P18). Shops are kept only when inside a mall (mall directory,
  "Plan my day here"). `OpeningHours` (lib/models/opening_hours.dart) parses
  common OSM hours for "Open now"; anything it can't read stays unknown.
- Favorites live in `users/{uid}/favorites/{placeId}`. Plans can have a
  stop swapped (`alternativesFor` / `swapStop` in planner.dart) and be shared
  as text with map links.
- Personal data per user: `users/{uid}/visited/{placeId}` ("Been there") and
  `users/{uid}/notes/{placeId}` (private notes, ≤500 chars). Recently viewed
  places, search history, text size, home city, your own star ratings and
  ticked plan stops live only on the phone (`lib/app/local_history.dart`,
  `local_prefs.dart`, `theme_settings.dart`). Star ratings are private and
  never shown as a place rating.
- Plan editing: reorder/remove/add stops, rename, outing day (`date`, used for
  weather + opening hours), full-route Google Maps link, route summary
  (straight-line km + a labeled rough time). Group extras: countdown, Google
  Calendar link, bill splitter (user-entered totals only), invite QR
  (`khroga:group:<code>`, scanned from Friends or Groups).
- Plan options: "only places open at that time" (`onlyOpen`), "prefer my
  favorites" (`preferPlaceIds`, a score boost only), "skip places I've been"
  (via `excludePlaceIds`). Plans can be copied, added to Google Calendar and
  show end times (`stopEndTime`, `planEndTime`, `planCalendarLink`).
- Plan around a spot: `nearLat/nearLng/nearLabel` on PlanRequest (from a place
  page or "Near me"); `passesFilters` keeps only places within 3 km. Stops can
  have their time/length/note edited (`setStopTime`, `setStopDuration`,
  `setStopNote`) and be reordered by `shortestRoute` (nearest-neighbour).
- Groups extras: polls in `groups/{id}/polls/{pollId}` (one vote per member,
  own key only), emoji `reactions` on messages (own key only), organizer-only
  `pinned` note, meeting point (`meetPlaceId/meetPlaceName`), and removing a
  member. All enforced in firestore.rules and covered in rules-test.
- Phone-only extras (`lib/app/local_prefs.dart`): your lists of places, plan
  "How was it?", things-to-bring lists, settings (pure black, data saver,
  start on Explore, welcome tour seen, last "What's new" version).
- App icon: drawn by `tool/make_icon.py` (Pillow) into the Android mipmaps
  (adaptive + monochrome) and `assets/icon/khroga.png`. Re-run it to change it.
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
  app/theme.dart        themes: 6 accent themes x light/dark. Screens read colors
                        with `context.k.<color>` (never fixed colors); test/theme_test.dart
                        checks text contrast for every theme
  app/theme_settings.dart  saved look (dark by default), shared_preferences
  app/router.dart       go_router, 4 tabs: Plan, Explore, Groups, Friends
  models/               place.dart, plan.dart, social.dart
  planner/planner.dart  pure planning logic (tested in test/planner_test.dart)
  planner/services.dart Open-Meteo + Gemini calls
  data/                 repositories + providers.dart
  features/             auth, plan, explore, groups, friends, profile
  app/helpers.dart      pure helpers: greeting, chat day labels, badges, Waze/Google links
  widgets/              common.dart, launchers.dart
  firebase_options.dart placeholder; CI generates the real one
assets/data/places.json bundled places (placeholder in git)
tool/fetch_osm_places.mjs      OpenStreetMap downloader (+ .test.mjs)
tool/fetch_overture.py         Overture Maps downloader (pyarrow)
tool/merge_overture.mjs        merges Overture into places.json (+ .test.mjs)
tool/gen_firebase_options.mjs  google-services.json → lib/firebase_options.dart
tool/make_icon.py              draws the app icon
firestore.rules         security rules
rules-test/             emulator tests for the rules
android/app/khroga-test.keystore  shared TEST signing key (SHA-1 FD:0F:A7:73:...)
```

## Checks to run before pushing

```bash
flutter analyze && flutter test
node --test tool/fetch_osm_places.test.mjs tool/merge_overture.test.mjs
cd rules-test && npm install && npm test   # needs Java + firebase-tools
```

## Gotchas

- Don't hard-code colors (no `Colors.white` on accents): use `context.k.onAccent` etc.
- Pill shapes use `StadiumBorder` (never `ContinuousRectangleBorder` at big radii).
- Never commit real Firebase config or keys; CI generates them at build time.
- Firestore rules on queries: a query must filter on what the rule checks
  (e.g. `memberUids array-contains uid`).
- This cloud environment can't reach `dl.google.com` or the OpenStreetMap
  servers, so Android builds and place downloads only run on GitHub. Check
  results with the GitHub Actions tools.

## Not built yet

Localization (Arabic first), user-submitted menus/prices, crowd check-ins,
"where is everyone" map, location share, iOS build,
photos (could use Wikimedia Commons, free).
