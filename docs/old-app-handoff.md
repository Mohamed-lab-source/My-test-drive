# Khroga — Project Handoff for Claude Code

This file is a complete handoff from a long chat-based session working on Khroga
with Mohamed, a **non-technical** app creator. Read this in full before touching
anything — it contains hard-won fixes, dead ends already explored, and explicit
rules that exist because they were violated before.

**Mohamed cannot read or write code.** Explain every change in plain language,
tell him exactly what file changed and what to run, and never assume he can
self-diagnose an error message — paste exact commands.

**Working environment:** Windows, project at (approximately)
`C:\Users\misho\Downloads\khroga\khroga`, with a connected Android device for
`flutter run` / `flutter install`. PowerShell is his shell.

---

## What Khroga Is

An AI-powered outing planner for Egypt (Cairo/Alexandria/Giza). Users describe
what they want (people, budget, vibe), Gemini generates a real multi-stop plan
from a database of real, researched places. Groups of friends collaborate:
RSVP, split bills, suggest changes, share live location, chat.

## THE Non-Negotiable Rule

**NEVER fabricate place data, prices, menus, reviews, or coordinates.** Every
place, price, and location must trace back to something real — Khroga's own
researched database, a real user submission, or verified Google Places data.
This rule has been violated and re-fixed multiple times (see "Bug saga"
below) — hold this line strictly in any future work, including when mixing in
new research (see "Places research" section below for how that was handled
correctly).

## Tech Stack

Flutter (Material 3) + Riverpod + go_router. Firebase: Auth, Firestore, Cloud
Functions (2nd gen, TypeScript), Storage, Messaging. Google Gemini API for
plan generation. Google Places API (New) for real place data — admin scripts
only, never called from the client directly. Firebase project id:
`khroga-74d82`.

---

## Complete Feature List

**Planning**: AI plan generation (Gemini, structured JSON output), real
Places data (~200 places: restaurants, cafes, cinemas, malls, escape rooms,
entertainment venues), weather-aware planning (Open-Meteo), crowdsourced
busyness check-ins, real photo galleries (up to 5/place via Google Places
API), real user-submitted menus (never AI-estimated), real distance/time to
each stop (Google Distance Matrix API), "Give me another one" regenerate
button (now correctly mall-aware — see Fixes), "Plan My Day Here" — one-tap
AI plan confined to a single mall's real venues only. Ride-hailing shortcuts
(Uber/DiDi/inDrive) on the first stop of a generated plan (see Fixes).

**Groups & social**: join codes, real-time feed + push notifications,
schedule/RSVP, who-pays-vs-free split, admin-only permissions (enforced in
Firestore rules), "Heading There" one-time location share with real
distance/time, Pay Now via InstaPay, collaborative plan suggestions.

**Friends & identity**: unique usernames, live search, QR code add, public/
private profile split.

**Personalization**: custom theme accent color, custom app icon, Plans tab.

**Localization**: real `flutter_localizations` infrastructure — Arabic
(MSA, not colloquial), Spanish, German, Japanese, Filipino. ~180 ARB keys.
**Only fully wired to actual screens so far: bottom nav, Home, Explore, Groups
list.** Every other screen still shows hardcoded English — keys likely
already exist in the ARB files (check before adding new ones), just needs the
screen-by-screen wiring work continued.

## Mall Data — Real Venue Research

Built a `parentMallId` field on Place (distinct from the general `area`
string) so "Plan My Day Here" only pulls venues *physically inside* a
specific mall. Real venue counts as of last count: **Mall of Egypt ~55, City
Centre Almaza ~40 (from the mall's own official app — best source, got via
user screenshots), City Centre Alexandria ~10, City Centre Maadi ~5
(thinnest — same official-app-directory approach never worked for this one,
worth trying again if Mohamed can get those screenshots)**.

---

## Fixes Completed This Session (in rough chronological order)

