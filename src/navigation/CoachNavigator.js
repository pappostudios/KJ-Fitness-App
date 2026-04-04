import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import CoachHomeScreen from '../screens/coach/CoachHomeScreen';
import ClientRequestsScreen from '../screens/coach/ClientRequestsScreen';
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

  // Live count of pending join requests
  useEffect(() => {
    const q = query(collection(db, 'pendingRequests'));
    const unsub = onSnapshot(q, (snap) => setPendingCount(snap.size));
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
          const showBadge = route.name === 'בקשות' && pendingCount > 0;
          return (
            <View style={styles.iconWrap}>
              <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </Text>
                </View>
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="בית" component={CoachHomeScreen} />
      <Tab.Screen name="לקוחות" component={PlaceholderScreen} />
      <Tab.Screen name="לוח זמנים" component={PlaceholderScreen} />
      <Tab.Screen name="הודעות" component={PlaceholderScreen} />
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
