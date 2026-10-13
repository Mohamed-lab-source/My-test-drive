// Downloads REAL places from OpenStreetMap (free, no key) and writes
// assets/data/places.json, which is bundled inside the app.
//
//   node tool/fetch_osm_places.mjs
//
// Data © OpenStreetMap contributors (ODbL); photos from Wikimedia Commons.
// The app shows these credits. Nothing is invented: every field is copied
// from the map (or Wikidata's photo link), or left out.

import { readFileSync, writeFileSync } from "node:fs";
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

const USER_AGENT = "Khroga-app-build/1.0 (outing planner; github actions)";

/** Most places of each kind to keep per city (the best-documented ones). */
const CAPS = {
  restaurant: 400, cafe: 300, cinema: 60, mall: 150, escape_room: 60,
  entertainment: 150, park: 80, museum: 120, activity: 80, sight: 120, shop: 2500,
};

/** Most shops to keep inside any one mall. */
const SHOPS_PER_MALL = 80;

const SIGHT_HISTORIC = ["castle", "monument", "archaeological_site", "ruins", "city_gate", "fort", "palace"];

export function categoryOf(t) {
  if (t.amenity === "restaurant" || t.amenity === "fast_food") return "restaurant";
  if (t.amenity === "cafe" || t.amenity === "ice_cream") return "cafe";
  if (t.amenity === "cinema") return "cinema";
  if (t.shop === "mall") return "mall";
  if (t.leisure === "escape_game") return "escape_room";
  if (["bowling_alley", "amusement_arcade", "trampoline_park", "water_park"].includes(t.leisure)) {
    return "entertainment";
  }
  if (["theme_park", "zoo", "aquarium"].includes(t.tourism)) return "entertainment";
  if (t.leisure === "park" || t.leisure === "garden") return "park";
  if (["museum", "gallery"].includes(t.tourism) || ["arts_centre", "theatre"].includes(t.amenity)) {
    return "museum";
  }
  if (["sports_centre", "ice_rink", "horse_riding"].includes(t.leisure) || t.sport === "karting") {
    return "activity";
  }
  if (["attraction", "viewpoint"].includes(t.tourism) || SIGHT_HISTORIC.includes(t.historic)) {
    return "sight";
  }
  if (t.shop) return "shop";
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
  if (t.brand) q += 1;
  return q;
}

const yesNo = (v) => (v === "yes" ? true : v === "no" ? false : undefined);

/** Extra facts copied from map tags. Only tags that are present are kept. */
export function detailsOf(t) {
  const cards = ["payment:credit_cards", "payment:debit_cards", "payment:visa", "payment:mastercard", "payment:cards"]
    .map((k) => t[k]);
  const d = {
    wheelchair: ["yes", "limited", "no"].includes(t.wheelchair) ? t.wheelchair : undefined,
    outdoorSeating: yesNo(t.outdoor_seating),
    wifi: ["wlan", "yes"].includes(t.internet_access) ? true : t.internet_access === "no" ? false : undefined,
    smoking: ["yes", "no", "outside", "separated", "isolated"].includes(t.smoking) ? t.smoking : undefined,
    shisha: t.shisha === "yes" || t["smoking:hookah"] === "yes" || /(^|;)\s*shisha/.test(t.cuisine ?? "")
      ? true : t.shisha === "no" ? false : undefined,
    takeaway: ["yes", "no", "only"].includes(t.takeaway) ? t.takeaway : undefined,
    delivery: yesNo(t.delivery),
    airConditioning: yesNo(t.air_conditioning),
    vegetarian: ["yes", "only", "limited"].includes(t["diet:vegetarian"]) ? t["diet:vegetarian"] : undefined,
    reservation: ["yes", "required", "recommended", "no"].includes(t.reservation) ? t.reservation : undefined,
    cards: cards.includes("yes") ? true : cards.filter(Boolean).length && cards.filter(Boolean).every((v) => v === "no") ? false : undefined,
    level: t.level || t["level:ref"] || undefined,
    halal: ["yes", "only"].includes(t["diet:halal"]) ? true : undefined,
    kidsArea: t.kids_area === "yes" || t["kids_area"] === "indoor" || t["kids_area"] === "outdoor" ? true : undefined,
    brand: t.brand || undefined,
    description: (t["description:en"] || t.description || "").slice(0, 300) || undefined,
  };
  for (const k of Object.keys(d)) if (d[k] === undefined) delete d[k];
  return d;
}

