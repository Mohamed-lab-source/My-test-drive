import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cookmate.hiddenRecipes";

/** Recipes the user marked "not interested"; they stop showing up in lists. */
export type HiddenRecipe = { slug: string; title: string; cuisineSlug: string };

type HiddenRecipesContextValue = {
  hidden: HiddenRecipe[];
  isHidden: (slug: string) => boolean;
  hide: (recipe: HiddenRecipe) => void;
  unhide: (slug: string) => void;
};

const HiddenRecipesContext = createContext<HiddenRecipesContextValue | undefined>(undefined);

export function HiddenRecipesProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState<HiddenRecipe[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setHidden(JSON.parse(stored));
      })
      .catch(() => {});
  }, []);

  const update = useCallback((updater: (prev: HiddenRecipe[]) => HiddenRecipe[]) => {
    setHidden((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const hiddenSlugs = useMemo(() => new Set(hidden.map((h) => h.slug)), [hidden]);
  const isHidden = useCallback((slug: string) => hiddenSlugs.has(slug), [hiddenSlugs]);
  const hide = useCallback(
    (recipe: HiddenRecipe) =>
      update((prev) => [{ slug: recipe.slug, title: recipe.title, cuisineSlug: recipe.cuisineSlug }, ...prev.filter((h) => h.slug !== recipe.slug)]),
    [update]
  );
  const unhide = useCallback((slug: string) => update((prev) => prev.filter((h) => h.slug !== slug)), [update]);

  const value = useMemo(() => ({ hidden, isHidden, hide, unhide }), [hidden, isHidden, hide, unhide]);

  return <HiddenRecipesContext.Provider value={value}>{children}</HiddenRecipesContext.Provider>;
}

export function useHiddenRecipes() {
  const ctx = useContext(HiddenRecipesContext);
  if (!ctx) throw new Error("useHiddenRecipes must be used within HiddenRecipesProvider");
  return ctx;
}
