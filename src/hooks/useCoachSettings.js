/**
 * useCoachSettings
 *
 * Fetches the coach's global settings from Firestore (`settings/coach`).
 * Provides:
 *   - bitLink      : string — coach's Bit payment URL (e.g. "https://bit.me/kjfitness")
 *   - sessionPrice : string — default session price displayed to clients (e.g. "180")
 *   - loading      : boolean
 *
 * The document is created / updated from CoachSettingsScreen.
 */

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const DEFAULTS = {
  bitLink: '',
  sessionPrice: '',
};

export function useCoachSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, 'settings', 'coach');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULTS, ...snap.data() });
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return { settings, loading };
}
