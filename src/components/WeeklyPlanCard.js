/**
 * WeeklyPlanCard
 *
 * Shows the most recently published weekly plan from Firestore.
 * Fetches from `weeklyPlans` collection (isPublished == true),
 * ordered by publishedAt descending, limit 1.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
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
import { db } from '../config/firebase';
import { colors, gradients } from '../theme/colors';
import { typography } from '../theme/typography';

export default function WeeklyPlanCard({ onPress, onHistoryPress }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'weeklyPlans'),
      where('isPublished', '==', true),
      orderBy('publishedAt', 'desc'),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setPlan({ id: d.id, ...d.data() });
      } else {
        setPlan(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.wrapper, styles.emptyWrapper]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── No plan yet ─────────────────────────────────────────────────────────
  if (!plan) {
    return (
      <View style={[styles.wrapper, styles.emptyWrapper]}>
        <Ionicons name="clipboard-outline" size={28} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>אין תוכנית שבועית</Text>
        <Text style={styles.emptySub}>Kirsten תפרסם בקרוב</Text>
      </View>
    );
  }

  const workouts = plan.workouts || [];
  const preview = workouts.filter((w) => w.name && w.name !== 'מנוחה').slice(0, 3);
  const totalDays = workouts.filter((w) => w.name && w.name !== 'מנוחה').length;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.wrapper}>
      <LinearGradient
        colors={gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.label}>📋  תוכנית השבוע</Text>
            <Text style={styles.weekOf}>{plan.weekLabel}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalDays} ימים</Text>
          </View>
        </View>

        {/* Workout preview — up to 3 days */}
        <View style={styles.workoutList}>
          {preview.map((w, i) => (
            <View key={i} style={styles.workoutRow}>
              <View style={styles.dayTag}>
                <Text style={styles.dayText}>{w.short || w.day?.slice(0, 1)}</Text>
              </View>
              <Text style={styles.workoutName} numberOfLines={1}>{w.name}</Text>
              <Ionicons name="ellipse-outline" size={18} color="rgba(255,255,255,0.4)" />
            </View>
          ))}
          {totalDays > 3 && (
            <Text style={styles.moreText}>+{totalDays - 3} ימים נוספים</Text>
          )}
        </View>

        {/* Nutrition tip */}
        {plan.nutritionTip ? (
          <View style={styles.tipRow}>
            <Ionicons name="nutrition-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.tipText} numberOfLines={2}>{plan.nutritionTip}</Text>
          </View>
        ) : null}

        {/* CTA row: full plan + history link */}
        <View style={styles.ctaRow}>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>לתוכנית המלאה</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </View>
          {onHistoryPress && (
            <TouchableOpacity onPress={onHistoryPress} style={styles.historyLink}>
              <Text style={styles.historyLinkText}>כל התוכניות</Text>
              <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  emptyWrapper: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: { ...typography.h4, color: colors.textSecondary },
  emptySub: { ...typography.caption, color: colors.textMuted },

  container: { padding: 20, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { ...typography.label, color: 'rgba(255,255,255,0.75)', fontSize: 10, marginBottom: 4 },
  weekOf: { ...typography.h3, color: '#fff' },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  badgeText: { ...typography.caption, color: '#fff', fontWeight: '600' },

  workoutList: { gap: 8 },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayTag: {
    width: 36, height: 24, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6, justifyContent: 'center', alignItems: 'center',
  },
  dayText: { ...typography.caption, color: '#fff', fontWeight: '700', fontSize: 10 },
  workoutName: { ...typography.body, color: '#fff', flex: 1, fontSize: 14 },
  moreText: { ...typography.caption, color: 'rgba(255,255,255,0.6)', marginLeft: 46, fontSize: 12 },

  tipRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.15)', padding: 10, borderRadius: 10,
  },
  tipText: { ...typography.caption, color: 'rgba(255,255,255,0.8)', flex: 1, fontStyle: 'italic' },

  ctaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ctaText: { ...typography.buttonSmall, color: '#fff' },
  historyLink: { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.8 },
  historyLinkText: { ...typography.caption, color: 'rgba(255,255,255,0.65)', fontSize: 12 },
});
