import type { AdhkarSession } from '../db/types';

export interface Dhikr {
  id: string;
  arabic?: string;
  text: string;
  count: number;
  sessions: AdhkarSession[];
}

// A short, commonly taught selection of the morning and evening adhkar.
// Longer passages are listed by name rather than reproduced in full.
export const ADHKAR: Dhikr[] = [
  { id: 'kursi', text: 'Ayat al-Kursi (Al-Baqarah 2:255)', count: 1, sessions: ['morning', 'evening'] },
  { id: 'quls', text: 'Al-Ikhlas, Al-Falaq and An-Nas', count: 3, sessions: ['morning', 'evening'] },
  {
    id: 'baqarah-end',
    text: 'Last two verses of Al-Baqarah (2:285–286)',
    count: 1,
    sessions: ['evening'],
  },
  { id: 'istighfar-sayyid', text: 'Sayyid al-Istighfar — “Allahumma anta Rabbi…”', count: 1, sessions: ['morning', 'evening'] },
  {
    id: 'bismillah-la-yadurr',
    arabic: 'بِسْمِ اللهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
    text: 'In the name of Allah, with whose name nothing on earth or in heaven can cause harm, and He is the All-Hearing, the All-Knowing',
    count: 3,
    sessions: ['morning', 'evening'],
  },
  {
    id: 'kalimat-tammat',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    text: 'I seek refuge in the perfect words of Allah from the evil of what He has created',
    count: 3,
    sessions: ['evening'],
  },
  {
    id: 'radeetu',
    arabic: 'رَضِيتُ بِاللهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا',
    text: 'I am pleased with Allah as my Lord, Islam as my religion and Muhammad ﷺ as my Prophet',
    count: 3,
    sessions: ['morning', 'evening'],
  },
  {
    id: 'hasbiyallah',
    arabic: 'حَسْبِيَ اللهُ لَا إِلَٰهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
    text: 'Allah is sufficient for me; there is no god but He. In Him I trust, and He is Lord of the Mighty Throne',
    count: 7,
    sessions: ['morning', 'evening'],
  },
  {
    id: 'tahlil',
    arabic: 'لَا إِلَٰهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
    text: 'None has the right to be worshipped but Allah alone, without partner. His is the dominion and His is the praise, and He is over all things capable',
    count: 10,
    sessions: ['morning', 'evening'],
  },
  {
    id: 'subhanallah-wabihamdih',
    arabic: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ',
    text: 'Glory be to Allah and praise be to Him',
    count: 100,
    sessions: ['morning', 'evening'],
  },
  {
    id: 'astaghfirullah',
    arabic: 'أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ',
    text: 'I seek the forgiveness of Allah and repent to Him',
    count: 100,
    sessions: ['morning'],
  },
];

export const adhkarFor = (session: AdhkarSession) => ADHKAR.filter((d) => d.sessions.includes(session));
