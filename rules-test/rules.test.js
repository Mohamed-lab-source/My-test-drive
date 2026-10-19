// Checks firestore.rules against the Firestore emulator.
// Run from this folder:  npm install && npm test   (needs Java + firebase-tools)
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs,
  serverTimestamp, deleteField, arrayUnion, arrayRemove, writeBatch, runTransaction, Timestamp,
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

test("delete my account: only your own documents", async () => {
  await assertFails(deleteDoc(doc(as(BOB), "users/alice")));
  await assertFails(deleteDoc(doc(as(BOB), "publicProfiles/alice")));
  await assertSucceeds(deleteDoc(doc(as(ALICE), "publicProfiles/alice")));
  await assertSucceeds(deleteDoc(doc(as(ALICE), "users/alice")));
});

test("reports, feedback and error reports: write-only and limited", async () => {
  const report = { by: BOB, kind: "message", targetUid: ALICE, groupId: "g1", messageId: "m1",
    text: "hi", reason: "Rude", createdAt: serverTimestamp() };
  await assertSucceeds(addDoc(collection(as(BOB), "reports"), report));
  await assertFails(addDoc(collection(as(BOB), "reports"), { ...report, by: ALICE }), "can't report as someone else");
  await assertFails(addDoc(collection(as(BOB), "reports"), { ...report, kind: "other" }));
  await assertFails(addDoc(collection(anon(), "reports"), report));
  await assertFails(getDocs(collection(as(BOB), "reports")), "nobody reads reports in the app");
  await assertSucceeds(addDoc(collection(as(BOB), "feedback"),
    { by: BOB, text: "Love it", appVersion: "0.5.0", createdAt: serverTimestamp() }));
  await assertFails(addDoc(collection(as(BOB), "feedback"),
    { by: BOB, text: "x".repeat(1001), appVersion: "0.5.0", createdAt: serverTimestamp() }));
  await assertSucceeds(addDoc(collection(as(BOB), "errorReports"),
    { by: BOB, message: "oops", stack: "at main", appVersion: "0.5.0", createdAt: serverTimestamp() }));
  await assertFails(getDocs(collection(as(BOB), "errorReports")));
});

test("chat: reply to a message, delete only your own", async () => {
  const msgs = (db) => collection(db, "groups/g1/messages");
  await assertSucceeds(addDoc(msgs(as(BOB)), { uid: BOB, name: "Bob", text: "yes!", replyTo: "hi",
    replyName: "Alice", createdAt: serverTimestamp() }));
  await assertFails(addDoc(msgs(as(BOB)), { uid: BOB, name: "Bob", text: "x", replyTo: "y".repeat(201),
    createdAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(as(BOB), "groups/g1/messages/m1")), "not Bob's message");
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups/g1/messages/m2"), { uid: BOB, name: "Bob", text: "oops" });
  });
  await assertSucceeds(deleteDoc(doc(as(BOB), "groups/g1/messages/m2")));
});

