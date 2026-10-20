// Merges Overture Maps places into assets/data/places.json (OpenStreetMap).
//
//   node tool/merge_overture.mjs build/overture.jsonl
//
// - Maps Overture categories to Khroga's categories.
// - Skips Overture places that duplicate an OpenStreetMap place nearby
//   (and copies over a missing phone/website instead).
// - Links places to the mall they're in: inside the mall's outline, very
//   close to the mall, or when their own name/address names that mall.
// - Shops are only kept when they're inside a mall.
// Nothing is invented: every field is copied from one of the two sources.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { insidePolygon } from "./fetch_osm_places.mjs";
import { assignDistricts } from "./districts.mjs";

const PLACES_FILE = "assets/data/places.json";

/** Overture category (taxonomy.primary / basic_category) → Khroga category. */
export function overtureCategory(tax, basic) {
  const t = tax ?? "";
  const b = basic ?? "";
  const any = (...words) => words.some((w) => t === w || b === w);
  if (any("shopping_mall")) return "mall";
  if (any("movie_theater")) return "cinema";
  if (any("escape_room")) return "escape_room";
  if (any("amusement_park", "amusement_attraction", "arcade", "bowling_alley", "zoo", "petting_zoo",
    "aquarium", "water_park", "ice_skating_rink", "roller_skating_rink", "skating_rink", "indoor_playcenter",
    "karaoke_venue", "laser_tag", "pool_billiards", "paintball", "go_kart_track", "kids_recreation_and_party",
    "atv_recreation_park")) return "entertainment";
  if (any("park", "botanical_garden", "national_park")) return "park";
  if (/museum$/.test(t) || any("museum", "art_gallery", "theatre_venue")) return "museum";
  if (any("historic_site", "monument", "landmark_and_historical_building")) return "sight";
  if (any("horse_riding", "horseback_riding_service", "golf_course", "skate_park", "rock_climbing_spot",
    "boat_tour", "boat_rental_and_training", "beach")) return "activity";
  if (any("cafe", "coffee_shop", "bakery", "dessert_shop", "ice_cream_shop", "smoothie_juice_bar", "donut_shop",
    "patisserie_cake_shop", "lounge", "hookah_bar", "tea_room")) return "cafe";
  if (/_restaurant$/.test(t) || any("restaurant", "casual_eatery", "fast_food_restaurant", "food_court"))
    return "restaurant";
  if (/_store$/.test(t) || /_store$/.test(b) || any("shopping", "department_store")) return "shop";
  return null;
}

const ARABIC = /[؀-ۿ]/;

/** Lowercase, unify spellings, keep letters/digits (Latin and Arabic). */
export function normalize(s) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/centre/g, "center")
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim();
}

const GENERIC = new Set([
  "mall", "center", "city", "the", "of", "shopping", "plaza", "egypt", "cairo", "giza", "alexandria",
  "new", "el", "al", "and", "مول", "سيتي", "سنتر", "مركز", "تجاري", "التجاري",
]);

/** The words that make a mall's name distinctive, e.g. "almaza", "stars". */
export function distinctiveWords(name) {
  return normalize(name).split(" ").filter((w) => w.length >= 3 && !GENERIC.has(w));
}

/** Does this text clearly name this mall? */
export function mentionsMall(text, mallName) {
  const t = ` ${normalize(text)} `;
  const full = normalize(mallName);
  if (full.length >= 6 && t.includes(` ${full} `)) return true;
  const words = distinctiveWords(mallName);
  if (!words.length) return false;
  // Every distinctive word must appear, plus a hint that it's about a mall.
  return words.every((w) => t.includes(` ${w} `)) &&
    /( mall | center | city | plaza | مول | سنتر | سيتي )/.test(t);
}

function km(aLat, aLng, bLat, bLng) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 +
    Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Rough grid index so "what's near here?" stays fast with 40k places. */
