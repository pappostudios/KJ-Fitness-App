import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, onSnapshot, orderBy,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useCoachSettings } from '../../hooks/useCoachSettings';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useLanguage } from '../../context/LanguageContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getGreeting = (t) => {
  const h = new Date().getHours();
  if (h < 12) return t('home.greetingMorning');
  if (h < 17) return t('home.greetingAfternoon');
  return t('home.greetingEvening');
};

function getWeekStart() {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() - today.getDay()); // back to Sunday
  return d.toISOString().split('T')[0];
}

function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoachHomeScreen({ navigation }) {
  const { user, profile } = useAuth();
  const { settings } = useCoachSettings();
  const { t, isRTL } = useLanguage();

  const displayName = profile?.name || user?.displayName || 'Coach';
  const firstName = displayName.split(' ')[0];
  const initials = displayName.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  // ── Live stats ──────────────────────────────────────────────────────────────
  const [activeClients, setActiveClients] = useState(null);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(null);
  const [newMessages, setNewMessages] = useState(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState(null);

  // 1. Active clients
  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'client'),
      where('status', '==', 'approved'),
    );
    return onSnapshot(q, (snap) => setActiveClients(snap.size));
  }, []);

  // 2. Sessions this week (confirmed bookings from this Sunday onwards)
  useEffect(() => {
    const weekStart = getWeekStart();
    const q = query(
      collection(db, 'bookings'),
      where('date', '>=', weekStart),
      where('status', '==', 'confirmed'),
    );
    return onSnapshot(q, (snap) => setSessionsThisWeek(snap.size));
  }, []);

  // 3. Unread messages (sum of unreadByCoach across all conversations)
  useEffect(() => {
    return onSnapshot(collection(db, 'conversations'), (snap) => {
      const total = snap.docs.reduce((sum, d) => sum + (d.data().unreadByCoach ?? 0), 0);
      setNewMessages(total);
    });
  }, []);

  // 4. Monthly revenue (paid bookings this month × session price)
  useEffect(() => {
    const monthStart = getMonthStart();
    const q = query(
      collection(db, 'bookings'),
      where('date', '>=', monthStart),
      where('paymentStatus', '==', 'paid'),
    );
    return onSnapshot(q, (snap) => {
      const price = parseFloat(settings.sessionPrice) || 0;
      // Use per-booking price if it exists, otherwise fall back to settings price
      const total = snap.docs.reduce((sum, d) => {
        const bookingPrice = parseFloat(d.data().price) || price;
        return sum + bookingPrice;
      }, 0);
      setMonthlyRevenue(total);
    });
  }, [settings.sessionPrice]);

  // ── Stats config ────────────────────────────────────────────────────────────
  const stats = [
    {
      label: t('home.activeClients'),
      value: activeClients,
      icon: 'people-outline',
      accent: false,
    },
    {
      label: t('home.sessionsWeek'),
      value: sessionsThisWeek,
      icon: 'barbell-outline',
      accent: false,
    },
    {
      label: t('home.newMessages'),
      value: newMessages,
      icon: 'chatbubble-outline',
      accent: newMessages > 0,
    },
    {
      label: t('home.monthlyRevenue'),
      value: monthlyRevenue != null
        ? `₪${monthlyRevenue % 1 === 0 ? monthlyRevenue : monthlyRevenue.toFixed(0)}`
        : null,
      icon: 'wallet-outline',
      accent: false,
    },
  ];

  const actions = [
    { title: t('home.library'),   sub: t('home.librarySub'),    icon: 'library-outline',  route: 'CoachLibrary' },
    { title: t('home.weeklyPlan'),        sub: t('home.weeklyPlanSub'), icon: 'calendar-outline', route: 'CoachWeeklyPlan' },
    { title: t('home.paymentSettings'),   sub: t('home.paymentSettingsSub'),     icon: 'card-outline',     route: 'CoachSettings' },
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
            <Eyebrow>{getGreeting(t).toUpperCase()}</Eyebrow>
            <Text style={styles.firstName}>{firstName}.</Text>
          </View>
          <View style={styles.greetingRight}>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.75}>
              <Ionicons name="notifications-outline" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('CoachProfile')} activeOpacity={0.85}>
              <Avatar initials={initials} size={36} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Coach badge ────────────────────────────────────────────────── */}
        <View style={styles.sectionPad}>
          <View style={styles.coachBadge}>
            <Ionicons name="shield-checkmark-outline" size={13} color={colors.accent} />
            <Text style={styles.coachBadgeText}>{t('home.eyebrow').toUpperCase()}</Text>
          </View>
        </View>

        {/* ── Stats grid ────────────────────────────────────────────────── */}
        <View style={styles.sectionPad}>
          <Eyebrow style={{ marginBottom: 12 }}>{t('home.overview').toUpperCase()}</Eyebrow>
          <View style={styles.statsGrid}>
            {stats.map((s) => (
              <View
                key={s.label}
                style={[styles.statCard, s.accent && styles.statCardAccent]}
              >
                <Ionicons
                  name={s.icon}
                  size={20}
                  color={s.accent ? colors.accent : colors.textMuted}
                />
                <Text style={[styles.statValue, s.accent && { color: colors.accent }]}>
                  {s.value != null ? s.value : '—'}
                </Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Quick actions ──────────────────────────────────────────────── */}
        <View style={styles.sectionPad}>
          <Eyebrow style={{ marginBottom: 12 }}>{t('home.quickActions').toUpperCase()}</Eyebrow>
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
                <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-forward'} size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dark.bg0 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },

  eyebrow: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 10.5, letterSpacing: 1.89, textTransform: 'uppercase',
    color: colors.textMuted,
  },

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

  coachBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(229,57,53,0.12)', borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.35)', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  coachBadgeText: {
    fontFamily: 'Sora-SemiBold', fontSize: 10.5, letterSpacing: 1.5, color: colors.accent,
  },

  sectionPad: { paddingHorizontal: 20, paddingTop: 18 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47.5%',
    backgroundColor: dark.bg1, borderRadius: 18,
    borderWidth: 1, borderColor: dark.lineSoft,
    padding: 18, gap: 8,
  },
  statCardAccent: {
    backgroundColor: 'rgba(229,57,53,0.08)',
    borderColor: 'rgba(229,57,53,0.35)',
  },
  statValue: {
    fontFamily: 'JetBrainsMono-Medium', fontSize: 26, fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: { fontFamily: 'Sora-Regular', fontSize: 11.5, color: colors.textMuted },

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
});