test("reviews: one per person, stars and points can't be faked", async () => {
  const db = as(ALICE);
  const review = (stars, extra = {}) => ({
    placeId: "p1", uid: ALICE, name: "Alice", stars, text: "", answers: { again: "yes" },
    category: "cafe", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
  });
  const write = (d, r, ps, rs) => {
    const b = writeBatch(d);
    if (r) b.set(doc(d, "reviews/p1__alice"), r);
    if (ps) b.set(doc(d, "placeStats/p1"), ps);
    if (rs) b.set(doc(d, "reviewerStats/alice"), rs);
    return b.commit();
  };
  // Must come with the right stats.
  await assertFails(write(db, review(5), null, null), "review alone");
  await assertFails(write(db, review(5), { count: 1, sum: 99 }, { total: 1, detailed: 0, cats: { cafe: 1 }, place: "p1" }), "fake sum");
  await assertFails(write(db, review(5), { count: 1, sum: 5 }, { total: 9, detailed: 0, cats: { cafe: 1 }, place: "p1" }), "fake points");
  await assertFails(write(guest(ALICE), review(5), { count: 1, sum: 5 }, { total: 1, detailed: 0, cats: { cafe: 1 }, place: "p1" }), "guests can't review");
  await assertFails(write(db, review(9), { count: 1, sum: 9 }, { total: 1, detailed: 0, cats: { cafe: 1 }, place: "p1" }), "stars 1-5");
  await assertSucceeds(write(db, review(5), { count: 1, sum: 5 }, { total: 1, detailed: 0, cats: { cafe: 1 }, place: "p1" }));
  // Anyone signed in can read it.
  await assertSucceeds(getDoc(doc(as(BOB), "reviews/p1__alice")));
  await assertSucceeds(getDocs(query(collection(as(BOB), "reviews"), where("placeId", "==", "p1"))));
  // Someone else can't write it or its stats.
  await assertFails(setDoc(doc(as(BOB), "placeStats/p1"), { count: 5, sum: 25 }));
  await assertFails(setDoc(doc(as(BOB), "reviewerStats/alice"), { total: 50, detailed: 50, cats: {}, place: "p1" }));
  // Change the stars: sum moves by the difference, count stays.
  const snap = (await getDoc(doc(db, "reviews/p1__alice"))).data();
  const longText = "x".repeat(60);
  await assertFails(write(db, { ...review(3), createdAt: snap.createdAt }, { count: 1, sum: 5 }, { total: 1, detailed: 0, cats: { cafe: 1 }, place: "p1" }), "sum must change");
  await assertSucceeds(write(db, { ...review(3, { text: longText, answers: { a: "1", b: "2", c: "3" } }), createdAt: snap.createdAt },
    { count: 1, sum: 3 }, { total: 1, detailed: 1, cats: { cafe: 1 }, place: "p1" }));
  // Delete: both stats go down.
  const del = (ps, rs) => {
    const b = writeBatch(db);
    b.delete(doc(db, "reviews/p1__alice"));
    if (ps) b.set(doc(db, "placeStats/p1"), ps);
    if (rs) b.set(doc(db, "reviewerStats/alice"), rs);
    return b.commit();
  };
  await assertFails(del(null, null), "delete alone");
  await assertSucceeds(del({ count: 0, sum: 0 }, { total: 0, detailed: 0, cats: {}, place: "p1" }));
  await assertSucceeds(deleteDoc(doc(db, "reviewerStats/alice")));
});

test("reviews: no links or phone numbers; AI text can be reported", async () => {
  const db = as(ALICE);
  const write = (text) => {
    const b = writeBatch(db);
    b.set(doc(db, "reviews/p2__alice"), {
      placeId: "p2", uid: ALICE, name: "Alice", stars: 4, text, answers: {}, category: "cafe",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    b.set(doc(db, "placeStats/p2"), { count: 1, sum: 4 });
    b.set(doc(db, "reviewerStats/alice"), { total: 1, detailed: 0, cats: { cafe: 1 }, place: "p2" });
    return b.commit();
  };
  await assertFails(write("order at https://spam.test"));
  await assertFails(write("call 0100 123 4567 now"));
  await assertSucceeds(write("Lovely terrace, opened 2019."));
  await assertSucceeds(addDoc(collection(db, "reports"), {
    by: ALICE, kind: "ai", text: "plan words", reason: "Offensive or inappropriate", createdAt: serverTimestamp(),
  }));
});


test("crowd: counts only go up by one, with your own mark, once per 30 minutes", async () => {
  const db = as(ALICE);
  const report = (d, counts, { since = serverTimestamp(), mark = true, place = "p9" } = {}) => {
    const b = writeBatch(d);
    b.set(doc(d, `crowd/${place}`), { ...counts, since, last: serverTimestamp() });
    if (mark) b.set(doc(d, `users/${d === db ? ALICE : BOB}/crowdMarks/${place}`), { at: serverTimestamp() });
    return b.commit();
  };
  await assertFails(report(db, { quiet: 0, normal: 0, busy: 1 }, { mark: false }), "needs the mark");
  await assertFails(report(db, { quiet: 0, normal: 0, busy: 5 }), "can't add 5");
  await assertFails(report(guest("gina"), { quiet: 0, normal: 0, busy: 1 }), "guests can't report");
  await assertSucceeds(report(db, { quiet: 0, normal: 0, busy: 1 }));
  await assertFails(report(db, { quiet: 0, normal: 0, busy: 2 }, { since: (await getDoc(doc(db, "crowd/p9"))).data().since }),
    "same person again within 30 minutes");
  // Bob adds one to the same window; he can't wipe Alice's report.
  const bob = as(BOB);
  const since = (await getDoc(doc(bob, "crowd/p9"))).data().since;
  await assertFails(report(bob, { quiet: 1, normal: 0, busy: 0 }), "can't start over while the window is fresh");
  await assertFails(report(bob, { quiet: 1, normal: 0, busy: 1 }, { since: Timestamp.fromMillis(0) }), "can't move the window");
  await assertSucceeds(report(bob, { quiet: 1, normal: 0, busy: 1 }, { since }));
  // After 2 hours a new window starts from zero.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "crowd/p8"), {
      quiet: 0, normal: 4, busy: 0, since: Timestamp.fromMillis(Date.now() - 3 * 3600 * 1000), last: Timestamp.now(),
    });
  });
  await assertSucceeds(report(db, { quiet: 1, normal: 0, busy: 0 }, { place: "p8" }));
  await assertFails(deleteDoc(doc(db, "crowd/p8")));
  await assertSucceeds(getDoc(doc(as(EVE), "crowd/p8")));
  await assertFails(getDoc(doc(as(EVE), "users/alice/crowdMarks/p8")), "marks are private");
});

