# Cookmate

A cooking companion app for people who can't cook yet: pick what you're in
the mood for (fit & healthy, a dessert, or just balanced), browse recipes
across 11 world cuisines (Italian, Asian, Egyptian, Mexican, Indian,
Levantine, Mediterranean, French, American, Moroccan, Turkish) or dish type,
follow step-by-step instructions with nutrition facts, and generate a
weighted shopping list scaled to your servings and budget — with quick links
to grocery delivery apps (Talabat, Breadfast, InstaShop) and nearby
supermarkets. The app works in English and Arabic (with right-to-left
layout), switchable from Profile at any time.

## Architecture

```
apps/
  server/   Express + TypeScript API, PostgreSQL via Prisma
  mobile/   Expo (React Native + TypeScript) app, React Navigation
```

- **Auth**: email/password with JWT, bcrypt-hashed passwords, plus optional
  Google sign-in (`POST /api/auth/google`, verifies a Google ID token
  server-side and issues the same JWT). Google sign-in auto-links to an
  existing email/password account with a matching email, or creates a new
  account. It returns a clear "not configured" error until `GOOGLE_CLIENT_ID`
  is set — see "Google sign-in setup" below.
- **Recipe sharing**: the recipe detail screen renders an off-screen branded
  card (title, cuisine, scaled ingredients, numbered steps), captures it to a
  PNG with `react-native-view-shot`, and hands it to the OS's native share
  sheet via `expo-sharing` — so it can go to WhatsApp, Instagram, Messages,
  or anywhere else the device offers, without per-app integration.
- **Personalization**: a `Preference` (diet goal: FIT / INDULGENT / BALANCED /
  NONE, favorite cuisines) drives recipe ranking, both server-side for signed
  in users and client-side (from locally stored onboarding answers) for
  anonymous browsing.
- **Recipes**: seeded with 42 real recipes across 11 cuisines (Italian,
  Asian, Egyptian, Mexican, Indian, Levantine, Mediterranean, French,
  American, Moroccan, Turkish — mains, appetizers, soups, breakfast, quick
  meals, and desserts), each with ingredients, steps, prep/cook time and
  difficulty.
- **Nutrition**: each ingredient carries calories/protein/fat/carbs per unit
  (per gram/ml/piece, standard nutrition-database estimates); the recipe
  detail endpoint sums this across the recipe and divides by base servings
  to report calories/protein/fat/carbs per serving.
- **Languages**: English and Arabic. Every cuisine name, recipe title,
  description, ingredient name and step instruction has an Arabic
  translation stored alongside the English original; the API picks one
  based on a `?lang=en|ar` query param (falling back to English if a
  translation is ever missing). The mobile app sends this automatically
  based on the user's chosen language and mirrors the layout to
  right-to-left for Arabic.
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
| POST | `/api/auth/signup`, `/api/auth/login` | email/password JWT auth |
| POST | `/api/auth/google` | Google ID token → JWT (needs `GOOGLE_CLIENT_ID`) |
| GET/PUT | `/api/auth/me`, `/api/auth/me/preferences` | profile + diet goal/cuisines |
| GET | `/api/cuisines` | all 11 cuisines |
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

### Google sign-in setup

Google sign-in needs one OAuth Client ID from Google Cloud Console — this
can only be created by whoever owns (or creates) the Google account/project,
so it's not something that can be generated for you. Once you have it, it
goes in two places (it's a public identifier, not a secret, so it's fine to
commit/ship):

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
   (create a new project first if you don't have one — top-left project
   picker → "New Project").
2. If prompted, configure the **OAuth consent screen** first: choose
   "External", fill in an app name + your email for the required fields,
   and add your email as a test user. This only needs to be done once per
   project.
