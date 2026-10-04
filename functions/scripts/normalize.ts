/**
 * Converts place records from older formats into Khroga's current format.
 * It only RENAMES and cleans fields: it never fills in missing facts.
 */

export const CATEGORY_ALIASES: Record<string, string> = {
  restaurant: "restaurant", restaurants: "restaurant", food: "restaurant", dining: "restaurant",
  cafe: "cafe", "café": "cafe", cafes: "cafe", coffee: "cafe", coffee_shop: "cafe", bakery: "cafe",
  dessert_shop: "cafe", ice_cream_shop: "cafe",
  cinema: "cinema", movie_theater: "cinema", movies: "cinema",
  mall: "mall", shopping_mall: "mall", malls: "mall",
  escape_room: "escape_room", "escape room": "escape_room", escaperoom: "escape_room",
  entertainment: "entertainment", bowling_alley: "entertainment", amusement_center: "entertainment",
  amusement_park: "entertainment", video_arcade: "entertainment", karaoke: "entertainment",
  gaming: "entertainment", trampoline: "entertainment",
  park: "park", parks: "park", garden: "park", botanical_garden: "park",
  museum: "museum", museums: "museum", art_gallery: "museum", culture: "museum",
  historical_landmark: "museum", tourist_attraction: "museum", cultural_center: "museum",
  activity: "activity", activities: "activity", sports: "activity", sports_activity_location: "activity",
  go_kart: "activity", paintball: "activity", climbing: "activity",
};

export const CITY_ALIASES: Record<string, string> = {
  cairo: "cairo", "new cairo": "cairo", "القاهرة": "cairo", heliopolis: "cairo", maadi: "cairo",
  "nasr city": "cairo", zamalek: "cairo", "downtown cairo": "cairo",
  giza: "giza", "الجيزة": "giza", "6th of october": "giza", "sheikh zayed": "giza", october: "giza",
  alexandria: "alexandria", alex: "alexandria", "الإسكندرية": "alexandria",
};

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export function priceLevelFrom(v: unknown): number | undefined {
  if (typeof v === "number" && v >= 0 && v <= 4) return Math.round(v);
  if (typeof v === "string" && v in PRICE_LEVELS) return PRICE_LEVELS[v];
  return undefined;
}

export function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "place";
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

function text(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export interface NormalizeResult {
  place?: Record<string, unknown> & { id: string };
  problem?: string;
}

export function normalizePlace(raw: Record<string, unknown>): NormalizeResult {
  const name = text(raw.name) ?? text((raw.displayName as { text?: string })?.text);
  if (!name) return { problem: "no name" };

  const cityRaw = (text(raw.city) ?? "").toLowerCase();
  const city = CITY_ALIASES[cityRaw];
  if (!city) return { problem: `unknown city "${raw.city ?? ""}" for ${name}` };

  const catRaw = (text(raw.category) ?? text(raw.type) ?? text(raw.primaryType) ?? "").toLowerCase();
  const category = CATEGORY_ALIASES[catRaw] ?? CATEGORY_ALIASES[catRaw.replace(/\s+/g, "_")];
  if (!category) return { problem: `unknown category "${catRaw}" for ${name}` };

  const loc = (raw.location ?? raw.coordinates ?? {}) as Record<string, unknown>;
  const lat = num(raw.lat) ?? num(raw.latitude) ?? num(loc.lat) ?? num(loc.latitude);
  const lng = num(raw.lng) ?? num(raw.lon) ?? num(raw.longitude) ?? num(loc.lng) ?? num(loc.longitude);
  const validCoords = lat !== undefined && lng !== undefined &&
    lat >= 21 && lat <= 32 && lng >= 24 && lng <= 37; // inside Egypt

  const photos = (Array.isArray(raw.photos) ? raw.photos : [])
    .map((p: unknown) => {
      if (typeof p === "string") return p.startsWith("http") ? { url: p } : p.startsWith("places/") ? { name: p } : null;
      if (p && typeof p === "object") {
        const o = p as Record<string, unknown>;
        const url = text(o.url) ?? text(o.photoUrl) ?? text(o.storageUrl);
        const ref = text(o.name);
        const attribution = text(o.attribution) ??
          text((o.authorAttributions as { displayName?: string }[] | undefined)?.[0]?.displayName);
        if (!url && !(ref && ref.startsWith("places/"))) return null;
        return { ...(url ? { url } : { name: ref }), ...(attribution ? { attribution } : {}) };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 5);

  const area = text(raw.area) ?? text(raw.neighborhood) ?? text(raw.district);
  const id = text(raw.id) ?? slugify(`${name}-${area ?? city}`);
  const openingHours = Array.isArray(raw.openingHours)
    ? raw.openingHours.filter((l): l is string => typeof l === "string")
    : Array.isArray((raw.regularOpeningHours as { weekdayDescriptions?: unknown })?.weekdayDescriptions)
      ? ((raw.regularOpeningHours as { weekdayDescriptions: string[] }).weekdayDescriptions)
      : undefined;

  const place: Record<string, unknown> & { id: string } = {
    id,
    name,
    category,
    city,
    area,
    address: text(raw.address) ?? text(raw.formattedAddress),
    lat: validCoords ? lat : null,
    lng: validCoords ? lng : null,
    googlePlaceId: text(raw.googlePlaceId) ?? text(raw.placeId) ?? text(raw.google_place_id),
    rating: num(raw.rating),
    ratingCount: num(raw.ratingCount) ?? num(raw.userRatingCount) ?? num(raw.reviewCount),
    priceLevel: priceLevelFrom(raw.priceLevel),
    // Only kept when it came from real user submissions in the source data.
    avgCostPerPerson: num(raw.avgCostPerPerson),
    photos,
    openingHours,
    parentMallId: text(raw.parentMallId),
    website: text(raw.website) ?? text(raw.websiteUri),
    phone: text(raw.phone) ?? text(raw.nationalPhoneNumber),
    indoor: typeof raw.indoor === "boolean" ? raw.indoor : undefined,
    source: text(raw.source) ?? "khroga_research",
  };
  for (const k of Object.keys(place)) if (place[k] === undefined) delete place[k];
  return { place };
}
