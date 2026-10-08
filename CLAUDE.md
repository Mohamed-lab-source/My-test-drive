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
- Where in the city: the plan form has Anywhere / Near me / Pick an area
  (`areaCenters` = mean of real coordinates per area) plus a distance
  (`radiusKm`, 1–8 km). With "Anywhere", `keepClose` still keeps stops
  within ~5 km of the best match (widening only if too few places).
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
- Map: `lib/widgets/khroga_map.dart` (flutter_map + CARTO raster tiles of
  OSM data, with credits). Used in Explore (map toggle, max 300 pins), plan result
  (numbered route), place page, and the friends map.
- Check-ins: `checkins/{uid}` holds your latest "I'm here" (place, coords,
  `visibleTo` = your accepted friends at that moment). Friends see it for 24 h
  (filtered in the app to accepted friends); you can remove it any time.
  Checking in also marks the place as been there.
- Arabic: `lib/app/i18n.dart` — English text is the key; `tr('…')` and
  `trf('{n} places', {'n': 3})` look it up in `lib/app/strings_ar.dart`.
  Wrap every new piece of UI text in tr/trf and add its Arabic line;
  `test/i18n_test.dart` fails if a tr() text has no translation or a
  {blank} differs. Language is saved on the phone (`app.lang`, default =
  phone language); switching rebuilds the app (`MaterialApp` key), sets RTL
  via flutter_localizations and `Intl.defaultLocale` for dates. Places show
  `nameAr` in Arabic mode (`Place.shownName`). Gemini writes plan text in
  Egyptian Arabic when the app is in Arabic.
- App icon: drawn by `tool/make_icon.py` (Pillow) into the Android mipmaps
  (adaptive + monochrome) and `assets/icon/khroga.png`. Re-run it to change it.
- Staying inside the free limits (keep it this way):
  - Plans are made by the app's own planner by default (`source: 'local'`,
    instant, offline, factual reasons from `describeStop`/`localTitle`).
    Gemini only runs when the person turns on "Let AI pick and write" or taps
    "Make it nicer" (`improveWithAi`: words only, same places/order/times).
    Model default is `gemini-flash-lite-latest`; a 429 sets `aiResting` for
    an hour and the app says so instead of retrying.
  - Firestore: recent plans listen to 15 docs, history pages 20 at a time,
    plan count uses `count()`, chats load 30 messages ("Show older"), the
    group preview write is skipped during a 2-minute burst
    (`shouldUpdatePreview`), and the offline cache is unlimited. Never add a
    listener on a whole collection without a small `limit`.
- Safety (Play Store needs these): Profile → Delete my account
  (`SafetyRepository.deleteAllData` + `AuthRepository.confirmIdentity` /
  `deleteSignIn`), report a message/user (`reports`, write-only), feedback
  (`feedback`, write-only), error reports (`errorReports`, write-only, max 3
  per app run, can be turned off), block people (phone-only list
  `blockedUsersProvider`; hides their messages and requests), in-app
  privacy policy and terms (`features/profile/safety_screens.dart`).
- Chat messages can be replies (`replyTo`/`replyName`) and deleted by their
  sender. Phone settings: 24-hour clock, vibration, reduce motion
  (`phoneSettingsProvider`). The GitHub build passes `BUILD_DATE`.
- Publishing (see store/PUBLISHING.md): release builds are signed with the
  private key from secrets `KHROGA_RELEASE_KEYSTORE` (base64 PKCS12, alias
  `khroga-release`) + `KHROGA_RELEASE_PASSWORD`; made once by the workflow's
  "make_release_key" run (artifact kept 1 day). Without them builds use the
  test key and no `.aab` is made (never upload a test-key bundle). Optional
  secrets `PLAY_APP_SIGNING_SHA1/SHA256` register Play's signing key with
  Firebase and the AI key. Build numbers are 100 + run number. The `site/`
  folder (privacy, terms, delete-account pages, AR+EN) deploys to Firebase
  Hosting (free) at `<project>.web.app`. Store texts/graphics: `store/`
  (`tool/make_store_graphic.py`).
- Map tiles come from CARTO (free for non-commercial use with credit, has a
  monthly allowance) instead of OpenStreetMap's server, which forbids heavy
  app use; flutter_map caches tiles on the phone, and the place-page map only
  loads when tapped. If the app ever outgrows the free allowance, switch
  `urlTemplate` in `khroga_map.dart`.
- Version 0.6 extras (`lib/app/extras.dart`, tested in `test/extras_test.dart`):
  sunrise/sunset and prayer times are *calculated* (NOAA formula, Egyptian
  method 19.5°/17.5°), never looked up; Egypt's fixed-date holidays only
  (Islamic ones follow the moon, so they're not listed); forgiving search
  (`fuzzyContains`, one typo, only when nothing matches exactly); outing
  ideas (`outingIdeas`, fill the form only). Week weather = one Open-Meteo
  call per city per session (`weekForecastProvider`).
- Plan must-haves (`PlanRequest.needs`, `meetsNeeds`): wheelchair,
  vegetarian (food places only), noSmoking, wifi, cards. Unknown = no.
- Screens in `lib/features/tools/`: ideas, areas + area page, tools (decide
  for us, coin, who pays, split a bill, walk time, weather week, sun,
  prayers, holidays, coming up), my stats + my map, notes (one `get()` of
  100, not a listener). Plan-form presets live on the phone
  (`planPresetsProvider`, max 8).
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

user-submitted menus/prices, crowd check-ins,
iOS build,
photos (could use Wikimedia Commons, free).
