// Short, well-known hadith (meaning in English) with their main sources.
export interface Hadith {
  text: string;
  source: string;
}

export const HADITH: Hadith[] = [
  { text: 'Actions are judged by intentions.', source: 'Bukhari & Muslim' },
  { text: 'None of you truly believes until he loves for his brother what he loves for himself.', source: 'Bukhari & Muslim' },
  { text: 'The strong one is not the one who overcomes others by force, but the one who controls himself when angry.', source: 'Bukhari & Muslim' },
  { text: 'Whoever believes in Allah and the Last Day, let him speak good or remain silent.', source: 'Bukhari & Muslim' },
  { text: 'Make things easy and do not make them difficult; give good news and do not drive people away.', source: 'Bukhari & Muslim' },
  { text: 'The deeds most beloved to Allah are those done consistently, even if they are small.', source: 'Bukhari & Muslim' },
  { text: 'Your smile for your brother is charity.', source: 'Tirmidhi' },
  { text: 'Allah does not look at your appearance or your wealth, but He looks at your hearts and your deeds.', source: 'Muslim' },
  { text: 'Charity does not decrease wealth.', source: 'Muslim' },
  { text: 'The best of you are those who learn the Quran and teach it.', source: 'Bukhari' },
  { text: "Part of a person's good Islam is leaving what does not concern him.", source: 'Tirmidhi' },
  { text: 'Do not become angry.', source: 'Bukhari' },
  { text: 'Whoever relieves a believer of a hardship of this world, Allah will relieve him of a hardship on the Day of Resurrection.', source: 'Muslim' },
  { text: 'Fear Allah wherever you are, follow a bad deed with a good one to wipe it out, and treat people with good character.', source: 'Tirmidhi' },
  { text: 'The most complete of the believers in faith are those with the best character.', source: 'Abu Dawud & Tirmidhi' },
  { text: 'Whoever does not thank people has not thanked Allah.', source: 'Abu Dawud & Tirmidhi' },
  { text: 'Purity is half of faith.', source: 'Muslim' },
  { text: 'Whoever takes a path seeking knowledge, Allah makes easy for him a path to Paradise.', source: 'Muslim' },
  { text: 'Be in this world as if you were a stranger or a traveller.', source: 'Bukhari' },
  { text: 'The religion is sincerity.', source: 'Muslim' },
  { text: 'Allah is gentle and loves gentleness in all matters.', source: 'Bukhari & Muslim' },
  { text: 'There are two blessings in which many people are at a loss: health and free time.', source: 'Bukhari' },
  { text: 'A good word is charity.', source: 'Bukhari & Muslim' },
  { text: 'The upper hand is better than the lower hand (the giving hand is better than the receiving one).', source: 'Bukhari & Muslim' },
  { text: 'Whoever is not merciful to people, Allah will not be merciful to him.', source: 'Bukhari & Muslim' },
];

export function hadithOfTheDay(now: Date = new Date()): Hadith {
  const day = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
  return HADITH[((day % HADITH.length) + HADITH.length) % HADITH.length];
}
