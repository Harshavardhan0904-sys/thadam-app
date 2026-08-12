import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore
} from "firebase/firestore";
import firebaseConfigRaw from "../../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: firebaseConfigRaw.apiKey,
  authDomain: firebaseConfigRaw.authDomain,
  projectId: firebaseConfigRaw.projectId,
  storageBucket: firebaseConfigRaw.storageBucket,
  messagingSenderId: firebaseConfigRaw.messagingSenderId,
  appId: firebaseConfigRaw.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Use custom firestoreDatabaseId from firebase-applet-config.json if present
let firestoreDb: Firestore;
try {
  const dbId = firebaseConfigRaw.firestoreDatabaseId || undefined;
  if (dbId) {
    firestoreDb = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    }, dbId);
  } else {
    firestoreDb = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
} catch {
  firestoreDb = firebaseConfigRaw.firestoreDatabaseId
    ? getFirestore(app, firebaseConfigRaw.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestoreDb;

export async function createDriverAuthAccount(email: string, pass: string): Promise<string> {
  const secondaryApp = initializeApp(firebaseConfig, "SecondaryDriverApp_" + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
  const uid = credential.user.uid;
  await signOut(secondaryAuth);
  return uid;
}

export default app;
