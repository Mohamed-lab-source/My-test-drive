/* ======================================================================
 * Jarvis 2.6 — finding places properly
 *
 * The original lookup (Open-Meteo's geocoder) only knows city names, so
 * street addresses and Google Maps links failed. Places now resolve through
 * a chain: coordinates → "here" → saved places → map links → OpenStreetMap
 * (Nominatim) → Photon → city names, with progressively simpler retries
 * for addresses that aren't found as written. Loads after extras.js.
 * ====================================================================== */

const geocodeCity = geocode; // the original: city names with timezones (used by the world clock)
const PLACES_UA = { "User-Agent": "JarvisPersonalAssistant/2.6 (personal use)" };

Object.assign(state, { places: {} }); // { home: {lat, lon, label}, work: {...}, gym: {...} }

const HERE_WORDS = /^(here|right here|current location|my (current )?location|where i am( now| right now)?|my position|هنا|مكاني)$/i;
const PLACE_KEYS = [
  [/^(my )?(home|house|place|flat|apartment)$|^البيت$|^بيتي$/i, "home"],
  [/^(my )?(work|office|job|workplace)$|^الشغل$|^المكتب$/i, "work"],
];

function placeKey(name) {
  const n = String(name || "").trim().toLowerCase().replace(/^the /, "");
  for (const [re, key] of PLACE_KEYS) if (re.test(n)) return key;
  return n.replace(/^my /, "").slice(0, 40);
}

function savedPlace(query) {
  const key = placeKey(query);
  const p = state.places[key];
  if (p) return { lat: p.lat, lon: p.lon, label: p.label || key };
  const spot = state.spots && state.spots[key];
  if (spot) return { lat: spot.lat, lon: spot.lon, label: spot.address || key };
  return null;
}

/* Google Maps links: long URLs carry coordinates; short share links
 * (maps.app.goo.gl) are followed natively to where they point. */
function coordsInText(text) {
  const s = decodeURIComponent(String(text || ""));
  const patterns = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|destination|daddr|center|sll)=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
    /\[null,null,(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})\]/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return { lat: Number(m[1]), lon: Number(m[2]) };
  }
  return null;
}

async function coordsFromMapLink(url) {
  let c = coordsInText(url);
  if (c) return { ...c, label: "the location in your link" };
  let finalUrl = url, body = "";
  try {
    if (CapacitorHttp) {
      const res = await CapacitorHttp.get({ url, headers: { "User-Agent": MOBILE_UA }, responseType: "text" });
      finalUrl = res.url || url;
      body = typeof res.data === "string" ? res.data : "";
    } else {
      const res = await fetch(url);
      finalUrl = res.url || url;
      body = await res.text();
    }
  } catch {}
  c = coordsInText(finalUrl) || coordsInText(body.slice(0, 200000));
  if (c) return { ...c, label: "the location in your link" };
  // A place link without coordinates: search for its name instead.
  const named = decodeURIComponent(finalUrl).match(/\/place\/([^/@?]+)/) || decodeURIComponent(finalUrl).match(/[?&]q=([^&]+)/);
  if (named) return searchPlace(named[1].replace(/\+/g, " "));
  return null;
}

