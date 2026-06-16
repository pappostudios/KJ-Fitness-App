import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

import ClientHomeNavigator from './ClientHomeNavigator';
import ClientScheduleScreen from '../screens/client/ClientScheduleScreen';
import ProgressScreen from '../screens/client/ProgressScreen';
import LibraryScreen from '../screens/client/LibraryScreen';
import MessagesScreen from '../screens/client/MessagesScreen';

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
    component: ProgressScreen,
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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tab = TABS.find((t) => t.name === route.name);
        return {
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarShowLabel: true,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? tab.icon : tab.iconOutline}
              size={22}
              color={color}
            />
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
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
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    height: Platform.OS === 'ios' ? 82 : 62,
  },
  tabLabel: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  badge: {
    backgroundColor: colors.primary,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
