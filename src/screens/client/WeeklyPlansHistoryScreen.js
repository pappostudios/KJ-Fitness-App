/**
 * WeeklyPlansHistoryScreen
 *
 * Shows all published weekly plans in reverse-chronological order.
 * Each plan is expandable to show its workout days.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
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
import { db } from '../../config/firebase';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

const DAY_NAMES = {
  sunday: 'ראשון',
  monday: 'שני',
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי',
  saturday: 'שבת',
};

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── PlanItem ───────────────────────────────────────────────────────────────────

function PlanItem({ plan, isFirst }) {
  const [expanded, setExpanded] = useState(isFirst);

  const workouts = plan.workouts || [];
  const activeDays = workouts.filter((w) => w.name && w.name !== 'מנוחה');
  const restDays = workouts.filter((w) => w.name === 'מנוחה' || !w.name);

  const toggle = () => {
    setExpanded((v) => !v);
  };

  return (
    <View style={[styles.planCard, isFirst && styles.planCardCurrent]}>
      {/* Card header */}
      <TouchableOpacity style={styles.planHeader} onPress={toggle} activeOpacity={0.8}>
        <View style={styles.planHeaderLeft}>
          {isFirst && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>נוכחית</Text>
            </View>
          )}
          <Text style={styles.planWeekLabel}>{plan.weekLabel}</Text>
          <Text style={styles.planDate}>{formatDate(plan.publishedAt)}</Text>
        </View>

        <View style={styles.planHeaderRight}>
          <View style={styles.statChip}>
            <Ionicons name="barbell-outline" size={13} color={colors.primary} />
            <Text style={styles.statChipText}>{activeDays.length}</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textMuted}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded content */}
      {expanded && (
        <View style={styles.planBody}>
          {/* Nutrition tip */}
          {plan.nutritionTip ? (
            <View style={styles.tipRow}>
              <Ionicons name="nutrition-outline" size={14} color={colors.primary} />
              <Text style={styles.tipText}>{plan.nutritionTip}</Text>
            </View>
          ) : null}

          {/* Workout days */}
          <View style={styles.dayList}>
            {workouts.map((w, i) => {
              const isRest = !w.name || w.name === 'מנוחה';
              const dayLabel = DAY_NAMES[w.day?.toLowerCase?.()] || w.day || `יום ${i + 1}`;
              return (
                <View key={i} style={[styles.dayRow, isRest && styles.dayRowRest]}>
                  <View style={[styles.dayTag, isRest && styles.dayTagRest]}>
                    <Text style={[styles.dayTagText, isRest && styles.dayTagTextRest]}>
                      {w.short || dayLabel.slice(0, 1)}
                    </Text>
                  </View>
                  <View style={styles.dayContent}>
                    <Text style={[styles.dayName, isRest && styles.dayNameRest]}>
                      {isRest ? 'מנוחה' : w.name}
                    </Text>
                    {!isRest && w.exercises && (
                      <Text style={styles.dayExercises} numberOfLines={1}>
                        {Array.isArray(w.exercises)
                          ? w.exercises.slice(0, 3).join(' · ')
                          : w.exercises}
                      </Text>
                    )}
                  </View>
                  {isRest && (
                    <Ionicons name="bed-outline" size={16} color={colors.textMuted} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function WeeklyPlansHistoryScreen({ navigation }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'weeklyPlans'),
      where('isPublished', '==', true),
      orderBy('publishedAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText}>כל התוכניות</Text>
          {!loading && (
            <Text style={styles.headerCount}>{plans.length} תוכניות</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : plans.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="clipboard-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>אין תוכניות עדיין</Text>
          <Text style={styles.emptySub}>Kirsten תפרסם בקרוב</Text>
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <PlanItem plan={item} isFirst={index === 0} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { alignItems: 'center' },
  headerTitleText: { ...typography.h3, color: colors.textPrimary },
  headerCount: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  // States
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: { ...typography.h3, color: colors.textSecondary },
  emptySub: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  // List
  list: { padding: 20, paddingBottom: 40 },

  // Plan card
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  planCardCurrent: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },

  // Plan header row
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  planHeaderLeft: { flex: 1, gap: 4 },
  planHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currentBadge: {
    backgroundColor: colors.primaryGlow,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  currentBadgeText: { ...typography.caption, color: colors.primary, fontWeight: '700', fontSize: 10 },
  planWeekLabel: { ...typography.h4, color: colors.textPrimary },
  planDate: { ...typography.caption, color: colors.textMuted },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryGlow,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statChipText: { ...typography.caption, color: colors.primary, fontWeight: '700' },

  // Plan body
  planBody: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    padding: 16,
    gap: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.cardElevated,
    padding: 10,
    borderRadius: 10,
  },
  tipText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // Day rows
  dayList: { gap: 8 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
  },
  dayRowRest: { opacity: 0.5 },
  dayTag: {
    width: 32,
    height: 26,
    backgroundColor: colors.primaryGlow,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayTagRest: { backgroundColor: 'rgba(255,255,255,0.05)' },
  dayTagText: { ...typography.caption, color: colors.primary, fontWeight: '700', fontSize: 11 },
  dayTagTextRest: { color: colors.textMuted },
  dayContent: { flex: 1 },
  dayName: { ...typography.body, color: colors.textPrimary, fontSize: 14 },
  dayNameRest: { color: colors.textMuted },
  dayExercises: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
});
