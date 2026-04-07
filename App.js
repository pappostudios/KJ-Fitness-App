import 'react-native-gesture-handler'; // must be first import
import React, { useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { usePushNotifications } from './src/hooks/usePushNotifications';
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

  // Register push token once user is authenticated
  usePushNotifications();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) return <AuthNavigator />;
  if (role === 'coach') return <CoachNavigator />;
  if (status === 'pending') return <PendingApprovalScreen />;
  if (status === 'rejected') return <RejectedScreen />;
  if (status === 'approved') return <ClientNavigator />;

  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function App() {
  const navigationRef = useRef(null);

  // Notification tap handler disabled for Expo Go (expo-notifications removed in SDK 53+).
  // Re-enable when using a dev/production build.

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={colors.background} />
      <AuthProvider>
        <NavigationContainer ref={navigationRef} theme={KJTheme}>
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
