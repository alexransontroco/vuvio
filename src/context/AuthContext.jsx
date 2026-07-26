import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase.js';
import {
  createUserProfileIfMissing,
  getUserProfile,
  parseAuthError,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
  updateUserProfile,
} from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,            setUser]            = useState(null);
  const [userProfile,     setUserProfile]     = useState(null);
  const [authLoading,     setAuthLoading]     = useState(true);
  const [profileLoading,  setProfileLoading]  = useState(false);
  const [currentUid,      setCurrentUid]      = useState(null);

  const loadProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setUserProfile(null);
      setCurrentUid(null);
      setProfileLoading(false);
      return;
    }

    const uid = firebaseUser.uid;
    console.count('[Auth] loadProfile called');
    console.time('[Auth] profile Firestore read');
    setProfileLoading(true);
    setCurrentUid(uid);

    try {
      let profile = await getUserProfile(uid);
      console.timeEnd('[Auth] profile Firestore read');

      if (!profile) {
        console.log('[Auth] profile missing, creating via AuthContext');
        await createUserProfileIfMissing(firebaseUser);
        profile = await getUserProfile(uid);
      }

      console.log('[Auth] profile loaded for', uid.slice(0, 8), profile ? 'exists' : 'null');
      setUserProfile(profile);
    } catch (err) {
      console.timeEnd('[Auth] profile Firestore read');
      console.error('[Auth] profile load error:', err.code || err.message);
      setUserProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    console.count('[Auth] onAuthStateChanged setup');
    let startTime = performance.now();

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.count('[Auth] onAuthStateChanged callback');
        console.log('[Auth] auth state changed:', firebaseUser ? firebaseUser.uid.slice(0, 8) : 'null');
        setUser(firebaseUser);
        await loadProfile(firebaseUser);
        setAuthLoading(false);
        const elapsed = performance.now() - startTime;
        console.log(`[Auth] restore session: ${elapsed.toFixed(2)}ms`);
      }, (err) => {
        console.error('[Auth] onAuthStateChanged error:', err);
        setAuthLoading(false);
      });
    } catch (err) {
      console.error('[Auth] onAuthStateChanged setup error:', err);
      setAuthLoading(false);
    }
    return unsubscribe;
  }, [loadProfile]);

  const refreshUserProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [user, loadProfile]);

  const signUp = useCallback(async (email, password, displayName) => {
    try {
      const firebaseUser = await signUpWithEmail(email, password, displayName);
      await loadProfile(firebaseUser);
      return { success: true };
    } catch (err) {
      return { success: false, error: parseAuthError(err) };
    }
  }, [loadProfile]);

  const signIn = useCallback(async (email, password) => {
    try {
      const firebaseUser = await signInWithEmail(email, password);
      await loadProfile(firebaseUser);
      return { success: true };
    } catch (err) {
      return { success: false, error: parseAuthError(err) };
    }
  }, [loadProfile]);

  const googleSignIn = useCallback(async () => {
    try {
      const firebaseUser = await signInWithGoogle();
      await loadProfile(firebaseUser);
      return { success: true };
    } catch (err) {
      const message = parseAuthError(err);
      return { success: false, error: message };
    }
  }, [loadProfile]);

  const logout = useCallback(async () => {
    await signOutUser();
    setUser(null);
    setUserProfile(null);
  }, []);

  const sendReset = useCallback(async (email) => {
    try {
      await sendPasswordReset(email);
      return { success: true };
    } catch (err) {
      return { success: false, error: parseAuthError(err) };
    }
  }, []);

  const updateProfile = useCallback(async (data) => {
    if (!user) return;
    await updateUserProfile(user.uid, data);
    await loadProfile(user);
  }, [user, loadProfile]);

  const value = {
    user,
    userProfile,
    authLoading,
    profileLoading,
    isAuthenticated: Boolean(user),
    signUp,
    signIn,
    signInWithGoogle: googleSignIn,
    logout,
    sendReset,
    updateProfile,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
