import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ScheduleScreen from '../screens/coach/ScheduleScreen';
import ClientProgressScreen from '../screens/coach/ClientProgressScreen';

const Stack = createStackNavigator();

export default function CoachScheduleNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScheduleMain" component={ScheduleScreen} />
      <Stack.Screen name="ClientProgress" component={ClientProgressScreen} />
    </Stack.Navigator>
  );
}
