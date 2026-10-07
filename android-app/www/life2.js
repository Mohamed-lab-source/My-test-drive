/* ======================================================================
 * Jarvis 4.0 — pack 5: Home, kitchen, travel, units & Islamic (offline)
 * Loads after text2.js. Reuses c2n / c2r / clampNum / localDayKey.
 * ====================================================================== */

/* ---- Home / DIY ------------------------------------------------------------- */
function paintNeeded({ wall_area, length, height, coats, opening_area } = {}) {
  let area = Number(wall_area); if (!area && length && height) area = c2n(length, "length") * c2n(height, "height");
  if (!area) throw new Error("Give me the wall area, or its length and height.");
  area = Math.max(0, area - Number(opening_area || 0)); const c = Math.round(clampNum(coats, 1, 5, 2));
  const liters = area * c / 10; // ~10 m² per litre per coat
  return { wallArea: c2r(area, 1), coats: c, litresNeeded: c2r(liters, 1), note: "~10 m² per litre per coat." };
}
function tilesNeeded({ area_m2, tile_length_cm, tile_width_cm, waste_percent } = {}) {
  const area = c2n(area_m2, "the area in m²"); const tile = c2n(tile_length_cm, "tile length") * c2n(tile_width_cm, "tile width") / 10000;
  if (tile <= 0) throw new Error("Tile size must be positive."); const waste = 1 + clampNum(waste_percent, 0, 50, 10) / 100;
  return { tiles: Math.ceil(area / tile * waste), note: `Includes ${Math.round((waste - 1) * 100)}% waste.` };
}
function wallpaperRolls({ perimeter_m, wall_height_m, roll_length_m, roll_width_m } = {}) {
  const per = c2n(perimeter_m, "the room perimeter"), h = c2n(wall_height_m, "the wall height");
  const rollL = clampNum(roll_length_m, 1, 50, 10), rollW = clampNum(roll_width_m, 0.3, 2, 0.53);
  const stripsPerRoll = Math.floor(rollL / (h + 0.1)); const stripsNeeded = Math.ceil(per / rollW);
  return { rolls: Math.ceil(stripsNeeded / Math.max(1, stripsPerRoll)), note: "Allows a little for pattern matching." };
}
function carpetCost({ length, width, price_per_m2 } = {}) { const a = c2n(length, "length") * c2n(width, "width"); return { area_m2: c2r(a, 2), cost: c2r(a * c2n(price_per_m2, "price per m²")), currency: "EGP" }; }
function concreteVolume({ length, width, depth } = {}) { const v = c2n(length, "length") * c2n(width, "width") * c2n(depth, "depth"); return { volume_m3: c2r(v, 3), bags_50kg: Math.ceil(v * 2400 / 50 * 0.15), note: "Rough: ~0.15 of mass is cement." }; }
function aggregateNeeded({ area_m2, depth_cm } = {}) { const v = c2n(area_m2, "area") * c2n(depth_cm, "depth in cm") / 100; return { volume_m3: c2r(v, 2), tonnes: c2r(v * 1.6, 2), note: "~1.6 t/m³ for sand/gravel." }; }
function bricksNeeded({ wall_area_m2 } = {}) { const a = c2n(wall_area_m2, "the wall area"); return { bricks: Math.ceil(a * 60), note: "~60 standard bricks per m² (single skin, with mortar)." }; }
function flooringCost({ area_m2, price_per_m2, waste_percent } = {}) { const a = c2n(area_m2, "area") * (1 + clampNum(waste_percent, 0, 30, 7) / 100); return { areaWithWaste_m2: c2r(a, 2), cost: c2r(a * c2n(price_per_m2, "price per m²")), currency: "EGP" }; }
function poolVolume({ length, width, avg_depth } = {}) { const v = c2n(length, "length") * c2n(width, "width") * c2n(avg_depth, "average depth"); return { volume_m3: c2r(v, 2), litres: c2r(v * 1000, 0), gallons: c2r(v * 264.172, 0) }; }
function boardFeet({ length_ft, width_in, thickness_in, quantity } = {}) { const bf = c2n(length_ft, "length in feet") * c2n(width_in, "width in inches") * c2n(thickness_in, "thickness in inches") / 12 * Math.round(clampNum(quantity, 1, 1000, 1)); return { boardFeet: c2r(bf, 2) }; }
function ladderLength({ wall_height } = {}) { const h = c2n(wall_height, "the height to reach"); const base = h / 4; return { ladderLength: c2r(Math.hypot(h, base), 2), baseDistance: c2r(base, 2), note: "4:1 rule (~75°)." }; }
function roomAcBtu({ area_m2, sunny, people } = {}) { let btu = c2n(area_m2, "room area in m²") * 10.76 * 20; if (sunny) btu *= 1.1; btu += Math.max(0, (Number(people || 1) - 1)) * 600; return { btu: Math.round(btu), recommendedHp: c2r(btu / 12000, 2), note: "Rough sizing." }; }

