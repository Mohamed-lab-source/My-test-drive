// Screens you can jump to, for "Jump back in" on Home. `color` names a
// theme colour.
export interface Destination {
  label: string;
  icon: string;
  color: string;
}

export const DESTINATIONS: Record<string, Destination> = {
  '/money/transactions': { label: 'Transactions', icon: 'list.bullet', color: 'blue' },
  '/money/budgets': { label: 'Budgets', icon: 'chart.pie.fill', color: 'orange' },
  '/money/analytics': { label: 'Analytics', icon: 'chart.bar.fill', color: 'teal' },
  '/money/insights': { label: 'Insights', icon: 'lightbulb.fill', color: 'yellow' },
  '/money/subscriptions': { label: 'Subscriptions', icon: 'repeat', color: 'purple' },
  '/money/debts': { label: 'Debts', icon: 'exclamationmark.triangle.fill', color: 'red' },
  '/money/savings': { label: 'Savings', icon: 'target', color: 'green' },
  '/money/bills-calendar': { label: 'Bills', icon: 'calendar', color: 'indigo' },
  '/money/sms-inbox': { label: 'Bank SMS', icon: 'banknote.fill', color: 'red' },
  '/money/cards': { label: 'Cards', icon: 'creditcard.fill', color: 'purple' },
  '/money/accounts': { label: 'Accounts', icon: 'building.columns.fill', color: 'blue' },
  '/money/shopping': { label: 'Shopping', icon: 'cart.badge.plus', color: 'green' },
  '/money/zakat': { label: 'Zakat', icon: 'hands.sparkles.fill', color: 'mint' },
  '/money/tools': { label: 'Tools', icon: 'function', color: 'gray' },
  '/tasks/agenda': { label: 'Agenda', icon: 'calendar', color: 'red' },
  '/tasks/meetings': { label: 'Meetings', icon: 'person.2.fill', color: 'indigo' },
  '/tasks/projects': { label: 'Projects', icon: 'folder.fill', color: 'blue' },
  '/tasks/focus': { label: 'Focus', icon: 'timer', color: 'orange' },
  '/tasks/board': { label: 'Board', icon: 'square.grid.2x2', color: 'teal' },
  '/tasks/routines': { label: 'Routines', icon: 'list.star', color: 'purple' },
  '/life/prayer-times': { label: 'Prayer times', icon: 'safari.fill', color: 'teal' },
  '/life/quran': { label: 'Quran', icon: 'book.fill', color: 'green' },
  '/life/adhkar': { label: 'Adhkar', icon: 'sun.haze.fill', color: 'orange' },
  '/life/tasbih': { label: 'Tasbih', icon: 'hands.sparkles.fill', color: 'mint' },
  '/life/duas': { label: 'Duas', icon: 'hands.sparkles.fill', color: 'cyan' },
  '/life/sunnah-prayers': { label: 'Sunnah', icon: 'sparkles', color: 'green' },
  '/life/fasting': { label: 'Fasting', icon: 'moon.fill', color: 'purple' },
  '/life/hifz': { label: 'Hifz', icon: 'book.closed.fill', color: 'indigo' },
  '/life/names': { label: '99 Names', icon: 'sparkles', color: 'indigo' },
  '/life/seasons': { label: 'Seasons', icon: 'moon.stars.fill', color: 'purple' },
  '/life/hijri-calendar': { label: 'Hijri', icon: 'calendar.badge.clock', color: 'brown' },
  '/life/habits': { label: 'Habits', icon: 'flame.fill', color: 'orange' },
  '/life/health': { label: 'Health', icon: 'drop.fill', color: 'cyan' },
  '/life/medications': { label: 'Meds', icon: 'heart.fill', color: 'red' },
  '/life/journal': { label: 'Journal', icon: 'text.book.closed.fill', color: 'indigo' },
  '/life/insights': { label: 'Life insights', icon: 'chart.xyaxis.line', color: 'teal' },
  '/life/books': { label: 'Reading', icon: 'bookmark.fill', color: 'orange' },
  '/life/countdowns': { label: 'Countdowns', icon: 'hourglass', color: 'indigo' },
  '/life/occasions': { label: 'Occasions', icon: 'gift.fill', color: 'pink' },
  '/life/notes': { label: 'Notes', icon: 'doc.text.fill', color: 'gray' },
  '/life/wishlist': { label: 'Wishlist', icon: 'lightbulb.fill', color: 'yellow' },
  '/review': { label: 'Weekly review', icon: 'chart.line.uptrend.xyaxis', color: 'purple' },
  '/recap': { label: 'Recap', icon: 'chart.bar.fill', color: 'green' },
};
