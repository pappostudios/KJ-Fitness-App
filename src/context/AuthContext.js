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
import * as Notifications from 'expo-notifications';
import { auth, db } from '../config/firebase';

const EXPO_PROJECT_ID = '53c02adf-30fb-45b4-970d-ef07931554ae';

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
  // Tracks the 12-second safety timer so a second _subscribeToProfile call can clear it.
  const safetyTimerRef = useRef(null);

  // ── Safe sign-out helper ─────────────────────────────────────────────────
  // Resets all local state AND signs out of Firebase.
  const _signOutAndReset = () => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
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

    // Clear any previous safety timer — prevents the orphaned-timer logout bug
    // that occurs when _subscribeToProfile is called twice in quick succession
    // (once from signIn, once from onAuthStateChanged firing after skipAuthHandlerRef resets).
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }

    // Safety net: if Firestore never responds, sign out after 20 s
    safetyTimerRef.current = setTimeout(() => {
      safetyTimerRef.current = null;
      console.warn('[KJAuth] Profile load timed out — signing out');
      if (!skipAuthHandlerRef.current) _signOutAndReset();
      else setLoading(false); // during active sign-in, just unblock
    }, 20000);

    unsubProfileRef.current = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          clearTimeout(safetyTimerRef.current);
          safetyTimerRef.current = null;
          const data = snap.data();
          setProfile(data);
          setRole('client');
          setStatus(data.status);
          setLoading(false);
        } else if (!snap.metadata.fromCache) {
          // Server confirmed: no Firestore profile.
          // This is a ghost Firebase Auth account (failed sign-up in a previous session).
          // Sign out completely so the user lands on the login screen.
          clearTimeout(safetyTimerRef.current);
          safetyTimerRef.current = null;
          console.warn('[KJAuth] No profile found — signing out ghost account');
          if (!skipAuthHandlerRef.current) {
            _signOutAndReset();
          }
          // If skipAuthHandlerRef is true a sign-in method is handling it — leave it alone.
        }
        // fromCache + no doc: wait for server confirmation (don't act yet).
      },
      (err) => {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
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
  const signUp = async (email, password, name, phone = '') => {
    setError(null);
    skipAuthHandlerRef.current = true;
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
      await _createPendingProfile(credential.user.uid, email.trim().toLowerCase(), name, phone);
      setUser(credential.user);
      setProfile({ uid: credential.user.uid, name, email: email.trim().toLowerCase(), phone, role: 'client', status: 'pending' });
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

      // Firebase Auth has genuinely signed this user in at this point — set
      // `user` immediately so the UI never has a window where it looks
      // logged-out while we're still checking Firestore. (Previously this was
      // set only after the profile fetch below, so a slow/timed-out fetch
      // left `user` null and bounced the screen back to Login even though
      // sign-in had actually succeeded.)
      setUser(googleUser);

      // Coaches get straight through — no Firestore needed
      if (COACH_EMAILS.includes(email)) {
        setRole('coach');
        setStatus('approved');
        return;
      }

      // Fetch profile — cache-first so we don't hang on slow networks.
      // On timeout, don't treat it as failure: fall through to the live
      // listener below, which will populate role/status as soon as it can
      // and has its own longer safety timeout for genuinely missing profiles.
      let snap = null;
      try {
        snap = await _getDocWithTimeout(doc(db, 'users', googleUser.uid), 8000);
      } catch {
        snap = null;
      }

      if (snap && !snap.exists() && !createIfNew) {
        // Login attempt but no account found → clean up and tell the user
        await signOut(auth).catch(() => {});
        setUser(null);
        setError("No account found. Please sign up first.");
        return;
      }

      if (snap && !snap.exists()) {
        // Sign-up flow: create pending profile
        const name = googleUser.displayName || email.split('@')[0];
        await _createPendingProfile(googleUser.uid, email, name);
        setProfile({ uid: googleUser.uid, name, email, role: 'client', status: 'pending' });
        setRole('client');
        setStatus('pending');
      } else if (snap) {
        const data = snap.data();
        setProfile(data);
        setRole('client');
        setStatus(data.status);
      }
      // snap === null means the fetch timed out — role/status stay as-is
      // and the live listener below fills them in once Firestore responds.

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
  // Before dropping auth, unregister THIS device's push token from the account
  // that's logging out. Without this, a device that once logged in as coach
  // stays the coach's notification target even after switching to a client
  // account on the same phone — so messages route back to yourself. Clearing on
  // logout is also correct in production: a signed-out device shouldn't receive
  // that account's pushes.
  const _clearPushTokenOnLogout = async () => {
    const current = auth.currentUser;
    if (!current) return;
    let deviceToken = null;
    try {
      const td = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
      deviceToken = td?.data ?? null;
    } catch {
      // no token available (e.g. permissions/simulator) — still clear the user field below
    }
    try {
      await setDoc(
        doc(db, 'users', current.uid),
        { pushToken: null, pushTokenUpdatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch { /* best-effort */ }

    // Clear the shared coach token only if it belongs to THIS device, so we
    // don't knock out the coach's other phone.
    if (COACH_EMAILS.includes(current.email)) {
      try {
        const snap = await getDoc(doc(db, 'settings', 'coachToken'));
        const stored = snap.data()?.pushToken ?? null;
        if (!deviceToken || stored === deviceToken) {
          await setDoc(
            doc(db, 'settings', 'coachToken'),
            { pushToken: null, updatedAt: serverTimestamp() },
            { merge: true },
          );
        }
      } catch { /* best-effort */ }
    }
  };

  const logOut = async () => {
    setError(null);
    // Cap the token cleanup so a slow network can never block sign-out.
    await Promise.race([
      _clearPushTokenOnLogout(),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
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
async function _createPendingProfile(uid, email, name, phone = '') {
  await setDoc(doc(db, 'users', uid), {
    uid,
    name,
    email,
    phone: phone || null,
    role: 'client',
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'pendingRequests', uid), {
    uid,
    name,
    email,
    phone: phone || null,
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
