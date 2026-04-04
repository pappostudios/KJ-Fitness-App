// Firebase configuration — shared with KJ Fitness website (kj-fitness-80723)
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBJDYiwXugrAaoOvoeuExHn_mMNgxN3Kpg',
  authDomain: 'kj-fitness-80723.firebaseapp.com',
  projectId: 'kj-fitness-80723',
  storageBucket: 'kj-fitness-80723.firebasestorage.app',
  messagingSenderId: '525333297888',
  appId: '1:525333297888:web:7246851d44b70d9904ee85',
};

// Prevent duplicate initialization (important in Expo fast refresh)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Auth
export const auth = getAuth(app);

// Firestore — client/session/schedule data
export const db = getFirestore(app);

// Storage — media uploads
export const storage = getStorage(app);

export default app;
