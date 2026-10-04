// Tests for the OpenStreetMap converter, using made-up map elements.
// Run: node --test tool/
import { test } from "node:test";
import assert from "node:assert/strict";
import { convert, categoryOf, insidePolygon } from "./fetch_osm_places.mjs";

const elements = [
  { type: "node", id: 1, lat: 30.06, lon: 31.22, tags: { place: "suburb", name: "Testville" } },
  { type: "node", id: 2, lat: 30.061, lon: 31.221, tags: { amenity: "cafe", name: "Test Cafe", opening_hours: "Mo-Su 09:00-23:00", website: "x.com" } },
  { type: "way", id: 3, center: { lat: 30.5, lon: 31.5 }, tags: { amenity: "restaurant", name: "مطعم تجربة", "name:en": "Try Restaurant", cuisine: "egyptian" } },
  { type: "node", id: 4, lat: 30.0, lon: 31.0, tags: { amenity: "bank", name: "Not a place for outings" } },
  { type: "node", id: 5, lat: 30.0, lon: 31.0, tags: { amenity: "cafe" } },
  { type: "node", id: 6, lat: 30.0, lon: 31.0, tags: { amenity: "cafe", name: "Closed", disused: "yes" } },
  { type: "way", id: 10, center: { lat: 30.1005, lon: 31.1005 }, tags: { shop: "mall", name: "Test Mall", website: "m.com" } },
  { type: "node", id: 11, lat: 30.1002, lon: 31.1002, tags: { amenity: "cinema", name: "Mall Cinema" } },
  { type: "node", id: 12, lat: 30.0, lon: 31.0, tags: { leisure: "park", name: "Tiny Park" } },
];
const malls = [{ type: "way", id: 10, geometry: [
  { lat: 30.1, lon: 31.1 }, { lat: 30.1, lon: 31.101 }, { lat: 30.101, lon: 31.101 }, { lat: 30.101, lon: 31.1 },
] }];

test("keeps only named outing places, copied as-is", () => {
  const out = convert("cairo", elements, malls);
  const names = out.map((p) => p.name).sort();
  assert.deepEqual(names, ["Mall Cinema", "Test Cafe", "Test Mall", "Try Restaurant"]);
  const cafe = out.find((p) => p.name === "Test Cafe");
  assert.equal(cafe.openingHours, "Mo-Su 09:00-23:00");
  assert.equal(cafe.area, "Testville");
  assert.equal(cafe.osmUrl, "https://www.openstreetmap.org/node/2");
  assert.equal("rating" in cafe, false, "no invented ratings");
});

test("Arabic and English names", () => {
  const r = convert("cairo", elements, malls).find((p) => p.id === "osm-way-3");
  assert.equal(r.name, "Try Restaurant");
  assert.equal(r.nameAr, "مطعم تجربة");
  assert.equal(r.area, undefined, "too far from any neighbourhood: left unknown");
});

test("venues inside a mall outline are linked to it", () => {
  const out = convert("cairo", elements, malls);
  assert.equal(out.find((p) => p.name === "Mall Cinema").parentMallId, "osm-way-10");
  assert.equal(out.find((p) => p.name === "Test Cafe").parentMallId, undefined);
});

test("undocumented parks are skipped", () => {
  assert.equal(convert("cairo", elements, malls).some((p) => p.name === "Tiny Park"), false);
});

test("categories and geometry helpers", () => {
  assert.equal(categoryOf({ leisure: "escape_game" }), "escape_room");
  assert.equal(categoryOf({ tourism: "museum" }), "museum");
  assert.equal(categoryOf({ amenity: "bank" }), null);
  const square = [[0, 0], [0, 1], [1, 1], [1, 0]];
  assert.equal(insidePolygon([0.5, 0.5], square), true);
  assert.equal(insidePolygon([1.5, 0.5], square), false);
});
