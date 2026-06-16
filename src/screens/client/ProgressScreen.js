import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

// ── Sparkline (bar chart) ─────────────────────────────────────────────────────
function Sparkline({ data = [], width = 110, height = 28 }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const barWidth = Math.max(3, (width - (data.length - 1) * 3) / data.length);
  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
      {data.map((v, i) => {
        const barH = Math.max(2, ((v - min) / range) * height);
        const isLast = i === data.length - 1;
        return (
          <View
            key={i}
            style={{
              width: barWidth,
              height: barH,
              borderRadius: 2,
              backgroundColor: isLast ? colors.accent : 'rgba(229,57,53,0.3)',
            }}
          />
        );
      })}
    </View>
  );
}

// ── Eyebrow ───────────────────────────────────────────────────────────────────
function Eyebrow({ children, accent, style }) {
  return (
    <Text style={[styles.eyebrow, accent && { color: colors.accent }, style]}>
      {children}
    </Text>
  );
}

export default function ProgressScreen() {
  const { profile } = useAuth();
  const { t, isRTL } = useLanguage();
  const week = profile?.currentWeek ?? null;
  const totalWeeks = profile?.totalWeeks ?? null;

  // All real — loaded from Firestore (empty until data is entered)
  const PRS = [];
  const BODY = [];
  const streak = profile?.streak ?? 0;
  const sessionsCompleted = profile?.sessionsCompleted ?? 0;
  const sessionsTotal = profile?.sessionsTotal ?? 0;

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
              <Text style={styles.kpiValueMd}>{sessionsCompleted}</Text>
              {sessionsTotal > 0 && <Text style={styles.kpiUnit}>/ {sessionsTotal}</Text>}
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: sessionsTotal > 0 ? `${(sessionsCompleted / sessionsTotal) * 100}%` : '0%' },
                ]}
              />
            </View>
          </View>
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
                <View
                  key={p.lift}
                  style={[
                    styles.prRow,
                    i < PRS.length - 1 && styles.prRowDivider,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prLift}>{p.lift}</Text>
                    <Text style={[
                      styles.prDelta,
                      { color: p.deltaWeek > 0 ? colors.success : colors.textMuted },
                    ]}>
                      {p.deltaWeek > 0 ? `+${p.deltaWeek} kg this week` : '—'}
                    </Text>
                  </View>
                  {p.history?.length > 0 && (
                    <Sparkline data={p.history} width={100} height={28} />
                  )}
                  <View style={styles.prValueBox}>
                    <Text style={styles.prValue}>{p.current}</Text>
                    <Text style={styles.prUnit}>{p.unit}</Text>
                  </View>
                </View>
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

        {/* Body metrics */}
        <View style={styles.section}>
          <Eyebrow style={{ marginBottom: 12 }}>{t('progress.body')}</Eyebrow>
          {BODY.length > 0 ? (
            <View style={[styles.card, { padding: 16 }]}>
              <View style={styles.bodyMetaRow}>
                <View>
                  <Text style={styles.bodyMetaLabel}>{t('progress.weight')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                    <Text style={styles.bodyMetaValue}>{BODY[BODY.length - 1].weight}</Text>
                    <Text style={styles.bodyMetaUnit}>kg</Text>
                  </View>
                </View>
                {BODY.length > 1 && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.bodyMetaLabel}>Change ({BODY.length} wk)</Text>
                    <Text style={[styles.bodyMetaDelta, {
                      color: BODY[0].weight > BODY[BODY.length - 1].weight ? colors.success : colors.textMuted,
                    }]}>
                      {BODY[0].weight > BODY[BODY.length - 1].weight ? '−' : '+'}
                      {Math.abs(BODY[0].weight - BODY[BODY.length - 1].weight).toFixed(1)} kg
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ marginTop: 16 }}>
                <Sparkline data={BODY.map((b) => b.weight)} width={300} height={40} />
                <View style={styles.bodyWeekLabels}>
                  {BODY.map((b) => (
                    <Text key={b.week} style={styles.bodyWeekLabel}>{t('progress.week', { num: b.week })}</Text>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="body-outline" size={26} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('progress.noBody')}</Text>
              <Text style={styles.emptyBody}>{t('progress.bodySub')}</Text>
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
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
    borderColor: 'rgba(229,57,53,0.3)',
    backgroundColor: 'rgba(229,57,53,0.08)',
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
  prDelta: { fontFamily: 'Sora-Regular', fontSize: 11, marginTop: 2 },
  prValueBox: { alignItems: 'flex-end' },
  prValue: { fontFamily: 'JetBrainsMono-Medium', fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  prUnit: { fontFamily: 'Sora-SemiBold', fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted, marginTop: 2 },

  // Body metrics
  bodyMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bodyMetaLabel: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },
  bodyMetaValue: { fontFamily: 'JetBrainsMono-Medium', fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  bodyMetaUnit: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textSecondary },
  bodyMetaDelta: { fontFamily: 'Sora-SemiBold', fontSize: 14, marginTop: 4 },
  bodyWeekLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  bodyWeekLabel: { fontFamily: 'JetBrainsMono-Regular', fontSize: 9, color: colors.textMuted },
});