/**
 * A social page from a map tag: a full Instagram/Facebook URL, or a bare
 * handle ("@name" / "name"). Anything else is ignored (we never guess).
 */
export function socialUrl(kind, value) {
  const v = (value ?? "").split(";")[0].trim();
  if (!v) return undefined;
  const domain = kind === "instagram" ? "instagram.com" : "facebook.com";
  if (/^https?:\/\//i.test(v)) {
    try {
      const host = new URL(v).hostname.replace(/^(www|m|web)\./, "");
      return host === domain || host === "fb.com" && kind === "facebook" ? v : undefined;
    } catch {
      return undefined;
    }
  }
  const handle = v.replace(/^@/, "");
  return /^[A-Za-z0-9._-]{2,60}$/.test(handle) ? `https://www.${domain}/${handle}` : undefined;
}

/** A menu link the map lists (website:menu / contact:menu), if it's a URL. */
export function menuUrlOf(t) {
  const v = (t["website:menu"] || t["contact:menu"] || "").split(";")[0].trim();
  return /^https?:\/\//i.test(v) ? v : undefined;
}

/** A Wikimedia Commons file named directly on the map, if any. */
export function commonsFileOf(t) {
  const c = t.wikimedia_commons;
  if (c && /^File:/i.test(c)) return c.replace(/^File:/i, "");
  const img = t.image ?? "";
  const m = img.match(/commons\.wikimedia\.org\/wiki\/File:([^?#]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export function commonsUrls(file) {
  const name = file.replace(/ /g, "_");
  return {
    photoUrl: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=800`,
    photoPage: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name)}`,
  };
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

/** Keeps at most [max] points of a ring (rounded), enough for "is it inside?". */
export function simplifyRing(ring, max = 60) {
  const step = Math.max(1, Math.ceil(ring.length / max));
  return ring.filter((_, i) => i % step === 0)
    .map(([lat, lng]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]);
}

/** Mall outlines from Overpass "out geom" (ways and multipolygon relations). */
export function mallShapes(elements) {
  const shapes = [];
  for (const el of elements) {
    const rings = [];
    if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 3) {
      rings.push(el.geometry.map((g) => [g.lat, g.lon]));
    } else if (el.type === "relation") {
      for (const m of el.members ?? []) {
        if (m.role !== "inner" && Array.isArray(m.geometry) && m.geometry.length >= 3) {
          rings.push(m.geometry.map((g) => [g.lat, g.lon]));
        }
      }
    }
    if (rings.length) shapes.push({ id: `osm-${el.type}-${el.id}`, rings });
  }
  return shapes;
}

/**
 * Turns raw Overpass elements for one city into Khroga places.
 * @param elements  places + neighbourhood nodes (out tags center)
 * @param shapes    mall outlines from mallShapes(), used to link venues to malls
 */
export function convert(city, elements, shapes = []) {
  const suburbs = elements
    .filter((e) => e.tags?.place && ["suburb", "neighbourhood", "quarter"].includes(e.tags.place) && pointOf(e))
    .map((e) => ({ name: e.tags["name:en"] || e.tags.name, at: pointOf(e) }));

  const seen = new Set();
  const byCategory = {};
  for (const el of elements) {
    const t = el.tags ?? {};
    if (!t.name || t.place) continue;
    const category = categoryOf(t);
    const at = pointOf(el);
    if (!category || !at) continue;
    if (t.disused || t["disused:amenity"] || t["disused:shop"] || t.abandoned) continue;
    const id = `osm-${el.type}-${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const mall = category === "mall"
      ? null
      : shapes.find((m) => m.id !== id && m.rings.some((ring) => insidePolygon(at, ring)));
    // Shops are only useful inside malls ("Plan my day here", mall directory).
    if (category === "shop" && !mall) continue;

    let area;
    let best = 4; // km: only name a neighbourhood if it's close
    for (const s of suburbs) {
      const d = distanceKm(at, s.at);
      if (d < best) { best = d; area = s.name; }
    }
    const name = t["name:en"] || t.name;
    const nameAr = t["name:ar"] || (ARABIC.test(t.name) ? t.name : undefined);
    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    const file = commonsFileOf(t);

    const place = {
      id,
      name,
      nameAr: nameAr && nameAr !== name ? nameAr : undefined,
      category,
      kind: t.shop && category === "shop" ? t.shop : t.amenity === "fast_food" ? "fast_food" : undefined,
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
      instagram: socialUrl("instagram", t["contact:instagram"] || t.instagram),
      facebook: socialUrl("facebook", t["contact:facebook"] || t.facebook),
      menuUrl: menuUrlOf(t),
      indoor: category === "park" ? false : undefined,
      osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      wikidata: /^Q\d+$/.test(t.wikidata ?? "") ? t.wikidata : undefined,
      ...(file ? commonsUrls(file) : {}),
      details: detailsOf(t),
      quality: qualityOf(t),
    };
    if (category === "mall") {
      const own = shapes.find((m) => m.id === id);
      if (own) place.outline = simplifyRing(own.rings[0]);
    }
    if (!Object.keys(place.details).length) delete place.details;
    for (const k of Object.keys(place)) if (place[k] === undefined) delete place[k];
    (byCategory[category] ??= []).push(place);
  }

  const out = [];
  for (const [category, list] of Object.entries(byCategory)) {
    list.sort((a, b) => b.quality - a.quality || a.name.localeCompare(b.name));
    let filtered = list;
    // Parks, sports centres and sights are common; keep only documented ones.
    if (["park", "activity", "sight"].includes(category)) filtered = list.filter((p) => p.quality >= 2 || p.wikidata);
    if (category === "shop") {
      const perMall = {};
      filtered = list.filter((p) => (perMall[p.parentMallId] = (perMall[p.parentMallId] ?? 0) + 1) <= SHOPS_PER_MALL);
    }
    out.push(...filtered.slice(0, CAPS[category] ?? 40));
  }
  // Keep mall links only to malls we actually kept.
  const keptMalls = new Set(out.filter((p) => p.category === "mall").map((p) => p.id));
  return out.filter((p) => {
    if (p.parentMallId && !keptMalls.has(p.parentMallId)) {
      if (p.category === "shop") return false;
      delete p.parentMallId;
    }
    return true;
  });
}

/** Smaller searches per city: busy public servers handle these far better. */
export function placeQueries(iso) {
  const wrap = (body) => `[out:json][timeout:TIMEOUT];
area["ISO3166-2"="${iso}"]->.a;
(
${body}
);
out tags center;`;
  return {
    food: wrap(`  nwr(area.a)["amenity"~"^(restaurant|fast_food|cafe|ice_cream)$"]["name"];`),
    fun: wrap(`  nwr(area.a)["amenity"~"^(cinema|arts_centre|theatre)$"]["name"];
  nwr(area.a)["leisure"~"^(escape_game|bowling_alley|amusement_arcade|trampoline_park|water_park|park|garden|sports_centre|ice_rink|horse_riding)$"]["name"];
  nwr(area.a)["tourism"~"^(museum|gallery|theme_park|zoo|aquarium|attraction|viewpoint)$"]["name"];
  nwr(area.a)["historic"~"^(${SIGHT_HISTORIC.join("|")})$"]["name"];
  nwr(area.a)["sport"="karting"]["name"];`),
    malls: wrap(`  nwr(area.a)["shop"="mall"]["name"];
  node(area.a)["place"~"^(suburb|neighbourhood|quarter)$"]["name"];`),
  };
}

function mallsQuery(iso) {
  return `[out:json][timeout:TIMEOUT];
area["ISO3166-2"="${iso}"]->.a;
(way(area.a)["shop"="mall"]["name"]; relation(area.a)["shop"="mall"]["name"];);
out geom;`;
}

function mallShopsQuery(iso) {
  return `[out:json][timeout:TIMEOUT];
area["ISO3166-2"="${iso}"]->.a;
(way(area.a)["shop"="mall"]["name"]; relation(area.a)["shop"="mall"]["name"];)->.m;
.m map_to_area->.ma;
nwr(area.ma)["shop"]["name"]["shop"!="mall"];
out tags center;`;
}

/**
 * Runs an Overpass query, trying each public server in turn.
 * [seconds] caps how long any one try may take, so a slow server can't
 * stall the whole build.
 */
async function overpass(query, { seconds = 200, endpoints = ENDPOINTS } = {}) {
  let lastError;
  for (const url of endpoints) {
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: "data=" + encodeURIComponent(query.replace("[timeout:TIMEOUT]", `[timeout:${seconds}]`)),
        signal: AbortSignal.timeout((seconds + 20) * 1000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const elements = (await res.json()).elements ?? [];
      console.log(`  ${new URL(url).host}: ${elements.length} items in ${Math.round((Date.now() - started) / 1000)}s`);
      return elements;
    } catch (e) {
      lastError = e;
      console.warn(`  ${new URL(url).host} failed after ${Math.round((Date.now() - started) / 1000)}s (${e.message})`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw lastError;
}

/** Adds real photos from Wikidata (property P18) for places that link to it. */
async function addWikidataPhotos(places) {
  const want = places.filter((p) => p.wikidata && !p.photoUrl);
  const ids = [...new Set(want.map((p) => p.wikidata))];
  const files = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = "https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=" +
      batch.join("|");
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      for (const [id, entity] of Object.entries(body.entities ?? {})) {
        const file = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        if (typeof file === "string") files[id] = file;
      }
    } catch (e) {
      console.warn(`  Wikidata batch failed (${e.message}); those places just won't have photos.`);
    }
  }
  let added = 0;
  for (const p of want) {
    if (files[p.wikidata]) { Object.assign(p, commonsUrls(files[p.wikidata])); added++; }
  }
  return added;
}

/** Downloads one city. Throws if its main searches fail. */
async function fetchCity(city, iso) {
  const queries = placeQueries(iso);
  const elements = [];
  for (const [name, q] of Object.entries(queries)) {
    const got = await overpass(q, { seconds: 150 });
    console.log(`  ${name}: ${got.length} map items`);
    elements.push(...got);
  }
  let malls = [];
  try {
    malls = await overpass(mallsQuery(iso), { seconds: 120 });
  } catch (e) {
    console.warn(`  Mall outlines skipped (${e.message}).`);
  }
  // Shops inside malls are a nice extra: strict time limit, one server.
  let shops = [];
  if (malls.length) {
    try {
      shops = await overpass(mallShopsQuery(iso), { seconds: 90, endpoints: ENDPOINTS.slice(0, 1) });
    } catch (e) {
      console.warn(`  Shops inside malls skipped (${e.message}).`);
    }
  }
  return convert(city, [...elements, ...shops], mallShapes(malls));
}

function summary(places) {
  const counts = {};
  for (const p of places) counts[p.category] = (counts[p.category] ?? 0) + 1;
  return `${places.length} places ${JSON.stringify(counts)}, ${places.filter((p) => p.parentMallId).length} inside malls`;
}

/** Places from the previous file (restored from the build cache), by city. */
function previousByCity() {
  try {
    const old = JSON.parse(readFileSync("assets/data/places.json", "utf8")).places ?? [];
    const by = {};
    for (const p of old) (by[p.city] ??= []).push(p);
    return by;
  } catch {
    return {};
  }
}

async function main() {
  const previous = previousByCity();
  const result = {};
  const failed = [];
  for (const [city, iso] of Object.entries(CITIES)) {
    console.log(`Downloading ${city}...`);
    try {
      result[city] = await fetchCity(city, iso);
      console.log(`  ✔ ${city}: ${summary(result[city])}`);
    } catch (e) {
      console.warn(`  ✖ ${city} failed (${e.message}); will retry at the end.`);
      failed.push(city);
    }
  }
  for (const city of failed) {
    console.log(`Retrying ${city}...`);
    await new Promise((r) => setTimeout(r, 20000));
    try {
      result[city] = await fetchCity(city, CITIES[city]);
      console.log(`  ✔ ${city}: ${summary(result[city])}`);
    } catch (e) {
      if (previous[city]?.length) {
        console.warn(`::warning::${city} failed again (${e.message}); keeping its previous ${previous[city].length} places.`);
        result[city] = previous[city];
      } else {
        console.warn(`::warning::${city} failed again (${e.message}) and has no previous places.`);
      }
    }
  }
  const all = Object.values(result).flat();
  if (all.length < 50) throw new Error(`Only ${all.length} places found; refusing to write a near-empty file.`);
  const photos = await addWikidataPhotos(all);
  console.log(`Added ${photos} photos from Wikidata (${all.filter((p) => p.photoUrl).length} places have photos).`);
  writeFileSync("assets/data/places.json", JSON.stringify({
    source: "© OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright). " +
      "Photos: Wikimedia Commons.",
    generatedAt: new Date().toISOString(),
    places: all,
  }));
  console.log(`Wrote ${all.length} real places to assets/data/places.json (${summary(all)})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("Failed:", e.message ?? e); process.exit(1); });
}
