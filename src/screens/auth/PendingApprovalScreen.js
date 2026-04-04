import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function PendingApprovalScreen() {
  const { user, logOut } = useAuth();

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.hero} style={styles.bg}>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <LinearGradient colors={gradients.primary} style={styles.iconBadge}>
            <Text style={styles.iconText}>⏳</Text>
          </LinearGradient>
        </View>

        {/* Text */}
        <Text style={styles.title}>הבקשה נשלחה!</Text>
        <Text style={styles.subtitle}>
          Kirsten תקבל את בקשתך ותאשר אותה בהקדם.{'\n'}
          תקבל גישה לאפליקציה לאחר האישור.
        </Text>

        {/* Info card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>📧</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardLabel}>החשבון הממתין</Text>
              <Text style={styles.cardValue}>{user?.email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>✅</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardLabel}>הצעד הבא</Text>
              <Text style={styles.cardValue}>
                לאחר שהמאמנת תאשר אותך, הדף הזה יתעדכן אוטומטית
              </Text>
            </View>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutButton} onPress={logOut}>
          <Text style={styles.signOutText}>יציאה</Text>
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

  iconContainer: { marginBottom: 8 },
  iconBadge: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  iconText: { fontSize: 44 },

  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    gap: 16,
    marginTop: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  cardIcon: { fontSize: 24, marginTop: 2 },
  cardText: { flex: 1, gap: 4 },
  cardLabel: { ...typography.label, color: colors.textMuted },
  cardValue: { ...typography.body, color: colors.textPrimary },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },

  signOutButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: {
    ...typography.button,
    color: colors.textSecondary,
  },
});
