import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ClientsScreen from '../screens/coach/ClientsScreen';
import ClientProgressScreen from '../screens/coach/ClientProgressScreen';
import CoachClientAssessmentScreen from '../screens/coach/CoachClientAssessmentScreen';
import CoachTrainingProgramScreen from '../screens/coach/CoachTrainingProgramScreen';

const Stack = createStackNavigator();

export default function CoachClientsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Clients" component={ClientsScreen} />
      <Stack.Screen name="ClientProgress" component={ClientProgressScreen} />
      <Stack.Screen name="CoachClientAssessment" component={CoachClientAssessmentScreen} />
      <Stack.Screen name="CoachTrainingProgram" component={CoachTrainingProgramScreen} />
    </Stack.Navigator>
  );
}
