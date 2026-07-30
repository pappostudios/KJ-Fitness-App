import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Linking,
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
import { useLanguage } from '../../context/LanguageContext';
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


// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { user, profile } = useAuth();
  const { t, isRTL } = useLanguage();

  const displayName = profile?.name || user?.displayName || '';
  const firstName = displayName.split(' ')[0] || t('clientHome.friend');
  const initials = getInitials(displayName);

  // Firestore: next upcoming confirmed booking
  const [nextBooking, setNextBooking] = useState(null);
  // Firestore: this client's active training program
  const [activeProgram, setActiveProgram] = useState(null);
  const [expandedWorkout, setExpandedWorkout] = useState(null);
  // Firestore: this week's logged progress (for the weekly-target pill)
  const [weekEntries, setWeekEntries] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'trainingPrograms'),
      where('clientId', '==', user.uid),
      where('isActive', '==', true),
      limit(1),
    );
    return onSnapshot(q, (snap) => {
      setActiveProgram(snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null);
    }, (err) => {
      console.warn('[HomeScreen] activeProgram snapshot error:', err.code, err.message);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    const weekStartISO = toISO(d);
    const q = query(
      collection(db, 'progress'),
      where('clientId', '==', user.uid),
      where('date', '>=', weekStartISO),
    );
    return onSnapshot(q, (snap) => {
      setWeekEntries(snap.docs.map((d) => d.data()));
    });
  }, [user]);

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

  // Weekly adherence: count logged sessions this week against non-bonus workouts
  const nonBonusKeys = new Set((activeProgram?.workouts ?? []).filter((w) => !w.isBonus).map((w) => w.key));
  const sessionsThisWeek = weekEntries.filter((e) => e.programId === activeProgram?.id && nonBonusKeys.has(e.workoutKey)).length;
  const currentProgramWeek = activeProgram
    ? Math.min(
        Math.max(Math.floor((new Date() - new Date(activeProgram.startDate + 'T00:00:00')) / 86400000 / 7) + 1, 1),
        activeProgram.weeks || 1,
      )
    : null;

  // Today's session vs. an upcoming (future) one
  const todayISOStr = toISO(today);
  const todaysBooking = nextBooking && nextBooking.date === todayISOStr ? nextBooking : null;
  const upcomingBooking = nextBooking && nextBooking.date !== todayISOStr ? nextBooking : null;

  function fmtSessionDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

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
        {activeProgram && (
          <View style={styles.programStrip}>
            <View style={styles.programMeta}>
              <Text style={styles.programLabel}>{activeProgram.title}</Text>
              <Text style={styles.programWeek}>
                {t('trainingProgram.weekOf', { current: currentProgramWeek, total: activeProgram.weeks })}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(currentProgramWeek / (activeProgram.weeks || 1)) * 100}%` },
                ]}
              />
            </View>

            {activeProgram.targetSessionsPerWeek > 0 && (
              <View style={styles.weeklyTargetRow}>
                <Text style={styles.weeklyTargetText}>
                  {t('trainingProgram.sessionsThisWeek', {
                    done: sessionsThisWeek,
                    target: activeProgram.targetSessionsPerWeek,
                  })}
                </Text>
                <View style={styles.weeklyTargetDots}>
                  {Array.from({ length: activeProgram.targetSessionsPerWeek }).map((_, i) => (
                    <View key={i} style={[styles.targetDot, i < sessionsThisWeek && styles.targetDotFilled]} />
                  ))}
                </View>
              </View>
            )}

            <View style={styles.workoutBadgeScrollRow}>
              {(activeProgram.workouts ?? []).map((w, wi) => {
                const isOpen = expandedWorkout === w.key;
                return (
                  <TouchableOpacity
                    key={w.key}
                    style={[styles.workoutBadge, isOpen && styles.workoutBadgeOpen]}
                    onPress={() => setExpandedWorkout(isOpen ? null : w.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.workoutBadgeText}>{w.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {expandedWorkout && (() => {
              const w = activeProgram.workouts.find((wk) => wk.key === expandedWorkout);
              if (!w) return null;
              return (
                <View style={styles.workoutExpandCard}>
                  {(w.exercises ?? []).map((ex) => (
                    <View key={ex.id} style={styles.workoutExpandRow}>
                      <Text style={styles.workoutExpandName}>{ex.name}</Text>
                      <Text style={styles.workoutExpandMeta}>
                        {ex.targetSets}×{ex.targetReps}{ex.targetWeight ? ` @ ${ex.targetWeight}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        )}

        {/* ── Today — hero card ──────────────────────────────────────────── */}
        <View style={styles.sectionPad}>
          {todaysBooking ? (
            /* A confirmed session is scheduled for today */
            <View style={styles.heroCard}>
              <View style={styles.heroCardCover}>
                <LinearGradient colors={['rgba(21, 194, 203,0.12)', 'transparent']} style={StyleSheet.absoluteFillObject} />
                <Ionicons name="barbell" size={40} color="rgba(21,194,203,0.4)" />
              </View>
              <View style={styles.heroCardBody}>
                <Eyebrow accent>{t('clientHome.today')} · {DAYS_SHORT[today.getDay()].toUpperCase()}</Eyebrow>
                <Text style={styles.sessionTitle}>{t('clientHome.sessionWithCoach')}</Text>
                <View style={styles.sessionMeta}>
                  <View style={styles.sessionMetaItem}>
                    <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.sessionMetaText}>{todaysBooking.time} · {todaysBooking.duration} min</Text>
                  </View>
                  {todaysBooking.location && todaysBooking.location !== t('schedule.notSpecified') && (
                    <View style={styles.sessionMetaItem}>
                      <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.sessionMetaText} numberOfLines={1}>{todaysBooking.location}</Text>
                    </View>
                  )}
                </View>
                {todaysBooking.workoutPlan?.pdfUrl ? (
                  <TouchableOpacity
                    style={styles.heroPlanBtn}
                    activeOpacity={0.8}
                    onPress={() => Linking.openURL(todaysBooking.workoutPlan.pdfUrl).catch(() => {})}
                  >
                    <Ionicons name="document-text-outline" size={15} color={colors.accent} />
                    <Text style={styles.heroPlanBtnText}>{t('schedule.openWorkout')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.startBtn} activeOpacity={0.85} onPress={() => navigation.navigate('LogWorkout')}>
                  <LinearGradient colors={gradients.primary} style={styles.startBtnGradient}>
                    <Text style={styles.startBtnText}>{t('clientHome.startSession')}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.accentInk} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ) : activeProgram ? (
            /* No session today, but an active program — prompt to train */
            <View style={styles.heroCard}>
              <View style={styles.heroCardBody}>
                <Eyebrow accent>{t('clientHome.today')} · {DAYS_SHORT[today.getDay()].toUpperCase()}</Eyebrow>
                <Text style={styles.sessionTitle}>{t('clientHome.todaysWorkout')}</Text>
                <Text style={styles.sessionFocus}>{activeProgram.title}</Text>
                {activeProgram.targetSessionsPerWeek > 0 && (
                  <View style={styles.sessionMeta}>
                    <View style={styles.sessionMetaItem}>
                      <Ionicons name="flame-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.sessionMetaText}>
                        {t('trainingProgram.sessionsThisWeek', { done: sessionsThisWeek, target: activeProgram.targetSessionsPerWeek })}
                      </Text>
                    </View>
                  </View>
                )}
                <TouchableOpacity style={styles.startBtn} activeOpacity={0.85} onPress={() => navigation.navigate('LogWorkout')}>
                  <LinearGradient colors={gradients.primary} style={styles.startBtnGradient}>
                    <Text style={styles.startBtnText}>{t('progress.logWorkout')}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.accentInk} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* No session, no program */
            <View style={styles.emptyCard}>
              <Eyebrow style={{ marginBottom: 8 }}>{t('clientHome.today')} · {DAYS_SHORT[today.getDay()].toUpperCase()}</Eyebrow>
              <Ionicons name="barbell-outline" size={28} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyCardTitle}>{t('clientHome.noSession')}</Text>
              <Text style={styles.emptyCardSub}>{t('clientHome.noSessionSub')}</Text>
              <TouchableOpacity style={styles.logWorkoutBtn} activeOpacity={0.85} onPress={() => navigation.navigate('LogWorkout')}>
                <LinearGradient colors={gradients.primary} style={styles.logWorkoutBtnInner}>
                  <Ionicons name="add" size={16} color={colors.accentInk} />
                  <Text style={styles.logWorkoutBtnText}>{t('progress.logWorkout')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Next session line ──────────────────────────────────────────── */}
        {upcomingBooking && (
          <View style={styles.sectionPad}>
            <TouchableOpacity
              style={styles.nextSessionCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Schedule', { openBookingId: upcomingBooking.id })}
            >
              <View style={styles.nextSessionIcon}>
                <Ionicons name="calendar-outline" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextSessionLabel}>{t('clientHome.nextSession')}</Text>
                <Text style={styles.nextSessionValue}>
                  {fmtSessionDate(upcomingBooking.date)} · {upcomingBooking.time}
                </Text>
              </View>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Week strip ─────────────────────────────────────────────────── */}
        <View style={styles.sectionPad}>
          <Eyebrow style={{ marginBottom: 10 }}>{t('clientHome.thisWeek')}</Eyebrow>
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
  programStrip: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  programMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  programLabel: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textSecondary },
  programWeek: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: colors.textSecondary },
  progressBarBg: { height: 6, backgroundColor: dark.bg2, borderRadius: 999, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 999 },

  weeklyTargetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weeklyTargetText: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.textPrimary },
  weeklyTargetDots: { flexDirection: 'row', gap: 5 },
  targetDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.line },
  targetDotFilled: { backgroundColor: colors.accent, borderColor: colors.accent },

  workoutBadgeScrollRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  workoutBadge: {
    backgroundColor: dark.bg1, borderRadius: 999,
    borderWidth: 1, borderColor: dark.lineSoft,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  workoutBadgeOpen: { backgroundColor: 'rgba(21,194,203,0.15)', borderColor: colors.accent },
  workoutBadgeText: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.textPrimary },

  workoutExpandCard: {
    backgroundColor: dark.bg1, borderRadius: 14,
    borderWidth: 1, borderColor: dark.lineSoft, padding: 12, gap: 6,
  },
  workoutExpandRow: { flexDirection: 'row', justifyContent: 'space-between' },
  workoutExpandName: { fontFamily: 'Sora-SemiBold', fontSize: 12.5, color: colors.textPrimary },
  workoutExpandMeta: { fontFamily: 'JetBrainsMono-Regular', fontSize: 11.5, color: colors.textMuted },

  logWorkoutBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 12 },
  logWorkoutBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  logWorkoutBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.accentInk },

  // Section padding
  sectionPad: { paddingHorizontal: 20, paddingTop: 18 },

  // Hero card
  heroCard: {
    borderRadius: 20,
    backgroundColor: dark.bg1,
    borderWidth: 1,
    borderColor: `rgba(21, 194, 203,0.35)`,
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
  heroPlanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent + '15', borderRadius: 10,
    borderWidth: 1, borderColor: colors.accent + '33',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  heroPlanBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 12.5, color: colors.accent },

  // Next session card
  nextSessionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: dark.bg1, borderRadius: 14,
    borderWidth: 1, borderColor: dark.lineSoft,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  nextSessionIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accent + '15', alignItems: 'center', justifyContent: 'center',
  },
  nextSessionLabel: {
    fontFamily: 'Sora-SemiBold', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
    color: colors.textMuted,
  },
  nextSessionValue: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary, marginTop: 2 },

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
  weekDayToday: { backgroundColor: `rgba(21, 194, 203,0.12)`, borderColor: colors.accent },
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
    backgroundColor: `rgba(21, 194, 203,0.16)`,
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