### 1. Group Detail layout overflow ("BOTTOM OVERFLOWED BY N PIXELS")
Root cause: three fixed-height header cards didn't fit once the keyboard
shrank the viewport when the status-update field was focused. Went through
two iterations (an `AnimatedSize`-based keyboard-collapse hack, which turned
out to cause unrelated rendering issues, described below) before landing on
the final approach: **the screen was restructured entirely** per Mohamed's
request. Current layout, top to bottom: schedule/event details card → chat
feed fills all remaining space → a slim "who's heading there" chip strip
(only visible when someone has an active status) → a compact action row
(Members button + Heading There button) directly above the message input.
The old big `_MembersBar` and big Heading There card were removed entirely.

### 2. Group deletion `permission-denied`
Root cause was `firestore.rules`, **not** the repository code. The
`groups/{id}/feed/{postId}` rule blocked ALL deletes
(`allow update, delete: if false`), but `deleteGroup()` in
`group_repository.dart` correctly tries to clean up feed posts *before*
deleting the group itself — so that cleanup batch got rejected before the
(correctly-written, owner-only) group-level delete ever ran. **Fix**: the
rule now allows the group owner specifically to delete `feed` and
`headingStatus` subcollection docs (regular members still can't edit/delete
messages). `deleteGroup()` was also updated to clean up `headingStatus`, not
just `feed`.

### 3. `auth_repository.dart` never created user documents
Contrary to an earlier (incorrect) note that it did, sign-in never actually
created `users/{uid}` or `publicProfiles/{uid}` Firestore documents. Fixed by
adding a private `_ensureUserDocuments(User user)` helper that checks
existence first (so it **never overwrites** an existing user's saved accent
color, InstaPay link, claimed username, etc.) and creates both docs on first
sign-in. Called after Google sign-in, guest sign-in, and guest-to-Google
account linking. Uses `FirebaseFirestore.instance` directly rather than a new
constructor parameter, so no other file needed to change.

### 4. Regenerate button didn't preserve mall-mode
Two-part fix, both now complete:
- `plan.dart`: `OutingPlan` gained a `mallId` field (nullable String) and an
  `isMallLocked` getter (`mallId != null && mallId!.isNotEmpty`). Read/written
  in `fromAiResponse`/`toMap`.
- `plan_result_screen.dart`: `_RegenerateButton` now passes
  `mallId: plan.isMallLocked ? plan.mallId : null` into `generatePlan()`.

**Gotcha hit here**: the `plan.dart` half of this fix was sent to Mohamed
once already in an earlier round but apparently never actually got applied
on his machine (unclear why — possibly a zip extraction that didn't
overwrite, or he missed a step). When the `plan_result_screen.dart` change
was sent alone, it failed to compile (`isMallLocked`/`mallId` undefined on
`OutingPlan`). Re-sending dependent files **bundled together** in one zip
resolved it. **Lesson: when two files have a compile-time dependency, always
ship them together, even if one was "already sent" earlier** — don't assume
a previous delivery was actually applied.

### 5. Ride-hailing buttons (Uber / DiDi / inDrive)
New file: `lib/core/widgets/ride_hailing_buttons.dart` — a small vertical
cluster of logo-only buttons, wired into `plan_result_screen.dart`'s
timeline. Shown **only next to the first stop**, and **only when that place
has real (non-fabricated) `lat`/`lng` on file** — never falls back to a
guessed location, consistent with the project's core rule.
- **Uber**: uses Uber's real, documented universal link
  (`https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=...&dropoff[longitude]=...&dropoff[nickname]=...`)
  which genuinely pre-fills the destination.
- **DiDi / inDrive**: these do **not** have a publicly documented way to
  pre-fill a destination. Rather than guess at an undocumented format (which
  could silently fail), the buttons just open the app itself (`didi://`,
  `indriver://`) with a Play Store fallback via `canLaunchUrl`/`launchUrl`.
  The person picks the destination themselves once inside.
- Logo assets: `assets/icons/uber_logo.png`, `didi_logo.png`,
  `indrive_logo.png` — Mohamed sourced these himself from each brand's
  official assets (Claude should never generate or scrape trademarked
  logos). `pubspec.yaml` already registers the whole `assets/icons/` folder.
  If the images are ever missing, `Image.asset`'s `errorBuilder` falls back
  to a plain taxi icon rather than crashing.

