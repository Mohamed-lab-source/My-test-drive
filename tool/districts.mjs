// Well-known districts of Greater Cairo and Alexandria, with the spellings
// the maps use (English, transliterated and Arabic). Used to give every place
// a recognisable area ("Maadi", "New Cairo (5th Settlement)", …).
//
// An area is only taken from what the data itself says (the place's own
// district/address, or the OpenStreetMap neighbourhood name), or — when that
// is missing — from what most of the places right around it say. It's a
// label for browsing, never a fact about the place.

/** [canonical English name, Arabic name, city, pattern]. Order matters: the first match wins. */
export const DISTRICTS = [
  ["New Cairo (5th Settlement)", "التجمع الخامس", "cairo",
    /new cairo|القاهرة الجديدة|القاهره الجديده|tagamo|tagamu|التجمع|settlement|5th sett|fifth sett|el yasmeen|el banafseg|الياسمين|البنفسج|90th st|التسعين/i],
  ["Rehab", "الرحاب", "cairo", /\brehab\b|الرحاب/i],
  ["Madinaty", "مدينتي", "cairo", /madinaty|مدينتي/i],
  ["Shorouk", "الشروق", "cairo", /shorouk|shorook|الشروق/i],
  ["Nasr City", "مدينة نصر", "cairo", /nasr city|madinat an na[sş]r|madinat al na[sş]r|مدين[ةه] نصر/i],
  ["Heliopolis", "مصر الجديدة", "cairo",
    /heliopolis|masr el gedida|masr al gadida|مصر الجديد|korba|الكوربة|alm[aā]z[aā]h?|almaza|ألماظة|الماظة|roxy|روكسي|sheraton|شيراتون|al golf\b|el nozha|النزهة/i],
  ["Maadi", "المعادي", "cairo", /ma['‘ʿ]?[aā]d[iī]|المعاد[يى]|degla|دجلة|zahraa el maadi|زهراء المعادي/i],
  ["Zamalek", "الزمالك", "cairo", /zamalek|الزمالك/i],
  ["Garden City", "جاردن سيتي", "cairo", /garden city|جاردن سيتي/i],
  ["Downtown", "وسط البلد", "cairo", /downtown|wust el balad|wist el balad|وسط البلد|talaat harb|طلعت حرب/i],
  ["Mokattam", "المقطم", "cairo", /mokattam|muqattam|المقطم/i],
  ["Manial", "المنيل", "cairo", /manial|el manyal|المنيل/i],
  ["Old Cairo", "مصر القديمة", "cairo", /old cairo|masr el qadima|مصر القديم/i],
  ["Shubra", "شبرا", "cairo", /shubra|shoubra|شبرا/i],
  ["Abbassia", "العباسية", "cairo", /abbassia|abbasiya|العباسي/i],
  ["Dokki", "الدقي", "giza", /dokki|doqi|duqqi|الدق[يى]/i],
  ["Mohandessin", "المهندسين", "giza", /mohand[ei]s+[ie]n|mohandiseen|المهندسين/i],
  ["Agouza", "العجوزة", "giza", /agouza|ajouza|العجوز[ةه]/i],
  ["Haram", "الهرم", "giza", /\bharam\b|pyramids? (st|road)|الهرم/i],
  ["Faisal", "فيصل", "giza", /\bfaisal\b|\bfaysal\b|فيصل/i],
  ["Sheikh Zayed", "الشيخ زايد", "giza", /sheikh zayed|shaykh zayed|el sheikh zayed|zayed city|الشيخ زايد/i],
  ["6th of October", "6 أكتوبر", "giza", /(6|six)(th)? (of )?october|october city|أكتوبر|اكتوبر/i],
  ["Smouha", "سموحة", "alexandria", /smouha|smoha|سموح[ةه]/i],
  ["Sidi Gaber", "سيدي جابر", "alexandria", /sidi gaber|سيدي جابر|سيدى جابر/i],
  ["Stanley", "ستانلي", "alexandria", /stanley|ستانل[يى]/i],
  ["Gleem", "جليم", "alexandria", /gleem|glim\b|جليم/i],
  ["Sporting", "سبورتنج", "alexandria", /sporting|سبورتنج/i],
  ["Roushdy", "رشدي", "alexandria", /roushdy|rushdi|رشد[يى]/i],
  ["Miami", "ميامي", "alexandria", /miami|ميام[يى]/i],
  ["Montaza", "المنتزه", "alexandria", /montaza|muntazah|المنتزه/i],
  ["Agami", "العجمي", "alexandria", /agami|ajami|العجم[يى]/i],
  ["Raml Station", "محطة الرمل", "alexandria", /raml station|mahatet el raml|محطة الرمل|محطه الرمل/i],
];

// Rough sanity checks for the far-away new cities, so a street named after
// one of them elsewhere can't move a place there: [min lng, max lng].
const FAR = {
  "New Cairo (5th Settlement)": [31.38, 31.7],
  "Rehab": [31.46, 31.53],
  "Madinaty": [31.6, 31.75],
  "Shorouk": [31.55, 31.7],
  "Sheikh Zayed": [30.9, 31.06],
  "6th of October": [30.8, 31.1],
};

// "6 October Bridge" and the like are streets, not the city.
const NOT_A_DISTRICT = /(كوبري|كوبرى|bridge|محور|axis)\s*(6|٦)?\s*(th\s*)?(of\s*)?(أكتوبر|اكتوبر|october)/gi;

/** The district a piece of text names (in this city, at this longitude), or null. */
export function districtFrom(text, city, lng) {
  if (!text) return null;
  const t = text.replace(NOT_A_DISTRICT, " ");
  for (const [name, , c, pattern] of DISTRICTS) {
    if (c !== city || !pattern.test(t)) continue;
    const far = FAR[name];
    if (far && lng != null && (lng < far[0] || lng > far[1])) continue;
    return name;
  }
  return null;
}

/** Arabic name of a canonical district (for the app's Arabic mode). */
export const DISTRICT_AR = Object.fromEntries(DISTRICTS.map(([en, ar]) => [en, ar]));

/**
 * Gives places a district `area`:
 * 1. what the place's own data says (its OSM neighbourhood, Overture
 *    district or address),
 * 2. else what most of the labelled places within [radiusKm] say (at least
 *    3 of them, and 60 % agreeing).
 * Places with no district keep the area they had (an OSM neighbourhood).
 */
export function assignDistricts(places, { radiusKm = 0.8, km, Grid }) {
  const own = new Map();
  for (const p of places) {
    const d = districtFrom(p.area, p.city, p.lng) ?? districtFrom(p._locality, p.city, p.lng) ??
      districtFrom(p.address, p.city, p.lng);
    if (d) own.set(p, d);
  }
  const grid = new Grid();
  for (const p of own.keys()) grid.add(p);
  for (const p of places) {
    let d = own.get(p);
    if (!d) {
      const votes = {};
      let total = 0;
      for (const q of grid.near(p.lat, p.lng, 1)) {
        if (q.city !== p.city || km(p.lat, p.lng, q.lat, q.lng) > radiusKm) continue;
        votes[own.get(q)] = (votes[own.get(q)] ?? 0) + 1;
        total++;
      }
      const [best, n] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0] ?? [];
      if (best && total >= 3 && n / total >= 0.6) d = best;
    }
    if (d) p.area = d;
    delete p._locality;
  }
  return places;
}
