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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function SignUpScreen({ navigation }) {
  const { signUp, error, setError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError(null);

    if (!name.trim()) return setError('נא להזין שם מלא.');
    if (!email.trim()) return setError('נא להזין כתובת אימייל.');
    if (password.length < 6) return setError('הסיסמה חייבת להכיל לפחות 6 תווים.');
    if (password !== confirm) return setError('הסיסמאות אינן תואמות.');

    setLoading(true);
    try {
      await signUp(email, password, name.trim());
      // Navigation to PendingApproval happens via auth state in App.js
    } catch {
      // error set in context
    } finally {
      setLoading(false);
    }
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
        {/* Header */}
        <LinearGradient colors={gradients.hero} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← חזרה</Text>
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <LinearGradient colors={gradients.primary} style={styles.logoBadge}>
              <Text style={styles.logoText}>KJ</Text>
            </LinearGradient>
            <Text style={styles.appName}>הצטרפות ל-KJ Fitness</Text>
            <Text style={styles.tagline}>בקשתך תישלח לאישור המאמנת</Text>
          </View>
        </LinearGradient>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.title}>יצירת חשבון</Text>

          {/* Full name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>שם מלא</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(t) => { setName(t); setError(null); }}
              placeholder="ישראל ישראלי"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              returnKeyType="next"
              textAlign="right"
            />
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
                placeholder="לפחות 6 תווים"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                textAlign="right"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>אימות סיסמה</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={(t) => { setConfirm(t); setError(null); }}
              placeholder="הזן סיסמה שוב"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              returnKeyType="go"
              onSubmitEditing={handleSignUp}
              textAlign="right"
            />
          </View>

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>
              ⏳ לאחר ההרשמה, בקשתך תישלח לאישור Kirsten. תקבל גישה לאפליקציה לאחר האישור.
            </Text>
          </View>

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Submit */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={gradients.primary} style={styles.submitGradient}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>שליחת בקשת הצטרפות</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Back to login */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.loginLinkText}>
              כבר יש לך חשבון?{' '}
              <Text style={styles.loginLinkBold}>כניסה</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },

  header: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  backButton: { marginBottom: 16 },
  backText: { ...typography.body, color: colors.primary },
  logoContainer: { alignItems: 'center', gap: 10 },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
  },
  logoText: { ...typography.h1, color: '#fff', fontSize: 28 },
  appName: { ...typography.h3, color: colors.textPrimary },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: { fontSize: 16 },

  infoBanner: {
    backgroundColor: colors.primaryGlow,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 12,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.primary,
    textAlign: 'right',
    lineHeight: 20,
  },

  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    backgroundColor: 'rgba(244,67,54,0.1)',
    borderRadius: 8,
    padding: 10,
  },

  submitButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  submitGradient: { paddingVertical: 16, alignItems: 'center' },
  submitText: { ...typography.button, color: '#fff', fontSize: 16 },

  loginLink: { alignItems: 'center', paddingVertical: 4 },
  loginLinkText: { ...typography.bodySmall, color: colors.textSecondary },
  loginLinkBold: { color: colors.primary, fontWeight: '700' },
});
