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
- Map tiles: with the `MAP_TILES_KEY` secret (free Stadia Maps key,
  non-commercial tier, no card) the app uses Stadia's light/dark tiles;
  without it, OpenStreetMap's own tiles (dark filter in dark mode), which
  their policy only allows for light use, so the key is needed before going
  public. CARTO was dropped: it started asking for an API key. flutter_map
  caches tiles on the phone; the place-page map only loads when tapped.
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
- Share links (0.7, `lib/app/links.dart` + `share_texts.dart`, tested in
  `test/links_test.dart`): `https://<project>.web.app/p/<placeId>`, `/j/<code>`
  (group invite), `/u/<uid>` (add friend), `/s?c=&t=&d=&s=id~HH:mm~min|…`
  (shared plan: only ids/times/title; places are looked up again in our
  data, unknown ids dropped), `/get`. Android App Links: intent-filter with
  `${webHost}` (gradle `KHROGA_WEB_HOST`, set in CI from google-services.json),
  `site/.well-known/assetlinks.json` written by CI with test/release/Play
  SHA-256. Hosting rewrites those paths to `site/open.html` (open in app /
  Get it on Google Play). Router maps links in its redirect and keeps a link
  opened before sign-in (`_pendingLink`). Chat opens our own links in-app.
- Story-size picture sharing (`lib/widgets/share_card.dart`: `StoryCard`,
  `sharePictureCard`) for plans, places and stats. In-app review
  (`lib/app/review.dart`, `in_app_review`): asked after 3 happy moments, at
  most every 90 days. Release notes: `store/release-notes.md`.
- Reviews (0.8, `lib/models/review.dart`, `lib/data/reviews_repository.dart`,
  `lib/features/reviews/`, tested in `test/review_test.dart` + rules-test):
  real user submissions, shown as "Khroga reviews", never mixed with map
  facts. `reviews/{placeId}__{uid}` (one per person per place, Google
  accounts only, stars 1–5, answers to category questions, text ≤1000).
  Each write is a transaction that also updates `placeStats/{placeId}`
  (count, sum) and `reviewerStats/{uid}` (total, detailed, cats, place);
  firestore.rules checks the deltas both ways (`statsAfter` mirrors them).
  Points: 10 per review, +10 if detailed (3+ answers, 50+ chars). Tiers
  `guideTiers`, expert badges `expertBadges` (enough reviews of a kind and
  ≥ half of all). Reads on request only: place page reads placeStats (1
  doc); the list loads the newest 20 when tapped. Reports kind 'review';
  blocked people's reviews hidden; deleting the account deletes reviews.
- Play policy items (0.8.1): people agree to community rules once before
  their first review or chat message (`ensureCommunityRules`, phone pref
  `community.accepted`); AI-written plan text can be reported (reports kind
  'ai'); reviews can't contain links, phone numbers (client
  `reviewTextProblem` + firestore.rules regex) or blocked rude words
  (client). Terms cover reviews and AI text. Play Console answers and the
  screenshot list are in store/PUBLISHING.md (5c, 5d).
- 0.9 live extras (`lib/data/live_data.dart`, tested in `test/live_data_test.dart`):
  Open-Meteo hourly weather per plan stop (`hourlyWeatherProvider`, ~10 km
  grid so one request per plan), UV + European AQI (`airProvider`, Plan tab
  line), Wikipedia summary via the place's Wikidata id (`wikiProvider`,
  Arabic article first, credited CC BY-SA; tap-to-load with data saver).
  Community page `/community` (top rated = placeStats by count, Bayesian
  average; fresh reviews). Weekly challenges (`lib/app/challenges.dart`,
  Saturday weeks, progress from this week's reviews via the
  reviews(uid, updatedAt) index in firestore.indexes.json, and plans; done
  weeks on the phone). Pipeline copies Instagram/Facebook (OSM tags,
  Overture socials), menu links (`website:menu`), halal and kids areas.
  Skeleton loading in `AsyncView`; predictive-back page transitions;
  category-coloured headers for places without photos.
