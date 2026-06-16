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
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => {
          const tab = TABS.find((t) => t.name === route.name);
          const iconName = focused ? tab?.iconFocused : tab?.icon;
          const showBadge =
            (route.name === 'Requests' && pendingCount > 0) ||
            (route.name === 'Messages' && unreadMessages > 0);
          const badgeCount = route.name === 'Requests' ? pendingCount : unreadMessages;

          return (
            <View style={styles.iconWrap}>
              <Ionicons name={iconName || 'ellipse-outline'} size={22} color={color} />
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
    paddingTop: 8,
    height: 70,
    paddingBottom: 12,
  },
  tabLabel: {
    fontFamily: 'Sora-SemiBold',
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
    top: -4, right: -10,
    backgroundColor: colors.error,
    borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: 'Sora-Bold', fontSize: 9, color: '#fff' },
});
