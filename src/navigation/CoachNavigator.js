import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import ClientRequestsScreen from '../screens/coach/ClientRequestsScreen';
import ScheduleScreen from '../screens/coach/ScheduleScreen';
import CoachMessagesNavigator from './CoachMessagesNavigator';
import CoachClientsNavigator from './CoachClientsNavigator';
import CoachHomeNavigator from './CoachHomeNavigator';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const Tab = createBottomTabNavigator();

// Placeholder screens
function PlaceholderScreen({ route }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>🔧</Text>
      <Text style={styles.placeholderText}>{route.name} — בקרוב</Text>
    </View>
  );
}

const ICONS = {
  'בית': '🏠',
  'לקוחות': '👥',
  'לוח זמנים': '📅',
  'הודעות': '💬',
  'בקשות': '🔔',
};

export default function CoachNavigator() {
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Live count of pending join requests
  useEffect(() => {
    const q = query(collection(db, 'pendingRequests'));
    const unsub = onSnapshot(q, (snap) => setPendingCount(snap.size));
    return unsub;
  }, []);

  // Live total of unread messages across all conversations
  useEffect(() => {
    const q = query(collection(db, 'conversations'));
    const unsub = onSnapshot(q, (snap) => {
      const total = snap.docs.reduce((sum, d) => sum + (d.data().unreadByCoach ?? 0), 0);
      setUnreadMessages(total);
    });
    return unsub;
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => {
          const icon = ICONS[route.name] ?? '📌';
          const showBadge =
            (route.name === 'בקשות' && pendingCount > 0) ||
            (route.name === 'הודעות' && unreadMessages > 0);
          const badgeCount =
            route.name === 'בקשות' ? pendingCount : unreadMessages;
          return (
            <View style={styles.iconWrap}>
              <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Text>
                </View>
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="בית" component={CoachHomeNavigator} />
      <Tab.Screen name="לקוחות" component={CoachClientsNavigator} />
      <Tab.Screen name="לוח זמנים" component={ScheduleScreen} />
      <Tab.Screen name="הודעות" component={CoachMessagesNavigator} />
      <Tab.Screen name="בקשות" component={ClientRequestsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.tabBar,
    borderTopColor: colors.tabBarBorder,
    borderTopWidth: 1,
    paddingTop: 8,
    height: 70,
    paddingBottom: 12,
  },
  tabLabel: {
    ...typography.caption,
    fontSize: 10,
    marginTop: 2,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderIcon: { fontSize: 48 },
  placeholderText: { ...typography.h4, color: colors.textSecondary },
});