3. Back on the Credentials page: **Create Credentials → OAuth client ID →
   Application type: Web application**. (Web, not Android/iOS — this avoids
   needing an Android signing certificate fingerprint, since the app opens
   Google's sign-in page in a browser rather than using a native SDK.)
4. Under **Authorized redirect URIs**, add exactly:
   `https://auth.expo.io/@toukhys-team/cookmate`
5. Click Create. Copy the **Client ID** shown (looks like
   `123456789-abc...apps.googleusercontent.com`).
6. Put that value in:
   - `apps/mobile/eas.json` → `build.preview.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID`
     (rebuild the APK afterward — `EXPO_PUBLIC_*` vars are baked in at build
     time).
   - The Railway service's environment variables → `GOOGLE_CLIENT_ID` (same
     value; redeploy to pick it up).

Until both are set, the "Continue with Google" button shows a friendly
"not set up yet" message instead of failing silently.

### App flow

1. **Onboarding** — pick a goal (fit/dessert/balanced) and favorite cuisines;
   stored locally so recommendations work before you ever sign up.
2. **Home** — cuisine categories (all 11), quick filters (desserts/fit/quick),
   and a personalized "Recommended for you" row.
3. **Recipe detail** — cuisine emoji, time/difficulty/servings chips, a
   nutrition panel (calories/protein/fat/carbs per serving), a servings
   stepper that live-rescales every ingredient quantity, numbered step
   cards, and a "Share recipe" button that generates a branded image (title,
   scaled ingredients, steps) and opens the device's share sheet for
   WhatsApp, Instagram, or anywhere else.
4. **Shopping list** — set servings and an optional EGP budget, generate a
   weighted list with per-item and total cost, an over/under-budget banner,
   delivery partner buttons, and a "find nearby supermarkets" button that
   uses device location.
5. **Profile** — sign up/log in (email/password or Google) to sync diet
   goal, favorite cuisines and shopping list history across sessions; also
   where you switch the app's language between English and Arabic.

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
- Nutrition figures are standard nutrition-database estimates for each
  ingredient, not lab-measured values for the specific brands/cuts a shopper
  would actually buy.
- Delivery partner links open each app/website's homepage rather than a
  prefilled cart (no public partner API available).
- Nearby-store search uses a keyless Google Maps search link rather than the
  paid Places API.
- No app icon/splash assets are committed (binary files couldn't be pushed
  through this session's text-only GitHub API path); `app.json` omits icon
  fields so Expo falls back to its defaults. Add real branding assets under
  `apps/mobile/assets/` and reference them in `app.json` before shipping.
- No photos anywhere in the app — an earlier version used stock photos that
  didn't reliably match the dish, so they were removed in favor of honest
  cuisine emoji placeholders until real, licensed food photography is
  available.
- Arabic covers all cuisine names, recipe titles/descriptions, ingredient
  names, step instructions and app UI chrome. It does **not** cover
  categorical/enum data (dish type like "Pizza", tags like "FIT"/"DESSERT",
  difficulty like "MEDIUM") — those still render in English regardless of
  language, since translating enum values would need a separate mapping
  layer not built here.
- Switching language forces a right-to-left layout change via React
  Native's `I18nManager`, which only fully re-flows on the next app
  launch — text and content flip immediately, but the user is prompted to
  restart the app for pixel-perfect RTL mirroring of the whole UI.
- Google sign-in routes through Expo's hosted auth proxy
  (`auth.expo.io`) rather than native Android/iOS Google Sign-In SDKs, since
  that avoids needing an Android signing certificate fingerprint for this
  sideloaded (non-Play-Store) build. If that proxy is ever retired, the
  fallback is switching `apps/mobile/src/auth/googleAuth.ts` to platform
  native client IDs.
- The share feature always shares one composed image (title + ingredients +
  steps) rather than deep-linking into WhatsApp/Instagram's own
  recipe/story-specific composers — the OS share sheet is what actually
  offers "send to WhatsApp", "share to Instagram Story", "save image", etc.,
  and this works without maintaining per-app integrations.
