"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithCustomToken, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// True only once real values exist (i.e. FIREBASE-SETUP.md has been
// completed). Every page that touches auth checks this FIRST and falls
// back to the Phase 1 mock flow when it's false — so filling in
// .env.local is the only thing that flips the app from demo to real,
// nothing else needs to change by hand.
export const firebaseReady = Boolean(config.apiKey && config.projectId);

function getClientApp() {
  if (!firebaseReady) return null;
  return getApps().length ? getApps()[0] : initializeApp(config);
}

export function getClientAuth() {
  const app = getClientApp();
  return app ? getAuth(app) : null;
}

/**
 * THE fix for "logged in but dashboard shows nothing/wrong data after a
 * refresh": Firebase restores the signed-in session from IndexedDB
 * ASYNCHRONOUSLY after page load. `auth.currentUser` is null for a brief
 * moment even for an already-logged-in user — reading it synchronously
 * right after a refresh races that restoration and loses. Every
 * authenticated fetch must wait for the FIRST `onAuthStateChanged` fire
 * (which resolves once, with either the restored user or null) instead
 * of trusting `currentUser` directly.
 */
export function waitForAuthUser(auth) {
  if (!auth) return Promise.resolve(null);
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export { signInWithCustomToken, signInWithEmailAndPassword };
