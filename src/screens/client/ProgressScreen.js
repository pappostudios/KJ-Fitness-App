import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, orderBy, onSnapshot, limit,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Consecutive-day streak from logged workouts (same logic as coach ClientProgressScreen)
function calcStreak(entries) {
  if (!entries.length) return 0;
  const dates = [...new Set(entries.map((e) => e.date))].sort().reverse();
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const iso of dates) {
    const d = new Date(iso + 'T00:00:00');
    const diff = Math.round((cursor - d) / 86400000);
    if (diff <= 1) { streak++; cursor = d; }
    else break;
  }
  return streak;
}

function startOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ── Eyebrow ───────────────────────────────────────────────────────────────────
function Eyebrow({ children, accent, style }) {
  return (
    <Text style={[styles.eyebrow, accent && { color: colors.accent }, style]}>
      {children}
    </Text>
  );
}

export default function ProgressScreen({ navigation }) {
  const { user, profile } = useAuth();
  const { t, isRTL } = useLanguage();
  const week = profile?.currentWeek ?? null;
  const totalWeeks = profile?.totalWeeks ?? null;
  const [assessments, setAssessments] = useState([]);
  const [progressEntries, setProgressEntries] = useState([]);

  // Load latest 2 assessments for this client
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'assessments'),
      where('clientId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(2),
    );
    return onSnapshot(q, (snap) => {
      setAssessments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [user?.uid]);

  // Load full progress history (for Personal Records)
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'progress'),
      where('clientId', '==', user.uid),
      orderBy('date', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setProgressEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [user?.uid]);

  // Group logged exercises by name → per-session {date, avg, max}. Keep top 5 by recency.
  const exerciseMap = new Map();
  for (const entry of progressEntries) {
    for (const ex of entry.exercises ?? []) {
      const weights = (ex.sets ?? []).map((s) => s.weight || 0).filter((w) => w > 0);
      if (weights.length === 0) continue;
      const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
      const max = Math.max(...weights);
      if (!exerciseMap.has(ex.name)) exerciseMap.set(ex.name, []);
      exerciseMap.get(ex.name).push({ date: entry.date, avg, max });
    }
  }
  const PRS = [...exerciseMap.entries()]
    .map(([name, sessions]) => {
      const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2] ?? null;
      return {
        lift: name,
        avg: Math.round(latest.avg * 10) / 10,
        max: latest.max,
        avgDelta: prev ? latest.avg - prev.avg : 0,
        maxDelta: prev ? latest.max - prev.max : 0,
        sessionCount: sorted.length,
      };
    })
    // most recently logged first
    .sort((a, b) => {
      const da = exerciseMap.get(a.lift).at(-1).date;
      const db2 = exerciseMap.get(b.lift).at(-1).date;
      return db2.localeCompare(da);
    })
    .slice(0, 5);

  // Live streak & session counts derived from logged workouts
  const streak = calcStreak(progressEntries);
  const totalWorkouts = progressEntries.length;
  const monthStart = startOfMonthISO();
  const workoutsThisMonth = progressEntries.filter((e) => e.date >= monthStart).length;

  const latestA = assessments[0] ?? null;
  const prevA = assessments[1] ?? null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Screen header */}
        <View style={styles.screenHeader}>
          {week != null && totalWeeks != null && (
            <Eyebrow>{t('progress.weekOf', { current: week, total: totalWeeks })}</Eyebrow>
          )}
          <Text style={styles.screenTitle}>{t('progress.title')}</Text>
        </View>

        {/* Big numbers row */}
        <View style={styles.kpiRow}>
          {/* Streak — accent card */}
          <View style={[styles.kpiCard, streak > 0 && styles.kpiCardAccent]}>
            <Eyebrow accent={streak > 0}>{t('progress.streak')}</Eyebrow>
            <View style={styles.kpiValueRow}>
              <Text style={styles.kpiValueLarge}>{streak}</Text>
              <Text style={styles.kpiUnit}>{t('progress.days')}</Text>
            </View>
            {streak > 0 ? (
              <View style={styles.kpiFlameRow}>
                <Ionicons name="flame" size={12} color={colors.accent} />
                <Text style={styles.kpiNote}>{t('progress.keepGoing')}</Text>
              </View>
            ) : (
              <Text style={styles.kpiNote}>{t('progress.startFirst')}</Text>
            )}
          </View>

          {/* Sessions */}
          <View style={styles.kpiCard}>
            <Eyebrow>{t('progress.sessions')}</Eyebrow>
            <View style={styles.kpiValueRow}>
              <Text style={styles.kpiValueMd}>{totalWorkouts}</Text>
              <Text style={styles.kpiUnit}>{t('progress.workoutsUnit')}</Text>
            </View>
            <Text style={[styles.kpiNote, { marginTop: 10 }]}>
              {t('progress.thisMonth', { count: workoutsThisMonth })}
            </Text>
          </View>
        </View>

        {/* Log a Workout + View history */}
        <View style={[styles.section, { paddingTop: 4 }]}>
          <TouchableOpacity
            style={styles.logWorkoutBtn}
            onPress={() => navigation.navigate('LogWorkout')}
            activeOpacity={0.85}
          >
            <LinearGradient colors={gradients.primary} style={styles.logWorkoutBtnInner}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.logWorkoutBtnText}>{t('progress.logWorkout')}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => navigation.navigate('ClientWorkoutHistory')}
            activeOpacity={0.85}
          >
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.viewAllBtnText}>{t('progress.viewAllWorkouts')}</Text>
          </TouchableOpacity>
        </View>

        {/* PRs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Eyebrow>{t('progress.personalRecords')}</Eyebrow>
            {PRS.length > 0 && <Text style={styles.sectionSub}>{t('progress.last10Weeks')}</Text>}
          </View>
          {PRS.length > 0 ? (
            <View style={styles.card}>
              {PRS.map((p, i) => (
                <TouchableOpacity
                  key={p.lift}
                  style={[
                    styles.prRow,
                    i < PRS.length - 1 && styles.prRowDivider,
                  ]}
                  onPress={() => navigation.navigate('ClientWorkoutHistory', { exerciseName: p.lift })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prLift}>{p.lift}</Text>
                    <Text style={styles.prSessions}>
                      {t('progress.sessionHistory', { count: p.sessionCount })}
                    </Text>
                  </View>
                  <PrStat label={t('progress.avg')} value={p.avg} delta={p.avgDelta} />
                  <PrStat label={t('progress.max')} value={p.max} delta={p.maxDelta} />
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={26} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('progress.noPRs')}</Text>
              <Text style={styles.emptyBody}>{t('progress.PRsSub')}</Text>
            </View>
          )}
        </View>

        {/* Body metrics — live from assessments collection */}
        <View style={styles.section}>
          <Eyebrow style={{ marginBottom: 12 }}>{t('progress.body')}</Eyebrow>
          {latestA ? (
            <View style={[styles.card, { padding: 16 }]}>
              <Text style={styles.bodyMetaLabel}>{t('assessment.lastAssessment')}: {latestA.date}</Text>
              <View style={styles.bodyMetaRow}>
                <View>
                  <Text style={[styles.bodyMetaLabel, { marginTop: 12 }]}>{t('assessment.weight')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                    <Text style={styles.bodyMetaValue}>{latestA.weight ?? '—'}</Text>
                    <Text style={styles.bodyMetaUnit}>kg</Text>
                  </View>
                </View>
                {prevA?.weight != null && latestA.weight != null && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.bodyMetaLabel}>vs prev</Text>
                    <Text style={[styles.bodyMetaDelta, {
                      color: latestA.weight < prevA.weight ? colors.success : colors.textMuted,
                    }]}>
                      {latestA.weight < prevA.weight ? '−' : '+'}
                      {Math.abs(latestA.weight - prevA.weight).toFixed(1)} kg
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.bodyRow}>
                {latestA.bodyFat?.percentage != null && (
                  <BodyStatChip label={t('assessment.bodyFatPct')} value={`${latestA.bodyFat.percentage}%`}
                    prev={prevA?.bodyFat?.percentage != null ? `${prevA.bodyFat.percentage}%` : null}
                    isGood={latestA.bodyFat.percentage < (prevA?.bodyFat?.percentage ?? Infinity)} />
                )}
                {latestA.bodyFat?.leanMass != null && (
                  <BodyStatChip label={t('assessment.leanMass')} value={`${latestA.bodyFat.leanMass}kg`}
                    prev={prevA?.bodyFat?.leanMass != null ? `${prevA.bodyFat.leanMass}kg` : null}
                    isGood={latestA.bodyFat.leanMass > (prevA?.bodyFat?.leanMass ?? -Infinity)} />
                )}
                {latestA.circumferences?.whr != null && (
                  <BodyStatChip label={t('assessment.whr')} value={latestA.circumferences.whr}
                    prev={prevA?.circumferences?.whr ?? null}
                    isGood={latestA.circumferences.whr < (prevA?.circumferences?.whr ?? Infinity)} />
                )}
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="body-outline" size={26} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('assessment.noBodyData')}</Text>
              <Text style={styles.emptyBody}>{t('assessment.noBodyDataSub')}</Text>
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PrStat({ label, value, delta }) {
  const up = delta > 0;
  const down = delta < 0;
  const color = up ? colors.success : down ? colors.error : colors.textMuted;
  const icon = up ? 'trending-up' : down ? 'trending-down' : 'remove';
  return (
    <View style={styles.prStat}>
      <Text style={styles.prStatLabel}>{label}</Text>
      <Text style={styles.prStatValue}>{value}<Text style={styles.prStatUnit}>kg</Text></Text>
      <View style={styles.prStatDelta}>
        <Ionicons name={icon} size={11} color={color} />
        {delta !== 0 && (
          <Text style={[styles.prStatDeltaText, { color }]}>
            {Math.abs(Math.round(delta * 10) / 10)}
          </Text>
        )}
      </View>
    </View>
  );
}

function BodyStatChip({ label, value, prev, isGood }) {
  return (
    <View style={styles.bodyStatChip}>
      <Text style={styles.bodyStatLabel}>{label}</Text>
      <Text style={styles.bodyStatValue}>{value}</Text>
      {prev != null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
          <Ionicons
            name={isGood ? 'trending-down' : 'trending-up'}
            size={11}
            color={isGood ? colors.success : colors.textMuted}
          />
          <Text style={[styles.bodyStatPrev, { color: isGood ? colors.success : colors.textMuted }]}>
            {prev}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dark.bg0 },
  content: { paddingBottom: 24 },

  eyebrow: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 10.5,
    letterSpacing: 1.89,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },

  // Screen header
  screenHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  screenTitle: { ...typography.h1, color: colors.textPrimary, marginTop: 4 },

  // KPI row
  kpiRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 18 },
  kpiCard: {
    flex: 1,
    backgroundColor: dark.bg1,
    borderRadius: 18, borderWidth: 1, borderColor: dark.lineSoft,
    padding: 18,
  },
  kpiCardAccent: {
    borderColor: 'rgba(21, 194, 203,0.3)',
    backgroundColor: 'rgba(21, 194, 203,0.08)',
  },
  kpiValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10 },
  kpiValueLarge: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 44, fontWeight: '700', lineHeight: 48,
    color: colors.textPrimary,
  },
  kpiValueMd: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 32, fontWeight: '700',
    color: colors.textPrimary,
  },
  kpiUnit: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textSecondary },
  kpiFlameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  kpiNote: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textSecondary },
  progressBarBg: {
    height: 6, backgroundColor: dark.bg2, borderRadius: 999,
    overflow: 'hidden', marginTop: 16,
  },
  progressBarFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 999 },

  logWorkoutBtn: { borderRadius: 14, overflow: 'hidden' },
  logWorkoutBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
  },
  logWorkoutBtnText: { fontFamily: 'Sora-Bold', fontSize: 14, color: '#fff' },
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, marginTop: 8,
    borderRadius: 14, borderWidth: 1, borderColor: dark.line, backgroundColor: dark.bg1,
  },
  viewAllBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textSecondary },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: 12,
  },
  sectionSub: { fontFamily: 'Sora-Regular', fontSize: 11, color: colors.textMuted },

  card: {
    backgroundColor: dark.bg1,
    borderRadius: 18, borderWidth: 1, borderColor: dark.lineSoft,
    overflow: 'hidden',
  },

  // Empty state
  emptyState: {
    padding: 32, alignItems: 'center', gap: 8,
    borderWidth: 1, borderStyle: 'dashed', borderColor: dark.line, borderRadius: 16,
  },
  emptyTitle: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textSecondary },
  emptyBody: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 17 },

  // PR rows
  prRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  prRowDivider: { borderBottomWidth: 1, borderBottomColor: dark.lineSoft },
  prLift: { fontFamily: 'Sora-SemiBold', fontSize: 13.5, color: colors.textPrimary },
  prSessions: { fontFamily: 'Sora-Regular', fontSize: 10.5, color: colors.textMuted, marginTop: 2 },
  prStat: { alignItems: 'flex-end', minWidth: 52 },
  prStatLabel: {
    fontFamily: 'Sora-SemiBold', fontSize: 8.5, letterSpacing: 0.6,
    textTransform: 'uppercase', color: colors.textMuted,
  },
  prStatValue: { fontFamily: 'JetBrainsMono-Medium', fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  prStatUnit: { fontFamily: 'Sora-Regular', fontSize: 9, color: colors.textMuted },
  prStatDelta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  prStatDeltaText: { fontFamily: 'Sora-SemiBold', fontSize: 10 },

  // Body metrics
  bodyMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bodyMetaLabel: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },
  bodyMetaValue: { fontFamily: 'JetBrainsMono-Medium', fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  bodyMetaUnit: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textSecondary },
  bodyMetaDelta: { fontFamily: 'Sora-SemiBold', fontSize: 14, marginTop: 4 },
  bodyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  bodyStatChip: {
    flex: 1, minWidth: 80,
    backgroundColor: dark.bg2, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 9,
    borderWidth: 1, borderColor: dark.lineSoft,
  },
  bodyStatLabel: { fontFamily: 'Sora-Regular', fontSize: 9.5, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  bodyStatValue: { fontFamily: 'JetBrainsMono-Medium', fontSize: 15, color: colors.textPrimary, marginTop: 3 },
  bodyStatPrev: { fontFamily: 'Sora-Regular', fontSize: 10 },
});
