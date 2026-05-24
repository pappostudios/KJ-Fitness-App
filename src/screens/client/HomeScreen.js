import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../config/firebase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const getInitials = (name = '') => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.[0]?.toUpperCase() ?? '?';
};

// ── Sub-components ────────────────────────────────────────────────────────────

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

function Eyebrow({ children, accent, style }) {
  return (
    <Text style={[styles.eyebrow, accent && { color: colors.accent }, style]}>
      {children}
    </Text>
  );
}

// Tiny inline sparkline using SVG-like dots approach
function Sparkline({ data = [], width = 80, height = 28 }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / Math.max(1, data.length - 1);
  // Render as a series of dots connected by the layout
  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
      {data.map((v, i) => {
        const barH = Math.max(2, ((v - min) / range) * height);
        const isLast = i === data.length - 1;
        return (
          <View
            key={i}
            style={{
              width: 4,
              height: barH,
              borderRadius: 2,
              backgroundColor: isLast ? colors.accent : `rgba(229,57,53,0.35)`,
            }}
          />
        );
      })}
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { user, profile } = useAuth();

  const displayName = profile?.name || user?.displayName || '';
  const firstName = displayName.split(' ')[0] || 'there';
  const initials = getInitials(displayName);

  // Firestore: next upcoming booking
  const [nextBooking, setNextBooking] = useState(null);
  // Firestore: today's plan (stub — real data comes from weeklyPlans collection)
  const [todayPlan, setTodayPlan] = useState(null);

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
      limit(1),
    );
    return onSnapshot(q, (snap) => {
      setNextBooking(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
    });
  }, [user]);

  // Week strip — generate from today
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sun
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dayOfWeek + i);
    return {
      day: DAYS_SHORT[d.getDay()],
      date: d.getDate(),
      isToday: i === dayOfWeek,
    };
  });

  // PRs — loaded from Firestore (empty until real data is entered)
  const PRS = [];

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
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.75}
            >
              <Ionicons name="notifications-outline" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.85}
            >
              <Avatar initials={initials} size={36} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Program strip ──────────────────────────────────────────────── */}
        {profile?.program && (
          <View style={styles.programStrip}>
            <View style={styles.programMeta}>
              <Text style={styles.programLabel}>{profile.program}</Text>
              <Text style={styles.programWeek}>
                Week {profile.currentWeek ?? 1}/{profile.totalWeeks ?? 12}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${((profile.currentWeek ?? 1) / (profile.totalWeeks ?? 12)) * 100}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* ── Today's session — hero card ────────────────────────────────── */}
        <View style={styles.sectionPad}>
          {todayPlan ? (
            <View style={styles.heroCard}>
              {/* Cover image placeholder */}
              <View style={styles.heroCardCover}>
                <LinearGradient
                  colors={['rgba(229,57,53,0.12)', 'transparent']}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
              {/* Card body */}
              <View style={styles.heroCardBody}>
                <Eyebrow accent>
                  TODAY · {DAYS_SHORT[today.getDay()].toUpperCase()}
                </Eyebrow>
                <Text style={styles.sessionTitle}>{todayPlan.label}</Text>
                <Text style={styles.sessionFocus}>{todayPlan.focus}</Text>
                <View style={styles.sessionMeta}>
                  {todayPlan.exerciseCount != null && (
                    <View style={styles.sessionMetaItem}>
                      <Ionicons name="barbell-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.sessionMetaText}>{todayPlan.exerciseCount} exercises</Text>
                    </View>
                  )}
                  {todayPlan.estMin != null && (
                    <View style={styles.sessionMetaItem}>
                      <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.sessionMetaText}>~{todayPlan.estMin} min</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity style={styles.startBtn} activeOpacity={0.85}>
                  <LinearGradient colors={gradients.primary} style={styles.startBtnGradient}>
                    <Text style={styles.startBtnText}>Start session</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.accentInk} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Eyebrow style={{ marginBottom: 8 }}>TODAY · {DAYS_SHORT[today.getDay()].toUpperCase()}</Eyebrow>
              <Ionicons name="barbell-outline" size={28} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyCardTitle}>No session planned yet</Text>
              <Text style={styles.emptyCardSub}>Your coach will add your plan here.</Text>
            </View>
          )}
        </View>

        {/* ── Coach note ─────────────────────────────────────────────────── */}
        {todayPlan?.coachNote ? (
          <View style={styles.sectionPad}>
            <Eyebrow style={{ marginBottom: 10 }}>COACH NOTES</Eyebrow>
            <View style={styles.card}>
              <View style={styles.coachNoteRow}>
                <Avatar initials="KJ" size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.coachNoteText}>{todayPlan.coachNote}</Text>
                  <TouchableOpacity style={styles.replyBtn} activeOpacity={0.75}>
                    <Text style={styles.replyBtnText}>Reply</Text>
                    <Ionicons name="chatbubble-outline" size={13} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Week strip ─────────────────────────────────────────────────── */}
        <View style={styles.sectionPad}>
          <Eyebrow style={{ marginBottom: 10 }}>THIS WEEK</Eyebrow>
          <View style={styles.weekGrid}>
            {weekDays.map((d, i) => (
              <View
                key={i}
                style={[
                  styles.weekDay,
                  d.isToday && styles.weekDayToday,
                ]}
              >
                <Text style={[styles.weekDayLabel, d.isToday && { color: colors.accent }]}>
                  {d.day.toUpperCase()}
                </Text>
                <View style={styles.weekDayDot}>
                  {d.isToday
                    ? <View style={styles.weekDotActive} />
                    : <View style={styles.weekDotEmpty} />
                  }
                </View>
                <Text style={[styles.weekDayDate, d.isToday && { color: colors.accent }]}>
                  {d.date}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Recent video feedback — shown only when real data exists ─── */}

        {/* ── PR glance ──────────────────────────────────────────────────── */}
        <View style={styles.sectionPad}>
          <Eyebrow style={{ marginBottom: 10 }}>PERSONAL RECORDS</Eyebrow>
          {PRS.length > 0 ? (
            <View style={styles.prGrid}>
              {PRS.map((p) => (
                <TouchableOpacity
                  key={p.lift}
                  style={styles.prCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('Progress')}
                >
                  <Text style={styles.prLift}>{p.lift}</Text>
                  <View style={styles.prValueRow}>
                    <Text style={styles.prValue}>{p.current}</Text>
                    <Text style={styles.prUnit}>{p.unit}</Text>
                  </View>
                  {p.history?.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Sparkline data={p.history} width={100} height={24} />
                    </View>
                  )}
                  <Text style={[
                    styles.prDelta,
                    { color: p.deltaWeek > 0 ? colors.success : colors.textMuted },
                  ]}>
                    {p.deltaWeek > 0 ? `+${p.deltaWeek} kg this week` : 'Same as last week'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="trophy-outline" size={24} color={colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyCardTitle}>No records yet</Text>
              <Text style={styles.emptyCardSub}>PRs will appear here as you log them.</Text>
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dark.bg0 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },

  // Greeting
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  firstName: { ...typography.h1, fontSize: 28, color: colors.textPrimary, marginTop: 4 },
  greetingRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.lineSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: 'Sora-Bold' },

  // Eyebrow
  eyebrow: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 10.5,
    letterSpacing: 1.89,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },

  // Program strip
  programStrip: { paddingHorizontal: 20, paddingTop: 12 },
  programMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  programLabel: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textSecondary },
  programWeek: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: colors.textSecondary },
  progressBarBg: { height: 6, backgroundColor: dark.bg2, borderRadius: 999, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 999 },

  // Section padding
  sectionPad: { paddingHorizontal: 20, paddingTop: 18 },

  // Hero card
  heroCard: {
    borderRadius: 20,
    backgroundColor: dark.bg1,
    borderWidth: 1,
    borderColor: `rgba(229,57,53,0.35)`,
    overflow: 'hidden',
  },
  heroCardCover: {
    height: 120,
    backgroundColor: dark.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholder: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 10,
    color: colors.textMuted,
    opacity: 0.4,
  },
  heroCardBody: { padding: 18 },
  sessionTitle: { ...typography.h2, color: colors.textPrimary, marginTop: 6 },
  sessionFocus: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  sessionMeta: { flexDirection: 'row', gap: 16, marginTop: 14 },
  sessionMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionMetaText: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },
  startBtn: { marginTop: 16, borderRadius: 12, overflow: 'hidden' },
  startBtnGradient: {
    height: 48, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  startBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.accentInk },

  // Card
  card: {
    backgroundColor: dark.bg1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: dark.lineSoft,
    padding: 18,
  },

  // Coach note
  coachNoteRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  coachNoteTime: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  coachNoteText: { fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textPrimary, lineHeight: 21 },
  replyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, alignSelf: 'flex-start',
    backgroundColor: dark.bg2, borderRadius: 9,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  replyBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.textSecondary },

  // Week strip
  weekGrid: { flexDirection: 'row', gap: 6 },
  weekDay: {
    flex: 1, paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: dark.bg1,
    borderWidth: 1,
    borderColor: dark.lineSoft,
    alignItems: 'center',
  },
  weekDayToday: { backgroundColor: `rgba(229,57,53,0.12)`, borderColor: colors.accent },
  weekDayLabel: { fontFamily: 'Sora-SemiBold', fontSize: 9, letterSpacing: 0.5, color: colors.textMuted, textTransform: 'uppercase' },
  weekDayDot: { height: 18, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  weekDotActive: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  weekDotEmpty: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: colors.textMuted },
  weekDayDate: { fontFamily: 'JetBrainsMono-Regular', fontSize: 9, color: colors.textMuted, marginTop: 4 },

  // Video feedback
  videoFeedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  videoThumb: {
    width: 64, height: 64, borderRadius: 10,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.lineSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  videoTitle: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textPrimary },
  videoReply: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  chipAccent: {
    backgroundColor: `rgba(229,57,53,0.16)`,
    borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  chipAccentText: { fontFamily: 'Sora-SemiBold', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.accent },

  // Empty state card
  emptyCard: {
    backgroundColor: dark.bg1,
    borderRadius: 18, borderWidth: 1, borderColor: dark.lineSoft,
    borderStyle: 'dashed',
    padding: 28,
    alignItems: 'center',
  },
  emptyCardTitle: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  emptyCardSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 17 },

  // PR grid
  prGrid: { flexDirection: 'row', gap: 10 },
  prCard: {
    flex: 1,
    backgroundColor: dark.bg1,
    borderRadius: 16, borderWidth: 1, borderColor: dark.lineSoft,
    padding: 14,
  },
  prLift: { fontFamily: 'Sora-Regular', fontSize: 11.5, color: colors.textMuted },
  prValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  prValue: { fontFamily: 'JetBrainsMono-Medium', fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  prUnit: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textSecondary },
  prDelta: { fontFamily: 'Sora-Regular', fontSize: 11, marginTop: 6 },
});
