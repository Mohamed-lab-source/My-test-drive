/**
 * Finds REAL places with the Google Places API (New) and saves them for review.
 *
 *   npm run discover                       -> runs every line in data/discover_queries.txt
 *   npm run discover -- --csv ../candidate_places.csv
 *                                          -> looks up each name in a CSV (name,area,city,...)
 *
 * Results go to data/discovered.json. Look them over, then run
 *   npm run discover -- --merge
 * to add new ones to data/places.json (duplicates are skipped), and finally
 *   npm run seed
 *
 * Needs a Places API key:  $env:PLACES_API_KEY="your-key"   (PowerShell)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORY_ALIASES, slugify } from "./normalize";

const dataDir = join(__dirname, "..", "..", "data");
const discoveredFile = join(dataDir, "discovered.json");
const placesFile = join(dataDir, "places.json");

const FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.location",
  "places.rating", "places.userRatingCount", "places.priceLevel", "places.primaryType",
  "places.types", "places.photos", "places.websiteUri", "places.nationalPhoneNumber",
  "places.regularOpeningHours.weekdayDescriptions", "places.businessStatus",
  "places.addressComponents",
].join(",");

interface GPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryType?: string;
  types?: string[];
  photos?: { name: string; authorAttributions?: { displayName?: string }[] }[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  businessStatus?: string;
  addressComponents?: { longText?: string; types?: string[] }[];
}

const PRICE: Record<string, number> = {
  PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

async function searchText(query: string, key: string, max: number): Promise<GPlace[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({ textQuery: query, maxResultCount: max, languageCode: "en", regionCode: "EG" }),
  });
  if (res.status === 403) {
    const body = await res.text();
    console.error("\n✖ Google said 403 (not allowed). Usual fixes:");
    console.error("  1. In Google Cloud Console > APIs & Services > Library, enable \"Places API (New)\".");
    console.error("  2. In Credentials, open your key: under \"Application restrictions\" choose None");
    console.error("     (Android-only keys are rejected for scripts and servers).");
    console.error("  3. Under \"API restrictions\", allow \"Places API (New)\" or choose Don't restrict.");
    console.error(`\n  Google's message: ${body.slice(0, 400)}`);
    process.exit(1);
  }
  if (!res.ok) throw new Error(`Places HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { places?: GPlace[] }).places ?? [];
}

function categoryFor(g: GPlace): string | null {
  for (const t of [g.primaryType, ...(g.types ?? [])]) {
    if (t && CATEGORY_ALIASES[t]) return CATEGORY_ALIASES[t];
  }
  return null;
}

function areaFor(g: GPlace): string | undefined {
  const comps = g.addressComponents ?? [];
  for (const type of ["neighborhood", "sublocality_level_1", "sublocality", "administrative_area_level_2"]) {
    const c = comps.find((x) => x.types?.includes(type));
    if (c?.longText) return c.longText;
  }
  return undefined;
}

function toPlace(g: GPlace, city: string, hint?: { area?: string; category?: string }) {
  const name = g.displayName?.text;
  if (!name || !g.location) return null;
  const category = (hint?.category && CATEGORY_ALIASES[hint.category.toLowerCase()]) ?? categoryFor(g);
  if (!category) return null;
  const area = areaFor(g) ?? hint?.area;
  return {
    id: slugify(`${name}-${area ?? city}`),
    name,
    category,
    city,
    area,
    address: g.formattedAddress,
    lat: g.location.latitude,
    lng: g.location.longitude,
    googlePlaceId: g.id,
    rating: g.rating,
    ratingCount: g.userRatingCount,
    priceLevel: g.priceLevel ? PRICE[g.priceLevel] : undefined,
    photos: (g.photos ?? []).slice(0, 5).map((p) => ({
      name: p.name,
      attribution: p.authorAttributions?.[0]?.displayName,
    })),
    openingHours: g.regularOpeningHours?.weekdayDescriptions,
    website: g.websiteUri,
    phone: g.nationalPhoneNumber,
    source: "google_places",
  };
}

function parseCsv(path: string): { name: string; area?: string; city: string; category?: string }[] {
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const col = (n: string) => header.indexOf(n);
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    return {
      name: cells[col("name")],
      area: col("area") >= 0 ? cells[col("area")] : undefined,
      city: (col("city") >= 0 ? cells[col("city")] : "cairo") || "cairo",
      category: col("category_hint") >= 0 ? cells[col("category_hint")]
        : col("category") >= 0 ? cells[col("category")] : undefined,
    };
  }).filter((r) => r.name);
}

async function discover() {
  const key = process.env.PLACES_API_KEY;
  if (!key) {
    console.error('✖ Set your key first, e.g. in PowerShell:  $env:PLACES_API_KEY="AIza..."');
    process.exit(1);
  }
  const csvIndex = process.argv.indexOf("--csv");
  const found = new Map<string, ReturnType<typeof toPlace>>();
  let skippedClosed = 0;

  if (csvIndex > 0) {
    for (const row of parseCsv(process.argv[csvIndex + 1])) {
      const query = [row.name, row.area, row.city, "Egypt"].filter(Boolean).join(", ");
      const [top] = await searchText(query, key, 1);
      if (!top) { console.log(`  ? not found: ${row.name}`); continue; }
      if (top.businessStatus && top.businessStatus !== "OPERATIONAL") { skippedClosed++; continue; }
      const p = toPlace(top, row.city.toLowerCase(), row);
      if (p) { found.set(p.googlePlaceId, p); console.log(`  ✔ ${row.name} → ${p.name} (${p.area ?? "?"})`); }
      else console.log(`  ? couldn't categorize: ${row.name}`);
    }
  } else {
    const qFile = join(dataDir, "discover_queries.txt");
    const lines = readFileSync(qFile, "utf8").split(/\r?\n/)
      .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    for (const line of lines) {
      const [city, query] = line.split("|").map((s) => s.trim());
      const results = await searchText(query, key, 20);
      let added = 0;
      for (const g of results) {
        if (g.businessStatus && g.businessStatus !== "OPERATIONAL") { skippedClosed++; continue; }
        const p = toPlace(g, city.toLowerCase());
        if (p && !found.has(p.googlePlaceId)) { found.set(p.googlePlaceId, p); added++; }
      }
      console.log(`  ${query}: ${added} places`);
    }
  }
  writeFileSync(discoveredFile, JSON.stringify([...found.values()], null, 2));
  console.log(`\n✔ Saved ${found.size} real places to data/discovered.json (skipped ${skippedClosed} closed).`);
  console.log("  Review it, then run:  npm run discover -- --merge");
}

function merge() {
  if (!existsSync(discoveredFile)) { console.error("✖ Run npm run discover first."); process.exit(1); }
  const discovered = JSON.parse(readFileSync(discoveredFile, "utf8")) as Record<string, unknown>[];
  const places = existsSync(placesFile) ? JSON.parse(readFileSync(placesFile, "utf8")) as Record<string, unknown>[] : [];
  const knownGoogle = new Set(places.map((p) => p.googlePlaceId).filter(Boolean));
  const knownIds = new Set(places.map((p) => p.id));
  let added = 0;
  for (const p of discovered) {
    if (knownGoogle.has(p.googlePlaceId) || knownIds.has(p.id)) continue;
    places.push(p);
    added++;
  }
  writeFileSync(placesFile, JSON.stringify(places, null, 2));
  console.log(`✔ Added ${added} new places to data/places.json (${discovered.length - added} were already there).`);
  console.log("  Next:  npm run seed");
}

if (process.argv.includes("--merge")) merge();
else discover().catch((e) => { console.error("✖", e.message ?? e); process.exit(1); });