### 6. Place Details photo section redesigned
Was a full-screen swipe-one-at-a-time `PageView` hero (with dot indicators)
inside a big collapsing `SliverAppBar`. Changed per Mohamed's request to: a
**slim pinned app bar** (just back + favorite buttons, no hero background)
followed by a **horizontal draggable strip** of photo thumbnails
(`ListView.separated`, 260×220 rounded cards, multiple visible side by side).
Photo attribution now shows as a small caption line below the strip instead
of an overlay badge on the photo. The now-unused `PageController`/gallery
index state was removed from the screen's State class.

### 7. ChatGPT-researched places doc — mixed in carefully
Mohamed supplied `Cairo_Outings_Guide_2026_AR.docx`, a ChatGPT-researched
list of ~50 candidate Cairo venues. **This was handled as a lead list, not a
data source**, because most of its price-range estimates were unsourced
ChatGPT output — putting those into `avgCostPerPerson` would have violated
the core no-fabrication rule (that field must stay user-submitted only, same
as the menu rule). Process followed:
1. Read the full doc, cross-referenced it against what's already in
   `places.json` (flagged City Centre Almaza, Mall of Egypt, Sheraton Cairo
   Hotel dining as duplicates to skip).
2. Web-searched the less-obviously-real names to confirm they're genuine,
   currently-operating venues (8 spot-checked directly with sources: SACHI
   Heliopolis, Vasko, Sweven, Pastari, Giannini's, CJC 610, Rush Hub, Waslet
   Dahshour — all confirmed with matching addresses).
3. Produced `candidate_places.csv` (name, area, category hint, verification
   status, notes) — **not** fed directly into `places.json`. This is meant
   to go through `discoverPlaces.ts` (real Google Places API pull) for
   actual coordinates/photos/ratings, same as any other new place.
4. **If continuing this work**: finish verifying the ~15–18 entries still
   marked `unverified` in that CSV before running them through discovery,
   and never let a ChatGPT-sourced price estimate reach `places.json`.

### 8. Liquid Glass redesign — attempted, then fully reverted
A multi-round attempt at an iOS-style "Liquid Glass" translucent/blurred
visual redesign. **This was explicitly reverted and is considered closed —
do not reintroduce translucent/blurred cards without Mohamed asking again.**
Kept here for the record since the failure modes are genuinely instructive:

- Introduced `GlassSurface`/`GlassCard` in `common_widgets.dart`, converted
  essentially every content card across the whole app (Home, Explore, Groups,
  Plans, Friends, Place Details, Profile, Plan Result, Group Detail) to use
  them, in one large batch per Mohamed's explicit "no more one-at-a-time"
  instruction.
