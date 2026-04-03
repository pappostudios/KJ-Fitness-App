import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme/colors';
import ClientNavigator from './src/navigation/ClientNavigator';

// Custom navigation theme — matches the dark KJ Fitness brand
const KJTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.card,
    text: colors.textPrimary,
    border: colors.cardBorder,
    notification: colors.primary,
  },
};

export default function App() {
  // TODO: Replace with Firebase Auth role check
  // For now, hardcoded to show the client app
  const userRole = 'client'; // will be 'coach' or 'client' from Firebase

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={colors.background} />
      <NavigationContainer theme={KJTheme}>
        {userRole === 'client' ? (
          <ClientNavigator />
        ) : (
          // Coach navigator will go here in the next phase
          <ClientNavigator />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
