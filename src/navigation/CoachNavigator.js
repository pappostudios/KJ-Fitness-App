import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import ClientRequestsScreen from '../screens/coach/ClientRequestsScreen';
import CoachScheduleNavigator from './CoachScheduleNavigator';
import CoachMessagesNavigator from './CoachMessagesNavigator';
import CoachClientsNavigator from './CoachClientsNavigator';
import CoachHomeNavigator from './CoachHomeNavigator';
import { colors, dark } from '../theme/colors';
import { typography } from '../theme/typography';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Home',     icon: 'home-outline',         iconFocused: 'home' },
  { name: 'Clients',  icon: 'people-outline',        iconFocused: 'people' },
  { name: 'Schedule', icon: 'calendar-outline',      iconFocused: 'calendar' },
  { name: 'Messages', icon: 'chatbubble-outline',    iconFocused: 'chatbubble' },
  { name: 'Requests', icon: 'notifications-outline', iconFocused: 'notifications' },
];

export default function CoachNavigator() {
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'pendingRequests')), (snap) =>
      setPendingCount(snap.size),
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'conversations')), (snap) => {
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
        tabBarItemStyle: styles.tabItem,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabel: ({ focused, color }) => (
          <Text style={[styles.tabLabel, focused && styles.tabLabelActive, { color }]}>
            {route.name.toUpperCase()}
          </Text>
        ),
        tabBarIcon: ({ focused, color }) => {
          const tab = TABS.find((t) => t.name === route.name);
          const iconName = focused ? tab?.iconFocused : tab?.icon;
          const showBadge =
            (route.name === 'Requests' && pendingCount > 0) ||
            (route.name === 'Messages' && unreadMessages > 0);
          const badgeCount = route.name === 'Requests' ? pendingCount : unreadMessages;

          return (
            <View style={[styles.iconPill, focused && styles.iconPillActive]}>
              <Ionicons name={iconName || 'ellipse-outline'} size={26} color={color} />
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                </View>
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home"     component={CoachHomeNavigator} />
      <Tab.Screen name="Clients"  component={CoachClientsNavigator} />
      <Tab.Screen name="Schedule" component={CoachScheduleNavigator} />
      <Tab.Screen name="Messages" component={CoachMessagesNavigator} />
      <Tab.Screen name="Requests" component={ClientRequestsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: dark.bg1,
    borderTopColor: dark.line,
    borderTopWidth: 1,
    paddingTop: 10,
    height: 76,
    paddingBottom: 12,
  },
  tabItem: {
    paddingTop: 2,
  },
  tabLabel: {
    fontFamily: 'Sora-Bold',
    fontSize: 9.5,
    letterSpacing: 0.4,
    marginTop: 4,
  },
  tabLabelActive: {
    fontFamily: 'Sora-ExtraBold',
  },
  iconPill: {
    width: 56,
    height: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: colors.primarySoft,
  },
  badge: {
    position: 'absolute',
    top: -2, right: 6,
    backgroundColor: colors.error,
    borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: 'Sora-Bold', fontSize: 9, color: '#fff' },
});
