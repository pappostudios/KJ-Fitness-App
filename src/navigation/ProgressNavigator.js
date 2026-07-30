import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProgressScreen from '../screens/client/ProgressScreen';
import LogWorkoutScreen from '../screens/client/LogWorkoutScreen';
import ClientWorkoutHistoryScreen from '../screens/client/ClientWorkoutHistoryScreen';

const Stack = createStackNavigator();

// Wraps the Progress tab in its own stack so pushing the workout-history or
// log-workout screens keeps the back button returning to Progress (not Home).
export default function ProgressNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProgressMain" component={ProgressScreen} />
      <Stack.Screen name="LogWorkout" component={LogWorkoutScreen} />
      <Stack.Screen name="ClientWorkoutHistory" component={ClientWorkoutHistoryScreen} />
    </Stack.Navigator>
  );
}
