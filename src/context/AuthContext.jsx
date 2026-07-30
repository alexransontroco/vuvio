import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase.js';
import {
  createUserProfileIfMissing,
  getUserProfile,
  handleGoogleRedirectResult,
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
  const [showSplash,      setShowSplash]      = useState(true);

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
    let mounted = true;

    const setupAuth = async () => {
      try {
        // Handle Google Sign-In redirect result first (mobile/PWA)
        try {
          console.log('[Auth] Checking for redirect result...');
          const redirectUser = await handleGoogleRedirectResult();
          if (redirectUser && mounted) {
            console.log('[Auth] Redirect user found, setting up auth state listener');
          }
        } catch (redirectErr) {
          console.error('[Auth] Redirect result error:', redirectErr.code, redirectErr.message);
          if (mounted) setAuthLoading(false);
        }

        if (!mounted) return;

        // Set up auth state listener
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          console.count('[Auth] onAuthStateChanged callback');
          console.log('[Auth] auth state changed:', firebaseUser ? firebaseUser.uid.slice(0, 8) : 'null');
          if (mounted) {
            setUser(firebaseUser);
            await loadProfile(firebaseUser);
            setAuthLoading(false);
            const elapsed = performance.now() - startTime;
            console.log(`[Auth] restore session: ${elapsed.toFixed(2)}ms`);
          }
        }, (err) => {
          console.error('[Auth] onAuthStateChanged error:', err);
          if (mounted) setAuthLoading(false);
        });
      } catch (err) {
        console.error('[Auth] setupAuth error:', err);
        if (mounted) setAuthLoading(false);
      }
    };

    setupAuth();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [loadProfile]);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 9000);
    return () => clearTimeout(splashTimer);
  }, []);

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
    showSplash,
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
