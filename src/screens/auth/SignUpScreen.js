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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';

const WEB_CLIENT_ID = '525333297888-d1h242a2i5dvj4tag6ib924oc0s836rh.apps.googleusercontent.com';

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  offlineAccess: true,
});

export default function SignUpScreen({ navigation }) {
  const { signUp, signInWithGoogle, error, setError } = useAuth();
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGooglePress = async () => {
    setError && setError(null);
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signOut();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo?.data?.idToken ?? userInfo?.idToken ?? null;
      if (!idToken) return;
      await signInWithGoogle(idToken, null, true);
    } catch (e) {
      if (e.code !== statusCodes.SIGN_IN_CANCELLED) {
        const code = e.code ?? 'no code';
        const msg = e.message ?? 'no message';
        Alert.alert(`Google Sign-In Error (code: ${code})`, msg, [{ text: 'OK' }]);
        setError && setError(`Google sign-in failed (code ${code}). Please try again.`);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError && setError(null);
    if (!name.trim()) return setError && setError(t('signup.nameRequired'));
    if (!email.trim()) return setError && setError(t('signup.emailRequired'));
    if (password.length < 6) return setError && setError(t('signup.passwordMinLength'));
    if (password !== confirm) return setError && setError(t('signup.passwordMismatch'));

    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
    } catch {
      // error set in context
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || googleLoading;

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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            <Text style={styles.backText}>{t('signup.back')}</Text>
          </TouchableOpacity>
          <LinearGradient colors={gradients.primary} style={styles.logoBadge}>
            <Ionicons name="flash" size={22} color={colors.accentInk} />
          </LinearGradient>
          <Text style={styles.headerTitle}>{t('signup.title')}</Text>
          <Text style={styles.headerSub}>{t('signup.subtitle')}</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>

          {/* Google */}
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
                  <Text style={styles.googleText}>{t('signup.google')}</Text>
                </>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>{t('signup.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Full name */}
          <Field
            label={t('signup.fullName')}
            value={name}
            onChangeText={(v) => { setName(v); setError && setError(null); }}
            placeholder={t('signup.fullNamePlaceholder')}
            autoCapitalize="words"
          />

          {/* Email */}
          <Field
            label={t('signup.email')}
            value={email}
            onChangeText={(v) => { setEmail(v); setError && setError(null); }}
            placeholder={t('signup.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('signup.password')}</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={(v) => { setPassword(v); setError && setError(null); }}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                returnKeyType="next"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm */}
          <Field
            label={t('signup.confirmPassword')}
            value={confirm}
            onChangeText={(v) => { setConfirm(v); setError && setError(null); }}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            returnKeyType="go"
            onSubmitEditing={handleSignUp}
          />

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="time-outline" size={14} color={colors.accent} />
            <Text style={styles.infoText}>{t('signup.subtitle')}</Text>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSignUp}
            disabled={busy}
            activeOpacity={0.85}
          >
            <LinearGradient colors={gradients.primary} style={styles.submitGradient}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>{t('signup.submit')}</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* Back to login */}
          <TouchableOpacity style={styles.loginLink} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.loginLinkText}>
              {t('signup.alreadyMember')}{'  '}
              <Text style={styles.loginLinkAccent}>{t('signup.loginHere')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, returnKeyType, onSubmitEditing }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        returnKeyType={returnKeyType ?? 'next'}
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dark.bg0 },
  scroll: { flexGrow: 1 },

  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 32, paddingHorizontal: 24 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 28, gap: 4 },
  backText: { fontFamily: 'Sora-Medium', fontSize: 14, color: colors.textPrimary },
  logoBadge: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
  },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 22, color: colors.textPrimary, marginTop: 14 },
  headerSub: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: 'center' },

  card: {
    marginHorizontal: 20, marginBottom: 32,
    backgroundColor: dark.bg1,
    borderRadius: 20, borderWidth: 1, borderColor: dark.lineSoft,
    padding: 24, gap: 16,
  },

  googleBtn: {
    height: 52, borderRadius: 14,
    backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  googleG: { fontSize: 18, fontWeight: '800', color: '#4285F4', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  googleText: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: '#3c3c3c' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: dark.lineSoft },
  dividerLabel: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },

  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontFamily: 'Sora-SemiBold', fontSize: 10,
    letterSpacing: 1.6, textTransform: 'uppercase',
    color: colors.textMuted,
  },
  input: {
    height: 52, borderRadius: 12,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.line,
    color: colors.textPrimary, paddingHorizontal: 14,
    fontFamily: 'Sora-Regular', fontSize: 15,
  },
  passwordRow: { flexDirection: 'row' },
  passwordInput: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    width: 52, height: 52,
    borderTopRightRadius: 12, borderBottomRightRadius: 12,
    backgroundColor: dark.bg2, borderWidth: 1, borderLeftWidth: 0, borderColor: dark.line,
    alignItems: 'center', justifyContent: 'center',
  },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(229,57,53,0.08)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(229,57,53,0.25)',
    padding: 12,
  },
  infoText: { fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textSecondary, flex: 1, lineHeight: 18 },

  errorBox: { backgroundColor: 'rgba(239,83,80,0.12)', borderRadius: 10, padding: 12 },
  errorText: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.error, textAlign: 'center' },

  submitBtn: {
    borderRadius: 14, overflow: 'hidden',
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  submitGradient: { height: 56, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: 'Sora-SemiBold', fontSize: 16, color: '#fff', letterSpacing: 0.2 },

  loginLink: { alignItems: 'center', paddingVertical: 4 },
  loginLinkText: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted },
  loginLinkAccent: { color: colors.accent, fontFamily: 'Sora-SemiBold' },
});
