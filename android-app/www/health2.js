/* ======================================================================
 * Jarvis 4.0 — pack 2: Health & Fitness (offline)
 * General wellbeing maths — estimates, never medical advice.
 * Loads after calc2.js (reuses c2r / c2n). ====================================================================== */

const h2male = s => !/f|woman|female/i.test(String(s || "m"));
const h2time = s => { const m = String(s || "").trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i); if (!m) return null; let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12; if (!m[3] && +m[1] === 24) h = 0; return (h % 24) * 60 + (+m[2] || 0); };
const h2fmt = mins => { mins = ((mins % 1440) + 1440) % 1440; return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`; };

function bodyFat({ sex, height_cm, neck_cm, waist_cm, hip_cm } = {}) {
  const h = c2n(height_cm, "height"), neck = c2n(neck_cm, "neck"), waist = c2n(waist_cm, "waist");
  let bf;
  if (h2male(sex)) bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
  else { const hip = c2n(hip_cm, "hip"); bf = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(h)) - 450; }
  const cat = bf < (h2male(sex) ? 6 : 14) ? "essential" : bf < (h2male(sex) ? 14 : 21) ? "athletic" : bf < (h2male(sex) ? 18 : 25) ? "fit" : bf < (h2male(sex) ? 25 : 32) ? "average" : "high";
  return { bodyFatPercent: c2r(bf, 1), category: cat, note: "US Navy method, an estimate." };
}
function idealWeight({ height_cm, sex } = {}) {
  const h = c2n(height_cm, "height"); const inchesOver5ft = Math.max(0, (h - 152.4) / 2.54);
  const devine = (h2male(sex) ? 50 : 45.5) + 2.3 * inchesOver5ft;
  const robinson = (h2male(sex) ? 52 : 49) + 1.9 * inchesOver5ft;
  return { idealWeightKg: c2r((devine + robinson) / 2, 1), range: `${c2r(devine, 1)}–${c2r(robinson, 1)} kg`, note: "An estimate; frame and muscle vary it." };
}
function oneRepMax({ weight, reps } = {}) {
  const w = c2n(weight, "the weight"), r = Math.round(c2n(reps, "the reps")); if (r < 1) throw new Error("Reps must be at least 1.");
  const orm = w * (1 + r / 30);
  return { oneRepMax: c2r(orm, 1), at80pct: c2r(orm * 0.8, 1), at90pct: c2r(orm * 0.9, 1), note: "Epley estimate." };
}
function maxHeartRate({ age } = {}) { const a = c2n(age, "age"); return { maxHeartRate: Math.round(208 - 0.7 * a), note: "Tanaka formula." }; }
function targetHeartRate({ age, resting, intensity } = {}) {
  const a = c2n(age, "age"); const max = 208 - 0.7 * a; const rest = Number(resting || 0);
  const pct = clampNum(intensity, 40, 100, 70) / 100;
  const hr = rest ? Math.round((max - rest) * pct + rest) : Math.round(max * pct);
  return { targetHeartRate: hr, maxHeartRate: Math.round(max), intensity: `${Math.round(pct * 100)}%` };
}
function heartRateZones({ age, resting } = {}) {
  const a = c2n(age, "age"); const max = 208 - 0.7 * a; const rest = Number(resting || 0);
  const z = p => rest ? Math.round((max - rest) * p + rest) : Math.round(max * p);
  return { maxHeartRate: Math.round(max), zones: { warmup: `${z(0.5)}–${z(0.6)}`, fatBurn: `${z(0.6)}–${z(0.7)}`, aerobic: `${z(0.7)}–${z(0.8)}`, anaerobic: `${z(0.8)}–${z(0.9)}`, max: `${z(0.9)}–${Math.round(max)}` } };
}
function bmrCalc({ weight_kg, height_cm, age, sex } = {}) {
  let w = Number(weight_kg); if (!w && typeof T === "object" && T.weight && T.weight.length) w = T.weight[T.weight.length - 1].kg;
  if (!w) throw new Error("I need your weight.");
  const h = c2n(height_cm, "height"), a = c2n(age, "age");
  return { bmr: Math.round(10 * w + 6.25 * h - 5 * a + (h2male(sex) ? 5 : -161)), note: "Calories at complete rest (Mifflin–St Jeor)." };
}
function macros({ calories, split } = {}) {
  const cal = c2n(calories, "the calories");
  const splits = { balanced: [0.4, 0.3, 0.3], lowcarb: [0.25, 0.35, 0.4], highprotein: [0.35, 0.4, 0.25], keto: [0.05, 0.3, 0.65] };
  const [c, p, f] = splits[String(split || "balanced").toLowerCase()] || splits.balanced;
  return { calories: cal, carbs_g: Math.round(cal * c / 4), protein_g: Math.round(cal * p / 4), fat_g: Math.round(cal * f / 9), split: split || "balanced" };
}
function proteinTarget({ weight_kg, activity } = {}) {
  const w = c2n(weight_kg, "weight"); const per = { sedentary: 0.8, light: 1.2, active: 1.6, athlete: 2.0 }[String(activity || "light").toLowerCase()] || 1.2;
  return { proteinGramsPerDay: Math.round(w * per), basis: `${per} g/kg` };
}
function waistToHeight({ waist_cm, height_cm } = {}) {
  const r = c2n(waist_cm, "waist") / c2n(height_cm, "height");
  return { ratio: c2r(r, 2), assessment: r < 0.4 ? "low" : r < 0.5 ? "healthy" : r < 0.6 ? "raised risk" : "high risk" };
}
function waistToHip({ waist_cm, hip_cm } = {}) {
  const r = c2n(waist_cm, "waist") / c2n(hip_cm, "hip");
  return { ratio: c2r(r, 2), note: "Lower is generally better." };
}
const H2_MET = { walking: 3.5, walk: 3.5, running: 9.8, run: 9.8, jogging: 7, cycling: 7.5, bike: 7.5, swimming: 7, swim: 7, gym: 6, weights: 6, yoga: 3, football: 7, soccer: 7, basketball: 8, "jump rope": 11, skipping: 11, hiking: 6, dancing: 5, rowing: 7, elliptical: 5, pilates: 3, boxing: 9, tennis: 7 };
function caloriesBurned({ activity, weight_kg, minutes } = {}) {
  const w = c2n(weight_kg, "weight"), min = c2n(minutes, "minutes");
  const met = H2_MET[String(activity || "").toLowerCase().trim()] || 5;
  return { activity: activity || "general", minutes: min, caloriesBurned: Math.round(met * 3.5 * w / 200 * min), met };
}
function stepsToDistance({ steps, height_cm } = {}) {
  const s = c2n(steps, "steps"); const stride = (Number(height_cm) || 170) * 0.415 / 100; // m
  const km = s * stride / 1000;
  return { steps: s, distanceKm: c2r(km, 2), distanceMiles: c2r(km * 0.621371, 2) };
}
function stepsCalories({ steps, weight_kg } = {}) {
  const s = c2n(steps, "steps"), w = Number(weight_kg) || 70;
  return { steps: s, caloriesBurned: Math.round(s * w * 0.00057) };
}
function pregnancyDue({ last_period } = {}) {
  const d = new Date(`${String(last_period || "").trim()}T12:00:00`); if (isNaN(d)) throw new Error("Give me the first day of the last period, like 2026-01-10.");
  const due = new Date(d.getTime() + 280 * 86400000);
  const weeks = Math.floor((Date.now() - d) / (7 * 86400000));
  return { dueDate: localDayKey(due), weeksPregnant: Math.max(0, weeks), trimester: weeks < 13 ? 1 : weeks < 27 ? 2 : 3, note: "Naegele's rule, an estimate." };
}
function ovulation({ last_period, cycle_length } = {}) {
  const d = new Date(`${String(last_period || "").trim()}T12:00:00`); if (isNaN(d)) throw new Error("Give me the first day of the last period.");
  const cyc = Math.round(clampNum(cycle_length, 20, 45, 28));
  const ov = new Date(d.getTime() + (cyc - 14) * 86400000);
  return { ovulationDay: localDayKey(ov), fertileWindow: `${localDayKey(new Date(ov.getTime() - 4 * 86400000))} to ${localDayKey(new Date(ov.getTime() + 86400000))}`, note: "An estimate; cycles vary." };
}
function bacEstimate({ drinks, weight_kg, sex, hours } = {}) {
  const d = c2n(drinks, "number of standard drinks"), w = c2n(weight_kg, "weight") * 1000; const hrs = Number(hours || 0);
  const grams = d * 14; const factor = h2male(sex) ? 0.68 : 0.55;
  let bac = (grams / (w * factor)) * 100 - 0.015 * hrs;
  bac = Math.max(0, bac);
  return { estimatedBAC: c2r(bac, 3) + "%", advice: bac >= 0.05 ? "Over the Egyptian/most legal driving limit — do not drive." : "Still, never drink and drive.", note: "A rough estimate only. Never rely on this to decide to drive." };
}
function smokingSavings({ cigs_per_day, price_per_pack, cigs_per_pack } = {}) {
  const c = c2n(cigs_per_day, "cigarettes per day"), price = c2n(price_per_pack, "price per pack"), per = clampNum(cigs_per_pack, 1, 100, 20);
  const daily = c / per * price;
  return { perDay: c2r(daily), perMonth: c2r(daily * 30), perYear: c2r(daily * 365), inFiveYears: c2r(daily * 365 * 5), currency: "EGP" };
}
function idealSleep({ age } = {}) {
  const a = c2n(age, "age"); const h = a < 1 ? "14–17" : a < 3 ? "11–14" : a < 6 ? "10–13" : a < 13 ? "9–11" : a < 18 ? "8–10" : a < 65 ? "7–9" : "7–8";
  return { age: a, recommendedSleep: h + " hours" };
}
function sleepCalculator({ wake_time, bedtime } = {}) {
  if (wake_time) { const wm = h2time(wake_time); if (wm == null) throw new Error("Give a wake time like 6:30am."); const beds = [6, 5, 4].map(c => h2fmt(wm - (c * 90 + 14))); return { toWakeAt: h2fmt(wm), fallAsleepBy: beds, note: "Sleep in full 90-minute cycles (plus ~14 min to drift off)." }; }
  if (bedtime) { const bm = h2time(bedtime); if (bm == null) throw new Error("Give a bedtime like 11pm."); const wakes = [4, 5, 6].map(c => h2fmt(bm + 14 + c * 90)); return { ifYouSleepAt: h2fmt(bm), wakeAt: wakes, note: "Best to wake at the end of a 90-minute cycle." }; }
  throw new Error("Give me a wake time or a bedtime.");
}
function racePredict({ known_distance, known_time_min, target_distance } = {}) {
  const d1 = c2n(known_distance, "the known distance"), t1 = c2n(known_time_min, "the known time in minutes"), d2 = c2n(target_distance, "the target distance");
  const t2 = t1 * Math.pow(d2 / d1, 1.06);
  return { targetDistance: d2, predictedTime: `${Math.floor(t2)}:${pad2(Math.round((t2 % 1) * 60))} (min:sec→ ${c2r(t2, 1)} min)`, note: "Riegel formula." };
}
function caloriesToGoal({ current_kg, goal_kg, weeks } = {}) {
  const cur = c2n(current_kg, "current weight"), goal = c2n(goal_kg, "goal weight"), wk = c2n(weeks, "weeks"); if (wk <= 0) throw new Error("Weeks must be above zero.");
  const kg = cur - goal; const dailyDeficit = kg * 7700 / (wk * 7);
  return { toChangeKg: c2r(kg, 1), weeks: wk, dailyCalorieChange: Math.round(dailyDeficit), direction: kg > 0 ? "deficit to lose" : "surplus to gain", note: Math.abs(dailyDeficit) > 1000 ? "That pace is aggressive — consider more time." : "A sustainable pace." };
}
function bodySurfaceArea({ height_cm, weight_kg } = {}) {
  const h = c2n(height_cm, "height"), w = c2n(weight_kg, "weight");
  return { bsa_m2: c2r(Math.sqrt(h * w / 3600), 2), note: "Mosteller formula." };
}
function leanBodyMass({ weight_kg, body_fat_percent } = {}) {
  const w = c2n(weight_kg, "weight"), bf = c2n(body_fat_percent, "body fat %") / 100;
  return { leanMassKg: c2r(w * (1 - bf), 1), fatMassKg: c2r(w * bf, 1) };
}
function bmiPrime({ weight_kg, height_cm } = {}) {
  const w = c2n(weight_kg, "weight"), m = c2n(height_cm, "height") / 100; const bmi = w / (m * m);
  return { bmi: c2r(bmi, 1), bmiPrime: c2r(bmi / 25, 2), note: "BMI Prime of 1.0 is the top of the healthy range." };
}
function vo2maxEstimate({ resting_hr, max_hr, age } = {}) {
  const rest = c2n(resting_hr, "resting heart rate"); const max = Number(max_hr) || (208 - 0.7 * c2n(age, "age"));
  return { vo2max: c2r(15.3 * max / rest, 1), note: "Rough estimate from heart-rate ratio." };
}
function packYears({ cigs_per_day, years } = {}) {
  const c = c2n(cigs_per_day, "cigarettes per day"), y = c2n(years, "years smoked");
  return { packYears: c2r(c / 20 * y, 1), note: "Pack-years = (cigs per day ÷ 20) × years." };
}

FEATURE_TOOLS.push(
  xfn("body_fat", "Estimate body-fat percentage (US Navy method).", { sex: { type: "string", enum: ["male", "female"] }, height_cm: xn, neck_cm: xn, waist_cm: xn, hip_cm: xn }, ["height_cm", "neck_cm", "waist_cm"]),
  xfn("ideal_weight", "Estimate an ideal weight range for a height.", { height_cm: xn, sex: { type: "string", enum: ["male", "female"] } }, ["height_cm"]),
  xfn("one_rep_max", "Estimate a one-rep-max lift from a weight and reps.", { weight: xn, reps: xi }, ["weight", "reps"]),
  xfn("max_heart_rate", "Estimated maximum heart rate for an age.", { age: xi }, ["age"]),
  xfn("target_heart_rate", "Target training heart rate for an age and intensity.", { age: xi, resting: xi, intensity: xn }, ["age"]),
  xfn("heart_rate_zones", "The five training heart-rate zones for an age.", { age: xi, resting: xi }, ["age"]),
  xfn("bmr", "Basal metabolic rate — calories at rest.", { weight_kg: xn, height_cm: xn, age: xi, sex: { type: "string", enum: ["male", "female"] } }, ["height_cm", "age"]),
  xfn("macros", "Split daily calories into carbs/protein/fat grams.", { calories: xn, split: { type: "string", enum: ["balanced", "lowcarb", "highprotein", "keto"] } }, ["calories"]),
  xfn("protein_target", "Daily protein target for a bodyweight and activity.", { weight_kg: xn, activity: { type: "string", enum: ["sedentary", "light", "active", "athlete"] } }, ["weight_kg"]),
  xfn("waist_to_height", "Waist-to-height ratio and risk band.", { waist_cm: xn, height_cm: xn }, ["waist_cm", "height_cm"]),
  xfn("waist_to_hip", "Waist-to-hip ratio.", { waist_cm: xn, hip_cm: xn }, ["waist_cm", "hip_cm"]),
  xfn("calories_burned", "Calories burned by an activity for a weight and duration.", { activity: xs, weight_kg: xn, minutes: xn }, ["activity", "weight_kg", "minutes"]),
  xfn("steps_to_distance", "Convert a step count to distance.", { steps: xn, height_cm: xn }, ["steps"]),
  xfn("steps_calories", "Rough calories burned from a step count.", { steps: xn, weight_kg: xn }, ["steps"]),
  xfn("pregnancy_due", "Estimate a due date from the last period.", { last_period: xs }, ["last_period"]),
  xfn("ovulation", "Estimate the ovulation day and fertile window.", { last_period: xs, cycle_length: xi }, ["last_period"]),
  xfn("bac_estimate", "Rough blood-alcohol estimate (never a basis to drive).", { drinks: xn, weight_kg: xn, sex: { type: "string", enum: ["male", "female"] }, hours: xn }, ["drinks", "weight_kg"]),
  xfn("smoking_savings", "Money saved by quitting smoking.", { cigs_per_day: xn, price_per_pack: xn, cigs_per_pack: xi }, ["cigs_per_day", "price_per_pack"]),
  xfn("ideal_sleep", "Recommended sleep hours for an age.", { age: xi }, ["age"]),
  xfn("sleep_calculator", "Best bedtimes or wake times using 90-minute sleep cycles.", { wake_time: xs, bedtime: xs }),
  xfn("race_predict", "Predict a race time at a new distance from a known one.", { known_distance: xn, known_time_min: xn, target_distance: xn }, ["known_distance", "known_time_min", "target_distance"]),
  xfn("calories_to_goal", "Daily calorie change to reach a weight goal in a number of weeks.", { current_kg: xn, goal_kg: xn, weeks: xn }, ["current_kg", "goal_kg", "weeks"]),
  xfn("body_surface_area", "Body surface area (Mosteller).", { height_cm: xn, weight_kg: xn }, ["height_cm", "weight_kg"]),
  xfn("lean_body_mass", "Lean and fat mass from weight and body-fat %.", { weight_kg: xn, body_fat_percent: xn }, ["weight_kg", "body_fat_percent"]),
  xfn("bmi_prime", "BMI and BMI Prime.", { weight_kg: xn, height_cm: xn }, ["weight_kg", "height_cm"]),
  xfn("vo2max_estimate", "Rough VO2 max from heart-rate ratio.", { resting_hr: xi, max_hr: xi, age: xi }, ["resting_hr"]),
  xfn("pack_years", "Smoking pack-years.", { cigs_per_day: xn, years: xn }, ["cigs_per_day", "years"]),
);
Object.assign(FEATURE_HANDLERS, {
  body_fat: a => bodyFat(a), ideal_weight: a => idealWeight(a), one_rep_max: a => oneRepMax(a), max_heart_rate: a => maxHeartRate(a),
  target_heart_rate: a => targetHeartRate(a), heart_rate_zones: a => heartRateZones(a), bmr: a => bmrCalc(a), macros: a => macros(a),
  protein_target: a => proteinTarget(a), waist_to_height: a => waistToHeight(a), waist_to_hip: a => waistToHip(a), calories_burned: a => caloriesBurned(a),
  steps_to_distance: a => stepsToDistance(a), steps_calories: a => stepsCalories(a), pregnancy_due: a => pregnancyDue(a), ovulation: a => ovulation(a),
  bac_estimate: a => bacEstimate(a), smoking_savings: a => smokingSavings(a), ideal_sleep: a => idealSleep(a), sleep_calculator: a => sleepCalculator(a),
  race_predict: a => racePredict(a), calories_to_goal: a => caloriesToGoal(a), body_surface_area: a => bodySurfaceArea(a), lean_body_mass: a => leanBodyMass(a),
  bmi_prime: a => bmiPrime(a), vo2max_estimate: a => vo2maxEstimate(a), pack_years: a => packYears(a),
});
TOOL_GROUPS.health2 = {
  about: "fitness & wellbeing maths: body fat, ideal weight, 1RM, heart-rate zones, BMR, macros, calories burned, steps, sleep cycles, pregnancy/ovulation, BAC, quit-smoking savings",
  tools: ["body_fat", "ideal_weight", "one_rep_max", "max_heart_rate", "target_heart_rate", "heart_rate_zones", "bmr", "macros", "protein_target", "waist_to_height", "waist_to_hip", "calories_burned", "steps_to_distance", "steps_calories", "pregnancy_due", "ovulation", "bac_estimate", "smoking_savings", "ideal_sleep", "sleep_calculator", "race_predict", "calories_to_goal", "body_surface_area", "lean_body_mass", "bmi_prime", "vo2max_estimate", "pack_years"],
  match: /\b(body ?fat|ideal weight|one ?rep ?max|1rm|max heart rate|target heart rate|heart rate zone|bmr|metabolic rate|macros?|protein|waist|calories? burned|how many calories|steps? to|how far.*steps|steps? calories|due date|pregnan|ovulation|fertile|blood alcohol|bac|quit smoking|smoking|cigarettes|how much sleep|sleep cycle|bedtime|wake up at|race time|predict.*run|lose .* kg|gain .* kg|body surface|lean (body )?mass|bmi prime|vo2)\b/i,
};

async function initHealth2() { /* stateless */ }
