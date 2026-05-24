import 'react-native-gesture-handler'; // must be first import
import React, { useRef, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { colors, gradients, dark } from './src/theme/colors';

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
    primary:      colors.primary,
    background:   colors.background,
    card:         colors.surface,
    text:         colors.textPrimary,
    border:       colors.border,
    notification: colors.primary,
  },
};

function RootNavigator() {
  const { user, role, status, loading, logOut } = useAuth();

  // Register push token once user is authenticated
  usePushNotifications();

  // Dead-end guard: Firebase has a user but we have no role/status after
  // loading finished. This means a ghost account (Firebase Auth exists but
  // no Firestore profile). Sign out immediately so the login screen shows.
  useEffect(() => {
    if (!loading && user && role !== 'coach' && !status) {
      logOut();
    }
  }, [loading, user, role, status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <KJLoadingScreen />;
  }

  if (!user) return <AuthNavigator />;
  if (role === 'coach') return <CoachNavigator />;
  if (status === 'pending') return <PendingApprovalScreen />;
  if (status === 'rejected') return <RejectedScreen />;
  if (status === 'approved') return <ClientNavigator />;

  // Transitional state while logOut() from the guard above is in-flight.
  return <KJLoadingScreen />;
}

export default function App() {
  const navigationRef = useRef(null);

  // Load custom fonts
  const [fontsLoaded] = useFonts({
    'Sora-Regular':          require('./assets/fonts/Sora-Regular.ttf'),
    'Sora-Medium':           require('./assets/fonts/Sora-Medium.ttf'),
    'Sora-SemiBold':         require('./assets/fonts/Sora-SemiBold.ttf'),
    'Sora-Bold':             require('./assets/fonts/Sora-Bold.ttf'),
    'Sora-ExtraBold':        require('./assets/fonts/Sora-ExtraBold.ttf'),
    'JetBrainsMono-Regular': require('./assets/fonts/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-Medium':  require('./assets/fonts/JetBrainsMono-Medium.ttf'),
  });

  // Hold splash until fonts are ready
  if (!fontsLoaded) {
    return <KJLoadingScreen />;
  }

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

// ── KJ branded loading screen ─────────────────────────────────────────────────
function KJLoadingScreen() {
  return (
    <View style={styles.loading}>
      <LinearGradient colors={gradients.primary} style={styles.loadingBadge}>
        <Ionicons name="flash" size={24} color={colors.accentInk} />
      </LinearGradient>
      <ActivityIndicator
        size="small"
        color={colors.primary}
        style={{ marginTop: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: dark.bg0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBadge: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
  },
});
