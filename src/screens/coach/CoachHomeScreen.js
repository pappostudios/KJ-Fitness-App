import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

function Eyebrow({ children, accent, style }) {
  return (
    <Text style={[styles.eyebrow, accent && { color: colors.accent }, style]}>
      {children}
    </Text>
  );
}

function Avatar({ initials, size = 36 }) {
  return (
    <LinearGradient
      colors={gradients.avatar}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </LinearGradient>
  );
}

export default function CoachHomeScreen({ navigation }) {
  const { user, profile, logOut } = useAuth();

  const displayName = profile?.name || user?.displayName || 'Coach';
  const firstName = displayName.split(' ')[0];
  const initials = displayName
    .trim().split(' ')
    .map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const stats = [
    { label: 'Active Clients', value: '—', icon: 'people-outline' },
    { label: 'Sessions This Week', value: '—', icon: 'barbell-outline' },
    { label: 'New Messages', value: '—', icon: 'chatbubble-outline' },
    { label: 'Monthly Revenue', value: '—', icon: 'wallet-outline' },
  ];

  const actions = [
    {
      title: 'Content Library',
      sub: 'Videos, articles and images',
      icon: 'library-outline',
      route: 'CoachLibrary',
    },
    {
      title: 'Weekly Plan',
      sub: 'Publish this week\'s training plan',
      icon: 'calendar-outline',
      route: 'CoachWeeklyPlan',
    },
    {
      title: 'Payment Settings',
      sub: 'Bit link and session price',
      icon: 'card-outline',
      route: 'CoachSettings',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Greeting row ──────────────────────────────────────────────── */}
        <View style={styles.greetingRow}>
          <View>
            <Eyebrow>{getGreeting().toUpperCase()}</Eyebrow>
            <Text style={styles.firstName}>{firstName}.</Text>
          </View>
          <View style={styles.greetingRight}>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.75}>
              <Ionicons name="notifications-outline" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <Avatar initials={initials} size={36} />
          </View>
        </View>

        {/* ── Coach badge ────────────────────────────────────────────────── */}
        <View style={styles.sectionPad}>
          <View style={styles.coachBadge}>
            <Ionicons name="shield-checkmark-outline" size={13} color={colors.accent} />
            <Text style={styles.coachBadgeText}>COACH</Text>
          </View>
        </View>

        {/* ── Stats grid ────────────────────────────────────────────────── */}
        <View style={styles.sectionPad}>
          <Eyebrow style={{ marginBottom: 12 }}>OVERVIEW</Eyebrow>
          <View style={styles.statsGrid}>
            {stats.map((s) => (
              <View key={s.label} style={styles.statCard}>
                <Ionicons name={s.icon} size={20} color={colors.textMuted} />
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Quick actions ──────────────────────────────────────────────── */}
        <View style={styles.sectionPad}>
          <Eyebrow style={{ marginBottom: 12 }}>QUICK ACTIONS</Eyebrow>
          <View style={styles.actionsCol}>
            {actions.map((a) => (
              <TouchableOpacity
                key={a.route}
                style={styles.actionCard}
                onPress={() => navigation.navigate(a.route)}
                activeOpacity={0.8}
              >
                <View style={styles.actionIconWrap}>
                  <Ionicons name={a.icon} size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{a.title}</Text>
                  <Text style={styles.actionSub}>{a.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Sign out ───────────────────────────────────────────────────── */}
        <View style={styles.sectionPad}>
          <TouchableOpacity style={styles.signOutBtn} onPress={logOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={16} color={colors.textMuted} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dark.bg0 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },

  eyebrow: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 10.5, letterSpacing: 1.89, textTransform: 'uppercase',
    color: colors.textMuted,
  },

  // Greeting
  greetingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4,
  },
  firstName: { fontFamily: 'Sora-Bold', fontSize: 28, color: colors.textPrimary, marginTop: 4 },
  greetingRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.lineSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: 'Sora-Bold' },

  // Coach badge
  coachBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(229,57,53,0.12)', borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.35)', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  coachBadgeText: {
    fontFamily: 'Sora-SemiBold', fontSize: 10.5, letterSpacing: 1.5,
    color: colors.accent,
  },

  sectionPad: { paddingHorizontal: 20, paddingTop: 18 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47.5%',
    backgroundColor: dark.bg1, borderRadius: 18,
    borderWidth: 1, borderColor: dark.lineSoft,
    padding: 18, gap: 8,
  },
  statValue: { fontFamily: 'JetBrainsMono-Medium', fontSize: 26, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontFamily: 'Sora-Regular', fontSize: 11.5, color: colors.textMuted },

  // Actions
  actionsCol: { gap: 10 },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: dark.bg1, borderRadius: 18,
    borderWidth: 1, borderColor: dark.lineSoft, padding: 18,
  },
  actionIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: 'rgba(229,57,53,0.12)', borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  actionSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: dark.lineSoft,
  },
  signOutText: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted },
});
