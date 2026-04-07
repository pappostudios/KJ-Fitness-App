import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { WeeklyBarsChart, TypeBreakdownChart, ActivityGridChart, WeightLineChart } from '../../components/ProgressCharts';

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKOUT_TYPES = [
  { key: 'strength',    label: 'כוח',      emoji: '💪' },
  { key: 'cardio',      label: 'קרדיו',    emoji: '🏃' },
  { key: 'flexibility', label: 'גמישות',   emoji: '🧘' },
  { key: 'swimming',    label: 'שחייה',    emoji: '🏊' },
  { key: 'cycling',     label: 'רכיבה',    emoji: '🚴' },
  { key: 'sports',      label: 'ספורט',    emoji: '⚽' },
  { key: 'other',       label: 'אחר',      emoji: '🏋️' },
];

const DURATION_PRESETS = [30, 45, 60, 75, 90];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonth(date) {
  return toISO(new Date(date.getFullYear(), date.getMonth(), 1));
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday = start of week
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

function getTypeInfo(key) {
  return WORKOUT_TYPES.find((t) => t.key === key) ?? WORKOUT_TYPES[WORKOUT_TYPES.length - 1];
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
    if (diff <= 1) {
      streak++;
      cursor = d;
    } else {
      break;
    }
  }
  return streak;
}

// ── Main Component ────────────────────────────────────────────────────────────

const ENERGY_LEVELS = [
  { value: 1, emoji: '😴', label: 'נמוך מאוד' },
  { value: 3, emoji: '😐', label: 'נמוך' },
  { value: 5, emoji: '🙂', label: 'בסדר' },
  { value: 7, emoji: '😊', label: 'טוב' },
  { value: 9, emoji: '🔥', label: 'מעולה' },
];

