// Checks firestore.rules against the Firestore emulator.
// Run from this folder:  npm install && npm test   (needs Java + firebase-tools)
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs,
  serverTimestamp, deleteField, arrayUnion, arrayRemove, writeBatch, runTransaction,
} from "firebase/firestore";

let env;
const ALICE = "alice"; // organizer of g1
const BOB = "bob";     // member of g1
const EVE = "eve";     // outsider
const CAROL = "carol"; // alice's friend, not in g1

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
    await setDoc(doc(db, "users/alice/plans/plan1"), { title: "T", saved: false, stops: [], summary: "", tips: [], source: "local" });
    await setDoc(doc(db, "publicProfiles/alice"), { displayName: "Alice", username: "alice" });
    await setDoc(doc(db, "publicProfiles/bob"), { displayName: "Bob" });
    await setDoc(doc(db, "usernames/alice"), { uid: ALICE });
    await setDoc(doc(db, "groups/g1"), {
      name: "Squad", ownerUid: ALICE, memberUids: [ALICE, BOB], joinCode: "ABC123",
      rsvp: { alice: "going" }, freeUids: [], scheduledAt: null,
    });
    await setDoc(doc(db, "groups/g1/messages/m1"), { uid: ALICE, name: "Alice", text: "hi" });
    await setDoc(doc(db, "joinCodes/ABC123"), { groupId: "g1" });
    await setDoc(doc(db, "friendships/alice_carol"), { uids: [ALICE, CAROL], requestedBy: ALICE, status: "accepted" });
    await setDoc(doc(db, "friendships/carol_eve"), { uids: [CAROL, EVE], requestedBy: EVE, status: "pending" });
  });
});

const as = (uid, opts) => env.authenticatedContext(uid, opts).firestore();
const guest = (uid) => as(uid, { firebase: { sign_in_provider: "anonymous" } });
const anon = () => env.unauthenticatedContext().firestore();

test("plans: owner creates and saves; can't fake or edit content", async () => {
  const plans = (db) => collection(db, "users/alice/plans");
  const plan = { title: "Day out", summary: "", stops: [], request: {}, tips: [], weatherNote: null,
    source: "ai", saved: false, createdAt: serverTimestamp() };
  await assertSucceeds(addDoc(plans(as(ALICE)), plan));
  await assertFails(addDoc(plans(as(BOB)), plan), "can't write into someone else's plans");
  await assertFails(addDoc(plans(as(ALICE)), { ...plan, stops: [1, 2, 3, 4, 5, 6] }));
  await assertFails(addDoc(plans(as(ALICE)), { ...plan, isAdmin: true }));
  await assertSucceeds(updateDoc(doc(as(ALICE), "users/alice/plans/plan1"), { saved: true }));
  await assertFails(updateDoc(doc(as(ALICE), "users/alice/plans/plan1"), { request: { city: "giza" } }));
  await assertFails(updateDoc(doc(as(ALICE), "users/alice/plans/plan1"), { weatherNote: "sunny" }));
  await assertFails(getDoc(doc(as(BOB), "users/alice/plans/plan1")));
  await assertFails(getDoc(doc(anon(), "users/alice/plans/plan1")));
});

test("usernames: unique, owned, and not for guests", async () => {
  await assertFails(setDoc(doc(as(BOB), "usernames/alice"), { uid: BOB }), "taken");
  await assertFails(setDoc(doc(guest(EVE), "usernames/eve"), { uid: EVE }), "guests can't");
  await assertFails(setDoc(doc(as(BOB), "usernames/Bad Name"), { uid: BOB }));
  await assertFails(setDoc(doc(as(BOB), "usernames/bobby"), { uid: ALICE }), "only for yourself");
  await assertFails(updateDoc(doc(as(BOB), "publicProfiles/bob"), { username: "alice" }),
    "can't put a name you don't own on your profile");
  // The real flow: claim + set on profile together.
  const bob = as(BOB);
  await assertSucceeds(runTransaction(bob, async (tx) => {
    tx.set(doc(bob, "usernames/bobby"), { uid: BOB });
    tx.update(doc(bob, "publicProfiles/bob"), { username: "bobby" });
  }));
  await assertFails(deleteDoc(doc(as(BOB), "usernames/alice")));
  await assertFails(getDocs(collection(as(BOB), "usernames")), "no listing");
});

test("profiles: own name only", async () => {
  await assertSucceeds(setDoc(doc(as(EVE), "publicProfiles/eve"), { displayName: "Eve", photoUrl: null, createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as(EVE), "publicProfiles/eve2"), { displayName: "Eve" }));
  await assertSucceeds(updateDoc(doc(as(ALICE), "publicProfiles/alice"), { displayName: "Ali" }));
  await assertFails(updateDoc(doc(as(BOB), "publicProfiles/alice"), { displayName: "Hacked" }));
});

