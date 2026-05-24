// Firebase configuration — shared with KJ Fitness website (kj-fitness-80723)
import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBJDYiwXugrAaoOvoeuExHn_mMNgxN3Kpg',
  authDomain: 'kj-fitness-80723.firebaseapp.com',
  projectId: 'kj-fitness-80723',
  storageBucket: 'kj-fitness-80723.firebasestorage.app',
  messagingSenderId: '525333297888',
  appId: '1:525333297888:web:7246851d44b70d9904ee85',
};

// Prevent duplicate initialization on Expo fast refresh
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Auth — persists login between sessions using AsyncStorage
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Already initialized (fast refresh)
  auth = getAuth(app);
}
export { auth };

// Firestore — experimentalForceLongPolling fixes WebSocket hangs in React Native
// Without this, setDoc/getDoc can block forever waiting for server confirmation.
let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  // Already initialized (fast refresh)
  db = getFirestore(app);
}
export { db };

// Storage — media uploads
export const storage = getStorage(app);

export default app;
