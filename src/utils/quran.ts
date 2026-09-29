import { QURAN_PAGES } from '../db/types';

// Standard 604-page Madinah mushaf: juz 1 is pages 1–21, then every juz
// after that is 20 pages, starting on page 22.
export function juzForPage(page: number): number {
  const p = Math.min(QURAN_PAGES, Math.max(1, page));
  return p < 22 ? 1 : Math.min(30, Math.floor((p - 2) / 20) + 1);
}

export function juzEndPage(juz: number): number {
  return juz >= 30 ? QURAN_PAGES : 21 + (juz - 1) * 20;
}
