import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

const config = JSON.parse(readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp({ projectId: config.projectId });
const dbId = config.firestoreDatabaseId || "(default)";
const db = getFirestore(app, dbId);
const auth = getAuth(app);

const TARGET_UIDS = [
  "Ojgg9x6kNJXgk9sla05xWn8Muwm1",
  "CBnUWCLg6VfSVXkyw5jMN9Qo4kB3",
  "user_1785826089670",
  "5e5Ma9zW2NWBSwF47N8KQecqpPA3",
  "GLN43idr0EQhlpOtSsRgtcjfF582",
  "tjsf87565KeGxCs8k7NxA56tYCC2",
  "3kJdx6W5KPSSNB4LRdQcYf3nBdf1",
  "HIkWKEFf62SbOmgB9nxheFQIFeF3",
  "QUrkdAXO1QTAQQB6WWQBdrFigiE2",
  "hfTS4r2XqiQpvZhz9c4ri98Ndb63",
  "OGcXomdufGQFguJRvJJJ1V7Gz482"
];

const PROTECTED_UID = "TIDNa7k2b6TfMAGwk8sisZRMgDu1";

async function deleteCollectionByCompany(collectionName, companyId) {
  const snapshot = await db.collection(collectionName).where("companyId", "==", companyId).get();
  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}

async function runCleanup() {
  console.log(`Starting cleanup for ${TARGET_UIDS.length} demo accounts...\n`);

  const companyIdsToDelete = new Set();

  for (const uid of TARGET_UIDS) {
    if (uid === PROTECTED_UID) {
      console.error(`[PROTECTION ALERT] Attempted to delete protected UID ${PROTECTED_UID}. Skipping!`);
      continue;
    }

    console.log(`Processing UID: ${uid}`);

    const userDocRef = db.collection("users").doc(uid);
    const userSnap = await userDocRef.get();

    if (userSnap.exists) {
      const userData = userSnap.data();
      if (userData?.companyId) {
        companyIdsToDelete.add(userData.companyId);
        console.log(`  -> Found Company ID: ${userData.companyId} (${userData.companyName || 'N/A'})`);
      }
      await userDocRef.delete();
      console.log(`  -> Deleted Firestore user doc: users/${uid}`);
    } else {
      console.log(`  -> No Firestore user doc found for users/${uid}`);
    }

    try {
      await auth.deleteUser(uid);
      console.log(`  -> Deleted Firebase Auth user: ${uid}`);
    } catch (err) {
      console.log(`  -> Auth user delete skipped/failed: ${err.message}`);
    }
  }

  console.log(`\nDeleting associated data for ${companyIdsToDelete.size} unique companies...`);

  for (const companyId of companyIdsToDelete) {
    console.log(`\nCleaning up Company ID: ${companyId}`);

    const collections = ["branches", "shipments", "vehicles", "drivers", "invoices", "payments", "driverLocations"];

    for (const col of collections) {
      const count = await deleteCollectionByCompany(col, companyId);
      if (count > 0) {
        console.log(`  -> Deleted ${count} documents from ${col}`);
      }
    }

    await db.collection("companies").doc(companyId).delete();
    console.log(`  -> Deleted company document: companies/${companyId}`);
  }

  console.log("\nCleanup successfully completed!");
}

runCleanup().catch((err) => console.error("Fatal cleanup error:", err));
