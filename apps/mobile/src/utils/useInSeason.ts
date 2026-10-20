import { useEffect, useState } from "react";
import { fetchIngredients } from "../api/endpoints";
import { inSeason, type Produce } from "../data/seasonalProduce";
import { useLocale } from "../i18n/LocaleContext";

/** This month's produce plus the matching catalog ingredient ids (empty until the catalog loads). */
export function useInSeason(): { produce: Produce[]; ingredientIds: string[] } {
  const { locale } = useLocale();
  const [ingredientIds, setIngredientIds] = useState<string[]>([]);
  const produce = inSeason();

  useEffect(() => {
    let cancelled = false;
    fetchIngredients()
      .then((catalog) => {
        if (cancelled) return;
        const names = new Set(inSeason().map((p) => p[locale]));
        setIngredientIds(catalog.filter((i) => names.has(i.name)).map((i) => i.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return { produce, ingredientIds };
}