/* ---- Kitchen ---------------------------------------------------------------- */
function recipeScale({ quantity, from_servings, to_servings } = {}) { const q = c2n(quantity, "the quantity"), f = c2n(from_servings, "original servings"), t = c2n(to_servings, "desired servings"); if (!f) throw new Error("Original servings can't be zero."); return { scaled: c2r(q * t / f, 3), factor: c2r(t / f, 3) }; }
function ovenConvert({ temp, from, to } = {}) {
  const t = c2n(temp, "the temperature"); const f = String(from || "C").toUpperCase()[0]; let celsius = f === "F" ? (t - 32) * 5 / 9 : f === "G" ? 135 + (t - 1) * 14 : t;
  const gas = Math.max(1, Math.round((celsius - 135) / 14 + 1)); const out = { celsius: Math.round(celsius), fahrenheit: Math.round(celsius * 9 / 5 + 32), gasMark: gas };
  const to_ = String(to || "").toUpperCase()[0]; if (to_ === "F") return { result: out.fahrenheit + "°F" }; if (to_ === "C") return { result: out.celsius + "°C" }; if (to_ === "G") return { result: "gas mark " + gas };
  return out;
}
const L2_VOL = { ml: 1, milliliter: 1, l: 1000, liter: 1000, litre: 1000, tsp: 5, teaspoon: 5, tbsp: 15, tablespoon: 15, cup: 240, cups: 240, floz: 30, "fl oz": 30, pint: 473, quart: 946, gallon: 3785 };
function cookingConvert({ amount, from, to } = {}) {
  const a = c2n(amount, "the amount"); const f = L2_VOL[String(from || "").toLowerCase().trim()], t = L2_VOL[String(to || "").toLowerCase().trim()];
  if (!f || !t) throw new Error("Use cup, tbsp, tsp, ml, l, fl oz, pint, quart or gallon.");
  return { result: c2r(a * f / t, 3), from, to };
}
function coffeeRatio({ cups, water_ml, ratio } = {}) {
  const r = Math.round(clampNum(ratio, 10, 20, 16)); const water = water_ml ? c2n(water_ml, "water") : c2n(cups, "cups") * 240;
  return { water_ml: Math.round(water), coffee_g: c2r(water / r, 1), ratio: `1:${r}` };
}
const L2_SUBS = { butter: "equal olive oil or margarine (¾ the amount for oil)", egg: "¼ cup unsweetened applesauce, or 1 tbsp ground flax + 3 tbsp water", milk: "equal water + 1 tbsp butter, or any plant milk", sugar: "equal honey (reduce liquid slightly) or date syrup", flour: "equal oat flour, or a 1:1 gluten-free blend", "baking powder": "¼ tsp baking soda + ½ tsp cream of tartar per tsp", buttermilk: "1 cup milk + 1 tbsp lemon juice, left 5 min", "sour cream": "equal plain yogurt", honey: "equal sugar + a little extra liquid", cream: "equal evaporated milk, or milk + butter", yogurt: "equal sour cream or buttermilk", cornstarch: "2 tbsp flour per 1 tbsp cornstarch" };
function bakingSubstitute({ ingredient } = {}) { const k = String(ingredient || "").toLowerCase().trim(); const hit = Object.keys(L2_SUBS).find(x => k.includes(x)); if (!hit) throw new Error(`I don't have a substitute for "${ingredient}".`); return { ingredient: hit, substitute: L2_SUBS[hit] }; }

