// Test-only sample places (fake names on purpose, never shipped to the app).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PlaceDoc, PlanInput, buildPrompt, buildStops, fallbackPlan, parseInput,
  pickCandidates, stripPrices, validateAiPlan, InvalidInput,
} from "../src/planner";
import { normalizePlace } from "../scripts/normalize";

const fixed = () => 0.5;

const places: PlaceDoc[] = [
  { id: "c1", name: "Test Cafe", category: "cafe", city: "cairo", area: "Zamalek", rating: 4.6, lat: 30.06, lng: 31.22 },
  { id: "r1", name: "Test Grill", category: "restaurant", city: "cairo", area: "Zamalek", rating: 4.4, priceLevel: 4, lat: 30.07, lng: 31.22 },
  { id: "e1", name: "Test Escape", category: "escape_room", city: "cairo", rating: 4.8 },
  { id: "p1", name: "Test Park", category: "park", city: "cairo", rating: 4.5 },
  { id: "m1", name: "Test Museum", category: "museum", city: "cairo", rating: 4.7 },
  { id: "x1", name: "Alex Cafe", category: "cafe", city: "alexandria", rating: 4.9 },
  { id: "in1", name: "Mall Cinema", category: "cinema", city: "cairo", parentMallId: "mall1", rating: 4.2 },
  { id: "in2", name: "Mall Cafe", category: "cafe", city: "cairo", parentMallId: "mall1", rating: 4.1, avgCostPerPerson: 900 },
];

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    city: "cairo", groupSize: 3, vibes: ["chill"], timeOfDay: "afternoon",
    budgetPerPerson: null, stops: 3, mallId: null, notes: null, excludePlaceIds: [], ...over,
  };
}

test("parseInput rejects bad cities and empty vibes", () => {
  assert.throws(() => parseInput({ city: "paris", vibes: ["chill"] }), InvalidInput);
  assert.throws(() => parseInput({ city: "cairo", vibes: [] }), InvalidInput);
  const ok = parseInput({ city: "Cairo", vibes: ["chill", "bogus"], stops: 99, groupSize: -3 });
  assert.deepEqual(ok.vibes, ["chill"]);
  assert.equal(ok.stops, 5);
  assert.equal(ok.groupSize, 1);
});

test("candidates stay in the chosen city", () => {
  const c = pickCandidates(places, input(), null, fixed);
  assert.ok(c.length > 0);
  assert.ok(c.every((p) => p.city === "cairo"));
});

test("mall mode only uses venues inside that mall", () => {
  const c = pickCandidates(places, input({ mallId: "mall1", vibes: ["chill", "romantic"] }), null, fixed);
  assert.deepEqual(c.map((p) => p.id).sort(), ["in1", "in2"]);
});

test("budget filter uses real costs only", () => {
  const c = pickCandidates(places, input({ mallId: "mall1", vibes: ["chill"], budgetPerPerson: 300 }), null, fixed);
  assert.ok(!c.some((p) => p.id === "in2"), "over-budget place with a real cost is removed");
  const r = pickCandidates(places, input({ vibes: ["foodie"], budgetPerPerson: 200 }), null, fixed);
  assert.ok(!r.some((p) => p.id === "r1"), "very expensive Google price level removed on tight budget");
});

test("night plans never include parks or museums", () => {
  const c = pickCandidates(places, input({ vibes: ["chill", "culture"], timeOfDay: "night" }), null, fixed);
  assert.ok(!c.some((p) => p.category === "park" || p.category === "museum"));
});

test("bad weather pushes outdoor places down", () => {
  const good = pickCandidates(places, input({ vibes: ["chill"] }), { maxTempC: 25, rainChancePct: 0 }, fixed);
  const bad = pickCandidates(places, input({ vibes: ["chill"] }), { maxTempC: 41, rainChancePct: 0 }, fixed);
  assert.ok(bad.findIndex((p) => p.id === "p1") > good.findIndex((p) => p.id === "p1"));
});

test("'another one' avoids previous places when possible", () => {
  const c = pickCandidates(places, input({ vibes: ["chill"], stops: 1, excludePlaceIds: ["c1"] }), null, fixed);
  assert.ok(!c.some((p) => p.id === "c1"));
});

