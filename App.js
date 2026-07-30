import 'react-native-gesture-handler'; // must be first import
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { doc, getDoc } from 'firebase/firestore';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { colors, gradients, dark } from './src/theme/colors';
import { db } from './src/config/firebase';

import AuthNavigator from './src/navigation/AuthNavigator';
import ClientNavigator from './src/navigation/ClientNavigator';
import CoachNavigator from './src/navigation/CoachNavigator';
import PendingApprovalScreen from './src/screens/auth/PendingApprovalScreen';
import RejectedScreen from './src/screens/auth/RejectedScreen';
import WaiverFormModal from './src/screens/shared/WaiverFormModal';

const FALLBACK_TERMS_VERSION = '1.1';

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
  const [termsVersion, setTermsVersion] = useState(null);
  const [agreedVersion, setAgreedVersion] = useState(null);
  const [termsChecked, setTermsChecked] = useState(false);

  // Register push token once user is authenticated
  usePushNotifications();

  // Dead-end guard: Firebase has a user but we have no role/status after
  // loading finished — ghost account. Sign out so login screen shows.
  //
  // This runs on a short delay rather than immediately: `loading` can flip
  // to false in a separate render from the one that sets `role`/`status`
  // (state updates that resume across a native module bridge — e.g. right
  // after Google Sign-In — aren't always batched together by React Native).
  // Firing instantly on that gap would wrongly treat a still-loading,
  // perfectly valid session as a ghost account and silently sign it back
  // out to the login screen. A real ghost account still has no role/status
  // a couple seconds later, so the delay costs nothing but removes the race.
  useEffect(() => {
    if (!(!loading && user && role !== 'coach' && !status)) return;
    const t = setTimeout(() => {
      logOut();
    }, 2500);
    return () => clearTimeout(t);
  }, [loading, user, role, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check whether the client has agreed to the current terms version.
  // Coaches are skipped — they author the terms.
  useEffect(() => {
    if (loading || !user || role === 'coach' || status !== 'approved') {
      setTermsChecked(true);
      return;
    }
    let cancelled = false;
    async function checkTerms() {
      try {
        const [termsSnap, userSnap] = await Promise.all([
          getDoc(doc(db, 'settings', 'terms')),
          getDoc(doc(db, 'users', user.uid)),
        ]);
        if (cancelled) return;
        const required = termsSnap.exists() ? termsSnap.data().version : FALLBACK_TERMS_VERSION;
        const agreed = userSnap.exists() ? (userSnap.data().agreedTermsVersion ?? null) : null;
        setTermsVersion(required);
        setAgreedVersion(agreed);
      } catch {
        // Network error — fail open so the app isn't permanently blocked
        setTermsVersion(FALLBACK_TERMS_VERSION);
        setAgreedVersion(FALLBACK_TERMS_VERSION);
      } finally {
        if (!cancelled) setTermsChecked(true);
      }
    }
    setTermsChecked(false);
    checkTerms();
    return () => { cancelled = true; };
  }, [user?.uid, role, status, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <KJLoadingScreen />;
  if (!user) return <AuthNavigator />;
  if (role === 'coach') return <CoachNavigator />;
  if (status === 'pending') return <PendingApprovalScreen />;
  if (status === 'rejected') return <RejectedScreen />;

  if (status === 'approved') {
    if (!termsChecked) return <KJLoadingScreen />;
    const needsTerms = agreedVersion !== termsVersion;
    return (
      <>
        <ClientNavigator />
        <WaiverFormModal
          visible={needsTerms}
          version={termsVersion || FALLBACK_TERMS_VERSION}
          onAccepted={() => setAgreedVersion(termsVersion)}
          onDeclined={logOut}
        />
      </>
    );
  }

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
      <StatusBar style="dark" backgroundColor={colors.background} />
      <LanguageProvider>
        <AuthProvider>
          <NavigationContainer ref={navigationRef} theme={KJTheme}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

// ── KJ branded loading screen ─────────────────────────────────────────────────
function KJLoadingScreen() {
  return (
    <View style={styles.loading}>
      <View style={styles.loadingCenter}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoSquare}
        >
          <Text style={styles.logoText} allowFontScaling={false}>KJ</Text>
        </LinearGradient>
        <Text style={styles.byline} allowFontScaling={false}>BY PAPPO STUDIOS</Text>
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={styles.loadingSpinner}
        />
      </View>
      <Text style={styles.buildStamp} allowFontScaling={false}>
        {Updates.isEmbeddedLaunch ? 'build (embedded)' : `update ${Updates.updateId?.slice(0, 8) ?? '—'}`}
      </Text>
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
  loadingCenter: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoSquare: {
    width: 116, height: 116, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'visible',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 12,
  },
  // Note: this screen renders WHILE custom fonts are still loading
  // (it's shown specifically during the `!fontsLoaded` gate in App.js),
  // so it must never reference a custom fontFamily — Sora/JetBrainsMono
  // aren't registered yet at that point, which corrupts Android's text
  // layout and silently drops characters. System font only, ever.
  logoText: {
    fontSize: 52,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  byline: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginTop: 22,
    textAlign: 'center',
  },
  loadingSpinner: {
    marginTop: 24,
  },
  buildStamp: {
    position: 'absolute',
    bottom: 20,
    fontSize: 10,
    color: dark.line,
  },
});
