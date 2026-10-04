/**
 * Uploads functions/data/places.json to Firestore.
 *
 *   npm run seed            -> check the file and upload
 *   npm run seed -- --dry   -> only check the file, upload nothing
 *
 * Needs Google credentials on this computer (see SETUP.md).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { normalizePlace } from "./normalize";

const file = join(__dirname, "..", "..", "data", "places.json");
const dry = process.argv.includes("--dry");

async function main() {
  const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
  const list = Array.isArray(raw) ? raw : Object.entries(raw as object).map(([id, v]) => ({ id, ...v }));

  const good: (Record<string, unknown> & { id: string })[] = [];
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const item of list) {
    const { place, problem } = normalizePlace(item as Record<string, unknown>);
    if (!place) { problems.push(problem!); continue; }
    if (ids.has(place.id)) { problems.push(`duplicate id ${place.id}`); continue; }
    ids.add(place.id);
    good.push(place);
  }

  const byCity: Record<string, number> = {};
  for (const p of good) byCity[p.city as string] = (byCity[p.city as string] ?? 0) + 1;
  const missingCoords = good.filter((p) => p.lat === null).length;

  console.log(`\nRead ${list.length} places from data/places.json`);
  console.log(`  ✔ ready to upload: ${good.length}`, byCity);
  console.log(`  • without coordinates (fine, ride buttons hide for these): ${missingCoords}`);
  if (problems.length) {
    console.log(`  ✖ skipped ${problems.length}:`);
    for (const p of problems.slice(0, 50)) console.log(`     - ${p}`);
  }
  if (dry) { console.log("\nDry run: nothing uploaded."); return; }

  initializeApp(); // project comes from your Google credentials
  const db = getFirestore();
  for (let i = 0; i < good.length; i += 400) {
    const batch = db.batch();
    for (const { id, ...data } of good.slice(i, i + 400)) {
      batch.set(db.collection("places").doc(id), { ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  }
  console.log(`\n✔ Uploaded ${good.length} places to Firestore.`);
}

main().catch((e) => {
  console.error("\n✖ Seeding failed:", e.message ?? e);
  if (String(e).includes("Could not load the default credentials")) {
    console.error("  Run: gcloud auth application-default login   (see SETUP.md)");
  }
  process.exit(1);
});
