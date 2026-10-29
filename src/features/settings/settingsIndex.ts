// What each Settings section is called, and every setting, so the Settings
// search and the app-wide search can find them.

export type SettingsSection = 'general' | 'money' | 'prayer' | 'notifications' | 'data';

export const SECTION_TITLES: Record<SettingsSection, string> = {
  general: 'General',
  money: 'Money',
  prayer: 'Prayer & Hijri',
  notifications: 'Notifications',
  data: 'Data & backup',
};

// Every setting, findable from the search box on the main Settings page.
export const SEARCH_INDEX: { label: string; section: SettingsSection; words: string }[] = [
  { label: 'Appearance (light / dark)', section: 'general', words: 'theme dark light mode system soft' },
  { label: 'Text size', section: 'general', words: 'font large bigger accessibility' },
  { label: '24-hour clock', section: 'general', words: 'time format clock' },
  { label: 'Whole-number amounts', section: 'general', words: 'decimals cents round money format' },
  { label: 'Vibration', section: 'general', words: 'haptics vibrate' },
  { label: 'Open the app on', section: 'general', words: 'start tab launch' },
  { label: 'Accent colour', section: 'general', words: 'color theme tint' },
  { label: 'Your name', section: 'general', words: 'greeting name' },
  { label: 'Currency', section: 'money', words: 'egp usd currency base' },
  { label: 'Default account', section: 'money', words: 'account new transactions' },
  { label: 'Low-balance alert', section: 'money', words: 'balance alert warning' },
  { label: 'Daily spending limit', section: 'money', words: 'limit daily alert' },
  { label: 'Weekend & week start', section: 'money', words: 'weekend saturday sunday monday week' },
  { label: 'When my month starts (payday)', section: 'money', words: 'month payday salary start day' },
  { label: 'Exchange rates', section: 'money', words: 'fx rate currency convert' },
  { label: 'Categories', section: 'money', words: 'categories edit' },
  { label: 'Prayer city', section: 'prayer', words: 'city location prayer times' },
  { label: 'Adhan alerts', section: 'prayer', words: 'adhan athan azan prayer notification' },
  { label: "Jumu'ah, fasting & occasions", section: 'prayer', words: 'jummah friday fast monday thursday ramadan eid' },
  { label: 'Hijri date adjustment', section: 'prayer', words: 'hijri islamic date calendar' },
  { label: 'Asr calculation', section: 'prayer', words: 'asr hanafi shafi madhab' },
  { label: 'Reminders', section: 'notifications', words: 'reminders notifications meetings bills' },
  { label: 'Morning briefing', section: 'notifications', words: 'morning briefing summary' },
  { label: 'Card payment due', section: 'notifications', words: 'credit card due payment' },
  { label: 'Monthly recap & weekly review', section: 'notifications', words: 'recap review weekly monthly' },
  { label: 'Quiet hours', section: 'notifications', words: 'quiet night silent' },
  { label: 'Spending digest', section: 'notifications', words: 'nightly digest spending' },
  { label: 'Water reminders', section: 'notifications', words: 'water drink' },
  { label: 'Tahajjud & evening check-in', section: 'notifications', words: 'tahajjud night journal mood' },
  { label: 'Export backup', section: 'data', words: 'backup export save json' },
  { label: 'Restore from backup', section: 'data', words: 'restore import' },
  { label: 'Export CSV', section: 'data', words: 'csv spreadsheet excel export transactions tasks' },
  { label: 'Monthly report', section: 'data', words: 'report share month' },
  { label: 'Reset all data', section: 'data', words: 'reset delete erase wipe' },
  { label: 'Bank SMS & every bank', section: 'notifications', words: 'sms bank alerts watch every bank cards' },
  { label: 'Prayer & Asr settings', section: 'prayer', words: 'madhab hanafi calculation adjust minutes' },
];


export function searchSettings(query: string): typeof SEARCH_INDEX {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SEARCH_INDEX.filter((r) => `${r.label} ${r.words}`.toLowerCase().includes(q));
}