async function nominatimSearch(q) {
  const bias = state.places.home;
  const view = bias ? `&viewbox=${bias.lon - 1},${bias.lat + 1},${bias.lon + 1},${bias.lat - 1}` : "";
  const r = await httpGetJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=en&q=${encodeURIComponent(q)}${view}`, PLACES_UA);
  if (!Array.isArray(r) || !r.length) return null;
  return { lat: Number(r[0].lat), lon: Number(r[0].lon), label: r[0].display_name };
}

async function photonSearch(q) {
  const bias = state.places.home;
  const near = bias ? `&lat=${bias.lat}&lon=${bias.lon}` : "";
  const r = await httpGetJson(`https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(q)}${near}`);
  const f = r && r.features && r.features[0];
  if (!f) return null;
  const p = f.properties || {};
  const label = [p.name, [p.housenumber, p.street].filter(Boolean).join(" "), p.district, p.city, p.country].filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i).join(", ");
  return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: label || q };
}

async function searchPlace(q) {
  // The city geocoder matches loosely; only trust it with short, plain place names, never street addresses.
  const cityLike = !/\d/.test(q) && !q.includes(",") && q.trim().split(/\s+/).length <= 3;
  for (const engine of cityLike ? [nominatimSearch, photonSearch, geocodeCity] : [nominatimSearch, photonSearch]) {
    try {
      const hit = await engine(q);
      if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon)) return hit;
    } catch {}
  }
  return null;
}

// "64 Banks Center St, New Cairo 1" → without the number → the last two parts → the last part.
function simplerQueries(q) {
  const out = [];
  const noNumber = q.replace(/^\s*\d+[a-z]?\s*[,-]?\s*/i, "");
  if (noNumber !== q) out.push(noNumber);
  const parts = q.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length > 2) out.push(parts.slice(-2).join(", "));
  if (parts.length > 1) out.push(parts[parts.length - 1]);
  return [...new Set(out)].filter(s => s && s !== q);
}

geocode = async function (place) {
  const q = String(place || "").trim();
  if (!q) throw new Error("Which place?");
  const m = q.match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (m) return { lat: Number(m[1]), lon: Number(m[2]), label: q };
  if (HERE_WORDS.test(q)) {
    const p = await currentPosition();
    return { lat: p.lat, lon: p.lon, label: "your current location" };
  }
  const saved = savedPlace(q);
  if (saved) return saved;
  if (/^https?:\/\/|maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps/i.test(q)) {
    const c = await coordsFromMapLink(/^https?:/i.test(q) ? q : "https://" + q);
    if (c) return c;
    throw new Error("I couldn't read a location from that link. Share it again, or give me the address.");
  }
  const exact = await searchPlace(q);
  if (exact) return exact;
  for (const simpler of simplerQueries(q)) {
    const near = await searchPlace(simpler);
    if (near) return { ...near, label: `${near.label} (approximate: "${q}" wasn't found exactly)`, approximate: true };
  }
  throw new Error(`I couldn't find "${q}" on the map. A landmark, a district, or a Google Maps link will do.`);
};

// No place named: home (saved coordinates, then the typed address), else where the user is.
resolvePlace = async function (location) {
  if (location) return geocode(location);
  if (state.places.home) return savedPlace("home");
  if (state.homeLoc) return geocode(state.homeLoc);
  const pos = await currentPosition();
  return { lat: pos.lat, lon: pos.lon, label: "your current location" };
};

getCommuteTime = async function (origin, destination) {
  const o = origin ? await geocode(origin) : await geocode("here");
  const dest = destination || (state.places.work ? "work" : state.workLoc);
  if (!dest) throw new Error("Where to? No destination given and no work location saved.");
  const d = await geocode(dest);
  const data = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`)).json();
  if (!data.routes || !data.routes.length) throw new Error("Couldn't find a driving route between those places.");
  const route = data.routes[0];
  return {
    from: o.label, to: d.label,
    minutes: Math.round(route.duration / 60), km: Math.round(route.distance / 100) / 10,
    approximate: !!(o.approximate || d.approximate) || undefined,
    note: "Free-flow driving estimate without live traffic; Cairo rush hour can add a lot. Offer to start navigation for live traffic.",
    directionsLink: `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lon}&destination=${d.lat},${d.lon}&travelmode=driving`,
  };
};

const cleanLabel = l => String(l).replace(/ \(approximate: .*\)$/, "");

async function savePlace({ name, address } = {}) {
  const key = placeKey(name || "home");
  const found = address ? await geocode(address) : await geocode("here");
  let label = cleanLabel(found.label);
  if (!address) {
    try {
      const r = await httpGetJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${found.lat}&lon=${found.lon}&zoom=18&accept-language=en`, PLACES_UA);
      if (r && r.display_name) label = r.display_name;
    } catch {}
  }
  state.places[key] = { lat: found.lat, lon: found.lon, label };
  store.set("places", state.places);
  if (key === "home" || key === "work") {
    const input = document.getElementById(key === "home" ? "homeLocInput" : "workLocInput");
    if (key === "home") { state.homeLoc = label; store.set("homeLoc", label); } else { state.workLoc = label; store.set("workLoc", label); }
    if (input) input.value = label;
    showPlaceCheck(key, `✓ Saved: ${label}`, true);
  }
  return { saved: key, address: label, approximate: found.approximate || undefined };
}

