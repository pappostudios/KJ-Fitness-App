import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function CoachHomeScreen({ navigation }) {
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

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <Text style={styles.quickActionsTitle}>פעולות מהירות</Text>

        {/* Library card */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('CoachLibrary')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['rgba(0,188,212,0.12)', 'rgba(0,151,167,0.06)']} style={styles.actionGradient}>
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>📚</Text>
              <View>
                <Text style={styles.actionTitle}>ספריית תוכן</Text>
                <Text style={styles.actionSub}>נהל וידאו, מאמרים ותמונות</Text>
              </View>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Weekly Plan */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('CoachWeeklyPlan')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['rgba(0,188,212,0.12)', 'rgba(0,151,167,0.06)']} style={styles.actionGradient}>
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>📋</Text>
              <View>
                <Text style={styles.actionTitle}>תוכנית שבועית</Text>
                <Text style={styles.actionSub}>פרסם תוכנית אימון לכל הלקוחות</Text>
              </View>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Bit payment settings */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('CoachSettings')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['rgba(26,68,232,0.15)', 'rgba(26,68,232,0.07)']} style={styles.actionGradient}>
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>💙</Text>
              <View>
                <Text style={styles.actionTitle}>הגדרות Bit</Text>
                <Text style={styles.actionSub}>קישור תשלום ומחיר אימון</Text>
              </View>
            </View>
            <Text style={[styles.actionArrow, { color: '#1A44E8' }]}>›</Text>
          </LinearGradient>
        </TouchableOpacity>
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

  // Quick actions
  quickActions: {
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 10,
  },
  quickActionsTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  actionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionIcon: { fontSize: 28 },
  actionTitle: { ...typography.h4, color: colors.textPrimary },
  actionTitleDisabled: { color: colors.textSecondary },
  actionSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  actionArrow: { fontSize: 22, color: colors.primary, fontWeight: '300' },
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
