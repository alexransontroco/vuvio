import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase.js';
import {
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
  const [user,        setUser]        = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading,     setLoading]     = useState(true);

  const loadProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) { setUserProfile(null); return; }
    try {
      const profile = await getUserProfile(firebaseUser.uid);
      setUserProfile(profile);
    } catch {
      setUserProfile(null);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser);
        await loadProfile(firebaseUser);
        setLoading(false);
      }, () => {
        setLoading(false);
      });
    } catch {
      setLoading(false);
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
    loading,
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
