// Cards on Home that can be hidden from the Customize sheet.
export const HOME_CARDS: { id: string; label: string }[] = [
  { id: 'rings', label: 'Today rings (prayers · tasks · water)' },
  { id: 'friday', label: "Friday checklist (Jumu'ah)" },
  { id: 'seasons', label: 'Ramadan & Eid countdown' },
  { id: 'mood', label: 'Mood check-in' },
  { id: 'verse', label: 'Verse of the day' },
  { id: 'names', label: 'Name of Allah of the day' },
  { id: 'hadith', label: 'Hadith of the day' },
  { id: 'gratitude', label: 'A past gratitude' },
  { id: 'insight', label: 'Insight of the day' },
  { id: 'spent', label: 'Spent today line' },
  { id: 'countdown', label: 'Next countdown' },
  { id: 'water', label: 'Water' },
  { id: 'networth', label: 'Net worth' },
  { id: 'accounts', label: 'Cards & accounts' },
  { id: 'stats', label: 'Month · tasks · streak' },
  { id: 'review', label: 'Weekly review' },
  { id: 'prayers', label: 'Prayer tracker' },
  { id: 'today', label: 'Today' },
  { id: 'bills', label: 'Upcoming bills' },
];

// Shortcuts that can fill the four quick-action buttons on Home.
export const QUICK_ACTIONS: { id: string; label: string; icon: string; color: string; route?: string }[] = [
  { id: 'expense', label: 'Expense', icon: 'cart.fill', color: 'red' },
  { id: 'task', label: 'Task', icon: 'checkmark.circle.fill', color: 'blue' },
  { id: 'tasbih', label: 'Tasbih', icon: 'hands.sparkles.fill', color: 'mint', route: '/life/tasbih' },
  { id: 'quran', label: 'Quran', icon: 'book.fill', color: 'green', route: '/life/quran' },
  { id: 'income', label: 'Income', icon: 'arrow.down.circle.fill', color: 'green' },
  { id: 'journal', label: 'Journal', icon: 'text.book.closed.fill', color: 'indigo', route: '/life/journal' },
  { id: 'water', label: 'Health', icon: 'drop.fill', color: 'cyan', route: '/life/health' },
  { id: 'prayer', label: 'Prayer times', icon: 'safari.fill', color: 'teal', route: '/life/prayer-times' },
  { id: 'sms', label: 'Bank SMS', icon: 'banknote.fill', color: 'orange', route: '/money/sms-inbox' },
  { id: 'insights', label: 'Insights', icon: 'lightbulb.fill', color: 'yellow', route: '/money/insights' },
  { id: 'focus', label: 'Focus', icon: 'timer', color: 'purple', route: '/tasks/focus' },
  { id: 'notes', label: 'Notes', icon: 'doc.text.fill', color: 'gray', route: '/life/notes' },
];
