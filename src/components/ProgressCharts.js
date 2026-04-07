/**
 * ProgressCharts.js
 *
 * Pure React Native chart components — no external dependencies.
 * Designed to match the KJ Fitness dark theme.
 *
 * Exports:
 *   WeeklyBarsChart       – 7-day workout count bar chart
 *   TypeBreakdownChart    – horizontal bars per workout type
 *   ActivityGridChart     – 28-day activity dot calendar
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

// ── Shared helpers ────────────────────────────────────────────────────────────

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function offsetDay(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

// ── Workout type meta ─────────────────────────────────────────────────────────

const TYPE_META = {
  strength:    { label: 'כוח',    emoji: '💪', color: '#00BCD4' },
  cardio:      { label: 'קרדיו',  emoji: '🏃', color: '#FF5722' },
  flexibility: { label: 'גמישות', emoji: '🧘', color: '#9C27B0' },
  swimming:    { label: 'שחייה',  emoji: '🏊', color: '#2196F3' },
  cycling:     { label: 'רכיבה',  emoji: '🚴', color: '#4CAF50' },
  sports:      { label: 'ספורט',  emoji: '⚽', color: '#FF9800' },
  other:       { label: 'אחר',    emoji: '🏋️', color: '#607D8B' },
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. WeeklyBarsChart
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Shows workout count per day for the last 7 days.
 * @param {Array} entries – progress docs from Firestore
 */
