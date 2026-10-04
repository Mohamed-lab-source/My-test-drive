// Downloads REAL places from OpenStreetMap (free, no key) and writes
// assets/data/places.json, which is bundled inside the app.
//
//   node tool/fetch_osm_places.mjs            -> download and write the file
//
// Data © OpenStreetMap contributors, ODbL. The app shows this credit.
// Nothing is invented: every field is copied from the map, or left out.

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CITIES = {
  cairo: "EG-C",      // Cairo Governorate
  giza: "EG-GZ",      // Giza Governorate
  alexandria: "EG-ALX",
};

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** Most places of each kind to keep per city (the best-documented ones). */
const CAPS = {
  restaurant: 150, cafe: 100, cinema: 40, mall: 40, escape_room: 40,
  entertainment: 60, park: 40, museum: 60, activity: 40,
};

export function categoryOf(t) {
  if (t.amenity === "restaurant") return "restaurant";
  if (t.amenity === "cafe") return "cafe";
  if (t.amenity === "cinema") return "cinema";
  if (t.shop === "mall") return "mall";
  if (t.leisure === "escape_game") return "escape_room";
  if (["bowling_alley", "amusement_arcade", "trampoline_park", "water_park"].includes(t.leisure)) {
    return "entertainment";
  }
  if (["theme_park", "zoo", "aquarium"].includes(t.tourism)) return "entertainment";
  if (t.leisure === "park") return "park";
  if (["museum", "gallery"].includes(t.tourism) || ["arts_centre", "theatre"].includes(t.amenity)) {
    return "museum";
  }
  if (["sports_centre", "ice_rink", "horse_riding"].includes(t.leisure) || t.sport === "karting") {
    return "activity";
  }
  return null;
}

/** How well-documented a map entry is. Used only for ranking, never shown. */
export function qualityOf(t) {
  let q = 0;
  if (t.website || t["contact:website"]) q += 3;
  if (t.phone || t["contact:phone"]) q += 2;
  if (t.opening_hours) q += 2;
  if (t.wikidata) q += 3;
  if (t.cuisine) q += 1;
  if (t["name:en"]) q += 1;
  if (t["addr:street"]) q += 1;
  return q;
}

const ARABIC = /[؀-ۿ]/;

function pointOf(el) {
  if (typeof el.lat === "number") return [el.lat, el.lon];
  if (el.center) return [el.center.lat, el.center.lon];
  return null;
}