class Grid {
  constructor(cellDeg = 0.01) { this.cell = cellDeg; this.map = new Map(); }
  key(lat, lng) { return `${Math.floor(lat / this.cell)}:${Math.floor(lng / this.cell)}`; }
  add(item) {
    const k = this.key(item.lat, item.lng);
    if (!this.map.has(k)) this.map.set(k, []);
    this.map.get(k).push(item);
  }
  near(lat, lng, rings = 1) {
    const out = [];
    const cy = Math.floor(lat / this.cell);
    const cx = Math.floor(lng / this.cell);
    for (let dy = -rings; dy <= rings; dy++) {
      for (let dx = -rings; dx <= rings; dx++) {
        out.push(...(this.map.get(`${cy + dy}:${cx + dx}`) ?? []));
      }
    }
    return out;
  }
}

/** Are these two names the same place? (one contains the other, or most words shared) */
export function sameName(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  if (x === y || (x.length >= 4 && y.includes(x)) || (y.length >= 4 && x.includes(y))) return true;
  const wx = new Set(x.split(" ").filter((w) => w.length > 2));
  const wy = new Set(y.split(" ").filter((w) => w.length > 2));
  if (!wx.size || !wy.size) return false;
  const shared = [...wx].filter((w) => wy.has(w)).length;
  return shared / Math.min(wx.size, wy.size) >= 0.6;
}

function cityFromRegion(region) {
  const r = normalize(region);
  if (!r) return null;
  if (/alex|اسكندري|الإسكندري/.test(r)) return "alexandria";
  if (/giza|jizah|جيز/.test(r)) return "giza";
  if (/cairo|qahirah|قاهر/.test(r)) return "cairo";
  return null;
}

/** Which of Khroga's cities this point belongs to. */
function cityFor(o, osmGrid) {
  // 1. The nearest OpenStreetMap place (it knows its governorate).
  let best = null;
  let bestKm = 2;
  for (const p of osmGrid.near(o.lat, o.lng, 2)) {
    const d = km(o.lat, o.lng, p.lat, p.lng);
    if (d < bestKm) { bestKm = d; best = p; }
  }
  if (best) return best.city;
  // 2. What the address says.
  const fromRegion = cityFromRegion(o.region) ?? cityFromRegion(o.locality);
  if (fromRegion) return fromRegion;
  // 3. Position: Alexandria's area, else west of the Nile is Giza.
  if (o.lat > 30.8 && o.lng < 30.3) return "alexandria";
  if (o.lat < 30.4 && o.lng < 31.21) return "giza";
  return "cairo";
}

/** How much to trust/rank an Overture place (never shown as a rating). */
function overtureQuality(o) {
  return Math.round((o.conf ?? 0) * 6) + (o.website ? 2 : 0) + (o.phone ? 1 : 0) + (o.brand ? 1 : 0);
}

/** Things Overture sometimes files as malls but aren't (banks, supermarkets, kids' play areas). */
const NOT_A_MALL = /(atm|bank|carrefour|carefour|spinneys|hyper|sparky|pharmacy|صيدلي|بنك|كارفور)/i;

/** A mall's name squeezed together, for spotting "CityStars" = "City Stars". */
function compactName(name) {
  const words = normalize(name).split(" ").filter((w) => !["cairo", "giza", "alexandria", "egypt", "the"].includes(w));
  const compact = words.join("");
  return compact.length >= 6 ? compact : normalize(name);
}

const LINKABLE = new Set(["shop", "restaurant", "cafe", "cinema", "entertainment", "escape_room"]);
const NEAR_MALL_KM = 0.12;
const NAMED_MALL_KM = 1.5;

/** Per-city limits so the app stays fast (best-documented places first). */
const CAPS = { restaurant: 9000, cafe: 7000, shop: 8000 };
const SHOPS_PER_MALL = 250;

/** The first Instagram/Facebook URL among Overture's social links. */
export function socialOf(o, kind) {
  const domain = kind === "instagram" ? "instagram.com" : "facebook.com";
  for (const s of o.socials ?? []) {
    try {
      const host = new URL(s).hostname.replace(/^(www|m|web)\./, "");
      if (host === domain) return s;
    } catch { /* not a URL */ }
  }
  return undefined;
}

