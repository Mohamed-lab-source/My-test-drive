/**
 * Khroga Cloud Functions.
 *
 * Anything that must be trustworthy happens here, not in the app:
 * building plans, unique usernames and join codes, joining/leaving/deleting
 * groups, and push notifications.
 */

import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";

import {
  InvalidInput, PlaceDoc, buildPrompt, buildStops, fallbackPlan, parseInput,
  pickCandidates, validateAiPlan, weatherNote,
} from "./planner";
import { askGemini, fetchWeather, resolvePhotoUri } from "./external";

initializeApp();
const db = getFirestore();

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const PLACES_API_KEY = defineSecret("PLACES_API_KEY");
/** Which Gemini model to use. "gemini-flash-latest" always points at the current Flash model. */
const GEMINI_MODEL = defineString("GEMINI_MODEL", { default: "gemini-flash-latest" });

const MAX_PLANS_PER_HOUR = 30;
const MAX_GROUP_MEMBERS = 50;

function requireUid(req: CallableRequest): string {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please sign in first.");
  return uid;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export const generatePlan = onCall(
  { secrets: [GEMINI_API_KEY], timeoutSeconds: 90, memory: "512MiB" },
  async (req) => {
    const uid = requireUid(req);
    let input;
    try {
      input = parseInput(req.data);
    } catch (e) {
      if (e instanceof InvalidInput) throw new HttpsError("invalid-argument", e.message);
      throw e;
    }

    const plansRef = db.collection("users").doc(uid).collection("plans");
    const hourAgo = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
    const recent = await plansRef.where("createdAt", ">", hourAgo).count().get();
    if (recent.data().count >= MAX_PLANS_PER_HOUR) {
      throw new HttpsError("resource-exhausted",
        "You've made a lot of plans this hour. Take a break and try again soon.");
    }

    // Load real places: either inside one mall, or across the city.
    const query = input.mallId
      ? db.collection("places").where("parentMallId", "==", input.mallId)
      : db.collection("places").where("city", "==", input.city);
    const [snap, weather] = await Promise.all([query.get(), fetchWeather(input.city)]);
    const places = snap.docs.map((d) => ({ ...(d.data() as Omit<PlaceDoc, "id">), id: d.id }));

    const candidates = pickCandidates(places, input, weather);
    if (candidates.length === 0) {
      throw new HttpsError("failed-precondition", input.mallId
        ? "We don't have venues listed inside this mall yet."
        : "We couldn't find places matching that. Try another vibe or a bigger budget.");
    }

    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Africa/Cairo" })
      .format(new Date());
    const prompt = buildPrompt(input, candidates, weather, weekday);

    // Ask the AI up to twice. If it still fails, build a plan ourselves so the
    // person always gets something real.
    let plan = null;
    let source: "ai" | "fallback" = "ai";
    for (let attempt = 1; attempt <= 2 && !plan; attempt++) {
      try {
        const ai = await askGemini(prompt, GEMINI_API_KEY.value(), GEMINI_MODEL.value());
        plan = validateAiPlan(ai, candidates, input.stops);
        if (!plan) logger.warn("AI plan failed validation", { attempt, ai });
      } catch (e) {
        logger.error("Gemini call failed", { attempt, error: String(e) });
      }
    }
    if (!plan) {
      source = "fallback";
      plan = validateAiPlan(fallbackPlan(input, candidates), candidates, input.stops)!;
    }

    const doc = plansRef.doc();
    await doc.set({
      title: plan.title,
      summary: plan.summary,
      tips: plan.tips,
      stops: buildStops(plan.stops, candidates),
      request: input,
      weatherNote: weatherNote(input.city, weather),
      source,
      saved: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { planId: doc.id };
  },
);

// ---------------------------------------------------------------------------
// Place photos
// ---------------------------------------------------------------------------

export const placePhotos = onCall({ secrets: [PLACES_API_KEY] }, async (req) => {
  requireUid(req);
  const placeId = str(req.data?.placeId);
  if (!placeId) throw new HttpsError("invalid-argument", "Missing place.");
  const doc = await db.collection("places").doc(placeId).get();
  if (!doc.exists) throw new HttpsError("not-found", "Place not found.");
  const photos = ((doc.data()?.photos ?? []) as { url?: string; name?: string; attribution?: string }[])
    .slice(0, 5);
  const resolved = await Promise.all(photos.map(async (p) => ({
    url: p.url ?? (p.name ? await resolvePhotoUri(p.name, PLACES_API_KEY.value()) : null),
    attribution: p.attribution ?? null,
  })));
  return { photos: resolved.filter((p) => p.url) };
});

// ---------------------------------------------------------------------------
// Usernames
// ---------------------------------------------------------------------------

const USERNAME = /^[a-z0-9_.]{3,20}$/;
const RESERVED = new Set(["admin", "khroga", "support", "help", "official", "moderator"]);

export const claimUsername = onCall(async (req) => {
  const uid = requireUid(req);
  if (req.auth?.token.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("failed-precondition", "Sign in with Google to pick a username.");
  }
  const username = str(req.data?.username).toLowerCase();
  if (!USERNAME.test(username) || RESERVED.has(username)) {
    throw new HttpsError("invalid-argument",
      "Use 3–20 letters, numbers, dots or underscores.");
  }
  await db.runTransaction(async (tx) => {
    const nameRef = db.collection("usernames").doc(username);
    const profileRef = db.collection("publicProfiles").doc(uid);
    const [nameDoc, profile] = await Promise.all([tx.get(nameRef), tx.get(profileRef)]);
    if (nameDoc.exists && nameDoc.data()?.uid !== uid) {
      throw new HttpsError("already-exists", "That username is taken. Try another.");
    }
    const old = profile.data()?.username as string | undefined;
    if (old && old !== username) tx.delete(db.collection("usernames").doc(old));
    tx.set(nameRef, { uid });
    tx.set(profileRef, { username }, { merge: true });
  });
  return { username };
});

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

export const createGroup = onCall(async (req) => {
  const uid = requireUid(req);
  const name = str(req.data?.name).slice(0, 40);
  if (!name) throw new HttpsError("invalid-argument", "Give your group a name.");

  let scheduledAt: Timestamp | null = null;
  if (req.data?.scheduledAt) {
    const ms = Date.parse(String(req.data.scheduledAt));
    if (Number.isNaN(ms)) throw new HttpsError("invalid-argument", "That date doesn't look right.");
    scheduledAt = Timestamp.fromMillis(ms);
  }

  // Copy the plan's stops into the group so every member can see them.
  let planFields: Record<string, unknown> = {};
  const planId = str(req.data?.planId);
  if (planId) {
    const plan = await db.collection("users").doc(uid).collection("plans").doc(planId).get();
    if (!plan.exists) throw new HttpsError("not-found", "That plan no longer exists.");
    planFields = { planId, planTitle: plan.data()?.title ?? "Plan", planStops: plan.data()?.stops ?? [] };
  }

  const groupRef = db.collection("groups").doc();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const codeRef = db.collection("joinCodes").doc(code);
    try {
      await db.runTransaction(async (tx) => {
        if ((await tx.get(codeRef)).exists) throw new Error("code-taken");
        tx.set(codeRef, { groupId: groupRef.id });
        tx.set(groupRef, {
          name,
          ownerUid: uid,
          memberUids: [uid],
          joinCode: code,
          scheduledAt,
          rsvp: { [uid]: "going" },
          freeUids: [],
          createdAt: FieldValue.serverTimestamp(),
          lastMessageAt: FieldValue.serverTimestamp(),
          ...planFields,
        });
      });
      return { groupId: groupRef.id };
    } catch (e) {
      if (!(e instanceof Error && e.message === "code-taken")) throw e;
    }
  }
  throw new HttpsError("internal", "Couldn't create the group. Please try again.");
});

export const joinGroup = onCall(async (req) => {
  const uid = requireUid(req);
  const code = str(req.data?.code).toUpperCase();
  if (!/^[A-Z0-9]{4,10}$/.test(code)) throw new HttpsError("invalid-argument", "That code doesn't look right.");
  const codeDoc = await db.collection("joinCodes").doc(code).get();
  if (!codeDoc.exists) throw new HttpsError("not-found", "No group has that code. Check it and try again.");
  const groupRef = db.collection("groups").doc(codeDoc.data()!.groupId as string);
  await db.runTransaction(async (tx) => {
    const group = await tx.get(groupRef);
    if (!group.exists) throw new HttpsError("not-found", "That group was deleted.");
    const members = (group.data()?.memberUids ?? []) as string[];
    if (members.includes(uid)) return;
    if (members.length >= MAX_GROUP_MEMBERS) throw new HttpsError("resource-exhausted", "This group is full.");
    tx.update(groupRef, { memberUids: FieldValue.arrayUnion(uid) });
  });
  return { groupId: groupRef.id };
});

export const addFriendToGroup = onCall(async (req) => {
  const uid = requireUid(req);
  const groupId = str(req.data?.groupId);
  const friendUid = str(req.data?.friendUid);
  if (!groupId || !friendUid) throw new HttpsError("invalid-argument", "Missing group or friend.");
  const pairId = [uid, friendUid].sort().join("_");
  const friendship = await db.collection("friendships").doc(pairId).get();
  if (friendship.data()?.status !== "accepted") {
    throw new HttpsError("permission-denied", "You can only add people who are your friends.");
  }
  const groupRef = db.collection("groups").doc(groupId);
  await db.runTransaction(async (tx) => {
    const group = await tx.get(groupRef);
    const members = (group.data()?.memberUids ?? []) as string[];
    if (!group.exists || !members.includes(uid)) throw new HttpsError("permission-denied", "You're not in this group.");
    if (members.includes(friendUid)) return;
    if (members.length >= MAX_GROUP_MEMBERS) throw new HttpsError("resource-exhausted", "This group is full.");
    tx.update(groupRef, { memberUids: FieldValue.arrayUnion(friendUid) });
  });
  return { ok: true };
});

export const leaveGroup = onCall(async (req) => {
  const uid = requireUid(req);
  const groupRef = db.collection("groups").doc(str(req.data?.groupId) || "_");
  await db.runTransaction(async (tx) => {
    const group = await tx.get(groupRef);
    if (!group.exists) return;
    if (group.data()?.ownerUid === uid) {
      throw new HttpsError("failed-precondition", "You're the organizer. Delete the group instead.");
    }
    tx.update(groupRef, {
      memberUids: FieldValue.arrayRemove(uid),
      freeUids: FieldValue.arrayRemove(uid),
      [`rsvp.${uid}`]: FieldValue.delete(),
    });
  });
  return { ok: true };
});

export const deleteGroup = onCall(async (req) => {
  const uid = requireUid(req);
  const groupRef = db.collection("groups").doc(str(req.data?.groupId) || "_");
  const group = await groupRef.get();
  if (!group.exists) return { ok: true };
  if (group.data()?.ownerUid !== uid) {
    throw new HttpsError("permission-denied", "Only the organizer can delete the group.");
  }
  const code = group.data()?.joinCode as string | undefined;
  // Deletes the group and everything under it (messages included).
  await db.recursiveDelete(groupRef);
  if (code) await db.collection("joinCodes").doc(code).delete();
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Chat notifications
// ---------------------------------------------------------------------------

export const notifyGroupMessage = onCall(async (req) => {
  const uid = requireUid(req);
  const groupRef = db.collection("groups").doc(str(req.data?.groupId) || "_");
  const msgRef = groupRef.collection("messages").doc(str(req.data?.messageId) || "_");

  // Each message can trigger at most one notification, only by its sender.
  const result = await db.runTransaction(async (tx) => {
    const [group, msg] = await Promise.all([tx.get(groupRef), tx.get(msgRef)]);
    if (!group.exists || !msg.exists) return null;
    const m = msg.data()!;
    if (m.uid !== uid || m.notified) return null;
    tx.update(msgRef, { notified: true });
    tx.update(groupRef, {
      lastMessage: `${m.name}: ${String(m.text).slice(0, 80)}`,
      lastMessageAt: FieldValue.serverTimestamp(),
    });
    return { group: group.data()!, msg: m };
  });
  if (!result) return { sent: 0 };

  const others = ((result.group.memberUids ?? []) as string[]).filter((u) => u !== uid);
  if (others.length === 0) return { sent: 0 };
  const userDocs = await db.getAll(...others.map((u) => db.collection("users").doc(u)));
  const tokenOwners = new Map<string, string>();
  for (const d of userDocs) {
    for (const t of (d.data()?.fcmTokens ?? []) as string[]) tokenOwners.set(t, d.id);
  }
  const tokens = [...tokenOwners.keys()];
  if (tokens.length === 0) return { sent: 0 };

  const response = await getMessaging().sendEachForMulticast({
    tokens: tokens.slice(0, 500),
    notification: {
      title: String(result.group.name ?? "Khroga"),
      body: `${result.msg.name}: ${String(result.msg.text).slice(0, 120)}`,
    },
    data: { groupId: groupRef.id },
  });

  // Forget tokens for uninstalled apps so we stop sending to them.
  const cleanups: Promise<unknown>[] = [];
  response.responses.forEach((r, i) => {
    const code = r.error?.code ?? "";
    if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
      const owner = tokenOwners.get(tokens[i])!;
      cleanups.push(db.collection("users").doc(owner).update({ fcmTokens: FieldValue.arrayRemove(tokens[i]) }));
    }
  });
  await Promise.allSettled(cleanups);
  return { sent: response.successCount };
});
