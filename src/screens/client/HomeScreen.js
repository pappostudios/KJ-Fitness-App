import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useAuth } from '../../context/AuthContext';
import { useCoachSettings } from '../../hooks/useCoachSettings';
import { db } from '../../config/firebase';
import WeeklyPlanCard from '../../components/WeeklyPlanCard';
import SessionCard from '../../components/SessionCard';
import QuickActions from '../../components/QuickActions';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MOTIVATIONAL_QUOTES = [
  { text: 'Consistency beats perfection every time.', author: 'KJ' },
  { text: 'Every rep is a vote for the person you want to become.', author: 'KJ' },
  { text: 'Rest is part of the work.', author: 'KJ' },
];

const todayQuote = MOTIVATIONAL_QUOTES[0];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? parts[0][0].toUpperCase() + parts[1][0].toUpperCase()
    : parts[0][0].toUpperCase();
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { user, profile } = useAuth();
  const { settings } = useCoachSettings();
  const displayName = profile?.name || 'שלום';

  // Fetch the next upcoming confirmed booking for this client
  const [nextBooking, setNextBooking] = useState(null);

  useEffect(() => {
    if (!user) return;
    const today = toISO(new Date());
    const q = query(
      collection(db, 'bookings'),
      where('clientId', '==', user.uid),
      where('date', '>=', today),
      where('status', '==', 'confirmed'),
      orderBy('date', 'asc'),
      orderBy('time', 'asc'),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setNextBooking({ id: d.id, ...d.data() });
      } else {
        setNextBooking(null);
      }
    });
    return unsub;
  }, [user]);

  const handleQuickAction = (actionId) => {
    console.log('Quick action:', actionId);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              {getGreeting()}, {displayName} 👋
            </Text>
            <Text style={styles.subGreeting}>מוכנה להתאמן היום?</Text>
          </View>

          {/* Avatar → Profile */}
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.avatar}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Streak Banner ── */}
        <LinearGradient
          colors={['#1A1A30', '#141428']}
          style={styles.streakBanner}
        >
          <View style={styles.streakLeft}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <View>
              <Text style={styles.streakNumber}>שמור על הרצף!</Text>
              <Text style={styles.streakSub}>כנסי למסך ההתקדמות לצפות בסטטוס</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Section: This Week's Plan ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>THIS WEEK</Text>
            <TouchableOpacity onPress={() => navigation.navigate('PlansHistory')}>
              <Text style={styles.sectionLink}>כל התוכניות</Text>
            </TouchableOpacity>
          </View>
          <WeeklyPlanCard
            onPress={() => console.log('Open weekly plan')}
            onHistoryPress={() => navigation.navigate('PlansHistory')}
          />
        </View>

        {/* ── Section: Next Session ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>NEXT SESSION</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Book')}>
              <Text style={styles.sectionLink}>כל ההזמנות</Text>
            </TouchableOpacity>
          </View>
          <SessionCard
            booking={nextBooking}
            bitLink={settings.bitLink}
            onReschedule={() => navigation.navigate('Book')}
          />
        </View>

        {/* ── Section: Quick Actions ── */}
        <View style={styles.section}>
          <QuickActions onPress={handleQuickAction} />
        </View>

        {/* ── Motivational Quote ── */}
        <View style={styles.quoteCard}>
          <Ionicons
            name="chatbubble-ellipses"
            size={20}
            color={colors.primary}
            style={{ marginBottom: 8 }}
          />
          <Text style={styles.quoteText}>"{todayQuote.text}"</Text>
          <Text style={styles.quoteAuthor}>— {todayQuote.author}</Text>
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, gap: 4 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
  },
  headerLeft: { flex: 1 },
  greeting: { ...typography.h2, color: colors.textPrimary },
  subGreeting: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.primaryGlow,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { ...typography.h4, color: colors.primary, fontSize: 16 },

  // Streak Banner
  streakBanner: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  streakLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakEmoji: { fontSize: 26 },
  streakNumber: { ...typography.h4, color: colors.textPrimary },
  streakSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  // Sections
  section: { marginBottom: 24, gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: { ...typography.label, color: colors.textMuted, fontSize: 11 },
  sectionLink: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  // Quote
  quoteCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  quoteText: {
    ...typography.body,
    color: colors.textPrimary,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  quoteAuthor: { ...typography.caption, color: colors.primary, marginTop: 8, fontWeight: '700' },
});