export default function ProgressScreen() {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('charts'); // 'charts' | 'history' | 'metrics'

  // Workout modal state
  const [showModal, setShowModal] = useState(false);
  const [newType, setNewType] = useState('strength');
  const [newDuration, setNewDuration] = useState(60);
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Metrics modal state
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newEnergy, setNewEnergy] = useState(7);
  const [newMetricNotes, setNewMetricNotes] = useState('');
  const [savingMetric, setSavingMetric] = useState(false);

  // ── Live progress entries ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'progress'),
      where('clientId', '==', user.uid),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // ── Live body metrics ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'metrics'),
      where('clientId', '==', user.uid),
      orderBy('date', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMetrics(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const today = toISO(new Date());
  const weekStart = startOfWeek(new Date());
  const monthStart = startOfMonth(new Date());

  const thisWeek = entries.filter((e) => e.date >= weekStart).length;
  const thisMonth = entries.filter((e) => e.date >= monthStart).length;
  const streak = calcStreak(entries);
  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration ?? 0), 0);

  // ── Log workout ───────────────────────────────────────────────────────────
  const logWorkout = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'progress'), {
        clientId: user.uid,
        clientName: profile?.name ?? user.email,
        date: today,
        type: newType,
        duration: newDuration,
        notes: newNotes.trim(),
        createdAt: serverTimestamp(),
      });
      setShowModal(false);
      setNewNotes('');
      setNewType('strength');
      setNewDuration(60);
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשמור את האימון. נסה שוב.');
    } finally {
      setSaving(false);
    }
  }, [saving, user, profile, today, newType, newDuration, newNotes]);

  const openModal = useCallback(() => {
    setNewType('strength');
    setNewDuration(60);
    setNewNotes('');
    setShowModal(true);
  }, []);

  // ── Log body metrics ──────────────────────────────────────────────────────
  const logMetric = useCallback(async () => {
    if (savingMetric) return;
    const w = parseFloat(newWeight);
    if (isNaN(w) || w <= 0) {
      Alert.alert('שגיאה', 'אנא הזן משקל תקין');
      return;
    }
    setSavingMetric(true);
    try {
      await addDoc(collection(db, 'metrics'), {
        clientId: user.uid,
        clientName: profile?.name ?? user.email,
        date: today,
        weight: w,
        energyLevel: newEnergy,
        notes: newMetricNotes.trim(),
        createdAt: serverTimestamp(),
      });
      setShowMetricModal(false);
      setNewWeight('');
      setNewEnergy(7);
      setNewMetricNotes('');
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשמור. נסה שוב.');
    } finally {
      setSavingMetric(false);
    }
  }, [savingMetric, newWeight, newEnergy, newMetricNotes, user, profile, today]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={gradients.hero} style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>מעקב התקדמות</Text>
              <Text style={styles.headerSub}>{entries.length} אימונים · {metrics.length} מדידות</Text>
            </View>
            <View style={styles.headerBtns}>
              <TouchableOpacity style={styles.logBtnSecondary} onPress={() => setShowMetricModal(true)} activeOpacity={0.85}>
                <Text style={styles.logBtnSecondaryText}>⚖️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logBtn} onPress={openModal} activeOpacity={0.85}>
                <LinearGradient colors={gradients.primary} style={styles.logBtnGradient}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.logBtnText}>תעד אימון</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard value={thisWeek} label="השבוע" icon="🔥" highlight={thisWeek >= 3} />
          <StatCard value={thisMonth} label="החודש" icon="📅" />
          <StatCard value={`${streak}d`} label="רצף" icon="⚡" highlight={streak >= 3} />
          <StatCard value={`${Math.round(totalMinutes / 60)}h`} label='סה"כ שעות' icon="⏱️" />
        </View>

        {/* View toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeView === 'charts' && styles.toggleBtnActive]}
            onPress={() => setActiveView('charts')}
          >
            <Ionicons name="stats-chart" size={15} color={activeView === 'charts' ? colors.primary : colors.textMuted} />
            <Text style={[styles.toggleText, activeView === 'charts' && styles.toggleTextActive]}>גרפים</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeView === 'history' && styles.toggleBtnActive]}
            onPress={() => setActiveView('history')}
          >
            <Ionicons name="list" size={15} color={activeView === 'history' ? colors.primary : colors.textMuted} />
            <Text style={[styles.toggleText, activeView === 'history' && styles.toggleTextActive]}>היסטוריה</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeView === 'metrics' && styles.toggleBtnActive]}
            onPress={() => setActiveView('metrics')}
          >
            <Ionicons name="scale" size={15} color={activeView === 'metrics' ? colors.primary : colors.textMuted} />
            <Text style={[styles.toggleText, activeView === 'metrics' && styles.toggleTextActive]}>מדדים</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : entries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>עוד לא תועד אימון</Text>
            <Text style={styles.emptySub}>לחץ על "תעד אימון" כדי להתחיל</Text>
          </View>
        ) : activeView === 'charts' ? (
          /* ── Charts view ── */
          <View style={styles.chartsSection}>
            <WeeklyBarsChart entries={entries} />
            <WeightLineChart metrics={metrics} />
            <TypeBreakdownChart entries={entries} />
            <ActivityGridChart entries={entries} />
          </View>
        ) : activeView === 'history' ? (
          /* ── History view ── */
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>היסטוריית אימונים</Text>
            {entries.length === 0
              ? <Text style={styles.emptySub}>לא תועדו אימונים עדיין</Text>
              : entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)
            }
          </View>
        ) : (
          /* ── Metrics view ── */
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>היסטוריית מדדים</Text>
            {metrics.length === 0
              ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>⚖️</Text>
                  <Text style={styles.emptyTitle}>עוד לא תועדו מדדים</Text>
                  <Text style={styles.emptySub}>לחץ על ⚖️ למעלה כדי להתחיל</Text>
                </View>
              )
              : metrics.map((m) => <MetricCard key={m.id} metric={m} />)
            }
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Log Metrics Modal */}
      <Modal
        visible={showMetricModal}
        transparent
        animationType="slide"
        onRequestClose={() => !savingMetric && setShowMetricModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>תיעוד מדדים ⚖️</Text>

            {/* Weight */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>משקל (ק"ג)</Text>
              <TextInput
                style={styles.weightInput}
                value={newWeight}
                onChangeText={setNewWeight}
                placeholder='למשל: 72.5'
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                textAlign="center"
              />
            </View>

            {/* Energy level */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>רמת אנרגיה</Text>
              <View style={styles.energyRow}>
                {ENERGY_LEVELS.map((e) => (
                  <TouchableOpacity
                    key={e.value}
                    style={[styles.energyChip, newEnergy === e.value && styles.energyChipSelected]}
                    onPress={() => setNewEnergy(e.value)}
                  >
                    <Text style={styles.energyEmoji}>{e.emoji}</Text>
                    <Text style={[styles.energyLabel, newEnergy === e.value && styles.energyLabelSelected]}>
                      {e.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>הערות (אופציונלי)</Text>
              <TextInput
                style={styles.notesInput}
                value={newMetricNotes}
                onChangeText={setNewMetricNotes}
                placeholder="איך הרגשת היום?"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={200}
                textAlign="right"
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={logMetric} disabled={savingMetric} activeOpacity={0.85}>
              <LinearGradient colors={gradients.primary} style={styles.saveBtnGradient}>
                {savingMetric
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>שמור מדדים ✓</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowMetricModal(false)} disabled={savingMetric}>
              <Text style={styles.cancelText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Log Workout Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>תיעוד אימון</Text>

            {/* Workout type */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>סוג אימון</Text>
              <View style={styles.typeGrid}>
                {WORKOUT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.typeChip, newType === t.key && styles.typeChipSelected]}
                    onPress={() => setNewType(t.key)}
                  >
                    <Text style={styles.typeEmoji}>{t.emoji}</Text>
                    <Text style={[styles.typeLabel, newType === t.key && styles.typeLabelSelected]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Duration */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>משך (דקות)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.durationRow}>
                {DURATION_PRESETS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.durationChip, newDuration === d && styles.durationChipSelected]}
                    onPress={() => setNewDuration(d)}
                  >
                    <Text style={[styles.durationText, newDuration === d && styles.durationTextSelected]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>הערות (אופציונלי)</Text>
              <TextInput
                style={styles.notesInput}
                value={newNotes}
                onChangeText={setNewNotes}
                placeholder="איך הרגשת? מה עשית?"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={300}
                textAlign="right"
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={logWorkout} disabled={saving} activeOpacity={0.85}>
              <LinearGradient colors={gradients.primary} style={styles.saveBtnGradient}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>שמור אימון ✓</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)} disabled={saving}>
              <Text style={styles.cancelText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

function MetricCard({ metric }) {
  const energy = ENERGY_LEVELS.find((e) => e.value === metric.energyLevel) ?? ENERGY_LEVELS[2];
  return (
    <View style={styles.entryCard}>
      <View style={styles.entryLeft}>
        <Text style={styles.entryEmoji}>{energy.emoji}</Text>
      </View>
      <View style={styles.entryBody}>
        <View style={styles.entryTopRow}>
          <Text style={styles.entryType}>{metric.weight ? `${metric.weight} ק"ג` : 'מדידה'}</Text>
          <Text style={styles.entryDate}>{formatEntryDate(metric.date)}</Text>
        </View>
        <Text style={styles.entryDuration}>אנרגיה: {energy.label}</Text>
        {metric.notes ? (
          <Text style={styles.entryNotes} numberOfLines={2}>{metric.notes}</Text>
        ) : null}
      </View>
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },

  // Header
  header: { paddingTop: 20, paddingBottom: 24, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },
  logBtn: { borderRadius: 14, overflow: 'hidden' },
  logBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  logBtnText: { ...typography.button, color: '#fff' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
  },
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
  statCardHighlight: {
    backgroundColor: colors.primaryGlow,
    borderColor: colors.primary,
  },
  statIcon: { fontSize: 26 },
  statValue: { ...typography.h2, color: colors.textPrimary },
  statValueHighlight: { color: colors.primary },
  statLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },

  // View toggle
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  toggleBtnActive: { backgroundColor: colors.primaryGlow },
  toggleText: { ...typography.buttonSmall, color: colors.textMuted },
  toggleTextActive: { color: colors.primary },

  // Charts section
  chartsSection: { padding: 12, gap: 12 },

  // Section
  section: { padding: 16, gap: 10 },
  sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: 4 },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { ...typography.h4, color: colors.textSecondary },
  emptySub: { ...typography.bodySmall, color: colors.textMuted },

  // Entry card
  entryCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    gap: 0,
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

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 44,
    gap: 16,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  modalTitle: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },

  // Form elements
  formGroup: { gap: 10 },
  formLabel: { ...typography.label, color: colors.textSecondary },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  typeChipSelected: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  typeEmoji: { fontSize: 22 },
  typeLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  typeLabelSelected: { color: colors.primary },
  durationRow: { gap: 8, paddingVertical: 2 },
  durationChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationChipSelected: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  durationText: { ...typography.h4, color: colors.textSecondary },
  durationTextSelected: { color: colors.primary },
  notesInput: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 80,
    maxHeight: 120,
  },

  // Header buttons
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logBtnSecondary: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  logBtnSecondaryText: { fontSize: 20 },

  // Weight input
  weightInput: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // Energy chips
  energyRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  energyChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
    minWidth: 52,
  },
  energyChipSelected: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  energyEmoji: { fontSize: 18 },
  energyLabel: { ...typography.caption, color: colors.textMuted, fontSize: 9, textAlign: 'center' },
  energyLabelSelected: { color: colors.primary },

  // Buttons
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  saveBtnGradient: { padding: 16, alignItems: 'center' },
  saveBtnText: { ...typography.button, color: '#fff' },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelText: { ...typography.button, color: colors.textSecondary },
});
