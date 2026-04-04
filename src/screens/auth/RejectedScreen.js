import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function RejectedScreen() {
  const { logOut } = useAuth();

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.hero} style={styles.bg}>
        <Text style={styles.icon}>🚫</Text>
        <Text style={styles.title}>הבקשה נדחתה</Text>
        <Text style={styles.subtitle}>
          לצערנו, בקשת ההצטרפות שלך לא אושרה.{'\n'}
          לפרטים נוספים, פנה ל-Kirsten ישירות.
        </Text>

        <View style={styles.card}>
          <Text style={styles.contactLabel}>📞 יצירת קשר</Text>
          <Text style={styles.contactValue}>kjfitness.info@gmail.com</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={logOut}>
          <Text style={styles.buttonText}>חזרה לדף הכניסה</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 20,
  },
  icon: { fontSize: 64 },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  contactLabel: { ...typography.label, color: colors.textMuted },
  contactValue: { ...typography.body, color: colors.primary },
  button: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { ...typography.button, color: colors.textSecondary },
});
