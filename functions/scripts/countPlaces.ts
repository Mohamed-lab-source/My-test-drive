/** Prints how many places are in Firestore (used by the build workflow). */
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
getFirestore().collection("places").count().get()
  .then((snap) => console.log(snap.data().count))
  .catch((e) => { console.error(e.message ?? e); process.exit(1); });
