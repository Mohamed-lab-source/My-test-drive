// Tests for merging Overture places, using made-up places.
// Run: node --test tool/merge_overture.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { merge, overtureCategory, mentionsMall, sameName, distinctiveWords } from "./merge_overture.mjs";

const osm = [
  { id: "osm-node-1", name: "Test Cafe", category: "cafe", city: "cairo", lat: 30.05, lng: 31.30, quality: 5 },
  { id: "osm-way-2", name: "Test Mall", category: "mall", city: "cairo", lat: 30.10, lng: 31.40, quality: 6,
    outline: [[30.099, 31.399], [30.099, 31.401], [30.101, 31.401], [30.101, 31.399]] },
];
const ov = (id, name, tax, lat, lng, extra = {}) => ({ id, name, tax, basic: null, conf: 0.9, lat, lng, ...extra });
const rows = [
  ov("a", "Test Café", "cafe", 30.0501, 31.3001, { phone: "+20 100" }),           // duplicate of OSM cafe
  ov("b", "Shoe Corner", "shoe_store", 30.1001, 31.4001),                          // inside Test Mall outline
  ov("c", "Street Shoes", "shoe_store", 30.20, 31.20),                              // shop not in a mall: dropped
  ov("d", "Almaza City Center", "shopping_mall", 30.0811, 31.3644),
  ov("e", "City Centre Almaza", "shopping_mall", 30.111, 31.3475),                 // misplaced duplicate
  ov("f", "Cinnabon", "dessert_shop", 30.0812, 31.3645),                            // right next to the mall
  ov("g", "Cinnabon Nozha", "dessert_shop", 30.0870, 31.3700, { address: "City Center Almaza, first floor" }),
  ov("h", "EGBANK ATM City Center", "shopping_mall", 30.30, 31.30),                 // not a mall
  ov("i", "Pizza Place", "pizza_restaurant", 30.05, 31.10, { region: "Giza Governorate" }),
  ov("j", "Shisha Lounge", "hookah_bar", 30.06, 31.31),
  ov("k", "Some Garage", "auto_repair", 30.06, 31.31),                              // not an outing
];

const { places, stats } = merge(structuredClone(osm), rows);
const byName = (n) => places.find((p) => p.name === n);

test("Overture categories map to Khroga categories", () => {
  assert.equal(overtureCategory("pizza_restaurant"), "restaurant");
  assert.equal(overtureCategory("dessert_shop"), "cafe");
  assert.equal(overtureCategory("escape_room"), "escape_room");
  assert.equal(overtureCategory("history_museum"), "museum");
  assert.equal(overtureCategory("womens_clothing_store"), "shop");
  assert.equal(overtureCategory("auto_repair"), null);
});

test("duplicates of OSM places are skipped, and fill in missing contacts", () => {
  assert.equal(byName("Test Café"), undefined);
  assert.equal(byName("Test Cafe").phone, "+20 100");
  assert.equal(stats.duplicates, 1);
});

test("shops are kept only inside malls", () => {
  assert.equal(byName("Shoe Corner").parentMallId, "osm-way-2");
  assert.equal(byName("Street Shoes"), undefined);
});

test("venues next to a mall, or naming it in their address, are linked", () => {
  const mall = byName("Almaza City Center");
  assert.ok(mall);
  assert.equal(byName("Cinnabon").parentMallId, mall.id);
  assert.equal(byName("Cinnabon Nozha").parentMallId, mall.id);
});

test("a misplaced copy of a mall and non-malls are dropped", () => {
  assert.equal(byName("City Centre Almaza"), undefined);
  assert.equal(byName("EGBANK ATM City Center"), undefined);
});

test("facts are copied, never invented", () => {
  const pizza = byName("Pizza Place");
  assert.equal(pizza.city, "giza");
  assert.equal(pizza.kind, "pizza restaurant");
  assert.equal(pizza.source, "overture");
  assert.equal("openingHours" in pizza, false);
  assert.deepEqual(byName("Shisha Lounge").details, { shisha: true });
  assert.equal(byName("Some Garage"), undefined);
});

test("merging twice doesn't duplicate Overture places", () => {
  const again = merge(places, rows);
  assert.equal(again.places.length, places.length);
});

test("name helpers", () => {
  assert.ok(sameName("Costa Coffee", "Costa Coffee Almaza"));
  assert.ok(!sameName("Costa Coffee", "Starbucks"));
  assert.deepEqual(distinctiveWords("City Centre Almaza"), ["almaza"]);
  assert.ok(mentionsMall("Shop 12, City Center Almaza, Cairo", "Almaza City Center"));
  assert.ok(!mentionsMall("Behind Almaza bridge", "Almaza City Center"));
  assert.ok(mentionsMall("Ground floor, Mall of Egypt", "Mall of Egypt"));
});
