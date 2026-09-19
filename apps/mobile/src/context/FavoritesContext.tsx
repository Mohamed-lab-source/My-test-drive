import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { addFavorite, fetchFavorites, fetchRecipes, removeFavorite } from "../api/endpoints";
import type { RecipeSummary } from "../api/types";

const LOCAL_STORAGE_KEY = "cookmate.localFavoriteSlugs";

type FavoritesContextValue = {
  isLoading: boolean;
  favoriteRecipes: RecipeSummary[];
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (recipe: RecipeSummary) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [favoriteRecipes, setFavoriteRecipes] = useState<RecipeSummary[]>([]);
  const [localSlugs, setLocalSlugs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isAuthenticated) {
        setFavoriteRecipes(await fetchFavorites());
      } else {
        const raw = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
        const slugs: string[] = raw ? JSON.parse(raw) : [];
        setLocalSlugs(slugs);
        if (slugs.length === 0) {
          setFavoriteRecipes([]);
        } else {
          const all = await fetchRecipes({});
          setFavoriteRecipes(all.filter((r) => slugs.includes(r.slug)));
        }
      }
    } catch {
      setFavoriteRecipes([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const favoriteSlugSet = useMemo(() => new Set(favoriteRecipes.map((r) => r.slug)), [favoriteRecipes]);
  const isFavorite = useCallback((slug: string) => favoriteSlugSet.has(slug), [favoriteSlugSet]);

  const toggleFavorite = useCallback(
    async (recipe: RecipeSummary) => {
      const currentlyFavorited = favoriteSlugSet.has(recipe.slug);

      if (isAuthenticated) {
        setFavoriteRecipes((prev) =>
          currentlyFavorited ? prev.filter((r) => r.slug !== recipe.slug) : [recipe, ...prev]
        );
        try {
          if (currentlyFavorited) await removeFavorite(recipe.slug);
          else await addFavorite(recipe.slug);
        } catch {
          load().catch(() => {});
        }
        return;
      }

      const nextSlugs = currentlyFavorited
        ? localSlugs.filter((s) => s !== recipe.slug)
        : [recipe.slug, ...localSlugs];
      setLocalSlugs(nextSlugs);
      setFavoriteRecipes((prev) =>
        currentlyFavorited ? prev.filter((r) => r.slug !== recipe.slug) : [recipe, ...prev]
      );
      await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextSlugs));
    },
    [favoriteSlugSet, isAuthenticated, localSlugs, load]
  );

  const value = useMemo(
    () => ({ isLoading, favoriteRecipes, isFavorite, toggleFavorite }),
    [isLoading, favoriteRecipes, isFavorite, toggleFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
