// "#travel #work" style tags written anywhere in a note.
export function extractTags(note: string | null | undefined): string[] {
  if (!note) return [];
  const out = new Set<string>();
  for (const m of note.matchAll(/#([A-Za-z0-9_\-\u0600-\u06FF]{1,30})/g)) out.add(m[1].toLowerCase());
  return Array.from(out);
}

// Every tag in use, most frequent first.
export function allTags(notes: (string | null)[]): string[] {
  const counts = new Map<string, number>();
  for (const n of notes) for (const t of extractTags(n)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}
