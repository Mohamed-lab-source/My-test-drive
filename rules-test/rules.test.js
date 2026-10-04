// Checks firestore.rules against the Firestore emulator.
// Run from this folder:  npm install && npm test   (needs Java installed)
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs,
  serverTimestamp, deleteField,
} from "firebase/firestore";

let env;
const ALICE = "alice";
const BOB = "bob";
const EVE = "eve";

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-khroga",
    firestore: { rules: readFileSync("../firestore.rules", "utf8") },
  });
});
after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "places/p1"), { name: "Place", city: "cairo", category: "cafe" });
    await setDoc(doc(db, "users/alice/plans/plan1"), { title: "T", saved: false, stops: [] });
    await setDoc(doc(db, "publicProfiles/alice"), { displayName: "Alice", username: "alice" });
    await setDoc(doc(db, "groups/g1"), {
      name: "Squad", ownerUid: ALICE, memberUids: [ALICE, BOB], joinCode: "ABC123",
      rsvp: { alice: "going" }, freeUids: [], scheduledAt: null,
    });
    await setDoc(doc(db, "groups/g1/messages/m1"), { uid: ALICE, name: "Alice", text: "hi" });
    await setDoc(doc(db, "joinCodes/ABC123"), { groupId: "g1" });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

test("places: signed-in can read, nobody can write", async () => {
  await assertSucceeds(getDoc(doc(as(ALICE), "places/p1")));
  await assertFails(getDoc(doc(anon(), "places/p1")));
  await assertFails(setDoc(doc(as(ALICE), "places/p2"), { name: "Fake place" }));
});

test("plans: owner can save/delete but not edit content or create", async () => {
  await assertSucceeds(updateDoc(doc(as(ALICE), "users/alice/plans/plan1"), { saved: true }));
  await assertFails(updateDoc(doc(as(ALICE), "users/alice/plans/plan1"), { title: "hacked" }));
  await assertFails(setDoc(doc(as(ALICE), "users/alice/plans/plan2"), { stops: [{ name: "Invented" }] }));
  await assertFails(getDoc(doc(as(BOB), "users/alice/plans/plan1")));
  await assertSucceeds(deleteDoc(doc(as(ALICE), "users/alice/plans/plan1")));
});

test("users: only own push tokens", async () => {
  await assertSucceeds(setDoc(doc(as(BOB), "users/bob"), { fcmTokens: ["t"] }, { merge: true }));
  await assertFails(setDoc(doc(as(BOB), "users/alice"), { fcmTokens: ["t"] }, { merge: true }));
  await assertFails(setDoc(doc(as(BOB), "users/bob"), { isAdmin: true }, { merge: true }));
});

test("profiles: can't set own username directly", async () => {
  await assertSucceeds(setDoc(doc(as(BOB), "publicProfiles/bob"), { displayName: "Bob", photoUrl: null, createdAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as(BOB), "publicProfiles/bob"), { username: "alice" }));
  await assertSucceeds(updateDoc(doc(as(ALICE), "publicProfiles/alice"), { displayName: "Ali" }));
  await assertFails(updateDoc(doc(as(BOB), "publicProfiles/alice"), { displayName: "Hacked" }));
});

test("join codes are server-only", async () => {
  await assertFails(getDoc(doc(as(EVE), "joinCodes/ABC123")));
});

test("groups: members read, outsiders don't, and queries work", async () => {
  await assertSucceeds(getDoc(doc(as(BOB), "groups/g1")));
  await assertFails(getDoc(doc(as(EVE), "groups/g1")));
  await assertSucceeds(getDocs(query(collection(as(BOB), "groups"), where("memberUids", "array-contains", BOB))));
  await assertSucceeds(getDoc(doc(as(BOB), "groups/deleted")), "missing group reads as empty");
});

