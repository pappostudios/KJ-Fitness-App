import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

import ClientHomeNavigator from './ClientHomeNavigator';
import ClientScheduleScreen from '../screens/client/ClientScheduleScreen';
import ProgressNavigator from './ProgressNavigator';
import LibraryScreen from '../screens/client/LibraryScreen';
import MessagesScreen from '../screens/client/MessagesScreen';
import { useSessionReminders } from '../hooks/useSessionReminders';

const Tab = createBottomTabNavigator();

const TABS = [
  {
    name: 'Home',
    component: ClientHomeNavigator,
    icon: 'home',
    iconOutline: 'home-outline',
    label: 'HOME',
  },
  {
    name: 'Schedule',
    component: ClientScheduleScreen,
    icon: 'calendar',
    iconOutline: 'calendar-outline',
    label: 'SCHEDULE',
  },
  {
    name: 'Progress',
    component: ProgressNavigator,
    icon: 'stats-chart',
    iconOutline: 'stats-chart-outline',
    label: 'PROGRESS',
  },
  {
    name: 'Library',
    component: LibraryScreen,
    icon: 'play-circle',
    iconOutline: 'play-circle-outline',
    label: 'LIBRARY',
  },
  {
    name: 'Messages',
    component: MessagesScreen,
    icon: 'chatbubble-ellipses',
    iconOutline: 'chatbubble-ellipses-outline',
    label: 'CHAT',
  },
];

export default function ClientNavigator() {
  // Schedule on-device 24h/1h reminders for confirmed sessions (clients only).
  useSessionReminders();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tab = TABS.find((t) => t.name === route.name);
        return {
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarShowLabel: true,
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.iconPill, focused && styles.iconPillActive]}>
              <Ionicons
                name={focused ? tab.icon : tab.iconOutline}
                size={26}
                color={color}
              />
            </View>
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive, { color }]}>
              {tab.label}
            </Text>
          ),
          tabBarBadge: tab?.badge || undefined,
          tabBarBadgeStyle: styles.badge,
        };
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.tabBar,
    borderTopColor: colors.tabBarBorder,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 26 : 12,
    height: Platform.OS === 'ios' ? 90 : 70,
  },
  tabItem: {
    paddingTop: 2,
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
  tabLabel: {
    fontFamily: 'Sora-Bold',
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  tabLabelActive: {
    fontFamily: 'Sora-ExtraBold',
  },
  badge: {
    backgroundColor: colors.primary,
    color: '#04282B',
    fontSize: 10,
    fontFamily: 'Sora-Bold',
  },
});
