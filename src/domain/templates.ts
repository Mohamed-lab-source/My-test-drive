// Starter templates for the Add Habit wizard — a tap-to-prefill shortcut so
// creating a habit doesn't start from a blank page. Every field is still
// editable afterward.

export interface HabitTemplate {
  icon: string;
  name: string;
  cue: string;
  craving: string;
  response: string;
  reward: string;
  twoMinuteVersion: string;
}

/** Offered in the emoji picker, in addition to whatever a template already set. */
export const ICON_CHOICES = [
  "⭐",
  "💧",
  "📖",
  "🧘",
  "🏃",
  "✍️",
  "🛏️",
  "🚶",
  "🥗",
  "🙏",
  "🦷",
  "🎸",
  "🌙",
  "💪",
  "🎯",
  "🧠",
  "🎨",
  "🌱",
  "☀️",
  "🚭",
];

export const HABIT_TEMPLATES: HabitTemplate[] = [
  {
    icon: "💧",
    name: "Drink water",
    cue: "I sit down at my desk",
    craving: "I feel refreshed, not sluggish",
    response: "Drink a full glass of water",
    reward: "Cross it off, feel awake",
    twoMinuteVersion: "Take one sip",
  },
  {
    icon: "📖",
    name: "Read",
    cue: "I get into bed",
    craving: "I get lost in a good story",
    response: "Read a few pages",
    reward: "Fall asleep feeling accomplished",
    twoMinuteVersion: "Read one page",
  },
  {
    icon: "🧘",
    name: "Meditate",
    cue: "I finish brushing my teeth",
    craving: "I feel calm and centered",
    response: "Sit and breathe",
    reward: "Notice the calm before the day starts",
    twoMinuteVersion: "Take 3 deep breaths",
  },
  {
    icon: "🏃",
    name: "Exercise",
    cue: "My alarm goes off",
    craving: "I feel strong and energized",
    response: "Do a workout",
    reward: "Enjoy the endorphin rush",
    twoMinuteVersion: "Put on my workout clothes",
  },
  {
    icon: "✍️",
    name: "Journal",
    cue: "I pour my morning coffee",
    craving: "I get clarity on my thoughts",
    response: "Write three pages",
    reward: "Feel lighter, clearer",
    twoMinuteVersion: "Write one sentence",
  },
  {
    icon: "🛏️",
    name: "Make the bed",
    cue: "I get out of bed",
    craving: "My room feels put-together",
    response: "Make the bed",
    reward: "One small win before the day starts",
    twoMinuteVersion: "Pull the covers up",
  },
  {
    icon: "🚶",
    name: "Walk outside",
    cue: "I finish lunch",
    craving: "I get fresh air and a clear head",
    response: "Walk around the block",
    reward: "Come back refreshed",
    twoMinuteVersion: "Step outside for a minute",
  },
  {
    icon: "🥗",
    name: "Eat a vegetable",
    cue: "I sit down for dinner",
    craving: "I feel good about what I'm eating",
    response: "Add a serving of vegetables",
    reward: "Feel nourished",
    twoMinuteVersion: "Add one bite of vegetables",
  },
  {
    icon: "🙏",
    name: "Gratitude note",
    cue: "I sit down for dinner",
    craving: "I notice the good in my day",
    response: "Write one thing I'm grateful for",
    reward: "Feel a little happier",
    twoMinuteVersion: "Think of one good thing",
  },
  {
    icon: "🦷",
    name: "Floss",
    cue: "I finish brushing my teeth",
    craving: "I want a healthy smile",
    response: "Floss my teeth",
    reward: "Mouth feels clean",
    twoMinuteVersion: "Floss one tooth",
  },
  {
    icon: "🎸",
    name: "Practice a skill",
    cue: "I get home from work",
    craving: "I enjoy getting better at something",
    response: "Practice for 20 minutes",
    reward: "See visible progress",
    twoMinuteVersion: "Pick it up for one minute",
  },
  {
    icon: "🌙",
    name: "Wind down screen-free",
    cue: "It's an hour before bed",
    craving: "I want to sleep better",
    response: "Put the phone away and read or stretch",
    reward: "Fall asleep faster",
    twoMinuteVersion: "Put the phone in another room",
  },
];
