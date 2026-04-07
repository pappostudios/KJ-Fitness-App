import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ClientsScreen from '../screens/coach/ClientsScreen';
import ClientProgressScreen from '../screens/coach/ClientProgressScreen';

const Stack = createStackNavigator();

// Nested stack for the coach clients tab:
//   ClientsScreen (list) → ClientProgressScreen (individual client detail)
export default function CoachClientsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Clients" component={ClientsScreen} />
      <Stack.Screen name="ClientProgress" component={ClientProgressScreen} />
    </Stack.Navigator>
  );
}
