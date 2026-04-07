import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/client/HomeScreen';
import ClientProfileScreen from '../screens/client/ClientProfileScreen';
import WeeklyPlansHistoryScreen from '../screens/client/WeeklyPlansHistoryScreen';

const Stack = createStackNavigator();

export default function ClientHomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientHome" component={HomeScreen} />
      <Stack.Screen name="Profile" component={ClientProfileScreen} />
      <Stack.Screen name="PlansHistory" component={WeeklyPlansHistoryScreen} />
    </Stack.Navigator>
  );
}
