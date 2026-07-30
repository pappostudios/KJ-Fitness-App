import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

const COACH_EMAILS = ['pappostudios@gmail.com', 'kjfitness.info@gmail.com'];

// Show banners + play sound when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const { user } = useAuth();
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function registerToken() {
      try {
        // Android 8+ requires a notification channel — without this, background
        // notifications are silently dropped by the OS.
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'KJ Fitness',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#15C2CB',
            sound: 'default',
          });
        }

        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;

        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') return;

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '53c02adf-30fb-45b4-970d-ef07931554ae',
        });

        if (cancelled) return;

        const token = tokenData.data;

        await setDoc(
          doc(db, 'users', user.uid),
          { pushToken: token, pushTokenUpdatedAt: serverTimestamp() },
          { merge: true },
        );

        // Coach token stored in /settings/coachToken so clients can read it
        if (COACH_EMAILS.includes(user.email)) {
          await setDoc(
            doc(db, 'settings', 'coachToken'),
            { pushToken: token, updatedAt: serverTimestamp() },
            { merge: true },
          );
        }
      } catch (e) {
        console.warn('Push registration error:', e.message);
      }
    }

    registerToken();

    return () => { cancelled = true; };
  }, [user?.uid]);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);
}
