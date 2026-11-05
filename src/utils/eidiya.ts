// Eidiya (العيدية): who gets how much this Eid, and which new notes to get
// from the bank so each envelope is exact. Pure helpers.

export interface EidiyaPerson {
  name: string;
  // In minor units.
  amount: number;
  currency: string;
  given: boolean;
  // A group to sort by: kids, nieces & nephews, family…
  group: string | null;
}

// Egyptian notes, biggest first (major units).
export const EGP_NOTES = [200, 100, 50, 20, 10, 5, 1];

// The fewest notes that make up one amount (whole pounds).
export function notesFor(amountMajor: number, notes: number[] = EGP_NOTES): Record<number, number> {
  let left = Math.max(0, Math.round(amountMajor));
  const out: Record<number, number> = {};
  for (const n of notes) {
    const k = Math.floor(left / n);
    if (k > 0) {
      out[n] = k;
      left -= k * n;
    }
  }
  return out;
}

// Notes needed for every envelope still to give.
export function eidiyaNotes(people: EidiyaPerson[], notes: number[] = EGP_NOTES): { note: number; count: number }[] {
  const total: Record<number, number> = {};
  for (const p of people) {
    if (p.given) continue;
    for (const [n, k] of Object.entries(notesFor(p.amount / 100, notes))) total[Number(n)] = (total[Number(n)] ?? 0) + k;
  }
  return notes.filter((n) => total[n]).map((n) => ({ note: n, count: total[n] }));
}

export function eidiyaTotals(people: EidiyaPerson[]): { total: number; given: number; left: number; people: number } {
  const total = people.reduce((s, p) => s + p.amount, 0);
  const given = people.filter((p) => p.given).reduce((s, p) => s + p.amount, 0);
  return { total, given, left: total - given, people: people.length };
}