export function merge(osmPlaces, overtureRows) {
  // Start clean: drop Overture places from an earlier merge.
  const places = osmPlaces.filter((p) => p.source !== "overture");
  const osmGrid = new Grid();
  for (const p of places) if (typeof p.lat === "number" && typeof p.lng === "number") osmGrid.add(p);

  // 1. Convert Overture rows, skipping duplicates of OSM places.
  const fresh = [];
  let duplicates = 0;
  for (const o of overtureRows) {
    const category = overtureCategory(o.tax, o.basic);
    if (!category || typeof o.lat !== "number" || typeof o.lng !== "number") continue;
    const twin = osmGrid.near(o.lat, o.lng).find((p) =>
      km(o.lat, o.lng, p.lat, p.lng) < (category === "mall" ? 0.4 : 0.15) && sameName(p.name, o.name));
    if (twin) {
      duplicates++;
      twin.phone ??= o.phone ?? undefined;
      twin.website ??= o.website ?? undefined;
      twin.instagram ??= socialOf(o, "instagram");
      twin.facebook ??= socialOf(o, "facebook");
      if (!twin.instagram) delete twin.instagram;
      if (!twin.facebook) delete twin.facebook;
      if (!twin.phone) delete twin.phone;
      if (!twin.website) delete twin.website;
      continue;
    }
    const place = {
      id: `ov-${o.id}`,
      name: o.name,
      nameAr: ARABIC.test(o.name) ? o.name : undefined,
      category,
      kind: (o.tax ?? o.basic ?? "").replace(/_/g, " ") || undefined,
      city: cityFor(o, osmGrid),
      address: o.address || undefined,
      _locality: o.locality || undefined,
      lat: o.lat,
      lng: o.lng,
      website: o.website || undefined,
      phone: o.phone || undefined,
      instagram: socialOf(o, "instagram"),
      facebook: socialOf(o, "facebook"),
      details: o.tax === "hookah_bar" ? { shisha: true } : o.brand ? { brand: o.brand } : undefined,
      source: "overture",
      quality: overtureQuality(o),
    };
    if (place.nameAr === place.name && !ARABIC.test(place.name.replace(/[؀-ۿ]/g, ""))) delete place.nameAr;
    for (const k of Object.keys(place)) if (place[k] === undefined) delete place[k];
    fresh.push(place);
  }

  // 2. Malls: OSM malls plus confident Overture malls with a mall-like name.
  const all = [...places, ...fresh];
  const malls = all.filter((p) => p.category === "mall" && (p.source !== "overture" ||
    (p.quality >= 5 && /(mall|center|centre|plaza|city|مول|سنتر|سيتي|اركاديا|اركان)/i.test(p.name) &&
      !NOT_A_MALL.test(p.name))));
  // Same mall listed twice (e.g. "City Centre Almaza" / "Almaza City Center")?
  // Keep the copy with the most real venues around it; drop misplaced copies.
  const venueGrid = new Grid();
  for (const p of all) if (LINKABLE.has(p.category)) venueGrid.add(p);
  const support = (m) => venueGrid.near(m.lat, m.lng).filter((v) => km(m.lat, m.lng, v.lat, v.lng) < NEAR_MALL_KM).length +
    (m.outline ? 1000 : 0) + (m.source === "overture" ? 0 : 50);
  // Group copies of the same mall (union-find over close pairs with matching names).
  const parent = malls.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const keys = malls.map((m) => [distinctiveWords(m.name).sort().join(" "), compactName(m.name)]);
  for (let i = 0; i < malls.length; i++) {
    for (let j = i + 1; j < malls.length; j++) {
      if (km(malls[i].lat, malls[i].lng, malls[j].lat, malls[j].lng) > 6) continue;
      const [di, ci] = keys[i];
      const [dj, cj] = keys[j];
      if ((di && di === dj) || ci === cj) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  malls.forEach((m, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(m);
  });
  const dropped = new Set();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ranked = group.map((m) => [m, support(m)]).sort((a, b) => b[1] - a[1]);
    for (const [m] of ranked.slice(1)) dropped.add(m.id);
  }
  malls.splice(0, malls.length, ...malls.filter((m) => !dropped.has(m.id)));
  for (const p of all) if (dropped.has(p.parentMallId)) delete p.parentMallId;
  const mallIds = new Set(malls.map((m) => m.id));
  const notMalls = all.filter((p) => p.category === "mall" && !mallIds.has(p.id));
  const mallGrid = new Grid(0.02);
  for (const m of malls) mallGrid.add(m);

  // 3. Link venues to malls.
  let linked = 0;
  for (const p of all) {
    if (p.category === "mall" || p.parentMallId || !LINKABLE.has(p.category)) continue;
    let mall = null;
    let bestKm = Infinity;
    for (const m of mallGrid.near(p.lat, p.lng, 4)) {
      const d = km(p.lat, p.lng, m.lat, m.lng);
      const inside = m.outline && insidePolygon([p.lat, p.lng], m.outline);
      const named = d < NAMED_MALL_KM && (mentionsMall(p.name, m.name) || mentionsMall(p.address, m.name));
      if ((inside || d < NEAR_MALL_KM || named) && d < bestKm) { bestKm = d; mall = m; }
    }
    if (mall) { p.parentMallId = mall.id; linked++; }
  }

  // 4. Areas: every place gets its district (from its own data or its
  //    neighbours); places inside a mall take the mall's district.
  assignDistricts(all, { km, Grid });
  const byId = new Map(all.map((p) => [p.id, p]));
  for (const p of all) {
    const mall = p.parentMallId && byId.get(p.parentMallId);
    if (mall?.area && mall.city === p.city) p.area = mall.area;
  }

  // 5. Keep shops only inside malls; drop mall-tagged things that aren't malls; apply limits.
  const counts = {};
  const perMall = {};
  const out = [];
  const ranked = all
    .filter((p) => !notMalls.includes(p))
    .sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0));
  for (const p of ranked) {
    if (p.category === "shop" && !p.parentMallId) continue;
    if (p.category === "shop") {
      perMall[p.parentMallId] = (perMall[p.parentMallId] ?? 0) + 1;
      if (perMall[p.parentMallId] > SHOPS_PER_MALL) continue;
    }
    const key = `${p.city}:${p.category}`;
    counts[key] = (counts[key] ?? 0) + 1;
    if (CAPS[p.category] && counts[key] > CAPS[p.category]) continue;
    out.push(p);
  }
  return { places: out, stats: { overture: fresh.length, duplicates, linked, malls: malls.length, duplicateMalls: dropped.size } };
}

function main(overturePath) {
  if (!existsSync(overturePath)) throw new Error(`${overturePath} not found`);
  const file = JSON.parse(readFileSync(PLACES_FILE, "utf8"));
  const rows = readFileSync(overturePath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const { places, stats } = merge(file.places ?? [], rows);
  const byCat = {};
  for (const p of places) byCat[p.category] = (byCat[p.category] ?? 0) + 1;
  console.log(`Overture places added: ${stats.overture} (skipped ${stats.duplicates} duplicates of OSM places)`);
  console.log(`Malls: ${stats.malls}; places linked to a mall: ${stats.linked}`);
  console.log(`Total after limits: ${places.length}`, byCat);
  writeFileSync(PLACES_FILE, JSON.stringify({
    source: "© OpenStreetMap contributors (ODbL 1.0); Overture Maps Foundation (CDLA-Permissive-2.0); " +
      "photos: Wikimedia Commons.",
    generatedAt: new Date().toISOString(),
    places,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv[2] ?? "build/overture.jsonl");
  } catch (e) {
    console.error("Merge failed:", e.message ?? e);
    process.exit(1);
  }
}
