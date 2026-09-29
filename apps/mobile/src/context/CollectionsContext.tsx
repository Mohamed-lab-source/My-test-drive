import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  addRecipeToCollection,
  createCollection,
  deleteCollection,
  fetchCollections,
  removeRecipeFromCollection,
  renameCollection,
} from "../api/endpoints";
import type { Collection, RecipeSummary } from "../api/types";

type CollectionsContextValue = {
  collections: Collection[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  create: (name: string) => Promise<Collection>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addRecipe: (id: string, recipe: RecipeSummary) => Promise<void>;
  removeRecipe: (id: string, slug: string) => Promise<void>;
  collectionsContaining: (slug: string) => Collection[];
};

const CollectionsContext = createContext<CollectionsContextValue | undefined>(undefined);

export function CollectionsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setCollections([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setCollections(await fetchCollections());
    } catch {
      setCollections([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const create = useCallback(async (name: string) => {
    const collection = await createCollection(name);
    setCollections((prev) => [...prev, collection]);
    return collection;
  }, []);

  const rename = useCallback(async (id: string, name: string) => {
    await renameCollection(id, name);
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteCollection(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addRecipe = useCallback(async (id: string, recipe: RecipeSummary) => {
    await addRecipeToCollection(id, recipe.slug);
    setCollections((prev) =>
      prev.map((c) => (c.id === id && !c.recipes.some((r) => r.slug === recipe.slug) ? { ...c, recipes: [recipe, ...c.recipes] } : c))
    );
  }, []);

  const removeRecipe = useCallback(async (id: string, slug: string) => {
    await removeRecipeFromCollection(id, slug);
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, recipes: c.recipes.filter((r) => r.slug !== slug) } : c))
    );
  }, []);

  const collectionsContaining = useCallback(
    (slug: string) => collections.filter((c) => c.recipes.some((r) => r.slug === slug)),
    [collections]
  );

  const value = useMemo(
    () => ({ collections, isLoading, refresh: load, create, rename, remove, addRecipe, removeRecipe, collectionsContaining }),
    [collections, isLoading, load, create, rename, remove, addRecipe, removeRecipe, collectionsContaining]
  );

  return <CollectionsContext.Provider value={value}>{children}</CollectionsContext.Provider>;
}

export function useCollections() {
  const ctx = useContext(CollectionsContext);
  if (!ctx) throw new Error("useCollections must be used within CollectionsProvider");
  return ctx;
}
