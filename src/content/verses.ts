// Short, well-known verses for the Home card. Meanings are given in plain
// English (close to the Sahih International rendering), with the reference.
export const VERSES: { text: string; ref: string }[] = [
  { text: 'Indeed, with hardship comes ease.', ref: 'Ash-Sharh 94:6' },
  { text: 'Allah does not burden a soul beyond that it can bear.', ref: 'Al-Baqarah 2:286' },
  { text: 'Whoever relies upon Allah — then He is sufficient for him.', ref: 'At-Talaq 65:3' },
  { text: 'Verily, in the remembrance of Allah do hearts find rest.', ref: "Ar-Ra'd 13:28" },
  { text: 'So remember Me; I will remember you.', ref: 'Al-Baqarah 2:152' },
  { text: 'Seek help through patience and prayer.', ref: 'Al-Baqarah 2:45' },
  { text: 'Do not despair of the mercy of Allah.', ref: 'Az-Zumar 39:53' },
  { text: 'And He is with you wherever you are.', ref: 'Al-Hadid 57:4' },
  { text: 'If you are grateful, I will surely increase you.', ref: 'Ibrahim 14:7' },
  { text: 'My Lord, increase me in knowledge.', ref: 'Ta-Ha 20:114' },
  { text: 'Call upon Me; I will respond to you.', ref: 'Ghafir 40:60' },
  { text: 'Indeed, Allah is with the patient.', ref: 'Al-Baqarah 2:153' },
  { text: 'Indeed, prayer prohibits immorality and wrongdoing.', ref: "Al-'Ankabut 29:45" },
  { text: 'And speak to people good words.', ref: 'Al-Baqarah 2:83' },
  { text: 'Allah loves those who do good.', ref: "Al-Baqarah 2:195" },
  { text: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.', ref: 'Al-Baqarah 2:201' },
  { text: 'And it may be that you dislike a thing which is good for you.', ref: 'Al-Baqarah 2:216' },
  { text: 'So be patient. Indeed, the promise of Allah is truth.', ref: 'Ar-Rum 30:60' },
  { text: 'And whoever fears Allah — He will make for him a way out.', ref: 'At-Talaq 65:2' },
  { text: 'Indeed, Allah will not change the condition of a people until they change what is in themselves.', ref: "Ar-Ra'd 13:11" },
  { text: 'My mercy encompasses all things.', ref: "Al-A'raf 7:156" },
  { text: 'And your Lord is going to give you, and you will be satisfied.', ref: 'Ad-Duha 93:5' },
  { text: 'Is not Allah sufficient for His servant?', ref: 'Az-Zumar 39:36' },
  { text: 'Those who strive for Us — We will surely guide them to Our ways.', ref: "Al-'Ankabut 29:69" },
  { text: 'So flee to Allah.', ref: 'Adh-Dhariyat 51:50' },
  { text: 'And We have certainly made the Quran easy to remember.', ref: 'Al-Qamar 54:17' },
  { text: 'Do not lose heart nor grieve, for you will be superior if you are believers.', ref: "Al-'Imran 3:139" },
  { text: 'And establish prayer for My remembrance.', ref: 'Ta-Ha 20:14' },
];

// Stable for the whole local day, different from one day to the next.
export function verseOfTheDay(date: Date = new Date()) {
  const dayNumber = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86400000);
  return VERSES[((dayNumber % VERSES.length) + VERSES.length) % VERSES.length];
}
