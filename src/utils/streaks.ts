// Longest run of consecutive calendar days among 'YYYY-MM-DD' keys.
export function longestStreak(dateKeys: string[]): number {
  const days = Array.from(new Set(dateKeys))
    .map((k) => {
      const [y, m, d] = k.split('-').map(Number);
      return Math.round(new Date(y, m - 1, d).getTime() / 86400000);
    })
    .sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] - days[i - 1] === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}