/* ---- Travel & units --------------------------------------------------------- */
function haversine({ lat1, lon1, lat2, lon2 } = {}) {
  const toR = d => d * Math.PI / 180; const R = 6371;
  const dLat = toR(c2n(lat2, "lat2") - c2n(lat1, "lat1")), dLon = toR(c2n(lon2, "lon2") - c2n(lon1, "lon1"));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return { distanceKm: c2r(km, 2), distanceMiles: c2r(km * 0.621371, 2) };
}
function tripBudget({ total, days, people } = {}) { const t = c2n(total, "the total budget"), d = Math.max(1, Math.round(Number(days || 1))), p = Math.max(1, Math.round(Number(people || 1))); return { perDay: c2r(t / d), perPerson: c2r(t / p), perPersonPerDay: c2r(t / p / d) }; }
function jetLag({ timezones_crossed, direction } = {}) { const z = Math.abs(Math.round(c2n(timezones_crossed, "time zones crossed"))); const east = /e(ast)?/i.test(direction || "e"); const days = Math.round(z * (east ? 0.66 : 0.5)); return { timezones: z, recoveryDays: days, tip: east ? "Going east is harder — get morning light and shift sleep earlier beforehand." : "Going west is easier — seek evening light." }; }
function packingEstimate({ days, trip_type } = {}) {
  const d = Math.max(1, Math.round(c2n(days, "the number of days"))); const beach = /beach|summer|hot/i.test(trip_type || "");
  return { days: d, shirts: Math.min(d + 1, 10), underwear: Math.min(d + 2, 14), trousers: Math.ceil(d / 3) + 1, socks: Math.min(d + 1, 12), note: beach ? "Add swimwear and sunscreen." : "Layer for changeable weather." };
}
function fuelEfficiency({ distance_km, liters } = {}) { const d = c2n(distance_km, "distance"), l = c2n(liters, "litres used"); if (l <= 0) throw new Error("Litres must be above zero."); return { kmPerLitre: c2r(d / l, 2), litresPer100km: c2r(l / d * 100, 2), mpg: c2r(d / l * 2.3521, 1) }; }
function tireSize({ size } = {}) {
  const m = String(size || "").match(/(\d{3})\s*\/\s*(\d{2})\s*R?\s*(\d{2})/i); if (!m) throw new Error("Give a size like 205/55R16.");
  const w = +m[1], ar = +m[2], rim = +m[3]; const sidewall = w * ar / 100; const diameter_mm = rim * 25.4 + sidewall * 2;
  return { width_mm: w, aspectRatio: ar, rim_in: rim, sidewall_mm: c2r(sidewall, 1), overallDiameter_mm: c2r(diameter_mm, 1), overallDiameter_in: c2r(diameter_mm / 25.4, 1) };
}
const L2_SPEED = { kmh: 1 / 3.6, "km/h": 1 / 3.6, kph: 1 / 3.6, mph: 0.44704, ms: 1, "m/s": 1, knots: 0.514444, knot: 0.514444 };
function speedConvert({ value, from, to } = {}) { const v = c2n(value, "the value"); const f = L2_SPEED[String(from || "kmh").toLowerCase()], t = L2_SPEED[String(to || "mph").toLowerCase()]; if (!f || !t) throw new Error("Use kmh, mph, ms or knots."); return { result: c2r(v * f / t, 3), from, to }; }
function shoeSize({ value, from, to, sex } = {}) {
  const v = c2n(value, "the size"); const men = !/f|woman|female/i.test(sex || "m");
  let eu; const f = String(from || "EU").toUpperCase();
  if (f === "EU") eu = v; else if (f === "UK") eu = men ? v + 33 : v + 34; else eu = men ? v + 33 - 1 : v + 31; // US
  const out = { EU: c2r(eu, 1), UK: c2r(men ? eu - 33 : eu - 34, 1), US: c2r(men ? eu - 33 + 1 : eu - 31, 1) };
  const t = String(to || "").toUpperCase(); if (t && out[t] != null) return { result: out[t], system: t }; out.note = "Approximate; brands vary."; return out;
}
function ringSize({ diameter_mm, circumference_mm } = {}) { const circ = circumference_mm ? c2n(circumference_mm, "circumference") : c2n(diameter_mm, "diameter") * Math.PI; return { circumference_mm: c2r(circ, 1), diameter_mm: c2r(circ / Math.PI, 1), usSize: c2r((circ - 36.5) / 2.55, 1), euSize: c2r(circ, 1) }; }
function dataTransferTime({ size_mb, speed_mbps } = {}) { const s = c2n(size_mb, "the size in MB"), sp = c2n(speed_mbps, "the speed in Mbps"); if (sp <= 0) throw new Error("Speed must be above zero."); const sec = s * 8 / sp; return { seconds: c2r(sec, 1), formatted: typeof durationFormat === "function" ? durationFormat({ seconds: sec }).formatted : c2r(sec, 1) + "s" }; }
function aspectRatio({ width, height } = {}) { let a = Math.round(c2n(width, "width")), b = Math.round(c2n(height, "height")); let g = a, h = b; while (h) { [g, h] = [h, g % h]; } g = g || 1; const r = `${a / g}:${b / g}`; const names = { "16:9": "widescreen", "4:3": "standard", "21:9": "ultrawide", "1:1": "square", "3:2": "classic photo", "9:16": "vertical/stories" }; return { ratio: r, name: names[r] || null }; }
function megapixels({ width, height } = {}) { return { megapixels: c2r(c2n(width, "width") * c2n(height, "height") / 1e6, 1) }; }
function screenPpi({ width_px, height_px, diagonal_in } = {}) { const d = Math.hypot(c2n(width_px, "width in px"), c2n(height_px, "height in px")); return { ppi: c2r(d / c2n(diagonal_in, "diagonal in inches"), 1) }; }
function batteryTime({ capacity_mah, draw_ma } = {}) { const c = c2n(capacity_mah, "capacity in mAh"), d = c2n(draw_ma, "current draw in mA"); if (d <= 0) throw new Error("Draw must be above zero."); const hrs = c / d * 0.85; return { hours: c2r(hrs, 1), formatted: `${Math.floor(hrs)}h ${Math.round(hrs % 1 * 60)}m`, note: "Assumes ~85% usable." }; }

