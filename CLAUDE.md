# Cookmate

Bilingual (English/Arabic) cooking app for the Egypt/MENA market. Monorepo:
Express/Prisma/PostgreSQL backend (`apps/server`) + Expo/React Native mobile
app (`apps/mobile`). Backend is deployed on Railway; mobile builds to APK via
GitHub Actions (`.github/workflows/build-android.yml`).

## Standing instruction: keep the in-app feature tour up to date

`apps/mobile/src/screens/FeatureTourScreen.tsx` is a first-launch, swipeable
guide (shown right after onboarding, replayable from Profile via "Take the
app tour") that walks new users through what the app can do. It's grouped
into ~12 thematic steps (`FEATURE_TOUR_STEPS`), not one step per individual
feature -- 60+ one-per-feature slides would be unusable on first open.

**Every time a new feature ships, update this tour:**

- If the feature fits an existing step's theme (e.g. a new sort filter fits
  "Sort it your way"), extend that step's `body` translation string to
  mention it.
- If it doesn't fit any existing step, add a new entry to
  `FEATURE_TOUR_STEPS` (icon + `titleKey` + `bodyKey`) and write matching
  English and Arabic strings in `apps/mobile/src/i18n/translations.ts`
  (`featureTour.<name>.title` / `.body`, added to both the `en` and `ar`
  blocks -- see the existing entries there for the pattern).

Do this in the same commit/session as the feature itself, not as a
follow-up -- the tour drifting out of date defeats its purpose. This applies
to every future feature-adding session in this repo, not just the one where
this file was created.

## Dev loop notes

- Postgres and the tsx dev server are often not running when a session
  starts. Bring them up with:
  `pg_ctlcluster 16 main start` (if needed) then
  `nohup npx tsx watch src/index.ts > /tmp/server.log 2>&1 & disown` from
  `apps/server`, then `sleep 4 && curl http://localhost:4000/api/health`.
- Verify changes with `npx tsc --noEmit` in both `apps/mobile` and
  `apps/server`, and `npm run test` in `apps/server`, before committing.
- The Android build workflow triggers automatically on push to
  `claude/senior-app-developer-0b9qqe` touching `apps/mobile/**` and
  publishes to a rolling GitHub Release (`android-preview-latest`,
  asset `cookmate-preview.apk`). That download link stays constant across
  builds.
