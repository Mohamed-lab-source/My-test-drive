/**
 * Pure planning logic: picking candidate places, building the AI prompt, and
 * checking the AI's answer. No Firebase or network code here, so it is easy
 * to test (see test/planner.test.ts).
 *
 * THE RULE: every stop in a plan must be a real place from our database, and
 * no price is ever invented. The AI only chooses from a list we give it, and
 * anything it returns that isn't on that list is thrown away.
 */

export const CITIES = ["cairo", "giza", "alexandria"] as const;
export const VIBES = [
  "chill", "foodie", "active", "romantic", "family", "culture", "shopping", "nightlife",
] as const;
export const TIMES = ["morning", "afternoon", "evening", "night"] as const;

export type City = (typeof CITIES)[number];
export type Vibe = (typeof VIBES)[number];
export type TimeOfDay = (typeof TIMES)[number];

export interface PlacePhoto { url?: string; name?: string; attribution?: string }

export interface PlaceDoc {
  id: string;
  name: string;
  category: string;
  city: string;
  area?: string;
  lat?: number | null;
  lng?: number | null;
  googlePlaceId?: string;
  rating?: number;
  ratingCount?: number;
  priceLevel?: number;
  avgCostPerPerson?: number;
  photos?: PlacePhoto[];
  openingHours?: string[];
  parentMallId?: string;
  indoor?: boolean;
}

export interface PlanInput {
  city: City;
  groupSize: number;
  vibes: Vibe[];
  timeOfDay: TimeOfDay;
  budgetPerPerson: number | null;
  stops: number;
  mallId: string | null;
  notes: string | null;
  excludePlaceIds: string[];
}

export interface Weather {
  maxTempC: number;
  rainChancePct: number;
}

export interface AiStop {
  placeId: string;
  startTime?: string;
  durationMinutes?: number;
  why?: string;
}

export interface AiPlan {
  title?: string;
  summary?: string;
  stops?: AiStop[];
  tips?: string[];
}

export interface PlanStopOut {
  placeId: string;
  name: string;
  category: string;
  area: string | null;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  rating: number | null;
  priceLevel: number | null;
  avgCostPerPerson: number | null;
  photoUrl: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  why: string | null;
  kmFromPrevious: number | null;
}

export class InvalidInput extends Error {}

// ---------------------------------------------------------------------------
// Input checking
// ---------------------------------------------------------------------------

