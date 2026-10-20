import { test } from "node:test";
import assert from "node:assert/strict";
import { districtFrom, assignDistricts, DISTRICT_AR } from "./districts.mjs";

const km = (a, b, c, d) => Math.hypot(a - c, (b - d) * 0.87) * 111;
class Grid {
  constructor() { this.items = []; }
  add(i) { this.items.push(i); }
  near() { return this.items; }
}

test("district names in English, transliterated and Arabic", () => {
  assert.equal(districtFrom("القاهرة الجديدة", "cairo", 31.47), "New Cairo (5th Settlement)");
  assert.equal(districtFrom("Fifth Settlement", "cairo", 31.47), "New Cairo (5th Settlement)");
  assert.equal(districtFrom("المعادى", "cairo", 31.26), "Maadi");
  assert.equal(districtFrom("Ma‘ādī al Khabīrī", "cairo", 31.26), "Maadi");
  assert.equal(districtFrom("مصر الجديدة", "cairo", 31.33), "Heliopolis");
  assert.equal(districtFrom("Ad Doqi", "giza", 31.21), "Dokki");
  assert.equal(districtFrom("الدقى", "giza", 31.21), "Dokki");
  assert.equal(DISTRICT_AR["Dokki"], "الدقي");
});

test("no district from the wrong city, a far-away street, or a bridge", () => {
  assert.equal(districtFrom("Dokki", "cairo", 31.21), null, "Dokki is in Giza");
  assert.equal(districtFrom("New Cairo St", "cairo", 31.25), null, "too far west for New Cairo");
  assert.equal(districtFrom("كوبري 6 أكتوبر", "giza", 31.0), null, "a bridge, not the city");
  assert.equal(districtFrom("6th of October", "giza", 30.95), "6th of October");
  assert.equal(districtFrom("Cairo", "cairo", 31.2), null);
  assert.equal(districtFrom(null, "cairo", 31.2), null);
});

test("places without their own district follow a clear majority of neighbours", () => {
  const p = (id, lat, lng, extra = {}) => ({ id, city: "cairo", lat, lng, ...extra });
  const labelled = [1, 2, 3].map((i) => p(`m${i}`, 29.96, 31.26, { address: "المعادي" }));
  const lone = p("x", 29.9601, 31.2601);
  const far = p("far", 30.2, 31.6);
  const split = [p("h1", 30.1, 31.33, { area: "Heliopolis" }), p("n1", 30.1, 31.33, { area: "Nasr City" })];
  const places = assignDistricts([...labelled, lone, far, ...split], { km, Grid });
  assert.equal(places.find((q) => q.id === "x").area, "Maadi");
  assert.equal(places.find((q) => q.id === "far").area, undefined);
  assert.equal(places.find((q) => q.id === "m1").area, "Maadi");
  assert.ok(places.every((q) => !("_locality" in q)));
});