test("bring list: members add, claim only for themselves, outsiders can't", async () => {
  const items = (db) => collection(db, "groups/g1/items");
  const item = { uid: BOB, name: "Bob", text: "Cards", takenBy: null, takenName: null, createdAt: serverTimestamp() };
  await assertFails(addDoc(items(as(EVE)), { ...item, uid: EVE }), "outsider");
  await assertFails(addDoc(items(as(BOB)), { ...item, takenBy: BOB, takenName: "Bob" }), "can't start taken");
  const ref = await addDoc(items(as(BOB)), item);
  const id = ref.id;
  await assertFails(updateDoc(doc(as(ALICE), `groups/g1/items/${id}`), { takenBy: BOB, takenName: "Bob" }), "not for others");
  await assertSucceeds(updateDoc(doc(as(ALICE), `groups/g1/items/${id}`), { takenBy: ALICE, takenName: "Alice" }));
  await assertFails(updateDoc(doc(as(BOB), `groups/g1/items/${id}`), { takenBy: BOB, takenName: "Bob" }), "already taken");
  await assertFails(updateDoc(doc(as(BOB), `groups/g1/items/${id}`), { takenBy: null, takenName: null }), "only Alice lets go");
  await assertSucceeds(updateDoc(doc(as(ALICE), `groups/g1/items/${id}`), { takenBy: null, takenName: null }));
  await assertFails(updateDoc(doc(as(ALICE), `groups/g1/items/${id}`), { text: "Changed" }));
  await assertFails(getDocs(items(as(EVE))));
  await assertSucceeds(deleteDoc(doc(as(ALICE), `groups/g1/items/${id}`)), "organizer can delete");
});

test("helpful votes: one per person, never on your own review", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "reviews/p1__alice"), { placeId: "p1", uid: ALICE, stars: 5 });
  });
  const vote = (db, voter) => setDoc(doc(db, `reviews/p1__alice/helpful/${voter}`), { at: serverTimestamp() });
  await assertFails(vote(as(ALICE), ALICE), "own review");
  await assertFails(vote(as(BOB), ALICE), "for someone else");
  await assertFails(vote(guest("gina"), "gina"), "guests");
  await assertSucceeds(vote(as(BOB), BOB));
  await assertSucceeds(getDocs(collection(as(EVE), "reviews/p1__alice/helpful")));
  await assertFails(deleteDoc(doc(as(EVE), "reviews/p1__alice/helpful/bob")));
  await assertSucceeds(deleteDoc(doc(as(BOB), "reviews/p1__alice/helpful/bob")));
  await assertSucceeds(setDoc(doc(as(BOB), "users/bob/helpfulGiven/p1__alice"), { at: serverTimestamp() }));
  await assertFails(getDoc(doc(as(EVE), "users/bob/helpfulGiven/p1__alice")));
});
