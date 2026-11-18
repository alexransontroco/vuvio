import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'europe-west1');

// Vuvio-Lab: wire Firebase SDK to local emulators when VITE_USE_EMULATORS=1.
// Keeps production credentials and data untouched while developing.
if (import.meta.env.VITE_USE_EMULATORS === '1') {
  const host = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1';
  const authPort = Number(import.meta.env.VITE_EMULATOR_AUTH_PORT || 9099);
  const fsPort = Number(import.meta.env.VITE_EMULATOR_FIRESTORE_PORT || 8080);
  const storagePort = Number(import.meta.env.VITE_EMULATOR_STORAGE_PORT || 9199);
  const fnPort = Number(import.meta.env.VITE_EMULATOR_FUNCTIONS_PORT || 5001);
  connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, fsPort);
  connectStorageEmulator(storage, host, storagePort);
  connectFunctionsEmulator(functions, host, fnPort);
  // eslint-disable-next-line no-console
  console.info('[Vuvio-Lab] Firebase SDK wired to local emulators', { host });
}