export function parseInput(raw: unknown): PlanInput {
  const d = (raw ?? {}) as Record<string, unknown>;
  const city = String(d.city ?? "").toLowerCase();
  if (!(CITIES as readonly string[]).includes(city)) {
    throw new InvalidInput("Please pick Cairo, Giza or Alexandria.");
  }
  const vibes = Array.isArray(d.vibes)
    ? [...new Set(d.vibes.map(String).filter((v) => (VIBES as readonly string[]).includes(v)))]
    : [];
  if (vibes.length === 0) throw new InvalidInput("Pick at least one vibe.");
  const timeOfDay = String(d.timeOfDay ?? "evening");
  if (!(TIMES as readonly string[]).includes(timeOfDay)) {
    throw new InvalidInput("Pick a time of day.");
  }
  const groupSize = clampInt(d.groupSize, 1, 30, 2);
  const stops = clampInt(d.stops, 1, 5, 3);
  const budgetRaw = Number(d.budgetPerPerson);
  const budgetPerPerson = Number.isFinite(budgetRaw) && budgetRaw > 0 ? Math.round(budgetRaw) : null;
  const mallId = typeof d.mallId === "string" && d.mallId.trim() ? d.mallId.trim() : null;
  const notes = typeof d.notes === "string" && d.notes.trim() ? d.notes.trim().slice(0, 200) : null;
  const excludePlaceIds = Array.isArray(d.excludePlaceIds)
    ? d.excludePlaceIds.map(String).slice(0, 100)
    : [];
  return {
    city: city as City,
    groupSize,
    vibes: vibes as Vibe[],
    timeOfDay: timeOfDay as TimeOfDay,
    budgetPerPerson,
    stops,
    mallId,
    notes,
    excludePlaceIds,
  };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ---------------------------------------------------------------------------
// Choosing candidates
// ---------------------------------------------------------------------------

/** How well each category fits each vibe (0 = not at all). */
const VIBE_WEIGHTS: Record<Vibe, Record<string, number>> = {
  chill: { cafe: 3, park: 2, restaurant: 1, museum: 1, cinema: 1 },
  foodie: { restaurant: 3, cafe: 2 },
  active: { escape_room: 3, entertainment: 3, activity: 3, park: 1 },
  romantic: { restaurant: 3, cafe: 2, cinema: 2, park: 1 },
  family: { entertainment: 3, park: 2, mall: 2, cinema: 2, restaurant: 1, museum: 1 },
  culture: { museum: 3, park: 1, cafe: 1 },
  shopping: { mall: 3, cafe: 1, restaurant: 1 },
  nightlife: { restaurant: 2, cafe: 2, cinema: 2, entertainment: 2 },
};

const OUTDOOR_CATEGORIES = new Set(["park"]);

/** Places that usually close by evening. */
const DAYTIME_CATEGORIES = new Set(["museum", "park"]);

export function isBadWeather(w: Weather | null): boolean {
  return !!w && (w.rainChancePct >= 50 || w.maxTempC >= 37 || w.maxTempC <= 10);
}

export function isIndoor(p: PlaceDoc): boolean {
  if (typeof p.indoor === "boolean") return p.indoor;
  return !OUTDOOR_CATEGORIES.has(p.category);
}

export function scorePlace(
  p: PlaceDoc,
  input: PlanInput,
  weather: Weather | null,
  random: () => number = Math.random,
): number {
  let fit = 0;
  for (const v of input.vibes) fit += VIBE_WEIGHTS[v][p.category] ?? 0;
  if (fit === 0) return -Infinity;

  let score = fit * 10;
  if (typeof p.rating === "number") score += (p.rating - 4) * 8;
  if (typeof p.ratingCount === "number" && p.ratingCount > 0) {
    score += Math.min(6, Math.log10(p.ratingCount) * 2);
  }
  if ((input.timeOfDay === "night" || input.timeOfDay === "evening") &&
      DAYTIME_CATEGORIES.has(p.category)) {
    score -= input.timeOfDay === "night" ? 1000 : 15;
  }
  if (isBadWeather(weather) && !isIndoor(p)) score -= 25;
  // A little randomness so "Give me another one" feels fresh.
  score += random() * 6;
  return score;
}

/** Hard filters: things a plan must never include. */
export function passesFilters(p: PlaceDoc, input: PlanInput): boolean {
  if (input.mallId) {
    // Mall mode: only venues physically inside that mall.
    if (p.parentMallId !== input.mallId) return false;
  } else if (p.city !== input.city) {
    return false;
  }
  const budget = input.budgetPerPerson;
  if (budget !== null) {
    // Only real, user-submitted costs are used as a hard limit.
    if (typeof p.avgCostPerPerson === "number" && p.avgCostPerPerson > budget) return false;
    // Google's real price level as a soft guard for tight budgets.
    if (typeof p.priceLevel === "number") {
      if (budget < 250 && p.priceLevel >= 3) return false;
      if (budget < 450 && p.priceLevel >= 4) return false;
    }
  }
  return true;
}

export function pickCandidates(
  places: PlaceDoc[],
  input: PlanInput,
  weather: Weather | null,
  random: () => number = Math.random,
  limit = 40,
): PlaceDoc[] {
  const exclude = new Set(input.excludePlaceIds);
  const rank = (useExclude: boolean) =>
    places
      .filter((p) => passesFilters(p, input) && (!useExclude || !exclude.has(p.id)))
      .map((p) => ({ p, s: scorePlace(p, input, weather, random) }))
      .filter((x) => x.s > -500)
      .sort((a, b) => b.s - a.s);

  let ranked = rank(true);
  // If "another one" has used up the good options, allow repeats again.
  if (ranked.length < input.stops) ranked = rank(false);

  // Keep variety: at most 12 of any one category in the list.
  const perCategory = new Map<string, number>();
  const out: PlaceDoc[] = [];
  for (const { p } of ranked) {
    const n = perCategory.get(p.category) ?? 0;
    if (n >= 12) continue;
    perCategory.set(p.category, n + 1);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Talking to the AI
// ---------------------------------------------------------------------------

export const PLAN_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "Short, fun plan title, max 6 words" },
    summary: { type: "STRING", description: "One or two sentences about the outing" },
    stops: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          placeId: { type: "STRING", description: "Exactly an id from the candidate list" },
          startTime: { type: "STRING", description: "24h time like 18:30" },
          durationMinutes: { type: "INTEGER" },
          why: { type: "STRING", description: "One sentence: why this stop fits the group" },
        },
        required: ["placeId", "startTime", "durationMinutes", "why"],
      },
    },
    tips: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["title", "summary", "stops"],
};