/* ---- Weather maths ---------------------------------------------------------- */
function windChill({ temp_c, wind_kmh } = {}) { const T = c2n(temp_c, "temperature"), V = c2n(wind_kmh, "wind speed"); const wc = 13.12 + 0.6215 * T - 11.37 * Math.pow(V, 0.16) + 0.3965 * T * Math.pow(V, 0.16); return { windChill_c: c2r(wc, 1), note: V < 5 ? "Wind chill only really applies above ~5 km/h." : "Feels like this in the wind." }; }
function heatIndex({ temp_c, humidity } = {}) {
  const Tf = c2n(temp_c, "temperature") * 9 / 5 + 32, R = c2n(humidity, "humidity %");
  let HI = -42.379 + 2.04901523 * Tf + 10.14333127 * R - 0.22475541 * Tf * R - 6.83783e-3 * Tf * Tf - 5.481717e-2 * R * R + 1.22874e-3 * Tf * Tf * R + 8.5282e-4 * Tf * R * R - 1.99e-6 * Tf * Tf * R * R;
  return { feelsLike_c: c2r((HI - 32) * 5 / 9, 1), note: "Apparent temperature in heat and humidity." };
}
function dewPoint({ temp_c, humidity } = {}) { const T = c2n(temp_c, "temperature"), R = c2n(humidity, "humidity %"); const a = 17.27, b = 237.7; const g = Math.log(R / 100) + a * T / (b + T); return { dewPoint_c: c2r(b * g / (a - g), 1), comfort: (b * g / (a - g)) < 13 ? "comfortable/dry" : (b * g / (a - g)) < 18 ? "a little humid" : "muggy" }; }
function rainfallVolume({ area_m2, mm } = {}) { const v = c2n(area_m2, "area in m²") * c2n(mm, "rainfall in mm"); return { litres: c2r(v, 0), cubicMetres: c2r(v / 1000, 3), note: "1 mm over 1 m² = 1 litre." }; }