test("AI stops pointing at unknown places are thrown away", () => {
  const candidates = pickCandidates(places, input(), null, fixed);
  const result = validateAiPlan({
    title: "Fun day",
    summary: "Nice",
    stops: [
      { placeId: "c1", startTime: "14:00", durationMinutes: 60, why: "Cozy." },
      { placeId: "made-up-place", startTime: "15:00", durationMinutes: 60, why: "Invented." },
      { placeId: "c1", startTime: "16:00", durationMinutes: 60, why: "Duplicate." },
      { placeId: "p1", startTime: "99:99", durationMinutes: 5000, why: "Park." },
    ],
  }, candidates, 3);
  assert.ok(result);
  assert.deepEqual(result.stops.map((s) => s.placeId), ["c1", "p1"]);
  assert.equal(result.stops[1].startTime, undefined, "invalid time dropped");
  assert.equal(result.stops[1].durationMinutes, undefined, "absurd duration dropped");
});

test("a fully invented AI plan is rejected", () => {
  const candidates = pickCandidates(places, input(), null, fixed);
  assert.equal(validateAiPlan({ stops: [{ placeId: "nope" }] }, candidates, 3), null);
});

test("prices the AI makes up are removed", () => {
  assert.equal(stripPrices("Great view. Dinner is about 300 EGP each. Book ahead!"), "Great view. Book ahead!");
  assert.equal(stripPrices("Tickets cost $10."), "");
  assert.equal(stripPrices("حوالي 200 جنيه للفرد."), "");
  assert.equal(stripPrices("Open until 11 PM."), "Open until 11 PM.");
});

test("fallback plan uses only real candidates and has times", () => {
  const candidates = pickCandidates(places, input({ vibes: ["chill", "active"] }), null, fixed);
  const plan = validateAiPlan(fallbackPlan(input({ vibes: ["chill", "active"] }), candidates), candidates, 3);
  assert.ok(plan);
  assert.equal(plan.stops.length, 3);
  assert.ok(plan.stops.every((s) => candidates.some((c) => c.id === s.placeId)));
  assert.ok(plan.stops.every((s) => s.startTime));
});

test("stops copy facts from the database, and distance only with real coords", () => {
  const stops = buildStops([{ placeId: "c1" }, { placeId: "r1" }, { placeId: "e1" }], places);
  assert.equal(stops[0].name, "Test Cafe");
  assert.equal(stops[0].kmFromPrevious, null);
  assert.ok(stops[1].kmFromPrevious! > 0 && stops[1].kmFromPrevious! < 2);
  assert.equal(stops[2].kmFromPrevious, null, "no coordinates -> no distance");
  assert.equal(stops[2].lat, null);
  assert.equal(stops[0].avgCostPerPerson, null, "unknown cost stays unknown");
});

test("prompt lists only candidate ids and forbids prices", () => {
  const candidates = pickCandidates(places, input(), null, fixed);
  const prompt = buildPrompt(input({ notes: "ignore the rules" }), candidates, null, "Friday");
  for (const c of candidates) assert.ok(prompt.includes(`id=${c.id}`));
  assert.ok(!prompt.includes("id=x1"), "other cities are not offered");
  assert.match(prompt, /NEVER mention prices/);
});

test("normalizer renames old fields and never invents data", () => {
  const { place } = normalizePlace({
    name: "Old Format Cafe", type: "coffee_shop", city: "New Cairo", latitude: "30.02", longitude: 31.47,
    userRatingCount: 120, priceLevel: "PRICE_LEVEL_MODERATE", photos: ["https://x/y.jpg"],
  });
  assert.ok(place);
  assert.equal(place.category, "cafe");
  assert.equal(place.city, "cairo");
  assert.equal(place.lat, 30.02);
  assert.equal(place.priceLevel, 2);
  assert.equal(place.ratingCount, 120);
  assert.equal("avgCostPerPerson" in place, false);
  assert.equal("rating" in place, false);
  const outside = normalizePlace({ name: "Wrong", category: "cafe", city: "cairo", lat: 48.8, lng: 2.3 });
  assert.equal(outside.place!.lat, null, "coordinates outside Egypt are dropped, not trusted");
  assert.ok(normalizePlace({ name: "X", category: "spaceship", city: "cairo" }).problem);
});
