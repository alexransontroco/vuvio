import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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

/* ─── Platform detection ─────────────────────────────────────── */

export function shouldUseRedirect() {
  // Detect mobile/tablet and PWA mode
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isPWA = window.matchMedia("(display-mode: standalone)").matches;
  return isMobileDevice || isPWA;
}

/* ─── Demo account detection ─────────────────────────────────── */

export function isDemoAccount(email) {
  return email === 'thomasmercier@gmail.com';
}

/* ─── Firebase error → readable English ──────────────────────── */

export function parseAuthError(error) {
  const code = error?.code;
  const message = error?.message;

  console.error('[authService] Firebase error:', code, message);

  switch (code) {
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
    case 'auth/user-cancelled-login':
      return '';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Google Sign-In. Contact support.';
    case 'auth/popup-blocked':
      return 'Pop-ups are blocked. Please enable them in your browser settings.';
    case 'auth/operation-not-allowed':
      return 'Google Sign-In is not enabled. Contact support.';
    case 'auth/network-request-failed':
      return 'Unable to connect. Check your internet connection and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email. Try signing in with your password.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Firebase is not configured. Set the correct API key in .env.local.';
    default:
      console.error('[authService] Unhandled Firebase error code:', code);
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
    emailVerified:      firebaseUser.emailVerified || false,
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
    followedCreators:   [],
    onboardingCompleted: false,
    authProvider:       extra.provider || 'password',
    createdAt:          serverTimestamp(),
    updatedAt:          serverTimestamp(),
    lastLoginAt:        serverTimestamp(),
  };

  try {
    console.log('[authService] profile write debug', {
      uid: firebaseUser.uid,
      path: `users/${firebaseUser.uid}`,
      profileDataKeys: Object.keys(profile),
    });
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
  const timerKey = `[authService] getDoc users/${uid.slice(0, 8)}`;
  console.time(timerKey);
  const snap = await getDoc(doc(db, 'users', uid));
  console.timeEnd(timerKey);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateUserProfile(uid, data) {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, { uid, ...data, updatedAt: serverTimestamp() }, { merge: true });
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
    tx.set(userRef, {
      uid,
      username,
      usernameNormalized: normalized,
      updatedAt: serverTimestamp(),
    }, { merge: true });
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

  // Send email verification
  try {
    await sendEmailVerification(credential.user);
    console.log('[authService] Verification email sent to:', email);
  } catch (err) {
    console.error('[authService] Failed to send verification email:', err.message);
  }

  return credential.user;
}

export async function signInWithEmail(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await createUserProfileIfMissing(credential.user);
    return credential.user;
  } catch (err) {
    // Auto-create demo account on first login
    if (isDemoAccount(email) && err.code === 'auth/user-not-found') {
      console.log('[authService] Creating demo account for Thomas Mercier');
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: 'Thomas Mercier' });
      await createUserProfileIfMissing(credential.user, { displayName: 'Thomas Mercier', provider: 'password' });
      return credential.user;
    }
    throw err;
  }
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const isMobile = shouldUseRedirect();
  console.log('[authService] signInWithGoogle called, isMobile:', isMobile);

  try {
    let userCredential;
    if (isMobile) {
      // Mobile/PWA: Use redirect flow
      console.log('[authService] Using signInWithRedirect (mobile/PWA)');
      console.log('[authService] About to redirect to Google...');
      await signInWithRedirect(auth, provider);
      // Note: Control returns to the app after redirect, but the actual credential
      // is handled by getRedirectResult in AuthContext
      console.log('[authService] signInWithRedirect completed (will not reach here due to redirect)');
      return null;
    } else {
      // Desktop: Use popup flow
      console.log('[authService] Using signInWithPopup (desktop)');
      userCredential = await signInWithPopup(auth, provider);
      console.log('[authService] Popup signin completed for:', userCredential.user.uid.slice(0, 8));
      await createUserProfileIfMissing(userCredential.user, { provider: 'google' });
      return userCredential.user;
    }
  } catch (err) {
    console.error('[authService] signInWithGoogle failed:', err.code, err.message);
    throw err;
  }
}

export async function signOutUser() {
  await signOut(auth);
}

export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function resendEmailVerification() {
  const user = auth.currentUser;
  if (!user) throw new Error('No user logged in');
  if (user.emailVerified) throw new Error('Email already verified');
  await sendEmailVerification(user);
  console.log('[authService] Verification email resent to:', user.email);
}

/* ─── Handle redirect result (for mobile sign-in) ────────────── */

export async function handleGoogleRedirectResult() {
  console.log('[authService] handleGoogleRedirectResult called');
  try {
    const result = await getRedirectResult(auth);
    if (!result) {
      console.log('[authService] No redirect result (normal on first page load)');
      return null;
    }
    console.log('[authService] Redirect successful for user:', result.user.uid.slice(0, 8));
    try {
      await createUserProfileIfMissing(result.user, { provider: 'google' });
      console.log('[authService] User profile created/updated for:', result.user.uid.slice(0, 8));
    } catch (profileErr) {
      console.error('[authService] Failed to create user profile:', profileErr.message);
      // Still return the user even if profile creation fails - they're authenticated in Firebase
    }
    return result.user;
  } catch (err) {
    console.error('[authService] handleGoogleRedirectResult error:', err.code, err.message);
    throw err;
  }
}
