import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Vuvio-Lab runtime safety: refuse any projectId that could be production.
// Only ids starting with "vuvio-lab" are accepted here. Blocks accidental
// copy of VITE_FIREBASE_PROJECT_ID=vuvio-bf328 into .env.local.
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
if (!projectId || !projectId.startsWith('vuvio-lab')) {
  const msg = `[Vuvio-Lab SAFETY] refusing to initialize Firebase with projectId="${projectId}". ` +
    `Only ids starting with "vuvio-lab" are allowed in this worktree. Fix .env.local.`;
  // eslint-disable-next-line no-console
  console.error(msg);
  throw new Error(msg);
}

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'europe-west1');

// Vuvio-Lab: force emulator wiring. Any non-"1" value is rejected to prevent
// a silent fallback to a real Firebase project (even the fake id would still
// talk to google-apis for auth token resolution).
const useEmu = import.meta.env.VITE_USE_EMULATORS;
if (useEmu !== '1') {
  const msg = `[Vuvio-Lab SAFETY] VITE_USE_EMULATORS must be "1" in this worktree (got "${useEmu}"). ` +
    `Emulators are the only Firebase backend the Lab is allowed to talk to.`;
  // eslint-disable-next-line no-console
  console.error(msg);
  throw new Error(msg);
}

{
  const host = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1';
  const authPort = Number(import.meta.env.VITE_EMULATOR_AUTH_PORT || 9099);
  const fsPort = Number(import.meta.env.VITE_EMULATOR_FIRESTORE_PORT || 8080);
  const storagePort = Number(import.meta.env.VITE_EMULATOR_STORAGE_PORT || 9199);
  const fnPort = Number(import.meta.env.VITE_EMULATOR_FUNCTIONS_PORT || 5001);
  connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, fsPort);
  connectStorageEmulator(storage, host, storagePort);
  connectFunctionsEmulator(functions, host, fnPort);
  // Best-effort health probe. If emulators are not up, warn loudly so the
  // developer notices before their session gets confusing network errors.
  fetch(`http://${host}:${authPort}/`, { mode: 'no-cors' }).catch(() => {
    // eslint-disable-next-line no-console
    console.warn(
      `[Vuvio-Lab] Firebase emulators appear to be offline on ${host}. ` +
      `Run "npm run emulators" (or "npm run lab") in another terminal.`
    );
  });
  // eslint-disable-next-line no-console
  console.info('[Vuvio-Lab] Firebase SDK wired to local emulators', { host, projectId });
}
