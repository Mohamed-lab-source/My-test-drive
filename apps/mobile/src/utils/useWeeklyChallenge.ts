import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchCuisines } from "../api/endpoints";
import { useCookStreak } from "../context/CookStreakContext";
import { useLocale } from "../i18n/LocaleContext";
import { weekNumber, weekStartKey } from "./week";
import type { Cuisine } from "../api/types";

const STORAGE_KEY = "cookmate.weeklyChallenge";

/**
 * "Cook a cuisine you've never tried" -- one per week. The pick is stored so
 * cooking it doesn't immediately swap the challenge for another untried one.
 */
export function useWeeklyChallenge(): { cuisine: Cuisine | null; completed: boolean } {
  const { locale } = useLocale();
  const { cuisinesCooked, recentlyCooked } = useCookStreak();
  const [cuisine, setCuisine] = useState<Cuisine | null>(null);
  const week = weekStartKey();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [all, stored] = await Promise.all([fetchCuisines(), AsyncStorage.getItem(STORAGE_KEY)]);
        if (cancelled || all.length === 0) return;
        const saved = stored ? (JSON.parse(stored) as { week: string; slug: string }) : null;
        let pick = saved?.week === week ? all.find((c) => c.slug === saved.slug) : undefined;
        if (!pick) {
          const untried = all.filter((c) => !cuisinesCooked.includes(c.slug)).sort((a, b) => a.slug.localeCompare(b.slug));
          const pool = untried.length > 0 ? untried : [...all].sort((a, b) => a.slug.localeCompare(b.slug));
          pick = pool[weekNumber() % pool.length];
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ week, slug: pick.slug })).catch(() => {});
        }
        setCuisine(pick);
      } catch {
        // Offline: no challenge this time.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-pick when the week or language changes, not after every cook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, locale]);

  const completed = !!cuisine && recentlyCooked.some((r) => r.cuisineSlug === cuisine.slug && r.date >= week);
  return { cuisine, completed };
}
