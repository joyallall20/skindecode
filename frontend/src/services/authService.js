import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
} from 'firebase/auth';

import { auth } from './firebase.js';

const googleProvider = new GoogleAuthProvider();

export const signUp = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const login = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

/** Alias kept for callers that use loginWithEmail instead of login. */
export const loginWithEmail = (email, password) =>
  login(email, password);

/**
 * Sign in with Google via popup.
 */
export const loginWithGoogle = () => {
  googleProvider.setCustomParameters({
    prompt: 'select_account',
  });

  return signInWithPopup(auth, googleProvider);
};

/**
 * Optional helper to inspect a completed Google redirect.
 */
export const handleGoogleRedirect = () =>
  getRedirectResult(auth);

export const logout = () =>
  signOut(auth);

export const getCurrentUser = () =>
  auth.currentUser;

export const getIdToken = async (forceRefresh = false) => {
  const user = auth.currentUser;

  if (!user) return null;

  return user.getIdToken(forceRefresh);
};

export const onAuthStateChange = (callback) =>
  onAuthStateChanged(auth, callback);

export const isGoogleAuthConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID,
);