import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function ForgotPasswordScreen({ navigation }) {
  const { resetPassword, error, setError } = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      setError('נא להזין כתובת אימייל.');
      return;
    }
    setSending(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch {
      // error set in context
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← חזרה</Text>
        </TouchableOpacity>

        <Text style={styles.title}>איפוס סיסמה</Text>
        <Text style={styles.subtitle}>
          הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה.
        </Text>

        {sent ? (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✉️</Text>
            <Text style={styles.successTitle}>הקישור נשלח!</Text>
            <Text style={styles.successText}>
              בדוק את תיבת הדואר שלך ועקוב אחר ההוראות לאיפוס הסיסמה.
            </Text>
            <TouchableOpacity style={styles.backToLoginButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backToLoginText}>חזרה לכניסה</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>כתובת אימייל</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(null); }}
                placeholder="your@email.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleReset}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
              disabled={sending}
              activeOpacity={0.85}
            >
              <LinearGradient colors={gradients.primary} style={styles.resetGradient}>
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.resetButtonText}>שלח קישור</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    ...typography.body,
    color: colors.primary,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 28,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
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
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    backgroundColor: 'rgba(244,67,54,0.1)',
    borderRadius: 8,
    padding: 10,
  },
  resetButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  resetGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  resetButtonText: {
    ...typography.button,
    color: '#fff',
    fontSize: 17,
  },

  // Success state
  successCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 32,
    alignItems: 'center',
    gap: 14,
  },
  successIcon: {
    fontSize: 48,
  },
  successTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  successText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  backToLoginButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: colors.primaryGlow,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  backToLoginText: {
    ...typography.button,
    color: colors.primary,
  },
});