test("creating a group with an invite code", async () => {
  const db = as(EVE);
  const batch = writeBatch(db);
  batch.set(doc(db, "joinCodes/NEW234"), { groupId: "g2" });
  batch.set(doc(db, "groups/g2"), {
    name: "Mine", ownerUid: EVE, memberUids: [EVE], joinCode: "NEW234", scheduledAt: null,
    rsvp: { eve: "going" }, freeUids: [], planId: null, planTitle: null, planStops: [],
    createdAt: serverTimestamp(), lastMessageAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());

  // Can't steal another group's code, or create a group owned by someone else.
  await assertFails(setDoc(doc(as(EVE), "joinCodes/ZZZ999"), { groupId: "g1" }));
  const eve = as(EVE);
  const bad = writeBatch(eve);
  bad.set(doc(eve, "joinCodes/BAD234"), { groupId: "g3" });
  bad.set(doc(eve, "groups/g3"), { name: "X", ownerUid: ALICE, memberUids: [ALICE], joinCode: "BAD234",
    rsvp: { alice: "going" }, freeUids: [], planStops: [] });
  await assertFails(bad.commit());
});

test("joining: look up one code, add only yourself", async () => {
  await assertSucceeds(getDoc(doc(as(EVE), "joinCodes/ABC123")));
  await assertFails(getDocs(collection(as(EVE), "joinCodes")), "can't list all codes");
  await assertFails(getDoc(doc(as(EVE), "groups/g1")), "can't read before joining");
  await assertFails(updateDoc(doc(as(EVE), "groups/g1"), { memberUids: arrayUnion(EVE, CAROL) }));
  await assertFails(updateDoc(doc(as(EVE), "groups/g1"), { memberUids: arrayUnion(EVE), name: "Mine now" }));
  await assertSucceeds(updateDoc(doc(as(EVE), "groups/g1"), { memberUids: arrayUnion(EVE) }));
  await assertSucceeds(getDoc(doc(as(EVE), "groups/g1")));
});

test("adding a friend: only accepted friends", async () => {
  await assertSucceeds(updateDoc(doc(as(ALICE), "groups/g1"), { memberUids: arrayUnion(CAROL), lastAddedUid: CAROL }));
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "groups/g1"), { memberUids: [ALICE, BOB] }));
  await assertFails(updateDoc(doc(as(BOB), "groups/g1"), { memberUids: arrayUnion(CAROL), lastAddedUid: CAROL }),
    "bob isn't carol's friend");
  await assertFails(updateDoc(doc(as(ALICE), "groups/g1"), { memberUids: arrayUnion(EVE), lastAddedUid: EVE }),
    "alice isn't eve's friend");
  await assertFails(updateDoc(doc(as(EVE), "groups/g1"), { memberUids: arrayUnion(CAROL), lastAddedUid: CAROL }),
    "outsiders can't add people");
});

test("RSVP, leaving and organizer powers", async () => {
  await assertSucceeds(updateDoc(doc(as(BOB), "groups/g1"), { "rsvp.bob": "maybe" }));
  await assertFails(updateDoc(doc(as(BOB), "groups/g1"), { "rsvp.alice": "no" }));
  await assertFails(updateDoc(doc(as(BOB), "groups/g1"), { "rsvp.bob": "sure" }));
  await assertFails(updateDoc(doc(as(BOB), "groups/g1"), { freeUids: [BOB] }), "only organizer");
  await assertFails(updateDoc(doc(as(BOB), "groups/g1"), { memberUids: arrayRemove(ALICE) }), "can't kick others");
  await assertSucceeds(updateDoc(doc(as(ALICE), "groups/g1"), { freeUids: [BOB], scheduledAt: new Date() }));
  await assertFails(updateDoc(doc(as(ALICE), "groups/g1"), { ownerUid: BOB }));
  await assertFails(updateDoc(doc(as(ALICE), "groups/g1"), {
    memberUids: arrayRemove(ALICE), freeUids: arrayRemove(ALICE), "rsvp.alice": deleteField(),
  }), "organizer can't leave, must delete");
  await assertSucceeds(updateDoc(doc(as(BOB), "groups/g1"), {
    memberUids: arrayRemove(BOB), freeUids: arrayRemove(BOB), "rsvp.bob": deleteField(),
  }));
  await assertFails(getDoc(doc(as(BOB), "groups/g1")), "no access after leaving");
});

