import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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
  getDoc,
  getDocs,
  deleteDoc,
  doc,
  limit,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { useLanguage } from '../../context/LanguageContext';
import { WeeklyBarsChart, TypeBreakdownChart, ActivityGridChart, ExerciseHistoryChart } from '../../components/ProgressCharts';
import { colors, gradients, dark } from '../../theme/colors';
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
  const { t, isRTL } = useLanguage();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('charts');
  const [latestAssessment, setLatestAssessment] = useState(null);
  const [arrowConfig, setArrowConfig] = useState(null);
  const [medicalFlags, setMedicalFlags] = useState([]);
  const [waiver, setWaiver] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [activeProgram, setActiveProgram] = useState(null);
  const [expandedExercise, setExpandedExercise] = useState(null);

  // ── Remove client + revoke app access ─────────────────────────────────────
  async function deleteCollectionWhere(coll, field, value) {
    const snap = await getDocs(query(collection(db, coll), where(field, '==', value)));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  async function performRemoval() {
    setRemoving(true);
    try {
      // 1. Delete the client's data
      await Promise.all([
        deleteCollectionWhere('bookings', 'clientId', clientId),
        deleteCollectionWhere('progress', 'clientId', clientId),
        deleteCollectionWhere('assessments', 'clientId', clientId),
      ]);

      // 2. Delete their conversation + messages
      const msgsSnap = await getDocs(collection(db, 'conversations', clientId, 'messages'));
      await Promise.all(msgsSnap.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'conversations', clientId)).catch(() => {});
      await deleteDoc(doc(db, 'pendingRequests', clientId)).catch(() => {});

      // 3. Delete the profile doc LAST — this revokes app access.
      // Their app's live profile listener will see the doc disappear and sign them out.
      await deleteDoc(doc(db, 'users', clientId));

      Alert.alert(
        t('clientProgress.removed') || 'Client removed',
        t('clientProgress.removedMsg') || 'The client has been removed and no longer has access to the app.',
      );
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message ?? 'Could not remove client.');
    } finally {
      setRemoving(false);
    }
  }

  function confirmRemoval() {
    Alert.alert(
      t('clientProgress.removeTitle') || 'Remove client?',
      (t('clientProgress.removeWarning') ||
        'This permanently deletes {name} and all their data (sessions, progress, messages, assessments) and revokes their access to the app. This cannot be undone.')
        .replace('{name}', clientName),
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('clientProgress.removeConfirm') || 'Remove',
          style: 'destructive',
          onPress: performRemoval,
        },
      ],
    );
  }

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

  // ── Latest assessment summary + arrow config ──────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'assessments'),
      where('clientId', '==', clientId),
      orderBy('date', 'desc'),
      limit(1),
    );
    const unsub = onSnapshot(q, (snap) => {
      setLatestAssessment(snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null);
    });
    getDoc(doc(db, 'users', clientId)).then((d) => {
      const data = d.data();
      setArrowConfig(data?.assessmentArrowConfig ?? null);
      setMedicalFlags(data?.medicalFlags ?? []);
      setWaiver(data?.waiver ?? null);
    }).catch(() => {});
    return unsub;
  }, [clientId]);

  // ── Active training program ────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'trainingPrograms'),
      where('clientId', '==', clientId),
      where('isActive', '==', true),
      limit(1),
    );
    return onSnapshot(q, (snap) => {
      setActiveProgram(snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null);
    }, (err) => {
      console.warn('[ClientProgress] activeProgram snapshot error:', err.code, err.message);
    });
  }, [clientId]);

  // ── Distinct exercise names logged for this client ────────────────────────
  const exerciseNames = [...new Set(
    entries.flatMap((e) => (e.exercises ?? []).map((ex) => ex.name)).filter(Boolean)
  )];

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

  function formatEntryDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    const today = toISO(new Date());
    const yesterday = toISO(new Date(Date.now() - 86400000));
    if (iso === today) return t('clientProgress.today');
    if (iso === yesterday) return t('clientProgress.yesterday');
    return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'short' });
  }

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
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerMain}>
            <View style={styles.clientAvatar}>
              <Text style={styles.clientAvatarText}>{getInitials(clientName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{clientName}</Text>
              <Text style={styles.headerSub}>{t('clientProgress.totalWorkouts', { count: entries.length })}</Text>
            </View>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={confirmRemoval}
              disabled={removing}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              {removing
                ? <ActivityIndicator size="small" color={colors.error} />
                : <Ionicons name="trash-outline" size={20} color={colors.error} />}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Medical flags from intake waiver */}
        {medicalFlags.length > 0 && (
          <View style={styles.flagCard}>
            <View style={styles.flagCardHeader}>
              <Ionicons name="warning" size={18} color={colors.error} />
              <Text style={styles.flagCardTitle}>
                {t('clientProgress.medicalFlags')} ({medicalFlags.length})
              </Text>
            </View>
            <Text style={styles.flagCardSub}>{t('clientProgress.medicalFlagsSub')}</Text>
            <View style={styles.flagList}>
              {medicalFlags.map((flag, i) => (
                <View key={i} style={styles.flagChip}>
                  <Text style={styles.flagChipText}>{flag}</Text>
                </View>
              ))}
            </View>
            {waiver?.pastInjuries ? (
              <Text style={styles.flagInjuries}>
                {t('clientProgress.pastInjuries')}: {waiver.pastInjuries}
              </Text>
            ) : null}
            {waiver?.emergencyName ? (
              <Text style={styles.flagEmergency}>
                {t('clientProgress.emergency')}: {waiver.emergencyName}
                {waiver.emergencyRelation ? ` (${waiver.emergencyRelation})` : ''}
                {waiver.emergencyNumber ? ` · ${waiver.emergencyNumber}` : ''}
              </Text>
            ) : null}
          </View>
        )}

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard value={thisWeek}  label={t('clientProgress.thisWeek')}   icon="🔥" highlight={thisWeek >= 3} />
          <StatCard value={thisMonth} label={t('clientProgress.thisMonth')}  icon="📅" />
          <StatCard value={`${streak}d`} label={t('clientProgress.streak')} icon="⚡" highlight={streak >= 3} />
          <StatCard value={`${Math.round(totalMinutes / 60)}h`} label={t('clientProgress.totalHours')} icon="⏱️" />
        </View>

        {/* Favourite workout type */}
        {topType && (
          <View style={styles.topTypeCard}>
            <Text style={styles.topTypeEmoji}>{getTypeInfo(topType[0]).emoji}</Text>
            <View style={styles.topTypeText}>
              <Text style={styles.topTypeLabel}>{t('clientProgress.favorite')}</Text>
              <Text style={styles.topTypeValue}>
                {getTypeInfo(topType[0]).label} · {topType[1]} {t('clientProgress.times')}
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
              {t('clientProgress.charts')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeView === 'history' && styles.toggleBtnActive]}
            onPress={() => setActiveView('history')}
          >
            <Text style={[styles.toggleText, activeView === 'history' && styles.toggleTextActive]}>
              {t('clientProgress.history')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeView === 'body' && styles.toggleBtnActive]}
            onPress={() => setActiveView('body')}
          >
            <Text style={[styles.toggleText, activeView === 'body' && styles.toggleTextActive]}>
              {t('clientProgress.body')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeView === 'program' && styles.toggleBtnActive]}
            onPress={() => setActiveView('program')}
          >
            <Text style={[styles.toggleText, activeView === 'program' && styles.toggleTextActive]}>
              {t('clientProgress.program')}
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
                <Text style={styles.emptyTitle}>{t('clientProgress.noData')}</Text>
              </View>
            ) : (
              <>
                <WeeklyBarsChart entries={entries} />
                <TypeBreakdownChart entries={entries} />
                <ActivityGridChart entries={entries} />

                {exerciseNames.length > 0 && (
                  <View style={styles.exerciseTrendsSection}>
                    <Text style={styles.sectionTitle}>{t('clientProgress.exerciseTrends')}</Text>
                    {exerciseNames.map((name) => {
                      const isOpen = expandedExercise === name;
                      return (
                        <View key={name}>
                          <TouchableOpacity
                            style={styles.exerciseTrendRow}
                            onPress={() => setExpandedExercise(isOpen ? null : name)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="trending-up" size={16} color={colors.accent} />
                            <Text style={styles.exerciseTrendName}>{name}</Text>
                            <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                          {isOpen && (
                            <View style={{ marginTop: 8, marginBottom: 4 }}>
                              <ExerciseHistoryChart entries={entries} exerciseName={name} />
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* History view */}
        {activeView === 'history' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('clientProgress.historyTitle')}</Text>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : entries.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🏋️</Text>
                <Text style={styles.emptyTitle}>{t('clientProgress.noWorkouts')}</Text>
              </View>
            ) : (
              entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} formatEntryDate={formatEntryDate} t={t} />
              ))
            )}
          </View>
        )}

        {/* Body tab */}
        {activeView === 'body' && (
          <View style={styles.section}>
            {latestAssessment ? (
              <View style={styles.bodyCard}>
                <View style={styles.bodyCardHeader}>
                  <Text style={styles.bodyCardDate}>{t('assessment.lastAssessment')}: {latestAssessment.date}</Text>
                </View>
                <View style={styles.bodyMetrics}>
                  {latestAssessment.weight != null && (
                    <BodyMetric label={t('assessment.weight')} value={`${latestAssessment.weight} kg`} />
                  )}
                  {latestAssessment.bmi != null && (
                    <BodyMetric label={t('assessment.bmi')} value={latestAssessment.bmi} />
                  )}
                  {latestAssessment.bodyFat?.percentage != null && (
                    <BodyMetric label={t('assessment.bodyFatPct')} value={`${latestAssessment.bodyFat.percentage}%`} />
                  )}
                  {latestAssessment.bodyFat?.leanMass != null && (
                    <BodyMetric label={t('assessment.leanMass')} value={`${latestAssessment.bodyFat.leanMass} kg`} />
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📏</Text>
                <Text style={styles.emptyTitle}>{t('assessment.noAssessments')}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.bodyNavBtn}
              onPress={() => navigation.navigate('CoachClientAssessment', { clientId, clientName, arrowConfig })}
              activeOpacity={0.85}
            >
              <LinearGradient colors={gradients.primary} style={styles.bodyNavBtnInner}>
                <Ionicons name="body-outline" size={18} color="#fff" />
                <Text style={styles.bodyNavBtnText}>{t('assessment.viewAssessments')}</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Program tab */}
        {activeView === 'program' && (
          <View style={styles.section}>
            {activeProgram ? (
              <View style={styles.bodyCard}>
                <View style={styles.bodyCardHeader}>
                  <Text style={styles.programTitle}>{activeProgram.title}</Text>
                  <Text style={styles.bodyCardDate}>
                    {t('trainingProgram.weekOf', {
                      current: computeWeekNumber(activeProgram.startDate, activeProgram.weeks),
                      total: activeProgram.weeks,
                    })}
                    {!activeProgram.isPublished ? ` · ${t('trainingProgram.draft')}` : ''}
                  </Text>
                </View>
                <View style={styles.workoutBadgeRow}>
                  {(activeProgram.workouts ?? []).map((w) => (
                    <View key={w.key} style={styles.workoutBadge}>
                      <Text style={styles.workoutBadgeText}>{w.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🗓️</Text>
                <Text style={styles.emptyTitle}>{t('trainingProgram.noProgram')}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.bodyNavBtn}
              onPress={() => navigation.navigate('CoachTrainingProgram', { clientId, clientName })}
              activeOpacity={0.85}
            >
              <LinearGradient colors={gradients.primary} style={styles.bodyNavBtnInner}>
                <Ionicons name="barbell-outline" size={18} color="#fff" />
                <Text style={styles.bodyNavBtnText}>{t('trainingProgram.manageProgram')}</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function computeWeekNumber(startDate, weeks) {
  if (!startDate) return 1;
  const start = new Date(startDate + 'T00:00:00');
  const now = new Date();
  const diffDays = Math.floor((now - start) / 86400000);
  if (diffDays < 0) return 1;
  const w = Math.floor(diffDays / 7) + 1;
  return Math.min(w, weeks || w);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BodyMetric({ label, value }) {
  return (
    <View style={styles.bodyMetricItem}>
      <Text style={styles.bodyMetricLabel}>{label}</Text>
      <Text style={styles.bodyMetricValue}>{value}</Text>
    </View>
  );
}

function StatCard({ value, label, icon, highlight }) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EntryCard({ entry, formatEntryDate, t }) {
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
        <Text style={styles.entryDuration}>{entry.duration} {t('clientProgress.minutes')}</Text>
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
  removeBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(239, 83, 80, 0.12)',
  },
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

  flagCard: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: 'rgba(239, 83, 80, 0.08)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(239, 83, 80, 0.3)',
    padding: 16, gap: 8,
  },
  flagCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flagCardTitle: { fontFamily: 'Sora-Bold', fontSize: 15, color: colors.error },
  flagCardSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  flagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  flagChip: {
    backgroundColor: 'rgba(239, 83, 80, 0.14)', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  flagChipText: { fontFamily: 'Sora-SemiBold', fontSize: 11.5, color: colors.error },
  flagInjuries: {
    fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textSecondary,
    marginTop: 6, lineHeight: 18,
  },
  flagEmergency: {
    fontFamily: 'Sora-Medium', fontSize: 12.5, color: colors.textPrimary,
    marginTop: 2, lineHeight: 18,
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

  bodyCard: {
    backgroundColor: colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden', marginBottom: 12,
  },
  bodyCardHeader: { padding: 14, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  bodyCardDate: { ...typography.bodySmall, color: colors.textSecondary },
  bodyMetrics: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, gap: 8 },
  bodyMetricItem: {
    backgroundColor: dark.bg2, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.cardBorder, minWidth: 80, flex: 1,
  },
  bodyMetricLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 3 },
  bodyMetricValue: { ...typography.h4, color: colors.textPrimary },
  bodyNavBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  bodyNavBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 14,
  },
  bodyNavBtnText: { ...typography.label, color: '#fff', flex: 1 },

  exerciseTrendsSection: { gap: 8 },
  exerciseTrendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.cardBorder,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  exerciseTrendName: { flex: 1, fontFamily: 'Sora-SemiBold', fontSize: 13.5, color: colors.textPrimary },

  programTitle: { fontFamily: 'Sora-Bold', fontSize: 15, color: colors.textPrimary },
  workoutBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  workoutBadge: {
    backgroundColor: dark.bg2, borderRadius: 999,
    borderWidth: 1, borderColor: dark.line,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  workoutBadgeText: { fontFamily: 'Sora-SemiBold', fontSize: 11.5, color: colors.textPrimary },
});
