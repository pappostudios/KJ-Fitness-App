import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CoachHomeScreen from '../screens/coach/CoachHomeScreen';
import CoachLibraryScreen from '../screens/coach/CoachLibraryScreen';
import CoachSettingsScreen from '../screens/coach/CoachSettingsScreen';
import CoachWeeklyPlanScreen from '../screens/coach/CoachWeeklyPlanScreen';
import CoachProfileScreen from '../screens/coach/CoachProfileScreen';

const Stack = createStackNavigator();

export default function CoachHomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CoachHome"       component={CoachHomeScreen} />
      <Stack.Screen name="CoachLibrary"    component={CoachLibraryScreen} />
      <Stack.Screen name="CoachSettings"   component={CoachSettingsScreen} />
      <Stack.Screen name="CoachWeeklyPlan" component={CoachWeeklyPlanScreen} />
      <Stack.Screen name="CoachProfile"    component={CoachProfileScreen} />
    </Stack.Navigator>
  );
}
