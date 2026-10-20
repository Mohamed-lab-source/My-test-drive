/** The minimal entry shape the helpers need (matches DiaryEntry). */
type EntryLike = { title: string; date: string; createdAt: number };

/**
 * Foods logged most often since `sinceKey`, most frequent first (ties: most
 * recent first). Each is represented by its latest entry so re-logging uses
 * the latest calories and portion.
 */
export function frequentFoods<T extends EntryLike>(entries: T[], sinceKey: string, limit = 6): T[] {
  const groups = new Map<string, { latest: T; count: number }>();
  for (const e of entries) {
    if (e.date < sinceKey) continue;
    const key = e.title.trim().toLowerCase();
    const g = groups.get(key);
    if (!g) groups.set(key, { latest: e, count: 1 });
    else {
      g.count++;
      if (e.createdAt > g.latest.createdAt) g.latest = e;
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || b.latest.createdAt - a.latest.createdAt)
    .slice(0, limit)
    .map((g) => g.latest);
}
