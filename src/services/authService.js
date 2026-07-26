import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase.js';

/* ─── Firebase error → readable English ──────────────────────── */

export function parseAuthError(error) {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'An account already exists with this email.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'The email or password is incorrect.';
    case 'auth/weak-password':
      return 'Your password must contain at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    case 'auth/network-request-failed':
      return 'Unable to connect. Check your internet connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Firebase is not configured. Set the correct API key in .env.local.';
    default:
      console.error('[authService] Unhandled Firebase error:', error?.code, error);
      return 'Something went wrong. Please try again.';
  }
}

/* ─── Username validation ─────────────────────────────────────── */

export function validateUsername(raw) {
  const value = String(raw ?? '').trim();
  if (value.length < 3)  return 'Username must be at least 3 characters.';
  if (value.length > 24) return 'Username must be 24 characters or less.';
  if (/[^a-zA-Z0-9._]/.test(value))   return 'Only letters, numbers, underscores and periods are allowed.';
  if (/^[._]|[._]$/.test(value))      return 'Username cannot start or end with a period or underscore.';
  if (/[.]{2,}/.test(value))          return 'Username cannot contain consecutive periods.';
  return null;
}

/* ─── Firestore user document ─────────────────────────────────── */

export async function createUserProfileIfMissing(firebaseUser, extra = {}) {
  const uid = firebaseUser.uid;
  console.count('[authService] createUserProfileIfMissing called');
  console.time('[authService] check if profile exists');

  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  console.timeEnd('[authService] check if profile exists');

  if (snap.exists()) {
    console.log('[authService] profile exists, updating lastLoginAt');
    await updateDoc(ref, { lastLoginAt: serverTimestamp() });
    return snap.data();
  }

  console.log('[authService] profile missing, creating new');

  const displayName = extra.displayName || firebaseUser.displayName || '';
  const profile = {
    uid:                firebaseUser.uid,
    email:              firebaseUser.email,
    emailNormalized:    (firebaseUser.email || '').toLowerCase(),
    displayName,
    username:           null,
    usernameNormalized: null,
    photoURL:           firebaseUser.photoURL || null,
    bio:                '',
    city:               '',
    country:            '',
    locationLabel:      '',
    primaryActivity:    null,
    activities:         [],
    preferredCategories: [],
    equipment:          [],
    followerCount:      0,
    followingCount:     0,
    liveCount:          0,
    role:               'user',
    accountStatus:      'active',
    onboardingCompleted: false,
    authProvider:       extra.provider || 'password',
    createdAt:          serverTimestamp(),
    updatedAt:          serverTimestamp(),
    lastLoginAt:        serverTimestamp(),
  };

  try {
    console.time('[authService] setDoc creating profile');
    await setDoc(ref, profile);
    console.timeEnd('[authService] setDoc creating profile');
    console.log('[authService] profile created successfully');
  } catch (err) {
    console.error('[authService] setDoc failed:', err.code, err.message);
    throw err;
  }
  return profile;
}

export async function getUserProfile(uid) {
  console.time(`[authService] getDoc users/${uid.slice(0, 8)}`);
  const snap = await getDoc(doc(db, 'users', uid));
  console.timeEnd(`[authService] getDoc users/${uid.slice(0, 8)}`);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateUserProfile(uid, data) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

/* ─── Username reservation ────────────────────────────────────── */

export async function reserveUsername(uid, username) {
  const normalized = username.toLowerCase();
  const usernameRef = doc(db, 'usernames', normalized);
  const userRef     = doc(db, 'users', uid);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(usernameRef);
    if (existing.exists() && existing.data().uid !== uid) {
      throw new Error('This username is already taken.');
    }
    tx.set(usernameRef, { uid, username, createdAt: serverTimestamp() });
    tx.update(userRef, {
      username,
      usernameNormalized: normalized,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function isUsernameAvailable(username) {
  const normalized = username.toLowerCase();
  const snap = await getDoc(doc(db, 'usernames', normalized));
  return !snap.exists();
}

/* ─── Auth actions ────────────────────────────────────────────── */

export async function signUpWithEmail(email, password, displayName) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  await createUserProfileIfMissing(credential.user, { displayName, provider: 'password' });
  return credential.user;
}

export async function signInWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await createUserProfileIfMissing(credential.user);
  return credential.user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  await createUserProfileIfMissing(credential.user, { provider: 'google' });
  return credential.user;
}

export async function signOutUser() {
  await signOut(auth);
}

export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}
