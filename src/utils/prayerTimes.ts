import { CalculationMethod, Coordinates, Madhab, PrayerTimes, Qibla, SunnahTimes } from 'adhan';
import type { Prayer } from '../db/types';

type MethodName = keyof typeof CalculationMethod;

export interface PrayerCity {
  id: string;
  name: string;
  lat: number;
  lng: number;
  method: MethodName;
  hanafi?: boolean;
}

// Each city uses the calculation method its local authorities follow.
export const PRAYER_CITIES: PrayerCity[] = [
  { id: 'cairo', name: 'Cairo', lat: 30.0444, lng: 31.2357, method: 'Egyptian' },
  { id: 'alexandria', name: 'Alexandria', lat: 31.2001, lng: 29.9187, method: 'Egyptian' },
  { id: 'dubai', name: 'Dubai', lat: 25.2048, lng: 55.2708, method: 'Dubai' },
  { id: 'abudhabi', name: 'Abu Dhabi', lat: 24.4539, lng: 54.3773, method: 'Dubai' },
  { id: 'sharjah', name: 'Sharjah', lat: 25.3463, lng: 55.4209, method: 'Dubai' },
  { id: 'riyadh', name: 'Riyadh', lat: 24.7136, lng: 46.6753, method: 'UmmAlQura' },
  { id: 'jeddah', name: 'Jeddah', lat: 21.4858, lng: 39.1925, method: 'UmmAlQura' },
  { id: 'makkah', name: 'Makkah', lat: 21.3891, lng: 39.8579, method: 'UmmAlQura' },
  { id: 'madinah', name: 'Madinah', lat: 24.5247, lng: 39.5692, method: 'UmmAlQura' },
  { id: 'dammam', name: 'Dammam', lat: 26.4207, lng: 50.0888, method: 'UmmAlQura' },
  { id: 'kuwait', name: 'Kuwait City', lat: 29.3759, lng: 47.9774, method: 'Kuwait' },
  { id: 'doha', name: 'Doha', lat: 25.2854, lng: 51.531, method: 'Qatar' },
  { id: 'manama', name: 'Manama', lat: 26.2285, lng: 50.586, method: 'UmmAlQura' },
  { id: 'muscat', name: 'Muscat', lat: 23.588, lng: 58.3829, method: 'MuslimWorldLeague' },
  { id: 'amman', name: 'Amman', lat: 31.9454, lng: 35.9284, method: 'MuslimWorldLeague' },
  { id: 'beirut', name: 'Beirut', lat: 33.8938, lng: 35.5018, method: 'MuslimWorldLeague' },
  { id: 'baghdad', name: 'Baghdad', lat: 33.3152, lng: 44.3661, method: 'MuslimWorldLeague' },
  { id: 'istanbul', name: 'Istanbul', lat: 41.0082, lng: 28.9784, method: 'Turkey' },
  { id: 'ankara', name: 'Ankara', lat: 39.9334, lng: 32.8597, method: 'Turkey' },
  { id: 'casablanca', name: 'Casablanca', lat: 33.5731, lng: -7.5898, method: 'MuslimWorldLeague' },
  { id: 'rabat', name: 'Rabat', lat: 34.0209, lng: -6.8416, method: 'MuslimWorldLeague' },
  { id: 'tunis', name: 'Tunis', lat: 36.8065, lng: 10.1815, method: 'MuslimWorldLeague' },
  { id: 'algiers', name: 'Algiers', lat: 36.7538, lng: 3.0588, method: 'MuslimWorldLeague' },
  { id: 'karachi', name: 'Karachi', lat: 24.8607, lng: 67.0011, method: 'Karachi', hanafi: true },
  { id: 'lahore', name: 'Lahore', lat: 31.5204, lng: 74.3587, method: 'Karachi', hanafi: true },
  { id: 'kualalumpur', name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869, method: 'Singapore' },
  { id: 'jakarta', name: 'Jakarta', lat: -6.2088, lng: 106.8456, method: 'Singapore' },
  { id: 'london', name: 'London', lat: 51.5074, lng: -0.1278, method: 'MoonsightingCommittee' },
  { id: 'paris', name: 'Paris', lat: 48.8566, lng: 2.3522, method: 'MuslimWorldLeague' },
  { id: 'berlin', name: 'Berlin', lat: 52.52, lng: 13.405, method: 'MuslimWorldLeague' },
  { id: 'newyork', name: 'New York', lat: 40.7128, lng: -74.006, method: 'NorthAmerica' },
  { id: 'toronto', name: 'Toronto', lat: 43.6532, lng: -79.3832, method: 'NorthAmerica' },
];

export const findPrayerCity = (id: string | null) => PRAYER_CITIES.find((c) => c.id === id) ?? null;

export type PrayerSchedule = Record<Prayer, Date>;

function computeTimes(city: PrayerCity, date: Date): PrayerTimes {
  const params = CalculationMethod[city.method]();
  if (city.hanafi) params.madhab = Madhab.Hanafi;
  return new PrayerTimes(new Coordinates(city.lat, city.lng), date, params);
}

export function getPrayerSchedule(city: PrayerCity, date: Date): PrayerSchedule {
  const t = computeTimes(city, date);
  return { fajr: t.fajr, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha };
}

export function getDayDetails(city: PrayerCity, date: Date): PrayerSchedule & { sunrise: Date; lastThird: Date } {
  const t = computeTimes(city, date);
  return {
    fajr: t.fajr,
    sunrise: t.sunrise,
    dhuhr: t.dhuhr,
    asr: t.asr,
    maghrib: t.maghrib,
    isha: t.isha,
    lastThird: new SunnahTimes(t).lastThirdOfTheNight,
  };
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// Degrees clockwise from true north toward the Kaaba, plus a compass point.
export function getQibla(city: PrayerCity): { degrees: number; direction: string } {
  const degrees = Qibla(new Coordinates(city.lat, city.lng));
  return { degrees, direction: COMPASS[Math.round(degrees / 45) % 8] };
}

const ORDER: Prayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

// The next prayer from `now`, rolling over to tomorrow's Fajr after Isha.
export function getNextPrayer(city: PrayerCity, now: Date = new Date()): { prayer: Prayer; time: Date } {
  const today = getPrayerSchedule(city, now);
  for (const p of ORDER) if (today[p] > now) return { prayer: p, time: today[p] };
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { prayer: 'fajr', time: getPrayerSchedule(city, tomorrow).fajr };
}

export function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
