// Central home for backward-compatible record migrations.
//
// IndexedDB itself has no per-record schema — bumping DB_VERSION and using
// onupgradeneeded only lets you create/rename stores and indexes once, when
// the version changes. It doesn't help with the far more common case here:
// a *field* gets added to a domain type, and every record written before
// that field existed is just missing it — including ones that arrive later
// via a restored JSON backup exported from an older build, which never goes
// through onupgradeneeded at all.
//
// So instead: every store's repo.ts list*() read runs its records through
// the matching backfill function below, applying the same default every
// time. It's idempotent (a record that already has the field is untouched)
// and it's the *only* place that needs to know about a field's default.
//
// Adding a new field to a domain type? Add its default here, in the
// backfill for that store — not inline in repo.ts.

import type { CheckIn, Habit, Identity, TimeOfDay } from "../domain/types.js";

export function backfillHabit(h: Habit): Habit {
  return {
    ...h,
    timeOfDay: h.timeOfDay ?? ("anytime" as TimeOfDay),
    // Falls back to creation time so pre-existing habits keep their
    // original relative order the first time sortOrder is read.
    sortOrder: h.sortOrder ?? Date.parse(h.createdAt),
    tags: h.tags ?? [],
  };
}

export function backfillIdentity(i: Identity): Identity {
  return { ...i, icon: i.icon ?? "🧭", why: i.why ?? "" };
}

export function backfillCheckIn(c: CheckIn): CheckIn {
  return { ...c, skipped: c.skipped ?? false, frozen: c.frozen ?? false, note: c.note ?? "" };
}
