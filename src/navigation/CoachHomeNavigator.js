import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CoachHomeScreen from '../screens/coach/CoachHomeScreen';
import CoachLibraryScreen from '../screens/coach/CoachLibraryScreen';
import CoachSettingsScreen from '../screens/coach/CoachSettingsScreen';
import CoachWeeklyPlanScreen from '../screens/coach/CoachWeeklyPlanScreen';

const Stack = createStackNavigator();

// Nested stack for the coach home tab:
//   CoachHomeScreen (dashboard)
//     → CoachLibraryScreen (manage content)
//     → CoachSettingsScreen (Bit link + session price)
//     → CoachWeeklyPlanScreen (create & publish weekly plan)
export default function CoachHomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CoachHome" component={CoachHomeScreen} />
      <Stack.Screen name="CoachLibrary" component={CoachLibraryScreen} />
      <Stack.Screen name="CoachSettings" component={CoachSettingsScreen} />
      <Stack.Screen name="CoachWeeklyPlan" component={CoachWeeklyPlanScreen} />
    </Stack.Navigator>
  );
}
