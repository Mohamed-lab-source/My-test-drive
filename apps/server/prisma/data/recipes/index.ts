import type { RecipeSeed } from "../types";
import { coreRecipes } from "./core";

/** Every recipe the seed loads; add new cuisine files here. */
export const allRecipes: RecipeSeed[] = [...coreRecipes];
