import type { RecipeSeed } from "../types";
import { coreRecipes } from "./core";
import { egyptian1 } from "./egyptian1";
import { egyptian2 } from "./egyptian2";
import { egyptian3 } from "./egyptian3";
import { egyptian4 } from "./egyptian4";
import { egyptian5 } from "./egyptian5";
import { gulf1 } from "./gulf1";
import { gulf2 } from "./gulf2";
import { gulf3 } from "./gulf3";
import { iraqi } from "./iraqi";
import { levantine1 } from "./levantine1";
import { levantine2 } from "./levantine2";
import { levantine3 } from "./levantine3";
import { sudanese } from "./sudanese";
import { yemeni } from "./yemeni";

/** Every recipe the seed loads; add new cuisine files here. */
export const allRecipes: RecipeSeed[] = [
  ...coreRecipes,
  ...egyptian1,
  ...egyptian2,
  ...egyptian3,
  ...egyptian4,
  ...egyptian5,
  ...gulf1,
  ...gulf2,
  ...gulf3,
  ...iraqi,
  ...levantine1,
  ...levantine2,
  ...levantine3,
  ...sudanese,
  ...yemeni,
];
