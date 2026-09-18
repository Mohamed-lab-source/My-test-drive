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
