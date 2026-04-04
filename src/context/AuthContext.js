import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// Emails that always get coach access — no approval needed
const COACH_EMAILS = [
  'pappostudios@gmail.com',
  'kjfitness.info@gmail.com',
];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);      // 'coach' | 'client'
  const [status, setStatus] = useState(null);  // 'pending' | 'approved' | 'rejected'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubProfile = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Coaches bypass Firestore check entirely
        if (COACH_EMAILS.includes(firebaseUser.email?.toLowerCase())) {
          setRole('coach');
          setStatus('approved');
          setLoading(false);
          return;
        }

        // Clients — listen to Firestore profile in real time
        // (pending screen auto-unlocks the moment Kirsten approves)
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubProfile = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setProfile(data);
            setRole('client');
            setStatus(data.status);
          }
          setLoading(false);
        });
      } else {
        if (unsubProfile) unsubProfile();
        setUser(null);
        setProfile(null);
        setRole(null);
        setStatus(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // ── Email/password sign up ──────────────────────────────────────────────
  const signUp = async (email, password, name) => {
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
      await _createPendingProfile(credential.user.uid, email.trim().toLowerCase(), name);
    } catch (err) {
      setError(getAuthError(err.code));
      throw err;
    }
  };

  // ── Email/password sign in ──────────────────────────────────────────────
  const signIn = async (email, password) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (err) {
      setError(getAuthError(err.code));
      throw err;
    }
  };

  // ── Google sign in (called from LoginScreen with the id_token) ──────────
  const signInWithGoogle = async (idToken) => {
    setError(null);
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      const { user: googleUser } = result;
      const email = googleUser.email?.toLowerCase();

      // Coaches get straight through — no Firestore needed
      if (COACH_EMAILS.includes(email)) return;

      // Check if this Google user already has a Firestore profile
      const snap = await getDoc(doc(db, 'users', googleUser.uid));
      if (!snap.exists()) {
        // First time — create pending profile
        const name = googleUser.displayName || email.split('@')[0];
        await _createPendingProfile(googleUser.uid, email, name);
      }
      // If profile exists, onAuthStateChanged listener picks it up automatically
    } catch (err) {
      setError(getAuthError(err.code));
      throw err;
    }
  };

  // ── Sign out ────────────────────────────────────────────────────────────
  const logOut = async () => {
    setError(null);
    await signOut(auth);
  };

  // ── Password reset ──────────────────────────────────────────────────────
  const resetPassword = async (email) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    } catch (err) {
      setError(getAuthError(err.code));
      throw err;
    }
  };

  const value = {
    user,
    profile,
    role,
    status,
    loading,
    error,
    setError,
    signUp,
    signIn,
    signInWithGoogle,
    logOut,
    resetPassword,
    isCoach: role === 'coach',
    isClient: role === 'client',
    isApproved: status === 'approved',
    isPending: status === 'pending',
    isRejected: status === 'rejected',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ── Shared helper — writes pending profile + request doc ─────────────────
async function _createPendingProfile(uid, email, name) {
  await setDoc(doc(db, 'users', uid), {
    uid,
    name,
    email,
    role: 'client',
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'pendingRequests', uid), {
    uid,
    name,
    email,
    requestedAt: serverTimestamp(),
  });
}

// ── Firebase error messages (Hebrew) ─────────────────────────────────────
function getAuthError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'כתובת האימייל או הסיסמה שגויים.';
    case 'auth/email-already-in-use':
      return 'כתובת האימייל כבר רשומה. נסה להתחבר.';
    case 'auth/invalid-email':
      return 'כתובת האימייל אינה תקינה.';
    case 'auth/weak-password':
      return 'הסיסמה חלשה מדי. השתמש לפחות ב-6 תווים.';
    case 'auth/too-many-requests':
      return 'יותר מדי ניסיונות. נסה שוב מאוחר יותר.';
    case 'auth/network-request-failed':
      return 'בעיית רשת. בדוק את החיבור לאינטרנט.';
    default:
      return 'שגיאה. נסה שוב.';
  }
}