- **Bug #1 (misdiagnosed twice)**: buttons app-wide rendered as distorted,
  pointed lens-shaped outlines instead of pills. First blamed on stacked
  `BackdropFilter` blur causing Android rendering corruption (plausible, but
  wrong — removing blur didn't fix it). Then blamed on an `AnimatedSize`
  keyboard-collapse animation (also wrong). **Actual root cause**, only found
  once a screenshot showed it clearly: `ContinuousRectangleBorder` degenerates
  into a distorted shape at pill-sized radii (999). **Rule going forward:
  pill shapes must always use `StadiumBorder`; `ContinuousRectangleBorder` is
  only safe at moderate radii** (cards ~20, snackbar ~12).
- **Bug #2**: list tiles with an image on the left + text on the right
  produced an ugly hard seam (bright image slamming into a dark glass panel).
  Mohamed's explicit decision: remove images from list tiles entirely,
  replace with a small leading icon/emoji chip instead.
- Even after both bugs were fixed and the look was tuned against a reference
  photo (lighter frosted fill, glowing rim, optional real blur), Mohamed
  ultimately decided the whole direction "doesn't work good and doesn't look
  good" and asked to revert.
- **How the revert was done**: rather than manually undoing every screen
  edit, `GlassSurface`/`GlassCard` were rewritten in `common_widgets.dart` to
  render a plain solid opaque card (theme surface color + outline border, no
  transparency/gradient/glow/blur) **while keeping the exact same constructor
  API**. Every screen that had adopted `GlassCard`/`GlassSurface` reverted to
  normal automatically, with only that one file changing. Dead code
  (`GlassFloatingNavBar`, `GlassNavItem` — a floating bottom-nav concept that
  was never actually wired into `root_shell.dart`) and now-unused glass color
  getters in `app_colors.dart` were deleted. Button/chip shapes
  (`StadiumBorder` pills, `ContinuousRectangleBorder` cards) were **left
  alone** since those are solid/normal, not part of the transparency
  complaint.
- **Takeaway for future redesign work**: if a visual redesign is attempted
  again, centralize the rendering in one shared widget (as `GlassSurface`
  already is) so a revert or major tweak only touches one file, not every
  screen. Also: verify any corner-radius helper function at the actual radii
  it'll be used at — don't assume a shape class behaves the same at radius 20
  as at radius 999.

---

## Currently Broken / Blocked

1. **Google Places API (New) returns HTTP 403** on all 3 progressively
   broader `resolvePlaceCoordinates` query attempts (used by `geocodePlace`
   and `getTravelInfoForPlan`). Billing confirmed active on the project.
   Unresolved whether a fresh, fully unrestricted API key + confirming
   "Places API (New)" (not the legacy "Places API") is enabled fixes it. May
   also be silently breaking `enrichPlaces.ts`'s photo fetching, since it's
   the same underlying API — check this once the 403 is resolved.

2. **`enrichPlaces.ts` storage-bucket fix is unconfirmed.** Root cause
   diagnosed earlier: `admin.initializeApp()` with no args doesn't know the
   storage bucket when run as a local script. The fix
   (`{ storageBucket: "khroga-74d82.firebasestorage.app" }`) was proposed but
   the file was never actually obtained to confirm it was applied correctly.
   **This file still needs to be requested from Mohamed and fixed directly**
   rather than guessed at again.

3. **`discoverPlaces.ts` was never obtained this session** — needed to
   actually process `candidate_places.csv` (see Fix #7 above) into real,
   enriched place data.

---

## Pending / Not Started

- **iOS build**: Flutter code is cross-platform already; building for iOS
  requires a Mac (Codemagic cloud CI recommended — has a free tier;
  alternatives: MacinCloud, a friend's Mac) plus an Apple Developer account
  ($99/yr) for device testing/publishing. An iOS-readiness audit (permission
  strings → `Info.plist`, push notification certs) was offered but never
  done.
- **Google Play Internal Testing setup**: walked Mohamed through creating a
  Play Console developer account ($25 one-time) and the Internal Testing
  track (free, ~100 testers, feels like a real Play Store install) as the
  path to let friends install the app before public release — confirmed the
  Maps SDK for Android specifically has **unlimited free usage**, but a
  billing account must still be attached to the project to enable any Maps
  SDK. Mohamed had not yet completed this setup as of end of session.
- **"Where is everyone" map feature**: Mohamed wants a real Google Map on
  Group Detail showing each member's last-shared location (from the existing
  one-shot `HeadingStatus` data — deliberately not continuous tracking, a
  privacy choice already baked into `location_service.dart`) plus distance to
  the venue and to each other. Decided: real Google Maps SDK (not a
  text-only "distance board" fallback). **Not started** — needs
  `google_maps_flutter` added to `pubspec.yaml`, a Maps SDK for Android API
  key enabled in Google Cloud (separate from the Places key, though can
  share a project), and the actual map widget built on Group Detail. I also
  still need `heading_status.dart`'s exact current fields to wire pins
  correctly (though the file map above should match).
- **Remaining localization wiring**: every screen besides bottom nav/Home/
  Explore/Groups list still shows hardcoded English. Keys likely already
  exist in the ARB files — check before adding new ones.
- **Remaining unverified candidate places** from `candidate_places.csv` (see
  Fix #7) — roughly 15–18 entries still need individual verification before
  being run through `discoverPlaces.ts`.

---

## Recurring Technical Patterns & Gotchas

- `lib/firebase_options.dart` gets overwritten on every zip extraction,
  requiring `flutterfire configure` to be re-run each time a `lib/` file swap
  happens and that file looks like a placeholder.
- **`AppColors` brand fields are mutable, not `const`** (supports
  user-customizable theme color via `applyAccent()`) — any widget
  referencing `AppColors.primary`/`.primaryDark`/`.primaryLight`/
  `.primarySurface`/`.primaryGradient` cannot be wrapped in `const`, even
  indirectly via a `const` ancestor, nor used as a compile-time-const default
  parameter value. Always grep for `const` in the ancestor tree before
  assuming safety.
- **`firebase deploy --only functions` silently no-ops** ("Skipped — No
  changes detected") if the built code is identical to what's already
  deployed. Always check for the literal
  `✔ functions[name] Successful update operation.` line, not just that the
  command exited without error.
- **`npm run seed` / `npm run enrich` need local auth** — either
  `gcloud auth application-default login` or a service account key via
  `$env:GOOGLE_APPLICATION_CREDENTIALS`.
- **Gradle/Java build crashes** on `flutter build apk --release` — usually
  fixed by `Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force`,
  then `flutter clean` and rebuild.
- **`firstOrNull`/`lastOrNull` are not in `dart:core`** — `package:collection`
  isn't a dependency here. Use `list.isNotEmpty ? list.first : null`.
- **Stale `BuildContext` inside bottom sheets with a nested `Consumer`**
  watching a live Firestore stream can go stale mid-`await`, silently
  skipping post-async UI feedback. Fix: capture
  `ScaffoldMessenger.of(context)` from the outer, stable screen context
  before opening the sheet, not from inside the sheet's builder.
- **Firestore list/query security rules require the query to structurally
  prove compliance** — e.g. a rule requiring `uid in memberUids` rejects a
  query that doesn't itself filter on `memberUids`, even if every actual
  result would satisfy the rule.
- **`ContinuousRectangleBorder` at pill-sized radius (999) degenerates into a
  distorted pointed-lens shape** — see the Liquid Glass postmortem above.
  Pill shapes must always use `StadiumBorder`.
- **When two files share a compile-time dependency (e.g. a model field and
  the screen that reads it), always ship them together** — don't assume a
  file sent in an earlier round was actually applied on Mohamed's machine.
- Mohamed strongly prefers **multi-file changes bundled as a single zip
  matching the project's folder structure** (extract-and-overwrite into
  project root) over separate loose file downloads — this matters less for
  Claude Code (which edits the real filesystem directly) but is worth
  knowing if generating any deliverable for him to apply by hand.

---

## Deployment Commands Reference

```powershell
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
cd functions; npm install; npm run build; firebase deploy --only functions; cd ..
cd functions; npm run seed; cd ..              # re-seed places.json to Firestore
cd functions; npm run enrich; cd ..            # pull real photos/ratings/coords (blocked, see above)
flutterfire configure                          # after any lib/ file swap, if firebase_options.dart looks like a placeholder
flutter pub get
flutter clean                                  # when in doubt after a multi-file change
flutter build apk --release
# APK lands at build\app\outputs\flutter-apk\app-release.apk
flutter build appbundle --release              # for Play Console upload (.aab, not .apk)
# AAB lands at build\app\outputs\bundle\release\app-release.aab
```

---

## Complete File Map

### Root
```
firestore.rules              # see Fix #2 above re: feed/headingStatus delete rules
firestore.indexes.json
storage.rules
pubspec.yaml                 # assets/icons/ already registered for ride-hailing logos
l10n.yaml
lib/main.dart
```

### lib/core/theme/
```
app_colors.dart   # AppColors — mutable accent fields, see gotchas
app_theme.dart    # AppTheme, AppSpacing, AppRadius, AppShape
```

### lib/core/widgets/
```
root_shell.dart          # bottom nav shell, 6 tabs — NOT yet obtained this session
common_widgets.dart       # StepperControl, CategoryChip, SectionHeader, GradientButton,
                           # GlassSurface/GlassCard (now plain solid cards, glass reverted)
place_card.dart
ride_hailing_buttons.dart # NEW this session — see Fix #5
```

### lib/core/providers/
```
app_providers.dart       # authProvider, localeProvider, onboardingCompleteProvider,
                           # AccentColorNotifier, homeFiltersProvider
firebase_providers.dart
group_providers.dart     # groupsForPlanProvider, headingStatusesProvider,
                           # locationServiceProvider, groupRepositoryProvider, userGroupsProvider
friends_providers.dart
plan_providers.dart
```

### lib/core/services/
```
location_service.dart     # one-shot only, never continuous — deliberate privacy choice
notification_service.dart
weather_service.dart      # Open-Meteo
```

### lib/data/models/
```
place.dart         # has lat/lng (nullable, never fake), parentMallId
plan.dart          # OutingPlan (now has mallId + isMallLocked), PlanStep
group.dart          # id, name, ownerUid, memberUids, freeUids, attendingUids, joinCode, planId, scheduledAt
group_feed_post.dart
heading_status.dart # uid, name, lat, lng, updatedAt, distanceToVenueMeters, venueName, isStale
crowd_check.dart
plan_suggestion.dart
plan_memory.dart
```

### lib/data/repositories/
```
places_repository.dart
plans_repository.dart
group_repository.dart        # createGroup, joinGroup, findOrCreateGroupForPlan, postToFeed,
                               # shareHeadingStatus, clearHeadingStatus, watchHeadingStatuses,
                               # toggleFree, inviteFriend, deleteGroup (now cleans up headingStatus too),
                               # watchGroupsForPlan
friends_repository.dart
public_profile_repository.dart
auth_repository.dart         # now has _ensureUserDocuments() — see Fix #3
user_data_repository.dart
plan_memories_repository.dart
```

### lib/features/
```
home/presentation/home_screen.dart
explore/presentation/explore_screen.dart
ai_planner/                                        # chat-based planner, not touched this session
plans/presentation/plans_list_screen.dart
plan_result/presentation/plan_result_screen.dart   # _RegenerateButton (now mall-aware),
                                                     # _BudgetSummaryCard, ride-hailing buttons wired in
plan_result/widgets/memories_section.dart
groups/presentation/groups_list_screen.dart
groups/presentation/group_detail_screen.dart       # restructured this session — see Fix #1
friends/presentation/friends_list_screen.dart
friends/presentation/add_friend_search_screen.dart
friends/presentation/qr_scan_screen.dart
friends/widgets/my_qr_code_dialog.dart
place_details/presentation/place_details_screen.dart  # photo gallery redesigned — see Fix #6
place_details/widgets/menu_section.dart
place_details/widgets/crowd_check_card.dart
profile/presentation/profile_screen.dart
```

### functions/src/
```
index.ts                  # all Cloud Functions — generateOutingPlan, geocodePlace,
                            # getTravelInfoForPlan, joinGroup, inviteFriendToGroup,
                            # sendGroupFeedNotification, resolvePlaceCoordinates,
                            # normalizeVenueName, SYSTEM_PROMPT, PLAN_SCHEMA
scripts/seed.ts
scripts/enrichPlaces.ts   # BLOCKED — see above, needs re-obtaining
scripts/discoverPlaces.ts # NOT obtained this session — needed for candidate_places.csv
```

### assets/
```
data/places.json          # ~200 real places, flat array, doc IDs match Firestore
icons/uber_logo.png        # Mohamed-sourced official logos for ride-hailing buttons
icons/didi_logo.png
icons/indrive_logo.png
```

### lib/l10n/
```
app_en.arb (template), app_ar.arb, app_es.arb, app_de.arb, app_ja.arb, app_fil.arb
~180 keys, all 6 files key-matched. Generated app_localizations.dart via l10n.yaml.
Only wired into: root_shell.dart, home_screen.dart, explore_screen.dart, groups_list_screen.dart.
```

### Other deliverables from this session, not part of the Flutter app itself
```
candidate_places.csv   # see Fix #7 — lead list for discoverPlaces.ts, not yet fed through it
```

---

## If a file isn't listed above at all

It hasn't come up in this project's history — don't assume it doesn't exist,
just ask Mohamed for it the same way as any other needed file. He has the
complete, real project on his machine at all times.
