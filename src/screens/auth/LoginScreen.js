import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

// Required for expo-auth-session to close the browser after OAuth
WebBrowser.maybeCompleteAuthSession();

// ── Get this from: Firebase Console → Authentication → Sign-in method
//    → Google → Web SDK configuration → Web client ID
const GOOGLE_WEB_CLIENT_ID = 'YOUR_GOOG525333297888-d1h242a2i5dvj4tag6ib924oc0s836rh.apps.googleusercontent.comLE_WEB_CLIENT_ID';

export default function LoginScreen({ navigation }) {
  const { signIn, signInWithGoogle, error, setError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Google OAuth request
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  // Handle Google response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      setGoogleLoading(true);
      signInWithGoogle(id_token).finally(() => setGoogleLoading(false));
    } else if (response?.type === 'error') {
      setError('שגיאה בהתחברות עם Google. נסה שוב.');
      setGoogleLoading(false);
    }
  }, [response]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('נא להזין אימייל וסיסמה.');
      return;
    }
    setSigningIn(true);
    try {
      await signIn(email, password);
    } catch {
      // error set in context
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogle = () => {
    setError(null);
    setGoogleLoading(true);
    promptAsync();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header */}
        <LinearGradient colors={gradients.hero} style={styles.header}>
          <View style={styles.logoContainer}>
            <LinearGradient colors={gradients.primary} style={styles.logoBadge}>
              <Text style={styles.logoText}>KJ</Text>
            </LinearGradient>
            <Text style={styles.appName}>KJ Fitness</Text>
            <Text style={styles.tagline}>אימון אישי • תזונה • ליווי מקצועי</Text>
          </View>
        </LinearGradient>

        {/* Login card */}
        <View style={styles.card}>
          <Text style={styles.title}>כניסה לאפליקציה</Text>

          {/* ── Google Sign-In ── */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogle}
            disabled={!request || googleLoading || signingIn}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleText}>המשך עם Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>או</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>אימייל</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(null); }}
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
          <View style={styles.inputGroup}>
            <Text style={styles.label}>סיסמה</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(null); }}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Sign in button */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={signingIn || googleLoading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={gradients.primary} style={styles.loginGradient}>
              {signingIn ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>כניסה</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Forgot password */}
          <TouchableOpacity
            style={styles.forgotButton}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotText}>שכחתי סיסמה</Text>
          </TouchableOpacity>
        </View>

        {/* Sign up link */}
        <TouchableOpacity
          style={styles.signUpLink}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={styles.signUpText}>
            לקוח חדש?{' '}
            <Text style={styles.signUpBold}>בקש גישה לאפליקציה</Text>
          </Text>
        </TouchableOpacity>

        <Text style={styles.footer}>KJ Fitness © 2025</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },

  header: {
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoContainer: { alignItems: 'center', gap: 10 },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
  },
  logoText: { ...typography.h1, color: '#fff', fontSize: 32 },
  appName: { ...typography.h2, color: colors.textPrimary },
  tagline: { ...typography.bodySmall, color: colors.textSecondary },

  card: {
    margin: 20,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
    gap: 16,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },

  // Google button
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4285F4',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
  },
  googleText: {
    ...typography.button,
    color: '#3c3c3c',
    fontSize: 15,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // Inputs
  inputGroup: { gap: 6 },
  label: { ...typography.label, color: colors.textSecondary },
  input: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: colors.textPrimary,
    ...typography.body,
    textAlign: 'right',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderRightWidth: 0,
  },
  eyeButton: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  eyeText: { fontSize: 16 },

  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    backgroundColor: 'rgba(244,67,54,0.1)',
    borderRadius: 8,
    padding: 10,
  },

  loginButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  loginGradient: { paddingVertical: 16, alignItems: 'center' },
  loginButtonText: { ...typography.button, color: '#fff', fontSize: 17 },

  forgotButton: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { ...typography.bodySmall, color: colors.primary },

  signUpLink: { alignItems: 'center', paddingVertical: 12 },
  signUpText: { ...typography.bodySmall, color: colors.textSecondary },
  signUpBold: { color: colors.primary, fontWeight: '700' },

  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingBottom: 30,
    paddingTop: 4,
  },
});