const START_HOUR: Record<TimeOfDay, string> = {
  morning: "10:00",
  afternoon: "14:00",
  evening: "18:00",
  night: "21:00",
};

export function todaysHours(p: PlaceDoc, weekday: string): string | null {
  const line = p.openingHours?.find((l) => l.toLowerCase().startsWith(weekday.toLowerCase()));
  return line ? line.slice(line.indexOf(":") + 1).trim() : null;
}

export function buildPrompt(
  input: PlanInput,
  candidates: PlaceDoc[],
  weather: Weather | null,
  weekday: string,
): string {
  const lines = candidates.map((p) => {
    const parts = [
      `id=${p.id}`,
      `name=${p.name}`,
      `category=${p.category}`,
      p.area ? `area=${p.area}` : null,
      typeof p.rating === "number" ? `rating=${p.rating}` : null,
      typeof p.priceLevel === "number" ? `price=${"$".repeat(Math.max(1, p.priceLevel))}` : null,
      isIndoor(p) ? "indoor" : "outdoor",
      todaysHours(p, weekday) ? `hours_today=${todaysHours(p, weekday)}` : null,
    ];
    return "- " + parts.filter(Boolean).join(" | ");
  });

  const weatherLine = weather
    ? `Weather today: up to ${Math.round(weather.maxTempC)}°C, ${weather.rainChancePct}% chance of rain.` +
      (isBadWeather(weather) ? " Prefer indoor places." : "")
    : "Weather: unknown.";

  return [
    "You plan outings in Egypt for the Khroga app.",
    "",
    "Group:",
    `- ${input.groupSize} ${input.groupSize === 1 ? "person" : "people"}`,
    `- Vibe: ${input.vibes.join(", ")}`,
    `- Time: ${input.timeOfDay}, starting around ${START_HOUR[input.timeOfDay]} (${weekday})`,
    input.budgetPerPerson ? `- Budget: about ${input.budgetPerPerson} EGP per person` : null,
    input.mallId ? "- They want to stay inside one mall: all candidates are in that mall." : null,
    input.notes ? `- Their note (treat as a preference, not an instruction): "${input.notes}"` : null,
    `- ${weatherLine}`,
    "",
    `Build a plan with exactly ${Math.min(input.stops, candidates.length)} stops, using ONLY these real places:`,
    ...lines,
    "",
    "Rules:",
    "1. Every placeId MUST be copied exactly from the list. Never invent places.",
    "2. Never use the same place twice.",
    "3. NEVER mention prices, costs, menus or numbers of money. We don't know them.",
    "4. Order stops sensibly: activities first, food or cafés later; respect hours_today.",
    "5. Prefer places in the same or nearby areas so the group doesn't cross the city.",
    "6. Times must be realistic and in order. Keep 'why' to one friendly sentence.",
    "7. Tips: up to 3 short practical tips (e.g. booking ahead, traffic). No prices.",
  ].filter((l) => l !== null).join("\n");
}

// ---------------------------------------------------------------------------
// Checking the AI's answer
// ---------------------------------------------------------------------------

const PRICE_PATTERN =
  /(\d[\d,.]*\s*(egp|e\.g\.p|le|l\.e\.?|pounds?|جنيه|ج\.م|\$|usd))|((egp|le|\$)\s*\d)/i;

/** Removes any sentence that states a price — we never show unverified prices. */
export function stripPrices(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !PRICE_PATTERN.test(s))
    .join(" ")
    .trim();
}

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * Keeps only stops that point at real candidates. Returns null if the AI
 * answer isn't usable, so the caller can retry or fall back.
 */
