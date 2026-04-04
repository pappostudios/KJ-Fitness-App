import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors } from './src/theme/colors';

import AuthNavigator from './src/navigation/AuthNavigator';
import ClientNavigator from './src/navigation/ClientNavigator';
import CoachNavigator from './src/navigation/CoachNavigator';
import PendingApprovalScreen from './src/screens/auth/PendingApprovalScreen';
import RejectedScreen from './src/screens/auth/RejectedScreen';

// Navigation theme — dark KJ Fitness brand
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

function RootNavigator() {
  const { user, role, status, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Not logged in
  if (!user) return <AuthNavigator />;

  // Coach
  if (role === 'coach') return <CoachNavigator />;

  // Client — check approval status
  if (status === 'pending') return <PendingApprovalScreen />;
  if (status === 'rejected') return <RejectedScreen />;
  if (status === 'approved') return <ClientNavigator />;

  // Fallback (status still loading from Firestore)
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={colors.background} />
      <AuthProvider>
        <NavigationContainer theme={KJTheme}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