- CI storage: GitHub's artifact storage is tiny, so the app config goes from
  the firebase job to the android job through actions/cache (key
  app-config-<run>), the APK and the .aab are published as release assets
  (`latest-apk/khroga.apk`, `play-store-bundle/khroga.aab`), and the last
  step deletes Khroga's old artifacts (only its own names).
- Customer-first behaviour (0.9.1): `friendlyError` maps every error to a
  kind next step (never raw/English-only text; `isOfflineError` → 📡);
  `showUndo` for deletes (plans via `PlansRepository.restore`, favorites,
  been-there, notes); empty states offer an action (e.g. clear filters);
  review form asks before discarding; plans with fewer stops explain how to
  get more; app-made plans get a factual `localSummary`; the AI prompt has a
  friendly "local friend" voice rule; "Right now" idea card (`ideaForNow`);
  Explore remembers map/list; delete-account text lists reviews and accepts
  "حذف".
- 0.10 game layer (`lib/app/fun.dart`, tested in `test/fun_test.dart`;
  screens in `lib/features/fun/`): 32 badges with progress (`allBadges`,
  `badgesProvider` uses only already-loaded data; celebrated once with
  confetti, seen keys in phone pref `fun`), recap for a month/year
  (`recapOf`, reads one page of 50 plans) + outing personality
  (`outerTypeFor`), monthly bingo (`bingoFor`, same card for everyone; ticks
  from `visitedDatedProvider` = visited docs' `createdAt`) and monthly goal,
  place of the day (`placeOfTheDay`, date-seeded), Feeling lucky, smart
  collections from map tags (`smartCollections`, unknown = not included),
  area explorer (`areaProgress`), friends leaderboard (public
  `reviewerStats`, one get per friend, max 60), Mystery mode
  (`/mystery/:id`), poll templates, teams/dice/conversation starters.
- **Plans** are made on the phone (`PlansRepository.generate`): weather from
  Open-Meteo, AI from Gemini (free tier, key passed with
  `--dart-define=GEMINI_API_KEY`, restricted to the Android app via the
  X-Android-Package / X-Android-Cert headers), saved to `users/{uid}/plans`.
- **Groups, friends, usernames** are written directly by the app. All the
  safety lives in `firestore.rules`: unique usernames via `/usernames`,
  invite codes via `/joinCodes` (get only, no list), join = add only yourself,
  add friend only if the friendship is accepted (`lastAddedUid`), organizer
  deletes the group, its messages and its code.
- **No push notifications** (they'd need a paid server). Outing reminders
  are *local* notifications instead (`lib/app/reminders.dart`,
  flutter_local_notifications ^21 + timezone, Africa/Cairo, inexact alarms so
  no exact-alarm permission; bell `ReminderButton` in
  `features/plan/reminder_sheet.dart` on plans and group outings; phone pref
  `reminders`; boot receivers in the manifest; status icon
  `ic_stat_khroga` drawn by make_icon.py and kept via res/raw/keep.xml;
  core library desugaring in build.gradle.kts).
- 1.0 extras: live "How busy is it now?" (`lib/models/crowd.dart`,
  `data/crowd_repository.dart`, `features/explore/crowd_card.dart`, tested
  in test/crowd_test.dart + rules-test): `crowd/{placeId}` holds only counts
  {quiet, normal, busy, since, last}; each report adds exactly 1 in a batch
  with the private `users/{uid}/crowdMarks/{placeId}` (one per place per 30
  min, Google accounts only); a new window starts when `since` is 2 h old.
  Real prices = the optional review question `spend` (`spendOptions`,
  `typicalSpend`, needs 2+ answers). Help screen `/help`.

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

user-submitted menus, iOS build, user photo uploads (Firebase Storage now
needs the paid Blaze plan, so stick to Wikimedia Commons photos).
