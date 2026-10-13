// Tests for the OpenStreetMap converter, using made-up map elements.
// Run: node --test tool/fetch_osm_places.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  convert, categoryOf, insidePolygon, mallShapes, detailsOf, commonsFileOf, commonsUrls,
  socialUrl, menuUrlOf,
} from "./fetch_osm_places.mjs";

const elements = [
  { type: "node", id: 1, lat: 30.06, lon: 31.22, tags: { place: "suburb", name: "Testville" } },
  { type: "node", id: 2, lat: 30.061, lon: 31.221, tags: { amenity: "cafe", name: "Test Cafe", opening_hours: "Mo-Su 09:00-23:00", website: "x.com", outdoor_seating: "yes", internet_access: "wlan" } },
  { type: "way", id: 3, center: { lat: 30.5, lon: 31.5 }, tags: { amenity: "restaurant", name: "مطعم تجربة", "name:en": "Try Restaurant", cuisine: "egyptian" } },
  { type: "node", id: 4, lat: 30.0, lon: 31.0, tags: { amenity: "bank", name: "Not a place for outings" } },
  { type: "node", id: 5, lat: 30.0, lon: 31.0, tags: { amenity: "cafe" } },
  { type: "node", id: 6, lat: 30.0, lon: 31.0, tags: { amenity: "cafe", name: "Closed", disused: "yes" } },
  { type: "way", id: 10, center: { lat: 30.1005, lon: 31.1005 }, tags: { shop: "mall", name: "Test Mall", website: "m.com" } },
  { type: "node", id: 11, lat: 30.1002, lon: 31.1002, tags: { amenity: "cinema", name: "Mall Cinema", level: "2" } },
  { type: "node", id: 12, lat: 30.0, lon: 31.0, tags: { leisure: "park", name: "Tiny Park" } },
  { type: "node", id: 13, lat: 30.1003, lon: 31.1003, tags: { shop: "clothes", name: "Mall Shop" } },
  { type: "node", id: 14, lat: 30.3, lon: 31.3, tags: { shop: "clothes", name: "Street Shop" } },
  { type: "node", id: 15, lat: 30.3, lon: 31.3, tags: { historic: "castle", name: "Old Citadel", wikidata: "Q123", wikimedia_commons: "File:Citadel view.jpg" } },
  { type: "relation", id: 20, center: { lat: 30.2005, lon: 31.2005 }, tags: { shop: "mall", name: "Big Mall" } },
  { type: "node", id: 21, lat: 30.2002, lon: 31.2002, tags: { amenity: "fast_food", name: "Burger Spot" } },
];
const malls = mallShapes([
  { type: "way", id: 10, geometry: [
    { lat: 30.1, lon: 31.1 }, { lat: 30.1, lon: 31.101 }, { lat: 30.101, lon: 31.101 }, { lat: 30.101, lon: 31.1 },
  ] },
  { type: "relation", id: 20, members: [{ type: "way", role: "outer", geometry: [
    { lat: 30.2, lon: 31.2 }, { lat: 30.2, lon: 31.201 }, { lat: 30.201, lon: 31.201 }, { lat: 30.201, lon: 31.2 },
  ] }] },
]);

const out = convert("cairo", elements, malls);
const byName = (n) => out.find((p) => p.name === n);

test("keeps only named outing places, copied as-is", () => {
  const names = out.map((p) => p.name).sort();
  assert.deepEqual(names, ["Big Mall", "Burger Spot", "Mall Cinema", "Mall Shop", "Old Citadel", "Test Cafe", "Test Mall", "Try Restaurant"]);
  const cafe = byName("Test Cafe");
  assert.equal(cafe.openingHours, "Mo-Su 09:00-23:00");
  assert.equal(cafe.area, "Testville");
  assert.equal(cafe.osmUrl, "https://www.openstreetmap.org/node/2");
  assert.equal("rating" in cafe, false, "no invented ratings");
});

