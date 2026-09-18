# Atomic — a habit coaching app inspired by *Atomic Habits*

A local-first web app for building habits using the core mechanics from James
Clear's *Atomic Habits*: identity-based habits, the Four Laws of Behavior
Change, habit stacking, the 2-minute rule, and the Habit Scorecard —
plus an analytics dashboard to see the data behind the compounding.

## Features

- **Habit Scorecard** — the book's onboarding exercise: list your routine and
  rate each behavior `+` / `-` / `=` to build awareness before changing anything.
- **Identities** — define who you're trying to become ("I am a healthy
  person"), link habits to that identity, and watch votes accumulate.
- **Habits with the Four Laws** — every habit captures its cue (obvious),
  craving (attractive), response (easy), and reward (satisfying), plus an
  optional 2-minute starter version and a stacking anchor ("After
  \[X\], I will \[this habit\]").
- **Today** — a daily check-in list respecting each habit's frequency, with
  one-tap completion, streaks, and stacked habits shown as chains.
- **Dashboard** — stat tiles, a 12-week consistency heatmap, a completion-rate
  chart per habit, and identity-vote trends.

## Tech

Dependency-free TypeScript compiled to native ES modules — no bundler, no
npm packages, no CDN. Data is stored entirely in the browser via IndexedDB
(nothing leaves your machine). Charts are hand-rolled inline SVG.

## Running it

Requires only `tsc` (TypeScript compiler) and a static file server; both are
available as globally-installed CLI tools in this environment, so no
`npm install` is needed.

```bash
npm run build   # compiles src/**/*.ts -> public/js/**/*.js
npm run serve   # serves public/ on http://localhost:8080
# or both:
npm run dev
```

Then open `http://localhost:8080/index.html`.

If you edit anything under `src/`, re-run `npm run build` (or `npm run
watch`) to regenerate `public/js/`.

## Android app (.apk)

`android/` wraps the same web app in a thin native Android shell (a WebView
loading the bundled `public/` assets via `androidx.webkit`'s
`WebViewAssetLoader`, so ES modules and IndexedDB work correctly). It's still
fully local — no network permission, no server.

Building an `.apk` needs the Android SDK and a network connection to Google's
Maven repo, so it's built by CI rather than in this sandbox:
[`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml) builds a
debug-signed APK on every push to this branch (or via **Actions → Build
Android APK → Run workflow**) and publishes it two ways:

- As a workflow run artifact (Actions tab → the run → Artifacts).
- Attached to the [`apk-latest` release](../../releases/tag/apk-latest),
  which always points at the most recent build — the easiest link to open
  from a phone.

To install: download `atomic-habits-debug.apk` on your Android device, open
it (you'll be prompted to allow installs from that source), and install.
It's a debug-signed build meant for personal sideloading, not the Play Store.

If you change `src/` or `public/`, run `npm run android:sync` before
rebuilding the APK — it recompiles TypeScript and refreshes
`android/app/src/main/assets/www/` from `public/`.