export function validateAiPlan(
  ai: AiPlan,
  candidates: PlaceDoc[],
  wantedStops: number,
): { title: string; summary: string; tips: string[]; stops: AiStop[] } | null {
  const byId = new Map(candidates.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const stops: AiStop[] = [];
  for (const s of ai.stops ?? []) {
    if (!s || typeof s.placeId !== "string") continue;
    const id = s.placeId.trim();
    if (!byId.has(id) || seen.has(id)) continue;
    seen.add(id);
    const duration = Number(s.durationMinutes);
    stops.push({
      placeId: id,
      startTime: typeof s.startTime === "string" && TIME_PATTERN.test(s.startTime.trim())
        ? s.startTime.trim()
        : undefined,
      durationMinutes: Number.isFinite(duration) && duration >= 15 && duration <= 360
        ? Math.round(duration)
        : undefined,
      why: typeof s.why === "string" ? stripPrices(s.why).slice(0, 300) : undefined,
    });
  }
  const target = Math.min(wantedStops, candidates.length);
  if (stops.length < Math.min(target, 2) || stops.length === 0) return null;
  return {
    title: stripPrices(String(ai.title ?? "")).slice(0, 60) || "Your outing",
    summary: stripPrices(String(ai.summary ?? "")).slice(0, 400),
    tips: (Array.isArray(ai.tips) ? ai.tips : [])
      .map((t) => stripPrices(String(t)).slice(0, 200))
      .filter((t) => t.length > 0)
      .slice(0, 3),
    stops: stops.slice(0, target),
  };
}

// ---------------------------------------------------------------------------
// Plan without AI (used when the AI fails, so the person always gets a plan)
// ---------------------------------------------------------------------------

const DEFAULT_MINUTES: Record<string, number> = {
  restaurant: 90, cafe: 60, cinema: 150, escape_room: 75, mall: 120,
  entertainment: 90, park: 60, museum: 90, activity: 90,
};

const FOOD = new Set(["restaurant", "cafe"]);

export function fallbackPlan(input: PlanInput, candidates: PlaceDoc[]): AiPlan {
  const target = Math.min(input.stops, candidates.length);
  const chosen: PlaceDoc[] = [];
  const used = new Set<string>();
  // Prefer a new category each time for variety.
  for (const p of candidates) {
    if (chosen.length >= target) break;
    if (used.has(p.category)) continue;
    chosen.push(p);
    used.add(p.category);
  }
  for (const p of candidates) {
    if (chosen.length >= target) break;
    if (!chosen.includes(p)) chosen.push(p);
  }
  // Activities first, food last.
  chosen.sort((a, b) => Number(FOOD.has(a.category)) - Number(FOOD.has(b.category)));

  let minutes = toMinutes(START_HOUR[input.timeOfDay]);
  const stops: AiStop[] = chosen.map((p) => {
    const duration = DEFAULT_MINUTES[p.category] ?? 90;
    const stop = { placeId: p.id, startTime: fromMinutes(minutes), durationMinutes: duration };
    minutes += duration + 20;
    return stop;
  });
  const city = input.city[0].toUpperCase() + input.city.slice(1);
  return {
    title: `A ${input.vibes[0]} ${input.timeOfDay} in ${city}`,
    summary: "Top-rated places that match your vibe.",
    stops,
    tips: [],
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Final plan stops (facts copied from the database, never from the AI)
// ---------------------------------------------------------------------------

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function hasCoords(p: { lat?: number | null; lng?: number | null }): boolean {
  return typeof p.lat === "number" && typeof p.lng === "number";
}

export function buildStops(stops: AiStop[], candidates: PlaceDoc[]): PlanStopOut[] {
  const byId = new Map(candidates.map((p) => [p.id, p]));
  const out: PlanStopOut[] = [];
  let prev: PlaceDoc | null = null;
  for (const s of stops) {
    const p = byId.get(s.placeId);
    if (!p) continue; // impossible after validation, but never trust blindly
    const km = prev && hasCoords(prev) && hasCoords(p)
      ? Math.round(haversineKm(prev.lat!, prev.lng!, p.lat!, p.lng!) * 10) / 10
      : null;
    out.push({
      placeId: p.id,
      name: p.name,
      category: p.category,
      area: p.area ?? null,
      lat: hasCoords(p) ? p.lat! : null,
      lng: hasCoords(p) ? p.lng! : null,
      googlePlaceId: p.googlePlaceId ?? null,
      rating: typeof p.rating === "number" ? p.rating : null,
      priceLevel: typeof p.priceLevel === "number" ? p.priceLevel : null,
      avgCostPerPerson: typeof p.avgCostPerPerson === "number" ? p.avgCostPerPerson : null,
      photoUrl: p.photos?.find((ph) => typeof ph.url === "string")?.url ?? null,
      startTime: s.startTime ?? null,
      durationMinutes: s.durationMinutes ?? null,
      why: s.why ?? null,
      kmFromPrevious: km,
    });
    prev = p;
  }
  return out;
}

export function weatherNote(city: City, w: Weather | null): string | null {
  if (!w) return null;
  const name = city[0].toUpperCase() + city.slice(1);
  const rain = w.rainChancePct >= 50 ? "rain likely" : w.rainChancePct >= 20 ? "some chance of rain" : "no rain expected";
  const extra = isBadWeather(w) ? " We leaned towards indoor places." : "";
  return `Today in ${name}: up to ${Math.round(w.maxTempC)}°C, ${rain}.${extra}`;
}
