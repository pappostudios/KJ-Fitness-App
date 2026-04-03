import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients } from '../theme/colors';
import { typography } from '../theme/typography';

// Placeholder data — will come from Firebase later
const MOCK_PLAN = {
  weekOf: 'Apr 7 – Apr 13',
  workouts: [
    { day: 'Mon', name: 'Strength & Power', done: false },
    { day: 'Tue', name: 'Active Recovery', done: false },
    { day: 'Wed', name: 'Kettlebell Circuit', done: false },
    { day: 'Thu', name: 'Rest Day', done: false },
    { day: 'Fri', name: 'CrossFit Foundations', done: false },
  ],
  nutritionTip: 'Prioritize protein within 30 min post-workout.',
};

export default function WeeklyPlanCard({ onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.wrapper}
    >
      <LinearGradient
        colors={gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        {/* Header row */}
        <View style={styles.header}>
          <View>
            <Text style={styles.label}>📋  THIS WEEK'S PLAN</Text>
            <Text style={styles.weekOf}>{MOCK_PLAN.weekOf}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>5 days</Text>
          </View>
        </View>

        {/* Workout days */}
        <View style={styles.workoutList}>
          {MOCK_PLAN.workouts.slice(0, 3).map((w) => (
            <View key={w.day} style={styles.workoutRow}>
              <View style={styles.dayTag}>
                <Text style={styles.dayText}>{w.day}</Text>
              </View>
              <Text style={styles.workoutName}>{w.name}</Text>
              <Ionicons
                name={w.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={w.done ? '#fff' : 'rgba(255,255,255,0.4)'}
              />
            </View>
          ))}
          <Text style={styles.moreText}>+{MOCK_PLAN.workouts.length - 3} more days</Text>
        </View>

        {/* Nutrition tip */}
        <View style={styles.tipRow}>
          <Ionicons name="nutrition-outline" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.tipText}>{MOCK_PLAN.nutritionTip}</Text>
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>View Full Plan</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    // Shadow for iOS
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    // Shadow for Android
    elevation: 10,
  },
  container: {
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    ...typography.label,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    marginBottom: 4,
  },
  weekOf: {
    ...typography.h3,
    color: '#fff',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '600',
  },
  workoutList: {
    gap: 8,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayTag: {
    width: 36,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
  },
  workoutName: {
    ...typography.body,
    color: '#fff',
    flex: 1,
    fontSize: 14,
  },
  moreText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.6)',
    marginLeft: 46,
    fontSize: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    padding: 10,
    borderRadius: 10,
  },
  tipText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
    fontStyle: 'italic',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  ctaText: {
    ...typography.buttonSmall,
    color: '#fff',
  },
});
