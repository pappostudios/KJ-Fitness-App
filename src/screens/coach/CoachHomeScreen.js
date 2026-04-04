import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function CoachHomeScreen() {
  const { user, logOut } = useAuth();

  const stats = [
    { label: 'לקוחות פעילים', value: '—', icon: '👥' },
    { label: 'אימונים השבוע', value: '—', icon: '🏋️' },
    { label: 'הודעות חדשות', value: '—', icon: '💬' },
    { label: 'הכנסה החודש', value: '—', icon: '₪' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient colors={gradients.hero} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>שלום, Kirsten 👋</Text>
            <Text style={styles.subGreeting}>{user?.email}</Text>
          </View>
          <View style={styles.coachBadge}>
            <Text style={styles.coachBadgeText}>מאמנת</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Coming soon banner */}
      <View style={styles.comingSoonCard}>
        <LinearGradient colors={['rgba(0,188,212,0.1)', 'rgba(0,151,167,0.05)']} style={styles.comingSoonGradient}>
          <Text style={styles.comingSoonIcon}>🚀</Text>
          <Text style={styles.comingSoonTitle}>לוח הבקרה בפיתוח</Text>
          <Text style={styles.comingSoonText}>
            ניהול לקוחות, לוח זמנים ומעקב תשלומים יתווספו בקרוב.
          </Text>
        </LinearGradient>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutButton} onPress={logOut}>
        <Text style={styles.signOutText}>יציאה מהחשבון</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subGreeting: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  coachBadge: {
    backgroundColor: colors.primaryGlow,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  coachBadgeText: {
    ...typography.label,
    color: colors.primary,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    fontSize: 28,
  },
  statValue: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Coming soon
  comingSoonCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 20,
  },
  comingSoonGradient: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  comingSoonIcon: {
    fontSize: 36,
  },
  comingSoonTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  comingSoonText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Sign out
  signOutButton: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: 40,
  },
  signOutText: {
    ...typography.button,
    color: colors.textSecondary,
  },
});
