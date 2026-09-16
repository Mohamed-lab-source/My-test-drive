# Cookmate

A cooking companion app: pick what you're in the mood for (fit & healthy, a
dessert, or just balanced), browse recipes by cuisine (Italian, Asian,
Egyptian) or dish type, follow step-by-step instructions with photos, and
generate a weighted shopping list scaled to your servings and budget — with
quick links to grocery delivery apps (Talabat, Breadfast, InstaShop) and
nearby supermarkets.

## Architecture

```
apps/
  server/   Express + TypeScript API, PostgreSQL via Prisma
  mobile/   Expo (React Native + TypeScript) app, React Navigation
```

- **Auth**: email/password with JWT, bcrypt-hashed passwords.
- **Personalization**: a `Preference` (diet goal: FIT / INDULGENT / BALANCED /
  NONE, favorite cuisines) drives recipe ranking, both server-side for signed
  in users and client-side (from locally stored onboarding answers) for
  anonymous browsing.
- **Recipes**: seeded with 18 real recipes across Italian, Asian and Egyptian
  cuisines (mains, appetizers, soups, breakfast, quick meals, and desserts),
  each with ingredients, step photos, prep/cook time and difficulty.
- **Shopping list**: given a recipe, desired servings and an optional budget,
  the API scales every ingredient's weight/volume/count, estimates cost per
  item (seeded EGP pricing) and totals it, flagging over/under budget.
- **Delivery & location**: static entries for Talabat, Breadfast and
  InstaShop (deep link to their sites) plus a Google Maps "supermarkets near
  me" link built from the device's location — no paid Places API key
  required. This is intentionally a lightweight MVP: swap in a real Places
  API or partner integrations for production.

## Prerequisites

- Node.js 20+
- PostgreSQL running locally (or update `DATABASE_URL`)

## Server setup

```bash
cd apps/server
cp .env.example .env        # adjust DATABASE_URL / JWT_SECRET if needed
npm install
npx prisma migrate dev      # creates tables
npm run prisma:seed         # loads cuisines, recipes, ingredients
npm run dev                 # http://localhost:4000
```

Health check: `curl http://localhost:4000/api/health`

### Key endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/signup`, `/api/auth/login` | JWT auth |
| GET/PUT | `/api/auth/me`, `/api/auth/me/preferences` | profile + diet goal/cuisines |
| GET | `/api/cuisines` | Italian / Asian / Egyptian |
| GET | `/api/recipes?cuisine=&tag=&q=` | filterable list |
| GET | `/api/recipes/recommended` | personalized ranking |
| GET | `/api/recipes/:slug` | full detail incl. steps + photos |
| POST | `/api/recipes/:slug/shopping-list` | `{ servings, budget? }` → scaled list + cost |
| GET | `/api/shopping-lists`, `/:id` | saved history (auth required) |
| GET | `/api/delivery-partners`, `/api/nearby-stores?lat=&lng=` | delivery + maps link |

## Mobile app setup

```bash
cd apps/mobile
cp .env.example .env        # set EXPO_PUBLIC_API_URL to reach your server
npm install
npm run start                # then press i / a / w, or scan the QR with Expo Go
```

`EXPO_PUBLIC_API_URL` notes:
- Android emulator: `http://10.0.2.2:4000/api` (the default)
- iOS simulator / web: `http://localhost:4000/api` (the default)
- Physical device: your computer's LAN IP, e.g. `http://192.168.1.20:4000/api`

### Build an installable APK (no Android Studio needed)

Expo's EAS Build compiles the app in the cloud and hands you a download
link — no local Android SDK required. Run this from your own machine (not
this sandbox, which blocks Expo's build servers):

```bash
cd apps/mobile
npm install -g eas-cli   # or use `npx eas-cli` below instead
eas login                # free Expo account
eas build --platform android --profile preview
```

That builds using the `preview` profile in `eas.json` (produces a plain
`.apk` you can sideload, instead of the Play Store `.aab` format). EAS
prints a QR code and URL when it's done — scan it on your phone or download
the `.apk` and install it directly (enable "install unknown apps" for your
browser/file manager first).

The app will point at whatever `EXPO_PUBLIC_API_URL` was set to at build
time, so either deploy the server somewhere reachable from your phone first,
or rebuild after changing `apps/mobile/.env`.

### App flow

1. **Onboarding** — pick a goal (fit/dessert/balanced) and favorite cuisines;
   stored locally so recommendations work before you ever sign up.
2. **Home** — cuisine categories, quick filters (desserts/fit/quick), and a
   personalized "Recommended for you" row.
3. **Recipe detail** — hero photo, time/difficulty/servings chips,
   ingredient list, and numbered step cards each with its own photo.
4. **Shopping list** — set servings and an optional EGP budget, generate a
   weighted list with per-item and total cost, an over/under-budget banner,
   delivery partner buttons, and a "find nearby supermarkets" button that
   uses device location.
5. **Profile** — sign up/log in to sync diet goal, favorite cuisines and
   shopping list history across sessions.

## Testing notes

- Server: verified end-to-end with `prisma migrate dev`, seeding, and a full
  curl smoke test (signup → set preferences → personalized recommendations →
  budget-aware shopping list generation → history → nearby stores).
- Server unit tests: `npm run test -w apps/server` (Vitest) covers the
  shopping-list scaling/pricing/budget math in `src/utils/shoppingListMath.ts`.
- Basic hardening: `helmet` security headers and rate limiting (20 req/15min)
  on `/api/auth/signup` and `/api/auth/login`.
- Mobile: `npx tsc --noEmit` passes and `npx expo config` validates the app
  config. This sandbox's network policy blocks `api.expo.dev` /
  `reactnative.directory`, so an actual `expo start`/simulator run could not
  be exercised here — do that locally with `npm run start` before shipping.

## Known simplifications (MVP scope)

- Ingredient prices are estimated EGP figures for demo purposes, not live
  market prices.
- Delivery partner links open each app/website's homepage rather than a
  prefilled cart (no public partner API available).
- Nearby-store search uses a keyless Google Maps search link rather than the
  paid Places API.
- No app icon/splash assets are committed (binary files couldn't be pushed
  through this session's text-only GitHub API path); `app.json` omits icon
  fields so Expo falls back to its defaults. Add real branding assets under
  `apps/mobile/assets/` and reference them in `app.json` before shipping.
