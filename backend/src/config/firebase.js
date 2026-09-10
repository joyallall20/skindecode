import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import './env.js';

let firebaseReady = false;

const parsePrivateKey = (privateKey) =>
  privateKey.replace(/\\n/g, '\n');

try {
  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
    GOOGLE_APPLICATION_CREDENTIALS,
  } = process.env;

  if (
    FIREBASE_PROJECT_ID &&
    FIREBASE_CLIENT_EMAIL &&
    FIREBASE_PRIVATE_KEY
  ) {
    initializeApp({
      credential: cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: parsePrivateKey(FIREBASE_PRIVATE_KEY),
      }),
    });

    firebaseReady = true;
  } else if (GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({
      credential: applicationDefault(),
    });

    firebaseReady = true;
  }
} catch (error) {
  console.warn(
    'Firebase admin initialization skipped:',
    error.message
  );
}

export const isFirebaseConfigured = () => firebaseReady;

export const firebaseAuth = () => getAuth();