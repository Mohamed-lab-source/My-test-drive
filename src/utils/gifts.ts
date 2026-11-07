// Gifts given and received (النقطة / الهدايا): who gave what, so you know
// what to give back. Pure helpers.

export type GiftOccasion = 'wedding' | 'engagement' | 'baby' | 'eid' | 'birthday' | 'housewarming' | 'hajj' | 'graduation' | 'sickness' | 'other';

export const GIFT_OCCASIONS: { id: GiftOccasion; label: string; emoji: string }[] = [
  { id: 'wedding', label: 'Wedding', emoji: '💍' },
  { id: 'engagement', label: 'Engagement', emoji: '💐' },
  { id: 'baby', label: 'New baby', emoji: '👶' },
  { id: 'eid', label: 'Eid', emoji: '🌙' },
  { id: 'birthday', label: 'Birthday', emoji: '🎂' },
  { id: 'housewarming', label: 'New home', emoji: '🏠' },
  { id: 'hajj', label: 'Hajj / Umrah', emoji: '🕋' },
  { id: 'graduation', label: 'Graduation', emoji: '🎓' },
  { id: 'sickness', label: 'Get well', emoji: '💐' },
  { id: 'other', label: 'Other', emoji: '🎁' },
];

export interface Gift {
  person: string;
  occasion: GiftOccasion;
  direction: 'given' | 'received';
  // Money, in minor units; null for a present.
  amount: number | null;
  currency: string;
  // A present instead of (or as well as) money.
  item: string | null;
  // 'YYYY-MM-DD'
  date: string;
  note: string | null;
}

export const personKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

export interface GiftBalance {
  key: string;
  person: string;
  given: number;
  received: number;
  count: number;
  lastDate: string;
  // The most recent gift they gave you.
  lastReceived: Gift | null;
  lastGiven: Gift | null;
}

// One line per person, most recent first.
export function giftBalances(gifts: Gift[]): GiftBalance[] {
  const map = new Map<string, GiftBalance>();
  const sorted = [...gifts].sort((a, b) => a.date.localeCompare(b.date));
  for (const g of sorted) {
    const key = personKey(g.person);
    if (!key) continue;
    const b = map.get(key) ?? { key, person: g.person.trim(), given: 0, received: 0, count: 0, lastDate: g.date, lastReceived: null, lastGiven: null };
    b.count++;
    b.lastDate = g.date;
    b.person = g.person.trim();
    if (g.direction === 'given') {
      b.given += g.amount ?? 0;
      b.lastGiven = g;
    } else {
      b.received += g.amount ?? 0;
      b.lastReceived = g;
    }
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

// What to give someone: what they gave you last time (money), if they did
// since you last gave them something.
export function giftSuggestion(person: string, gifts: Gift[]): { amount: number; currency: string; because: Gift } | null {
  const b = giftBalances(gifts).find((x) => x.key === personKey(person));
  const r = b?.lastReceived;
  if (!r || r.amount == null) return null;
  if (b.lastGiven && b.lastGiven.date >= r.date) return null;
  return { amount: r.amount, currency: r.currency, because: r };
}

export function giftYearTotals(gifts: Gift[], year: number): { given: number; received: number; count: number } {
  const ys = String(year);
  const these = gifts.filter((g) => g.date.startsWith(ys));
  return {
    given: these.filter((g) => g.direction === 'given').reduce((s, g) => s + (g.amount ?? 0), 0),
    received: these.filter((g) => g.direction === 'received').reduce((s, g) => s + (g.amount ?? 0), 0),
    count: these.length,
  };
}

// People who gave you a money gift you haven't returned yet.
export function giftsToReturn(gifts: Gift[]): GiftBalance[] {
  return giftBalances(gifts).filter((b) => b.lastReceived && b.lastReceived.amount != null && !(b.lastGiven && b.lastGiven.date >= b.lastReceived.date));
}