/* ---- School ----------------------------------------------------------------- */
function gradeAverage({ scores, weights } = {}) { const s = c2list(scores); if (weights) { const w = c2list(weights); const tot = w.reduce((a, b) => a + b, 0); return { weightedAverage: c2r(s.reduce((a, x, i) => a + x * (w[i] || 0), 0) / tot, 2) }; } return { average: c2r(s.reduce((a, b) => a + b, 0) / s.length, 2), count: s.length }; }
const L2_GPA = { "A+": 4, A: 4, "A-": 3.7, "B+": 3.3, B: 3, "B-": 2.7, "C+": 2.3, C: 2, "C-": 1.7, "D+": 1.3, D: 1, F: 0 };
function gpaCalc({ grades } = {}) { const list = (Array.isArray(grades) ? grades : String(grades || "").split(/[,\s]+/)).map(g => g.trim().toUpperCase()).filter(Boolean); if (!list.length) throw new Error("Give me grades like A, B+, C."); const pts = list.map(g => L2_GPA[g]); if (pts.some(p => p == null)) throw new Error("Use letter grades A+ to F."); return { gpa: c2r(pts.reduce((a, b) => a + b, 0) / pts.length, 2), courses: list.length }; }

/* ---- Islamic / Egypt -------------------------------------------------------- */
function zakatFitr({ people, price_per_kg } = {}) { const n = Math.max(1, Math.round(c2n(people, "the number of people"))); const price = c2n(price_per_kg, "the price of staple food per kg"); return { people: n, kgPerPerson: 2.5, totalKg: c2r(n * 2.5, 1), amount: c2r(n * 2.5 * price), currency: "EGP", note: "~2.5 kg of staple food per person (one saʿ)." }; }
function qibla({ lat, lon } = {}) {
  const toR = d => d * Math.PI / 180, toD = r => r * 180 / Math.PI; const kLat = toR(21.4225), kLon = toR(39.8262);
  const la = toR(c2n(lat, "your latitude")), lo = toR(c2n(lon, "your longitude")); const dLon = kLon - lo;
  let b = toD(Math.atan2(Math.sin(dLon), Math.cos(la) * Math.tan(kLat) - Math.sin(la) * Math.cos(dLon)));
  b = (b + 360) % 360; const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return { bearingFromNorth: c2r(b, 1) + "°", compass: dirs[Math.round(b / 45) % 8], note: "Face this direction for prayer." };
}
function fastingHours({ fajr, maghrib } = {}) { const a = h2time(fajr), b = h2time(maghrib); if (a == null || b == null) throw new Error("Give Fajr and Maghrib times, like 4:30 and 18:15."); let diff = b - a; if (diff < 0) diff += 1440; return { fastingHours: `${Math.floor(diff / 60)}h ${diff % 60}m`, totalMinutes: diff }; }
function khatmaPlan({ days } = {}) { const d = Math.max(1, Math.round(c2n(days, "the number of days"))); const pages = 604; return { days: d, pagesPerDay: c2r(pages / d, 1), perPrayer: c2r(pages / d / 5, 1), note: "The Mushaf is 604 pages; per-prayer splits it across the five." }; }
function hijriAge({ birthdate } = {}) { const d = new Date(`${String(birthdate || "").trim()}T12:00:00`); if (isNaN(d)) throw new Error("Give a birthdate like 1995-04-20."); const days = (Date.now() - d) / 86400000; return { gregorianYears: c2r(days / 365.25, 1), hijriYears: c2r(days / 354.367, 1), note: "The Hijri year is ~11 days shorter." }; }
const L2_RAMADAN = ["2026-02-18", "2027-02-08", "2028-01-28", "2029-01-16", "2030-01-05", "2031-12-26"];
function ramadanCountdown() { const now = Date.now(); const next = L2_RAMADAN.map(s => new Date(s + "T00:00:00")).find(d => d > now); if (!next) return { note: "Beyond my table — ask nearer the time." }; return { nextRamadanStarts: localDayKey(next), inDays: Math.ceil((next - now) / 86400000), note: "Approximate; the sighting of the moon decides the exact day." }; }
const L2_TIPS = { egypt: "10% is common; a little more for good service", usa: "18–20% expected", uk: "10–12.5%, often already added", france: "service included; round up", japan: "no tipping — it can offend", uae: "10–15%", "saudi arabia": "10–15%", italy: "service often included; round up", germany: "5–10%, round up", turkey: "5–10%" };
function tipByCountry({ country } = {}) { const k = String(country || "").toLowerCase().trim(); const hit = Object.keys(L2_TIPS).find(c => k.includes(c)); if (!hit) throw new Error(`I don't have tipping custom for "${country}".`); return { country: hit, custom: L2_TIPS[hit] }; }