test("messages: members post as themselves, preview updates, no edits", async () => {
  const db = as(BOB);
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "groups/g1/messages")), { uid: BOB, name: "Bob", text: "hey", createdAt: serverTimestamp() });
  batch.update(doc(db, "groups/g1"), { lastMessage: "Bob: hey", lastMessageAt: serverTimestamp() });
  await assertSucceeds(batch.commit());

  const msgs = (d) => collection(d, "groups/g1/messages");
  await assertFails(addDoc(msgs(as(BOB)), { uid: ALICE, name: "Alice", text: "fake", createdAt: serverTimestamp() }));
  await assertFails(addDoc(msgs(as(EVE)), { uid: EVE, name: "Eve", text: "spam", createdAt: serverTimestamp() }));
  await assertFails(addDoc(msgs(as(BOB)), { uid: BOB, name: "Bob", text: "", createdAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as(ALICE), "groups/g1/messages/m1"), { text: "edited" }));
  await assertFails(deleteDoc(doc(as(BOB), "groups/g1/messages/m1")), "members can't delete");
  await assertFails(getDoc(doc(as(EVE), "groups/g1/messages/m1")));
  await assertFails(updateDoc(doc(as(EVE), "groups/g1"), { lastMessage: "x", lastMessageAt: serverTimestamp() }));
});

test("deleting a group: organizer only, with messages and code", async () => {
  await assertFails(deleteDoc(doc(as(BOB), "groups/g1")));
  await assertFails(deleteDoc(doc(as(BOB), "joinCodes/ABC123")));
  await assertSucceeds(deleteDoc(doc(as(ALICE), "groups/g1/messages/m1")));
  const alice = as(ALICE);
  const batch = writeBatch(alice);
  batch.delete(doc(alice, "joinCodes/ABC123"));
  batch.delete(doc(alice, "groups/g1"));
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(as(BOB), "groups/g1")), "a deleted group reads as empty");
});

test("groups list query works for members", async () => {
  await assertSucceeds(getDocs(query(collection(as(BOB), "groups"), where("memberUids", "array-contains", BOB))));
});

