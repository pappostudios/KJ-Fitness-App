import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const STORE_KEY = 'kj_session_reminder_ids';

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Schedules on-device local notifications 24h and 1h before each confirmed
 * session. No backend — the phone fires them. On every change to the client's
 * confirmed bookings we cancel the previously-scheduled reminders and
 * reschedule from scratch (idempotent, avoids drift).
 */
export function useSessionReminders() {
  const { user, role, status } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    // Clients only, once approved.
    if (!user || role === 'coach' || status !== 'approved') return;

    const today = toISO(new Date());
    const q = query(
      collection(db, 'bookings'),
      where('clientId', '==', user.uid),
      where('date', '>=', today),
      where('status', '==', 'confirmed'),
      orderBy('date'),
      orderBy('time'),
    );

    const unsub = onSnapshot(q, async (snap) => {
      try {
        const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        await syncReminders(bookings, t);
      } catch (e) {
        console.warn('[reminders] sync error:', e.message);
      }
    }, (err) => console.warn('[reminders] listener:', err.code));

    return unsub;
  }, [user?.uid, role, status]); // eslint-disable-line react-hooks/exhaustive-deps
}

async function syncReminders(bookings, t) {
  // 1. Cancel everything we scheduled last time.
  try {
    const prev = JSON.parse((await AsyncStorage.getItem(STORE_KEY)) || '[]');
    await Promise.all(prev.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  } catch { /* ignore */ }

  // 2. Schedule fresh reminders for each upcoming confirmed session.
  const now = Date.now();
  const newIds = [];

  for (const b of bookings) {
    if (!b.date || !b.time) continue;
    const sessionAt = new Date(`${b.date}T${b.time}:00`);
    if (isNaN(sessionAt.getTime())) continue;

    const targets = [
      { offsetMs: 24 * 60 * 60 * 1000, body: t('reminders.body24h', { time: b.time }) },
      { offsetMs: 60 * 60 * 1000, body: t('reminders.body1h', { time: b.time }) },
    ];

    for (const target of targets) {
      const fireAt = new Date(sessionAt.getTime() - target.offsetMs);
      if (fireAt.getTime() <= now + 60 * 1000) continue; // skip past / too-soon
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: t('reminders.title'),
            body: target.body,
            sound: 'default',
            data: { screen: 'Schedule', bookingId: b.id },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
        });
        newIds.push(id);
      } catch { /* ignore individual failures */ }
    }
  }

  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(newIds));
}