FEATURE_TOOLS.push(
  xfn("paint_needed", "Litres of paint for a wall.", { wall_area: xn, length: xn, height: xn, coats: xi, opening_area: xn }),
  xfn("tiles_needed", "How many tiles to cover an area (with waste).", { area_m2: xn, tile_length_cm: xn, tile_width_cm: xn, waste_percent: xn }, ["area_m2", "tile_length_cm", "tile_width_cm"]),
  xfn("wallpaper_rolls", "Rolls of wallpaper for a room.", { perimeter_m: xn, wall_height_m: xn, roll_length_m: xn, roll_width_m: xn }, ["perimeter_m", "wall_height_m"]),
  xfn("carpet_cost", "Carpet/flooring area and cost.", { length: xn, width: xn, price_per_m2: xn }, ["length", "width", "price_per_m2"]),
  xfn("concrete_volume", "Concrete volume for a slab.", { length: xn, width: xn, depth: xn }, ["length", "width", "depth"]),
  xfn("aggregate_needed", "Sand/gravel volume and tonnage for an area and depth.", { area_m2: xn, depth_cm: xn }, ["area_m2", "depth_cm"]),
  xfn("bricks_needed", "Bricks to build a wall.", { wall_area_m2: xn }, ["wall_area_m2"]),
  xfn("flooring_cost", "Flooring area with waste and its cost.", { area_m2: xn, price_per_m2: xn, waste_percent: xn }, ["area_m2", "price_per_m2"]),
  xfn("pool_volume", "Water volume of a pool.", { length: xn, width: xn, avg_depth: xn }, ["length", "width", "avg_depth"]),
  xfn("board_feet", "Board feet of timber.", { length_ft: xn, width_in: xn, thickness_in: xn, quantity: xi }, ["length_ft", "width_in", "thickness_in"]),
  xfn("ladder_length", "Safe ladder length to reach a height.", { wall_height: xn }, ["wall_height"]),
  xfn("room_ac_btu", "Air-conditioner BTU for a room.", { area_m2: xn, sunny: xb, people: xi }, ["area_m2"]),
  xfn("recipe_scale", "Scale a recipe ingredient between serving sizes.", { quantity: xn, from_servings: xn, to_servings: xn }, ["quantity", "from_servings", "to_servings"]),
  xfn("oven_convert", "Convert oven temperature between °C, °F and gas mark.", { temp: xn, from: xs, to: xs }, ["temp", "from"]),
  xfn("cooking_convert", "Convert cooking volumes (cup, tbsp, tsp, ml…).", { amount: xn, from: xs, to: xs }, ["amount", "from", "to"]),
  xfn("coffee_ratio", "Coffee grams and water for a brew ratio.", { cups: xn, water_ml: xn, ratio: xi }),
  xfn("baking_substitute", "A substitute for a baking ingredient.", { ingredient: xs }, ["ingredient"]),
  xfn("haversine", "Great-circle distance between two lat/long points.", { lat1: xn, lon1: xn, lat2: xn, lon2: xn }, ["lat1", "lon1", "lat2", "lon2"]),
  xfn("trip_budget", "Split a trip budget per day and per person.", { total: xn, days: xi, people: xi }, ["total"]),
  xfn("jet_lag", "Estimate jet-lag recovery.", { timezones_crossed: xi, direction: xs }, ["timezones_crossed"]),
  xfn("packing_estimate", "Suggested clothing counts for a trip.", { days: xi, trip_type: xs }, ["days"]),
  xfn("fuel_efficiency", "Fuel economy from distance and litres used.", { distance_km: xn, liters: xn }, ["distance_km", "liters"]),
  xfn("tire_size", "Decode a tyre size like 205/55R16.", { size: xs }, ["size"]),
  xfn("speed_convert", "Convert speed between kmh, mph, m/s and knots.", { value: xn, from: xs, to: xs }, ["value", "from", "to"]),
  xfn("shoe_size", "Convert shoe sizes between EU, UK and US.", { value: xn, from: xs, to: xs, sex: xs }, ["value", "from"]),
  xfn("ring_size", "Ring size from diameter or circumference.", { diameter_mm: xn, circumference_mm: xn }),
  xfn("data_transfer_time", "How long to transfer a file at a given speed.", { size_mb: xn, speed_mbps: xn }, ["size_mb", "speed_mbps"]),
  xfn("aspect_ratio", "Simplify a width:height to an aspect ratio.", { width: xn, height: xn }, ["width", "height"]),
  xfn("megapixels", "Megapixels from a pixel width and height.", { width: xn, height: xn }, ["width", "height"]),
  xfn("screen_ppi", "Pixels-per-inch of a screen.", { width_px: xn, height_px: xn, diagonal_in: xn }, ["width_px", "height_px", "diagonal_in"]),
  xfn("battery_time", "Runtime from battery capacity and current draw.", { capacity_mah: xn, draw_ma: xn }, ["capacity_mah", "draw_ma"]),
  xfn("wind_chill", "Wind-chill 'feels like' temperature.", { temp_c: xn, wind_kmh: xn }, ["temp_c", "wind_kmh"]),
  xfn("heat_index", "Heat-index 'feels like' in heat and humidity.", { temp_c: xn, humidity: xn }, ["temp_c", "humidity"]),
  xfn("dew_point", "Dew point from temperature and humidity.", { temp_c: xn, humidity: xn }, ["temp_c", "humidity"]),
  xfn("rainfall_volume", "Litres of rain falling on an area.", { area_m2: xn, mm: xn }, ["area_m2", "mm"]),
  xfn("grade_average", "Average of scores, optionally weighted.", { scores: xs, weights: xs }, ["scores"]),
  xfn("gpa_calc", "GPA from letter grades (A+ to F).", { grades: xs }, ["grades"]),
  xfn("zakat_fitr", "Zakat al-Fitr for a household.", { people: xi, price_per_kg: xn }, ["people", "price_per_kg"]),
  xfn("qibla", "The Qibla direction from a latitude/longitude.", { lat: xn, lon: xn }, ["lat", "lon"]),
  xfn("fasting_hours", "Length of the fast from Fajr to Maghrib.", { fajr: xs, maghrib: xs }, ["fajr", "maghrib"]),
  xfn("khatma_plan", "Plan to finish the Quran in a number of days.", { days: xi }, ["days"]),
  xfn("hijri_age", "Age in Hijri years from a birthdate.", { birthdate: xs }, ["birthdate"]),
  xfn("ramadan_countdown", "Days until the next Ramadan.", {}),
  xfn("tip_by_country", "Tipping custom in a country.", { country: xs }, ["country"]),
);
Object.assign(FEATURE_HANDLERS, {
  paint_needed: a => paintNeeded(a), tiles_needed: a => tilesNeeded(a), wallpaper_rolls: a => wallpaperRolls(a), carpet_cost: a => carpetCost(a),
  concrete_volume: a => concreteVolume(a), aggregate_needed: a => aggregateNeeded(a), bricks_needed: a => bricksNeeded(a), flooring_cost: a => flooringCost(a),
  pool_volume: a => poolVolume(a), board_feet: a => boardFeet(a), ladder_length: a => ladderLength(a), room_ac_btu: a => roomAcBtu(a),
  recipe_scale: a => recipeScale(a), oven_convert: a => ovenConvert(a), cooking_convert: a => cookingConvert(a), coffee_ratio: a => coffeeRatio(a),
  baking_substitute: a => bakingSubstitute(a), haversine: a => haversine(a), trip_budget: a => tripBudget(a), jet_lag: a => jetLag(a),
  packing_estimate: a => packingEstimate(a), fuel_efficiency: a => fuelEfficiency(a), tire_size: a => tireSize(a), speed_convert: a => speedConvert(a),
  shoe_size: a => shoeSize(a), ring_size: a => ringSize(a), data_transfer_time: a => dataTransferTime(a), aspect_ratio: a => aspectRatio(a),
  megapixels: a => megapixels(a), screen_ppi: a => screenPpi(a), battery_time: a => batteryTime(a), wind_chill: a => windChill(a),
  heat_index: a => heatIndex(a), dew_point: a => dewPoint(a), rainfall_volume: a => rainfallVolume(a), grade_average: a => gradeAverage(a),
  gpa_calc: a => gpaCalc(a), zakat_fitr: a => zakatFitr(a), qibla: a => qibla(a), fasting_hours: a => fastingHours(a),
  khatma_plan: a => khatmaPlan(a), hijri_age: a => hijriAge(a), ramadan_countdown: () => ramadanCountdown(), tip_by_country: a => tipByCountry(a),
});
TOOL_GROUPS.home2 = {
  about: "home & DIY maths: paint, tiles, wallpaper, carpet, concrete, aggregate, bricks, flooring, pool volume, timber, ladder safety, AC sizing",
  tools: ["paint_needed", "tiles_needed", "wallpaper_rolls", "carpet_cost", "concrete_volume", "aggregate_needed", "bricks_needed", "flooring_cost", "pool_volume", "board_feet", "ladder_length", "room_ac_btu"],
  match: /\b(paint|tiles?|wallpaper|carpet|concrete|cement|aggregate|gravel|sand|bricks?|flooring|pool volume|board feet|timber|lumber|ladder|air con|\bac\b|btu|cooling)\b/i,
};
TOOL_GROUPS.kitchen2 = {
  about: "kitchen helpers: scale recipes, oven temperature convert, cooking volume convert, coffee ratios, ingredient substitutes",
  tools: ["recipe_scale", "oven_convert", "cooking_convert", "coffee_ratio", "baking_substitute"],
  match: /\b(scale .* recipe|servings|oven|gas mark|degrees|cups?|tablespoons?|teaspoons?|tbsp|tsp|millilit|coffee|brew|substitute for|instead of .* (butter|egg|milk|sugar|flour))\b/i,
};
TOOL_GROUPS.travel2 = {
  about: "travel & units: distance between coordinates, trip budget, jet lag, packing, fuel economy, tyre sizes, speed convert, shoe/ring sizes, data transfer, screen specs, battery life",
  tools: ["haversine", "trip_budget", "jet_lag", "packing_estimate", "fuel_efficiency", "tire_size", "speed_convert", "shoe_size", "ring_size", "data_transfer_time", "aspect_ratio", "megapixels", "screen_ppi", "battery_time"],
  match: /\b(distance between|how far|trip budget|jet ?lag|packing|what to pack|fuel economy|km ?\/ ?l|mpg|tyre|tire|speed.*(mph|kmh|knots)|convert.*speed|shoe size|ring size|download time|transfer time|aspect ratio|megapixel|ppi|pixel density|battery life|how long.*battery)\b/i,
};
TOOL_GROUPS.weather2 = {
  about: "weather & school maths: wind chill, heat index, dew point, rainfall volume, grade average, GPA",
  tools: ["wind_chill", "heat_index", "dew_point", "rainfall_volume", "grade_average", "gpa_calc"],
  match: /\b(wind ?chill|heat index|feels like|dew point|humidity|rainfall|rain volume|grade average|average grade|gpa)\b/i,
};
TOOL_GROUPS.islam2 = {
  about: "Islamic helpers: Zakat al-Fitr, Qibla direction, fasting hours, Quran khatma plan, Hijri age, Ramadan countdown, tipping customs",
  tools: ["zakat_fitr", "qibla", "fasting_hours", "khatma_plan", "hijri_age", "ramadan_countdown", "tip_by_country"],
  match: /\b(zakat al[- ]?fitr|fitr|qibla|qiblah|direction.*pray|fasting hours|how long.*fast|khatma|finish the quran|quran in|hijri age|age in hijri|ramadan|tipping|how much.*tip.*(in|abroad))\b|قبلة|زكاة الفطر|رمضان|ختمة/i,
};

async function initLife2() { /* stateless */ }
