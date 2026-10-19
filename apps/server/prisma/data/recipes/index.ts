import type { RecipeSeed } from "../types";
import { coreRecipes } from "./core";
import { egyptian1 } from "./egyptian1";
import { egyptian2 } from "./egyptian2";
import { egyptian3 } from "./egyptian3";
import { egyptian4 } from "./egyptian4";
import { egyptian5 } from "./egyptian5";

/** Every recipe the seed loads; add new cuisine files here. */
export const allRecipes: RecipeSeed[] = [
  ...coreRecipes,
  ...egyptian1,
  ...egyptian2,
  ...egyptian3,
  ...egyptian4,
  ...egyptian5,
];
