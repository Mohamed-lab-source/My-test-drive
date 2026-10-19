import type { RecipeSeed } from "../types";
import { coreRecipes } from "./core";
import { egyptian1 } from "./egyptian1";
import { egyptian2 } from "./egyptian2";
import { egyptian3 } from "./egyptian3";
import { egyptian4 } from "./egyptian4";
import { egyptian5 } from "./egyptian5";
import { french1 } from "./french1";
import { french2 } from "./french2";
import { greek1 } from "./greek1";
import { gulf1 } from "./gulf1";
import { gulf2 } from "./gulf2";
import { gulf3 } from "./gulf3";
import { iraqi } from "./iraqi";
import { italian1 } from "./italian1";
import { italian2 } from "./italian2";
import { italian3 } from "./italian3";
import { levantine1 } from "./levantine1";
import { levantine2 } from "./levantine2";
import { levantine3 } from "./levantine3";
import { mediterranean1 } from "./mediterranean1";
import { mediterranean2 } from "./mediterranean2";
import { moroccan1 } from "./moroccan1";
import { moroccan2 } from "./moroccan2";
import { persian } from "./persian";
import { spanish1 } from "./spanish1";
import { sudanese } from "./sudanese";
import { tunisian } from "./tunisian";
import { turkish1 } from "./turkish1";
import { turkish2 } from "./turkish2";
import { yemeni } from "./yemeni";

/** Every recipe the seed loads; add new cuisine files here. */
export const allRecipes: RecipeSeed[] = [
  ...coreRecipes,
  ...egyptian1,
  ...egyptian2,
  ...egyptian3,
  ...egyptian4,
  ...egyptian5,
  ...french1,
  ...french2,
  ...greek1,
  ...gulf1,
  ...gulf2,
  ...gulf3,
  ...iraqi,
  ...italian1,
  ...italian2,
  ...italian3,
  ...levantine1,
  ...levantine2,
  ...levantine3,
  ...mediterranean1,
  ...mediterranean2,
  ...moroccan1,
  ...moroccan2,
  ...persian,
  ...spanish1,
  ...sudanese,
  ...tunisian,
  ...turkish1,
  ...turkish2,
  ...yemeni,
];
