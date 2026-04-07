import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { WeeklyBarsChart, TypeBreakdownChart, ActivityGridChart } from '../../components/ProgressCharts';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

const WORKOUT_TYPES = {
  strength:    { label: 'כוח',    emoji: '💪' },
  cardio:      { label: 'קרדיו',  emoji: '🏃' },
  flexibility: { label: 'גמישות', emoji: '🧘' },
  swimming:    { label: 'שחייה',  emoji: '🏊' },
  cycling:     { label: 'רכיבה',  emoji: '🚴' },
  sports:      { label: 'ספורט',  emoji: '⚽' },
  other:       { label: 'אחר',    emoji: '🏋️' },
};

function getTypeInfo(key) {
  return WORKOUT_TYPES[key] ?? WORKOUT_TYPES.other;
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return toISO(d);
}

function formatEntryDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today = toISO(new Date());
  const yesterday = toISO(new Date(Date.now() - 86400000));
  if (iso === today) return 'היום';
  if (iso === yesterday) return 'אתמול';
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'short' });
}

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

export default function ClientProgressScreen({ route, navigation }) {
  const { clientId, clientName } = route.params;
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('charts');

  // ── Live progress for this client ─────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'progress'),
      where('clientId', '==', clientId),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [clientId]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const weekStart = startOfWeek(new Date());
  const monthStart = startOfMonth(new Date());
  const thisWeek = entries.filter((e) => e.date >= weekStart).length;
  const thisMonth = entries.filter((e) => e.date >= monthStart).length;
  const streak = calcStreak(entries);
  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration ?? 0), 0);

  // Type breakdown
  const typeBreakdown = entries.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});
  const topType = Object.entries(typeBreakdown).sort(([, a], [, b]) => b - a)[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header with back button */}
        <LinearGradient colors={gradients.hero} style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerMain}>
            <View style={styles.clientAvatar}>
              <Text style={styles.clientAvatarText}>{getInitials(clientName)}</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>{clientName}</Text>
              <Text style={styles.headerSub}>{entries.length} אימונים סה"כ</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard value={thisWeek}  label="השבוע"       icon="🔥" highlight={thisWeek >= 3} />
          <StatCard value={thisMonth} label="החודש"       icon="📅" />
          <StatCard value={`${streak}d`} label="רצף"     icon="⚡" highlight={streak >= 3} />
          <StatCard value={`${Math.round(totalMinutes / 60)}h`} label='סה"כ שעות' icon="⏱️" />
        </View>

        {/* Favourite workout type */}
        {topType && (
          <View style={styles.topTypeCard}>
            <Text style={styles.topTypeEmoji}>{getTypeInfo(topType[0]).emoji}</Text>
            <View style={styles.topTypeText}>
              <Text style={styles.topTypeLabel}>אימון מועדף</Text>
              <Text style={styles.topTypeValue}>
                {getTypeInfo(topType[0]).label} · {topType[1]} פעמים
              </Text>
            </View>
          </View>
        )}

        {/* Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeView === 'charts' && styles.toggleBtnActive]}
            onPress={() => setActiveView('charts')}
          >
            <Text style={[styles.toggleText, activeView === 'charts' && styles.toggleTextActive]}>
              📊 גרפים
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeView === 'history' && styles.toggleBtnActive]}
            onPress={() => setActiveView('history')}
          >
            <Text style={[styles.toggleText, activeView === 'history' && styles.toggleTextActive]}>
              📋 היסטוריה
            </Text>
          </TouchableOpacity>
        </View>

        {/* Charts view */}
        {activeView === 'charts' && (
          <View style={styles.chartsSection}>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : entries.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyTitle}>עוד אין נתונים להצגה</Text>
              </View>
            ) : (
              <>
                <WeeklyBarsChart entries={entries} />
                <TypeBreakdownChart entries={entries} />
                <ActivityGridChart entries={entries} />
              </>
            )}
          </View>
        )}

        {/* History view */}
        {activeView === 'history' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>היסטוריית אימונים</Text>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : entries.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🏋️</Text>
                <Text style={styles.emptyTitle}>עוד לא תועד אימון</Text>
              </View>
            ) : (
              entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ value, label, icon, highlight }) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EntryCard({ entry }) {
  const type = getTypeInfo(entry.type);
  return (
    <View style={styles.entryCard}>
      <View style={styles.entryLeft}>
        <Text style={styles.entryEmoji}>{type.emoji}</Text>
      </View>
      <View style={styles.entryBody}>
        <View style={styles.entryTopRow}>
          <Text style={styles.entryType}>{type.label}</Text>
          <Text style={styles.entryDate}>{formatEntryDate(entry.date)}</Text>
        </View>
        <Text style={styles.entryDuration}>{entry.duration} דקות</Text>
        {entry.notes ? (
          <Text style={styles.entryNotes} numberOfLines={2}>{entry.notes}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function getInitials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },

  header: { paddingTop: 16, paddingBottom: 20, paddingHorizontal: 16 },
  backBtn: { marginBottom: 12 },
  headerMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryGlow,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: { ...typography.label, color: colors.primary },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  statCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    alignItems: 'center',
    gap: 5,
  },
  statCardHighlight: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  statIcon: { fontSize: 26 },
  statValue: { ...typography.h2, color: colors.textPrimary },
  statValueHighlight: { color: colors.primary },
  statLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },

  topTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
  },
  topTypeEmoji: { fontSize: 32 },
  topTypeText: { gap: 2 },
  topTypeLabel: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  topTypeValue: { ...typography.h4, color: colors.textPrimary },

  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.primaryGlow,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  toggleText: { ...typography.label, color: colors.textSecondary },
  toggleTextActive: { color: colors.primary },

  chartsSection: { padding: 16, gap: 16 },

  section: { padding: 16, gap: 10 },
  sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: 4 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { ...typography.h4, color: colors.textSecondary },

  entryCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  entryLeft: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
  },
  entryEmoji: { fontSize: 26 },
  entryBody: { flex: 1, padding: 14, gap: 3 },
  entryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryType: { ...typography.h4, color: colors.textPrimary },
  entryDate: { ...typography.caption, color: colors.textMuted },
  entryDuration: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  entryNotes: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
});