test("friendships: request, accept by receiver only, delete by either", async () => {
  const ref = (db) => doc(db, "friendships/alice_bob");
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

test("favorites: only your own", async () => {
  const fav = (db, uid, id) => doc(db, `users/${uid}/favorites/${id}`);
  await assertSucceeds(setDoc(fav(as(ALICE), ALICE, "osm-node-1"), { createdAt: serverTimestamp() }));
  await assertFails(setDoc(fav(as(BOB), ALICE, "osm-node-2"), { createdAt: serverTimestamp() }));
  await assertFails(setDoc(fav(as(ALICE), ALICE, "osm-node-3"), { createdAt: serverTimestamp(), note: "x" }));
  await assertSucceeds(getDocs(collection(as(ALICE), "users/alice/favorites")));
  await assertFails(getDocs(collection(as(BOB), "users/alice/favorites")));
  await assertSucceeds(deleteDoc(fav(as(ALICE), ALICE, "osm-node-1")));
});

test("plans: owner can swap stops, max 5", async () => {
  const ref = (db) => doc(db, "users/alice/plans/plan1");
  await assertSucceeds(updateDoc(ref(as(ALICE)), { stops: [{ placeId: "a" }] }));
  await assertFails(updateDoc(ref(as(ALICE)), { stops: [1, 2, 3, 4, 5, 6] }));
  await assertFails(updateDoc(ref(as(BOB)), { stops: [] }));
});

test("been there and notes: only your own", async () => {
  const v = (db, uid) => doc(db, `users/${uid}/visited/ov-123`);
  await assertSucceeds(setDoc(v(as(ALICE), ALICE), { createdAt: serverTimestamp() }));
  await assertFails(setDoc(v(as(BOB), ALICE), { createdAt: serverTimestamp() }));
  const n = (db, uid) => doc(db, `users/${uid}/notes/ov-123`);
  await assertSucceeds(setDoc(n(as(ALICE), ALICE), { text: "Ask for the terrace", updatedAt: serverTimestamp() }));
  await assertFails(getDoc(n(as(BOB), ALICE)));
  await assertFails(setDoc(n(as(ALICE), ALICE), { text: "x".repeat(501), updatedAt: serverTimestamp() }));
  await assertFails(setDoc(n(as(ALICE), ALICE), { text: "", updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(n(as(ALICE), ALICE)));
});

test("plans: owner can rename, not blank", async () => {
  const ref = (db) => doc(db, "users/alice/plans/plan1");
  await assertSucceeds(updateDoc(ref(as(ALICE)), { title: "Friday fun" }));
  await assertFails(updateDoc(ref(as(ALICE)), { title: "" }));
  await assertFails(updateDoc(ref(as(BOB)), { title: "Hacked" }));
});

test("group polls: members ask and vote once; outsiders can't", async () => {
  const polls = (db) => collection(db, "groups/g1/polls");
  const poll = { uid: BOB, question: "Where?", options: ["A", "B"], votes: {}, createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(polls(as(BOB)), "p1"), poll));
  await assertFails(setDoc(doc(polls(as(EVE)), "p2"), { ...poll, uid: EVE }), "outsider");
  await assertFails(setDoc(doc(polls(as(BOB)), "p3"), { ...poll, options: ["only one"] }));
  await assertFails(setDoc(doc(polls(as(BOB)), "p4"), { ...poll, votes: { alice: 1 } }), "no fake votes");
  const p1 = (db) => doc(db, "groups/g1/polls/p1");
  await assertSucceeds(updateDoc(p1(as(ALICE)), { "votes.alice": 1 }));
  await assertSucceeds(updateDoc(p1(as(ALICE)), { "votes.alice": 0 }), "can change vote");
  await assertFails(updateDoc(p1(as(ALICE)), { "votes.bob": 0 }), "can't vote for someone else");
  await assertFails(updateDoc(p1(as(ALICE)), { "votes.alice": 5 }), "option must exist");
  await assertFails(updateDoc(p1(as(EVE)), { "votes.eve": 0 }));
  await assertFails(getDoc(p1(as(EVE))));
  await assertSucceeds(deleteDoc(p1(as(ALICE))), "organizer can delete any poll");
});

test("message reactions: only your own", async () => {
  const m = (db) => doc(db, "groups/g1/messages/m1");
  await assertSucceeds(updateDoc(m(as(BOB)), { "reactions.bob": "👍" }));
  await assertFails(updateDoc(m(as(BOB)), { "reactions.alice": "👍" }));
  await assertFails(updateDoc(m(as(BOB)), { text: "edited" }));
  await assertFails(updateDoc(m(as(EVE)), { "reactions.eve": "👍" }));
  await assertSucceeds(updateDoc(m(as(BOB)), { "reactions.bob": deleteField() }));
});

test("organizer: pin a note, set meeting point, remove a member", async () => {
  const g = (db) => doc(db, "groups/g1");
  await assertSucceeds(updateDoc(g(as(ALICE)), { pinned: "Meet at 7", meetPlaceId: "x", meetPlaceName: "Gate 1" }));
  await assertFails(updateDoc(g(as(BOB)), { pinned: "Hi" }), "only the organizer pins");
  await assertFails(updateDoc(g(as(ALICE)), { pinned: "x".repeat(301) }));
  await assertFails(updateDoc(g(as(BOB)), { memberUids: arrayRemove(ALICE) }), "members can't remove others");
  await assertFails(updateDoc(g(as(ALICE)), { memberUids: arrayRemove(ALICE) }), "organizer stays");
  await assertSucceeds(updateDoc(g(as(ALICE)), {
    memberUids: arrayRemove(BOB), freeUids: arrayRemove(BOB), "rsvp.bob": deleteField() }));
});

test("check-ins: only you write yours; only listed friends read it", async () => {
  const c = (db, uid) => doc(db, `checkins/${uid}`);
  const data = { name: "Alice", placeId: "ov-1", placeName: "Test Cafe", area: null, lat: 30, lng: 31,
    visibleTo: [CAROL], createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(c(as(ALICE), ALICE), data));
  await assertFails(setDoc(c(as(BOB), ALICE), data), "can't check in as someone else");
  await assertFails(setDoc(c(as(ALICE), ALICE), { ...data, extra: 1 }));
  await assertSucceeds(getDoc(c(as(CAROL), ALICE)), "listed friend can see it");
  await assertFails(getDoc(c(as(EVE), ALICE)), "others can't");
  await assertSucceeds(getDocs(query(collection(as(CAROL), "checkins"), where("visibleTo", "array-contains", CAROL))));
  await assertFails(getDocs(collection(as(EVE), "checkins")), "no listing everyone");
  await assertFails(deleteDoc(c(as(CAROL), ALICE)));
  await assertSucceeds(deleteDoc(c(as(ALICE), ALICE)));
});

test("plans: AI polish can update summary, tips and source, within limits", async () => {
  const ref = (db) => doc(db, "users/alice/plans/plan1");
  await assertSucceeds(updateDoc(ref(as(ALICE)), { title: "Nice", summary: "A calm evening.", tips: ["Book ahead"], source: "ai" }));
  await assertFails(updateDoc(ref(as(ALICE)), { summary: "x".repeat(401) }));
  await assertFails(updateDoc(ref(as(ALICE)), { tips: ["a", "b", "c", "d"] }));
  await assertFails(updateDoc(ref(as(ALICE)), { source: "hacked" }));
  await assertFails(updateDoc(ref(as(BOB)), { summary: "nope" }));
});