/* Settings: check each address as it's typed, cache its coordinates, and
 * offer "use where I am now". */
function showPlaceCheck(key, text, ok) {
  const el = document.getElementById(key === "home" ? "homeLocCheck" : "workLocCheck");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("ok", !!ok);
  el.classList.toggle("bad", ok === false);
}

async function checkTypedPlace(key, text) {
  delete state.places[key]; // the typed text is now the source of truth
  store.set("places", state.places);
  if (!text) { showPlaceCheck(key, ""); return; }
  showPlaceCheck(key, "Looking it up…");
  try {
    const found = await geocode(text);
    state.places[key] = { lat: found.lat, lon: found.lon, label: cleanLabel(found.label) };
    store.set("places", state.places);
    showPlaceCheck(key, `${found.approximate ? "≈ Closest match" : "✓ Found"}: ${cleanLabel(found.label)}`, true);
  } catch (e) {
    showPlaceCheck(key, `✗ ${e.message}`, false);
  }
}

FEATURE_TOOLS.push({
  type: "function",
  function: {
    name: "save_place",
    description: "Save a named place (home, work, gym, mum's house…) as where the user is right now, or from an address or Google Maps link. Use when they say 'this is my home', 'set work to …'.",
    parameters: { type: "object", properties: { name: { type: "string" }, address: { type: "string", description: "Omit to use the current location" } }, required: ["name"] },
  },
});
FEATURE_HANDLERS.save_place = a => savePlace(a);
FEATURE_LABELS.save_place = a => `SAVING PLACE: ${String(a.name || "home").toUpperCase()}`;
TOOL_GROUPS.location.tools.push("save_place");
TOOL_GROUPS.location.about += ", saving named places (home, work…)";
TOOL_GROUPS.location.match = new RegExp(TOOL_GROUPS.location.match.source +
  "|\\b(my home|my house|my work|my office|set (my )?(home|work)|save (this|here|my location)|this is my|maps\\.app\\.goo\\.gl|google\\.[a-z.]+\\/maps)\\b|البيت|الشغل", "i");
// The commute tool now defaults to "from here", and accepts anything the chain understands.
const commuteSchema = TOOLS.find(t => t.function.name === "get_commute_time");
if (commuteSchema) {
  commuteSchema.function.description = "Driving time and distance between two places. Origin defaults to where the user is now, destination to work. Accepts addresses, landmarks, 'home'/'work'/saved places, coordinates, or Google Maps links.";
}

async function initPlaces() {
  state.places = await store.get("places", {});
  for (const key of ["home", "work"]) {
    const input = document.getElementById(key === "home" ? "homeLocInput" : "workLocInput");
    const btn = document.getElementById(key === "home" ? "homeHereBtn" : "workHereBtn");
    if (input) input.addEventListener("change", () => checkTypedPlace(key, input.value.trim()));
    if (btn) btn.addEventListener("click", async () => {
      showPlaceCheck(key, "Getting your location…");
      try { await savePlace({ name: key }); } catch (e) { showPlaceCheck(key, `✗ ${e.message}`, false); }
    });
    if (state.places[key]) showPlaceCheck(key, `✓ ${state.places[key].label}`, true);
  }
}