export function WeeklyBarsChart({ entries = [] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build day objects for the last 7 days (Sun → today)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = offsetDay(today, -i);
    const iso = toISO(d);
    const count = entries.filter((e) => e.date === iso).length;
    days.push({
      iso,
      label: d.toLocaleDateString('he-IL', { weekday: 'narrow' }),
      count,
      isToday: i === 0,
    });
  }

  const maxCount = Math.max(...days.map((d) => d.count), 1);
  const BAR_TRACK = 100; // px — fixed track height

  return (
    <View style={s.card}>
      <ChartHeader title="פעילות שבועית" subtitle={`${days.reduce((n, d) => n + d.count, 0)} אימונים`} />

      <View style={s.weekBarsRow}>
        {days.map((day) => {
          const fillPx = Math.max((day.count / maxCount) * BAR_TRACK, day.count > 0 ? 6 : 0);
          return (
            <View key={day.iso} style={s.weekBarCol}>
              {/* Count label above bar */}
              <Text style={[s.weekBarCount, day.isToday && s.weekBarCountToday]}>
                {day.count > 0 ? day.count : ''}
              </Text>

              {/* Track */}
              <View style={[s.weekBarTrack, { height: BAR_TRACK }]}>
                <View
                  style={[
                    s.weekBarFill,
                    { height: fillPx },
                    day.isToday && s.weekBarFillToday,
                  ]}
                />
              </View>

              {/* Day label */}
              <Text style={[s.weekBarLabel, day.isToday && s.weekBarLabelToday]}>
                {day.label}
              </Text>

              {/* Today dot */}
              {day.isToday && <View style={s.todayDot} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. TypeBreakdownChart
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Horizontal bar chart breaking workouts down by type.
 * @param {Array} entries – progress docs from Firestore
 */
export function TypeBreakdownChart({ entries = [] }) {
  if (!entries.length) return null;

  // Count per type
  const counts = {};
  entries.forEach((e) => {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  });

  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const total = entries.length;
  const topCount = sorted[0]?.[1] ?? 1;

  return (
    <View style={s.card}>
      <ChartHeader title="פירוט סוגי אימון" subtitle={`${sorted.length} סוגים שונים`} />

      <View style={s.typeList}>
        {sorted.map(([key, count]) => {
          const meta = TYPE_META[key] ?? TYPE_META.other;
          const barPct = count / topCount; // relative to max bar width
          const pct = Math.round((count / total) * 100);

          return (
            <View key={key} style={s.typeRow}>
              {/* Icon + Label */}
              <View style={s.typeRowLeft}>
                <Text style={s.typeEmoji}>{meta.emoji}</Text>
                <Text style={s.typeLabel}>{meta.label}</Text>
              </View>

              {/* Bar */}
              <View style={s.typeBarTrack}>
                <View
                  style={[
                    s.typeBarFill,
                    { width: `${barPct * 100}%`, backgroundColor: meta.color },
                  ]}
                />
              </View>

              {/* Count + % */}
              <View style={s.typeRowRight}>
                <Text style={s.typeCount}>{count}</Text>
                <Text style={s.typePct}>{pct}%</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. ActivityGridChart
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 28-day activity grid. Each cell = one day.
 * Cells lit cyan when a workout was logged that day.
 * @param {Array} entries – progress docs from Firestore
 */
export function ActivityGridChart({ entries = [] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build 28 days, oldest → newest
  const activeDates = new Set(entries.map((e) => e.date));
  const cells = [];
  for (let i = 27; i >= 0; i--) {
    const d = offsetDay(today, -i);
    const iso = toISO(d);
    cells.push({
      iso,
      active: activeDates.has(iso),
      isToday: i === 0,
      label: d.getDate(),
    });
  }

  // Split into 4 weeks of 7
  const weeks = [];
  for (let w = 0; w < 4; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7));
  }

  const activeCount = cells.filter((c) => c.active).length;
  const pct = Math.round((activeCount / 28) * 100);

  return (
    <View style={s.card}>
      <ChartHeader
        title="28 ימים אחרונים"
        subtitle={`${activeCount} ימים פעילים · ${pct}% עקביות`}
      />

      {/* Day-of-week headers */}
      <View style={s.gridRow}>
        {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((d) => (
          <Text key={d} style={s.gridDOW}>{d}</Text>
        ))}
      </View>

      {/* Cells */}
      {weeks.map((week, wi) => (
        <View key={wi} style={s.gridRow}>
          {week.map((cell) => (
            <View
              key={cell.iso}
              style={[
                s.gridCell,
                cell.active && s.gridCellActive,
                cell.isToday && s.gridCellToday,
              ]}
            >
              <Text style={[s.gridLabel, cell.active && s.gridLabelActive]}>
                {cell.label}
              </Text>
            </View>
          ))}
        </View>
      ))}

      {/* Legend */}
      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: colors.cardBorder }]} />
          <Text style={s.legendText}>לא פעיל</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={s.legendText}>יום אימון</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#fff', borderWidth: 2, borderColor: colors.primary }]} />
          <Text style={s.legendText}>היום</Text>
        </View>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. WeightLineChart
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Dot chart for the last 10 weight entries.
 * @param {Array} metrics – metric docs from Firestore (each has .weight, .date)
 */
export function WeightLineChart({ metrics = [] }) {
  const withWeight = [...metrics]
    .filter((m) => m.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);

  if (withWeight.length < 2) {
    return (
      <View style={s.card}>
        <ChartHeader title="מעקב משקל" subtitle='תעד לפחות 2 מדידות לגרף' />
        <View style={s.weightEmpty}>
          <Text style={s.weightEmptyIcon}>⚖️</Text>
          <Text style={s.weightEmptyText}>עוד אין מספיק נתונים</Text>
        </View>
      </View>
    );
  }

  const weights = withWeight.map((m) => m.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = Math.max(maxW - minW, 1);
  const CHART_H = 80;
  const latest = withWeight[withWeight.length - 1];
  const first = withWeight[0];
  const diff = parseFloat((latest.weight - first.weight).toFixed(1));
  const diffSign = diff > 0 ? '+' : '';

  return (
    <View style={s.card}>
      <ChartHeader
        title="מעקב משקל"
        subtitle={`${latest.weight} ק"ג כעת · ${diffSign}${diff} ק"ג`}
      />
      <View style={[s.weightChart, { height: CHART_H + 24 }]}>
        {withWeight.map((m, i) => {
          const xPct = (i / (withWeight.length - 1)) * 94; // 94% max to avoid clipping
          const yPx = ((maxW - m.weight) / range) * CHART_H;
          const isLast = i === withWeight.length - 1;
          return (
            <View key={m.id ?? i} style={[s.weightDotWrap, { left: `${xPct}%`, top: yPx }]}>
              <View style={[s.weightDot, isLast && s.weightDotLatest]} />
              {isLast && <Text style={s.weightDotLabel}>{m.weight}</Text>}
            </View>
          );
        })}
      </View>
      <View style={s.weightMinMax}>
        <Text style={s.weightMinMaxText}>{minW} ק"ג מינ'</Text>
        <Text style={s.weightMinMaxText}>{maxW} ק"ג מקס'</Text>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared sub-component
// ══════════════════════════════════════════════════════════════════════════════

function ChartHeader({ title, subtitle }) {
  return (
    <View style={s.chartHeader}>
      <Text style={s.chartTitle}>{title}</Text>
      <Text style={s.chartSubtitle}>{subtitle}</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  // Card wrapper
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
    gap: 14,
  },

  // Chart header
  chartHeader: { gap: 2 },
  chartTitle: { ...typography.h4, color: colors.textPrimary },
  chartSubtitle: { ...typography.bodySmall, color: colors.textSecondary },

  // ── Weekly bar chart ──────────────────────────────────────────────────────
  weekBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekBarCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  weekBarCount: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    height: 14,
  },
  weekBarCountToday: { color: colors.primary, fontWeight: '700' },
  weekBarTrack: {
    width: '100%',
    maxWidth: 32,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekBarFill: {
    width: '100%',
    backgroundColor: colors.primaryDark,
    borderRadius: 6,
    minHeight: 0,
  },
  weekBarFillToday: { backgroundColor: colors.primary },
  weekBarLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  weekBarLabelToday: { color: colors.primary, fontWeight: '700' },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  // ── Type breakdown ────────────────────────────────────────────────────────
  typeList: { gap: 10 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeRowLeft: {
    width: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeEmoji: { fontSize: 16 },
  typeLabel: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  typeBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  typeBarFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 6,
  },
  typeRowRight: {
    width: 46,
    alignItems: 'flex-end',
    gap: 1,
  },
  typeCount: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '700' },
  typePct: { fontSize: 10, color: colors.textMuted },

  // ── Activity grid ─────────────────────────────────────────────────────────
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  gridDOW: {
    flex: 1,
    textAlign: 'center',
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 2,
  },
  gridCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  gridCellActive: {
    backgroundColor: colors.primaryGlow,
    borderColor: colors.primaryDark,
  },
  gridCellToday: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  gridLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '500',
  },
  gridLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // ── Weight chart ─────────────────────────────────────────────────────────
  weightChart: { position: 'relative', width: '100%' },
  weightDotWrap: { position: 'absolute', alignItems: 'center' },
  weightDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.primaryDark,
  },
  weightDotLatest: { backgroundColor: colors.primary, width: 14, height: 14, borderRadius: 7 },
  weightDotLabel: {
    ...typography.caption, fontSize: 11, color: colors.primary,
    fontWeight: '700', marginTop: 2,
  },
  weightMinMax: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 4,
  },
  weightMinMaxText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  weightEmpty: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  weightEmptyIcon: { fontSize: 28 },
  weightEmptyText: { ...typography.bodySmall, color: colors.textMuted },

  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
});
