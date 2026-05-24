import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';

// Google OAuth client IDs (from Firebase Console / Google Cloud Console)
const WEB_CLIENT_ID = '525333297888-d1h242a2i5dvj4tag6ib924oc0s836rh.apps.googleusercontent.com';

// Configure native Google Sign-In once at module level
GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  offlineAccess: true,
});

export default function LoginScreen({ navigation }) {
  const { signIn, signInWithGoogle, error, setError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleGooglePress = async () => {
    if (!GoogleSignin) {
      Alert.alert('Google Sign-In', 'Google Sign-In requires a native build.\nUse email + password to log in for now.');
      return;
    }
    setError && setError(null);
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signOut(); // clear cached account so picker always shows
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo?.data?.idToken ?? userInfo?.idToken ?? null;
      if (!idToken) return; // cancelled or no token — just stop silently
      await signInWithGoogle(idToken, null);
    } catch (e) {
      if (e.code !== statusCodes.SIGN_IN_CANCELLED) {
        setError && setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError && setError('Please enter your email and password.');
      return;
    }
    setSigningIn(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      // error set inside context
    } finally {
      setSigningIn(false);
    }
  };

  const busy = signingIn || googleLoading;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero block */}
        <View style={styles.hero}>
          <LinearGradient
            colors={['rgba(229,57,53,0.18)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['transparent', 'rgba(28,20,18,0.8)', dark.bg0]}
            style={StyleSheet.absoluteFillObject}
            locations={[0.3, 0.7, 1]}
          />
          {/* Logo top-left */}
          <View style={styles.heroLogo}>
            <LinearGradient colors={gradients.primary} style={styles.logoBadge}>
              <Ionicons name="flash" size={18} color={colors.accentInk} />
            </LinearGradient>
            <Text style={styles.logoWordmark}>KJ FITNESS</Text>
          </View>
        </View>

        {/* Form area */}
        <View style={styles.form}>
          <Text style={styles.eyebrow}>Welcome to KJ Fitness</Text>
          <Text style={styles.tagline}>Coached. Not programmed.</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => { setEmail(t); setError && setError(null); }}
              placeholder="your@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={(t) => { setPassword(t); setError && setError(null); }}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot */}
          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => navigation?.navigate('ForgotPassword')}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={{ height: 28 }} />

          {/* Login button */}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={busy}
            activeOpacity={0.85}
          >
            <LinearGradient colors={gradients.primary} style={styles.loginGradient}>
              {signingIn
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.loginBtnText}>Log in</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign-In — uses expo-auth-session, works in Expo Go */}
          <TouchableOpacity
            style={[styles.googleBtn, busy && { opacity: 0.6 }]}
            onPress={handleGooglePress}
            disabled={busy}
            activeOpacity={0.85}
          >
            {googleLoading
              ? <ActivityIndicator color="#333" />
              : <>
                  <Text style={styles.googleG}>G</Text>
                  <Text style={styles.googleText}>Continue with Google</Text>
                </>
            }
          </TouchableOpacity>

          {/* Sign up */}
          <TouchableOpacity
            style={styles.signUpLink}
            onPress={() => navigation?.navigate('SignUp')}
            activeOpacity={0.7}
          >
            <Text style={styles.signUpText}>
              New client?{'  '}
              <Text style={styles.signUpAccent}>Request access</Text>
            </Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            By signing in you accept the{' '}
            <Text style={{ color: colors.textSecondary, textDecorationLine: 'underline' }}>
              liability waiver
            </Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dark.bg0 },
  scroll: { flexGrow: 1 },

  hero: {
    height: 280,
    backgroundColor: dark.bg1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroLogo: {
    position: 'absolute',
    top: 56,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  logoWordmark: {
    fontFamily: 'Sora-ExtraBold',
    fontSize: 14, letterSpacing: 2.5,
    color: colors.textPrimary,
  },

  form: { flex: 1, padding: 24, paddingBottom: 40 },
  eyebrow: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 10.5, letterSpacing: 1.89, textTransform: 'uppercase',
    color: colors.accent, marginTop: 8,
  },
  tagline: { ...typography.h1, color: colors.textPrimary, marginTop: 10, marginBottom: 28 },

  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase',
    color: colors.textMuted, marginBottom: 6,
  },
  input: {
    height: 52, borderRadius: 12,
    backgroundColor: dark.bg1, borderWidth: 1, borderColor: dark.line,
    color: colors.textPrimary, paddingHorizontal: 14,
    fontFamily: 'Sora-Regular', fontSize: 15,
  },
  passwordRow: { flexDirection: 'row' },
  passwordInput: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    width: 52, height: 52,
    borderTopRightRadius: 12, borderBottomRightRadius: 12,
    backgroundColor: dark.bg1,
    borderWidth: 1, borderLeftWidth: 0, borderColor: dark.line,
    alignItems: 'center', justifyContent: 'center',
  },

  forgotRow: { alignItems: 'flex-end', marginBottom: 4 },
  forgotText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.accent },

  errorBox: { backgroundColor: 'rgba(239,83,80,0.12)', borderRadius: 10, padding: 12, marginTop: 8 },
  errorText: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.error, textAlign: 'center' },

  loginBtn: {
    borderRadius: 14, overflow: 'hidden',
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  loginGradient: { height: 56, alignItems: 'center', justifyContent: 'center' },
  loginBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 16, color: '#fff', letterSpacing: 0.2 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: dark.lineSoft },
  dividerLabel: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted },

  googleBtn: {
    height: 52, borderRadius: 14,
    backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  googleG: {
    fontSize: 18, fontWeight: '800', color: '#4285F4',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
  },
  googleText: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: '#3c3c3c' },

  signUpLink: { alignItems: 'center', paddingVertical: 16 },
  signUpText: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted },
  signUpAccent: { color: colors.accent, fontFamily: 'Sora-SemiBold' },
  legal: {
    fontFamily: 'Sora-Regular', fontSize: 11, color: colors.textMuted,
    textAlign: 'center', lineHeight: 16,
  },
});
