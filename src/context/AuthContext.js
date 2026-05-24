import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // When a sign-in method is running, skip onAuthStateChanged so they don't race.
  const skipAuthHandlerRef = useRef(false);
  // Holds the active Firestore unsub so we can clean it up from anywhere.
  const unsubProfileRef = useRef(null);

  // ── Safe sign-out helper ─────────────────────────────────────────────────
  // Resets all local state AND signs out of Firebase.
  const _signOutAndReset = () => {
    if (unsubProfileRef.current) {
      unsubProfileRef.current();
      unsubProfileRef.current = null;
    }
    setUser(null);
    setProfile(null);
    setRole(null);
    setStatus(null);
    setLoading(false);
    signOut(auth).catch(() => {});
  };

  // ── Subscribe to Firestore profile in real time ──────────────────────────
  function _subscribeToProfile(uid) {
    if (unsubProfileRef.current) {
      unsubProfileRef.current();
      unsubProfileRef.current = null;
    }

    // Safety net: if Firestore never responds, sign out after 12 s
    const safetyTimer = setTimeout(() => {
      console.warn('[KJAuth] Profile load timed out — signing out');
      if (!skipAuthHandlerRef.current) _signOutAndReset();
      else setLoading(false); // during active sign-in, just unblock
    }, 12000);

    unsubProfileRef.current = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          clearTimeout(safetyTimer);
          const data = snap.data();
          setProfile(data);
          setRole('client');
          setStatus(data.status);
          setLoading(false);
        } else if (!snap.metadata.fromCache) {
          // Server confirmed: no Firestore profile.
          // This is a ghost Firebase Auth account (failed sign-up in a previous session).
          // Sign out completely so the user lands on the login screen.
          clearTimeout(safetyTimer);
          console.warn('[KJAuth] No profile found — signing out ghost account');
          if (!skipAuthHandlerRef.current) {
            _signOutAndReset();
          }
          // If skipAuthHandlerRef is true a sign-in method is handling it — leave it alone.
        }
        // fromCache + no doc: wait for server confirmation (don't act yet).
      },
      (err) => {
        clearTimeout(safetyTimer);
        console.warn('[KJAuth] Profile snapshot error:', err.code);
        if (!skipAuthHandlerRef.current) setLoading(false);
      }
    );
  }

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // A sign-in method is running and owns all state updates — back off.
      if (skipAuthHandlerRef.current) return;

      if (firebaseUser) {
        setUser(firebaseUser);

        // Coaches bypass Firestore entirely
        if (COACH_EMAILS.includes(firebaseUser.email?.toLowerCase())) {
          setRole('coach');
          setStatus('approved');
          setLoading(false);
          return;
        }

        // App restart: user was already authenticated — subscribe to their profile.
        // If the profile doesn't exist, _subscribeToProfile will sign them out.
        _subscribeToProfile(firebaseUser.uid);
      } else {
        // User signed out — clean up
        if (unsubProfileRef.current) {
          unsubProfileRef.current();
          unsubProfileRef.current = null;
        }
        setUser(null);
        setProfile(null);
        setRole(null);
        setStatus(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfileRef.current) {
        unsubProfileRef.current();
        unsubProfileRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Email/password sign up ──────────────────────────────────────────────
  const signUp = async (email, password, name) => {
    setError(null);
    skipAuthHandlerRef.current = true;
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
      await _createPendingProfile(credential.user.uid, email.trim().toLowerCase(), name);
      setUser(credential.user);
      setProfile({ uid: credential.user.uid, name, email: email.trim().toLowerCase(), role: 'client', status: 'pending' });
      setRole('client');
      setStatus('pending');
      _subscribeToProfile(credential.user.uid);
    } catch (err) {
      setError(getAuthError(err.code));
      throw err;
    } finally {
      skipAuthHandlerRef.current = false;
      setLoading(false);
    }
  };

  // ── Email/password sign in ──────────────────────────────────────────────
  const signIn = async (email, password) => {
    setError(null);
    skipAuthHandlerRef.current = true;
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const firebaseUser = result.user;
      setUser(firebaseUser);

      if (COACH_EMAILS.includes(firebaseUser.email?.toLowerCase())) {
        setRole('coach');
        setStatus('approved');
        return;
      }

      const snap = await _getDocWithTimeout(doc(db, 'users', firebaseUser.uid), 8000);
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setRole('client');
        setStatus(data.status);
      }
      _subscribeToProfile(firebaseUser.uid);
    } catch (err) {
      setError(getAuthError(err.code));
      throw err;
    } finally {
      skipAuthHandlerRef.current = false;
      setLoading(false);
    }
  };

  // ── Google sign in / sign up ─────────────────────────────────────────────
  // createIfNew = false  →  login screen: show error if no account exists
  // createIfNew = true   →  sign-up screen: create pending profile if new
  const signInWithGoogle = async (idToken, accessToken, createIfNew = false) => {
    setError(null);
    skipAuthHandlerRef.current = true;
    setLoading(true);
    try {
      const credential = GoogleAuthProvider.credential(idToken ?? null, accessToken ?? null);
      const { user: googleUser } = await signInWithCredential(auth, credential);
      const email = googleUser.email?.toLowerCase();

      // Coaches get straight through — no Firestore needed
      if (COACH_EMAILS.includes(email)) {
        setUser(googleUser);
        setRole('coach');
        setStatus('approved');
        return;
      }

      // Fetch profile — cache-first so we don't hang on slow networks
      const snap = await _getDocWithTimeout(doc(db, 'users', googleUser.uid), 8000);

      if (!snap.exists() && !createIfNew) {
        // Login attempt but no account found → clean up and tell the user
        await signOut(auth).catch(() => {});
        setError("No account found. Please sign up first.");
        return;
      }

      setUser(googleUser);

      if (!snap.exists()) {
        // Sign-up flow: create pending profile
        const name = googleUser.displayName || email.split('@')[0];
        await _createPendingProfile(googleUser.uid, email, name);
        setProfile({ uid: googleUser.uid, name, email, role: 'client', status: 'pending' });
        setRole('client');
        setStatus('pending');
      } else {
        const data = snap.data();
        setProfile(data);
        setRole('client');
        setStatus(data.status);
      }

      // Subscribe for real-time status updates (e.g. when coach approves)
      _subscribeToProfile(googleUser.uid);
    } catch (err) {
      setError(getAuthError(err.code));
      throw err;
    } finally {
      skipAuthHandlerRef.current = false;
      setLoading(false);
    }
  };

  // ── Sign out ────────────────────────────────────────────────────────────
  const logOut = async () => {
    setError(null);
    _signOutAndReset();
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

// ── getDoc with a timeout so it never hangs forever ───────────────────────
function _getDocWithTimeout(ref, ms) {
  return Promise.race([
    getDoc(ref),
    new Promise((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'app/timeout' })), ms)
    ),
  ]);
}

// ── Firebase error messages ───────────────────────────────────────────────
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
    case 'app/timeout':
      return 'הבקשה ארכה יותר מדי. נסה שוב.';
    default:
      return 'שגיאה. נסה שוב.';
  }
}
