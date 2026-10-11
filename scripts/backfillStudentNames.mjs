// scripts/backfillStudentNames.mjs
// One-time fix for attempts that got auto-finalized before the
// studentName/studentCollege fix existed — they're stuck "submitted"
// with no name, which is exactly what crashed the analytics batch
// write. Safe to re-run; it skips anything that already has a name.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./serviceAccountKey.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection("attempts")
  .where("status", "==", "submitted")
  .where("isPractice", "==", false)
  .get();

let fixed = 0;
for (const doc of snap.docs) {
  const data = doc.data();
  if (data.isGuest) continue;       // guests use guestName, different field
  if (data.studentName) continue;   // already fine

  const studentSnap = await db.collection("students").doc(data.studentAuthUid).get();
  const studentName = studentSnap.exists ? (studentSnap.data().name || "Student") : "Student";
  const studentCollege = studentSnap.exists ? (studentSnap.data().college || null) : null;

  await doc.ref.update({ studentName, studentCollege });
  fixed++;
  console.log(`Fixed ${doc.id} -> ${studentName}`);
}
console.log(`Done. Fixed ${fixed} attempt(s).`);