/** Ray-casting point-in-polygon test. poly = [[lat, lon], ...] */
export function insidePolygon([lat, lon], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceKm([a1, o1], [a2, o2]) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(a2 - a1) / 2) ** 2 + Math.cos(r(a1)) * Math.cos(r(a2)) * Math.sin(r(o2 - o1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Turns raw Overpass elements for one city into Khroga places.
 * @param elements  places + neighbourhood nodes (out tags center)
 * @param mallWays  mall outlines (out geom), used to link venues to malls
 */
export function convert(city, elements, mallWays = []) {
  const suburbs = elements
    .filter((e) => e.tags?.place && ["suburb", "neighbourhood", "quarter"].includes(e.tags.place) && pointOf(e))
    .map((e) => ({ name: e.tags["name:en"] || e.tags.name, at: pointOf(e) }));

  const malls = mallWays
    .filter((w) => Array.isArray(w.geometry) && w.geometry.length >= 3)
    .map((w) => ({ id: `osm-way-${w.id}`, poly: w.geometry.map((g) => [g.lat, g.lon]) }));

  const seen = new Set();
  const byCategory = {};
  for (const el of elements) {
    const t = el.tags ?? {};
    if (!t.name || t.place) continue;
    const category = categoryOf(t);
    const at = pointOf(el);
    if (!category || !at) continue;
    if (t.disused || t["disused:amenity"] || t.abandoned) continue;
    const id = `osm-${el.type}-${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    let area;
    let best = 4; // km: only name a neighbourhood if it's close
    for (const s of suburbs) {
      const d = distanceKm(at, s.at);
      if (d < best) { best = d; area = s.name; }
    }
    const mall = category === "mall" ? null : malls.find((m) => m.id !== id && insidePolygon(at, m.poly));
    const name = t["name:en"] || t.name;
    const nameAr = t["name:ar"] || (ARABIC.test(t.name) ? t.name : undefined);
    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");

    const place = {
      id,
      name,
      nameAr: nameAr && nameAr !== name ? nameAr : undefined,
      category,
      city,
      area,
      address: street || undefined,
      lat: Math.round(at[0] * 1e6) / 1e6,
      lng: Math.round(at[1] * 1e6) / 1e6,
      cuisine: t.cuisine,
      openingHours: t.opening_hours,
      parentMallId: mall?.id,
      website: t.website || t["contact:website"],
      phone: t.phone || t["contact:phone"],
      indoor: category === "park" ? false : undefined,
      osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      quality: qualityOf(t),
    };
    for (const k of Object.keys(place)) if (place[k] === undefined) delete place[k];
    (byCategory[category] ??= []).push(place);
  }

  const out = [];
  for (const [category, list] of Object.entries(byCategory)) {
    list.sort((a, b) => b.quality - a.quality || a.name.localeCompare(b.name));
    // Parks and sports centres are common; keep only documented ones.
    const filtered = ["park", "activity"].includes(category) ? list.filter((p) => p.quality >= 2) : list;
    out.push(...filtered.slice(0, CAPS[category] ?? 40));
  }
  // Keep mall links only to malls we actually kept.
  const keptMalls = new Set(out.filter((p) => p.category === "mall").map((p) => p.id));
  for (const p of out) if (p.parentMallId && !keptMalls.has(p.parentMallId)) delete p.parentMallId;
  return out;
}

function placesQuery(iso) {
  return `[out:json][timeout:240];
area["ISO3166-2"="${iso}"]->.a;
(
  nwr(area.a)["amenity"~"^(restaurant|cafe|cinema|arts_centre|theatre)$"]["name"];
  nwr(area.a)["shop"="mall"]["name"];
  nwr(area.a)["leisure"~"^(escape_game|bowling_alley|amusement_arcade|trampoline_park|water_park|park|sports_centre|ice_rink|horse_riding)$"]["name"];
  nwr(area.a)["tourism"~"^(museum|gallery|theme_park|zoo|aquarium)$"]["name"];
  nwr(area.a)["sport"="karting"]["name"];
  node(area.a)["place"~"^(suburb|neighbourhood|quarter)$"]["name"];
);
out tags center;`;
}

function mallsQuery(iso) {
  return `[out:json][timeout:120];
area["ISO3166-2"="${iso}"]->.a;
way(area.a)["shop"="mall"]["name"];
out geom;`;
}

async function overpass(query) {
  let lastError;
  for (const url of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Khroga-app-build" },
          body: "data=" + encodeURIComponent(query),
          signal: AbortSignal.timeout(300000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()).elements ?? [];
      } catch (e) {
        lastError = e;
        console.warn(`  ${url} failed (${e.message}), retrying...`);
        await new Promise((r) => setTimeout(r, 10000 * attempt));
      }
    }
  }
  throw lastError;
}

async function main() {
  const all = [];
  for (const [city, iso] of Object.entries(CITIES)) {
    console.log(`Downloading ${city}...`);
    const elements = await overpass(placesQuery(iso));
    const mallWays = await overpass(mallsQuery(iso));
    const places = convert(city, elements, mallWays);
    const counts = {};
    for (const p of places) counts[p.category] = (counts[p.category] ?? 0) + 1;
    console.log(`  ${places.length} places`, counts,
      `${places.filter((p) => p.parentMallId).length} inside malls`);
    all.push(...places);
  }
  if (all.length < 50) throw new Error(`Only ${all.length} places found; refusing to write a near-empty file.`);
  writeFileSync("assets/data/places.json", JSON.stringify({
    source: "© OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)",
    generatedAt: new Date().toISOString(),
    places: all,
  }));
  console.log(`Wrote ${all.length} real places to assets/data/places.json`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("Failed:", e.message ?? e); process.exit(1); });
}