test("groups: members only change their own RSVP", async () => {
  await assertSucceeds(updateDoc(doc(as(BOB), "groups/g1"), { "rsvp.bob": "maybe" }));
  await assertFails(updateDoc(doc(as(BOB), "groups/g1"), { "rsvp.alice": "no" }));
  await assertFails(updateDoc(doc(as(BOB), "groups/g1"), { "rsvp.bob": "sure" }));
  await assertFails(updateDoc(doc(as(BOB), "groups/g1"), { memberUids: [ALICE, BOB, EVE] }));
  await assertFails(updateDoc(doc(as(EVE), "groups/g1"), { "rsvp.eve": "going" }));
  await assertFails(updateDoc(doc(as(BOB), "groups/g1"), { freeUids: [BOB] }));
});

test("groups: organizer manages date and who pays; nobody deletes directly", async () => {
  await assertSucceeds(updateDoc(doc(as(ALICE), "groups/g1"), { freeUids: [BOB] }));
  await assertSucceeds(updateDoc(doc(as(ALICE), "groups/g1"), { scheduledAt: new Date() }));
  await assertFails(updateDoc(doc(as(ALICE), "groups/g1"), { ownerUid: BOB }));
  await assertFails(deleteDoc(doc(as(ALICE), "groups/g1")));
  await assertFails(setDoc(doc(as(ALICE), "groups/g2"), { ownerUid: ALICE, memberUids: [ALICE] }));
});

test("messages: members post as themselves; no edits", async () => {
  const msgs = (db) => collection(db, "groups/g1/messages");
  await assertSucceeds(addDoc(msgs(as(BOB)), { uid: BOB, name: "Bob", text: "hey", createdAt: serverTimestamp() }));
  await assertFails(addDoc(msgs(as(BOB)), { uid: ALICE, name: "Alice", text: "fake", createdAt: serverTimestamp() }));
  await assertFails(addDoc(msgs(as(EVE)), { uid: EVE, name: "Eve", text: "spam", createdAt: serverTimestamp() }));
  await assertFails(addDoc(msgs(as(BOB)), { uid: BOB, name: "Bob", text: "", createdAt: serverTimestamp() }));
  await assertFails(addDoc(msgs(as(BOB)), { uid: BOB, name: "Bob", text: "x", createdAt: serverTimestamp(), notified: true }));
  await assertFails(updateDoc(doc(as(ALICE), "groups/g1/messages/m1"), { text: "edited" }));
  await assertFails(deleteDoc(doc(as(ALICE), "groups/g1/messages/m1")));
  await assertSucceeds(getDoc(doc(as(BOB), "groups/g1/messages/m1")));
  await assertFails(getDoc(doc(as(EVE), "groups/g1/messages/m1")));
});

test("friendships: request, accept by receiver only, delete by either", async () => {
  const id = "alice_bob";
  const ref = (db) => doc(db, `friendships/${id}`);
  await assertSucceeds(getDoc(ref(as(ALICE))), "checking a missing friendship is allowed");
  await assertFails(setDoc(ref(as(ALICE)), { uids: [ALICE, BOB], requestedBy: ALICE, status: "accepted" }));
  await assertFails(setDoc(ref(as(EVE)), { uids: [ALICE, BOB], requestedBy: EVE, status: "pending" }));
  await assertFails(setDoc(doc(as(ALICE), "friendships/wrong_id"), { uids: [ALICE, BOB], requestedBy: ALICE, status: "pending" }));
  await assertSucceeds(setDoc(ref(as(ALICE)), { uids: [ALICE, BOB], requestedBy: ALICE, status: "pending", createdAt: serverTimestamp() }));
  await assertFails(updateDoc(ref(as(ALICE)), { status: "accepted" }), "sender can't accept own request");
  await assertFails(getDoc(ref(as(EVE))));
  await assertSucceeds(updateDoc(ref(as(BOB)), { status: "accepted" }));
  await assertSucceeds(getDocs(query(collection(as(BOB), "friendships"), where("uids", "array-contains", BOB))));
  await assertSucceeds(deleteDoc(ref(as(ALICE))));
});

test("leaving rsvp field removal isn't possible from the app", async () => {
  await assertFails(updateDoc(doc(as(BOB), "groups/g1"), { "rsvp.alice": deleteField() }));
});