test("details are copied from map tags only", () => {
  assert.deepEqual(byName("Test Cafe").details, { outdoorSeating: true, wifi: true });
  assert.equal(byName("Try Restaurant").details, undefined, "no tags, no details");
  assert.equal(byName("Mall Cinema").details.level, "2");
  assert.deepEqual(detailsOf({ "payment:credit_cards": "no", "payment:debit_cards": "no" }), { cards: false });
  assert.deepEqual(detailsOf({ "payment:visa": "yes" }), { cards: true });
  assert.deepEqual(detailsOf({ cuisine: "coffee_shop;shisha" }), { shisha: true });
});

test("Arabic and English names", () => {
  const r = byName("Try Restaurant");
  assert.equal(r.nameAr, "مطعم تجربة");
  assert.equal(r.area, undefined, "too far from any neighbourhood: left unknown");
});

test("venues inside mall outlines (ways and relations) are linked", () => {
  assert.equal(byName("Mall Cinema").parentMallId, "osm-way-10");
  assert.equal(byName("Burger Spot").parentMallId, "osm-relation-20");
  assert.equal(byName("Test Cafe").parentMallId, undefined);
});

test("shops are kept only when inside a mall", () => {
  assert.equal(byName("Mall Shop").category, "shop");
  assert.equal(byName("Mall Shop").kind, "clothes");
  assert.equal(byName("Street Shop"), undefined);
});

test("sights and photos", () => {
  const s = byName("Old Citadel");
  assert.equal(s.category, "sight");
  assert.equal(s.wikidata, "Q123");
  assert.match(s.photoUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/Citadel_view\.jpg/);
  assert.equal(commonsFileOf({ image: "https://commons.wikimedia.org/wiki/File:A%20b.jpg" }), "A b.jpg");
  assert.equal(commonsFileOf({ image: "https://example.com/x.jpg" }), null, "only Commons photos");
  assert.match(commonsUrls("A b.jpg").photoPage, /File:A_b\.jpg$/);
});

test("malls keep a simplified outline", () => {
  assert.equal(byName("Test Mall").outline.length, 4);
  assert.equal(byName("Big Mall").outline.length, 4);
  assert.equal(byName("Test Cafe").outline, undefined);
});

test("undocumented parks are skipped", () => {
  assert.equal(byName("Tiny Park"), undefined);
});

test("categories and geometry helpers", () => {
  assert.equal(categoryOf({ leisure: "escape_game" }), "escape_room");
  assert.equal(categoryOf({ tourism: "museum" }), "museum");
  assert.equal(categoryOf({ amenity: "ice_cream" }), "cafe");
  assert.equal(categoryOf({ amenity: "bank" }), null);
  const square = [[0, 0], [0, 1], [1, 1], [1, 0]];
  assert.equal(insidePolygon([0.5, 0.5], square), true);
  assert.equal(insidePolygon([1.5, 0.5], square), false);
});

test("social pages, menu links, halal and kids areas only from real tags", () => {
  assert.equal(socialUrl("instagram", "@test_cafe"), "https://www.instagram.com/test_cafe");
  assert.equal(socialUrl("instagram", "https://www.instagram.com/test.cafe/"), "https://www.instagram.com/test.cafe/");
  assert.equal(socialUrl("instagram", "https://evil.example/insta"), undefined);
  assert.equal(socialUrl("facebook", "https://m.facebook.com/TestPage"), "https://m.facebook.com/TestPage");
  assert.equal(socialUrl("facebook", "not a handle!"), undefined);
  assert.equal(socialUrl("facebook", undefined), undefined);
  assert.equal(menuUrlOf({ "website:menu": "https://example.test/menu" }), "https://example.test/menu");
  assert.equal(menuUrlOf({ "website:menu": "ask the waiter" }), undefined);
  assert.deepEqual(detailsOf({ "diet:halal": "yes", kids_area: "yes" }), { halal: true, kidsArea: true });
});
