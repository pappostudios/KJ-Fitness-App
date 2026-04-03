import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

import HomeScreen from '../screens/client/HomeScreen';
import BookScreen from '../screens/client/BookScreen';
import ProgressScreen from '../screens/client/ProgressScreen';
import LibraryScreen from '../screens/client/LibraryScreen';
import MessagesScreen from '../screens/client/MessagesScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  {
    name: 'Home',
    component: HomeScreen,
    icon: 'home',
    iconOutline: 'home-outline',
    label: 'Home',
  },
  {
    name: 'Book',
    component: BookScreen,
    icon: 'calendar',
    iconOutline: 'calendar-outline',
    label: 'Book',
  },
  {
    name: 'Progress',
    component: ProgressScreen,
    icon: 'stats-chart',
    iconOutline: 'stats-chart-outline',
    label: 'Progress',
  },
  {
    name: 'Library',
    component: LibraryScreen,
    icon: 'play-circle',
    iconOutline: 'play-circle-outline',
    label: 'Library',
  },
  {
    name: 'Messages',
    component: MessagesScreen,
    icon: 'chatbubble-ellipses',
    iconOutline: 'chatbubble-ellipses-outline',
    label: 'Chat',
    badge: 2, // Unread messages count — will come from Firebase later
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
    ...typography.caption,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.primary,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
