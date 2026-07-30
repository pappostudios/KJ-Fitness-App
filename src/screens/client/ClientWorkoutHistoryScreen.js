import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, dark } from '../../theme/colors';
import { ExerciseHistoryChart } from '../../components/ProgressCharts';

const TYPE_EMOJI = {
  strength: '💪', cardio: '🏃', flexibility: '🧘', swimming: '🏊',
  cycling: '🚴', sports: '⚽', other: '🏋️',
};

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ClientWorkoutHistoryScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const exerciseName = route?.params?.exerciseName ?? null;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'progress'),
      where('clientId', '==', user.uid),
      orderBy('date', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, [user?.uid]);

  // When focused on a single exercise, only show sessions that contain it.
  const filtered = exerciseName
    ? entries.filter((e) => (e.exercises ?? []).some((ex) => ex.name === exerciseName))
    : entries;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {exerciseName || t('workoutHistory.title')}
        </Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="time-outline" size={40} color={colors.textMuted} />
          <Text style={s.emptyTitle}>{t('workoutHistory.empty')}</Text>
          <Text style={s.emptySub}>{t('workoutHistory.emptySub')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {exerciseName && (
            <View style={{ marginBottom: 8 }}>
              <ExerciseHistoryChart entries={entries} exerciseName={exerciseName} />
            </View>
          )}

          {filtered.map((entry) => {
            const isOpen = expanded === entry.id;
            const exercises = exerciseName
              ? (entry.exercises ?? []).filter((ex) => ex.name === exerciseName)
              : (entry.exercises ?? []);
            const title = entry.workoutName
              || `${TYPE_EMOJI[entry.type] ?? '🏋️'} ${t(`workoutType.${entry.type}`) ?? entry.type}`;

            return (
              <TouchableOpacity
                key={entry.id}
                style={s.card}
                onPress={() => setExpanded(isOpen ? null : entry.id)}
                activeOpacity={0.85}
              >
                <View style={s.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{title}</Text>
                    <Text style={s.cardDate}>{fmtDate(entry.date)}</Text>
                  </View>
                  {entry.duration ? (
                    <Text style={s.cardDuration}>{entry.duration} {t('clientProgress.minutes')}</Text>
                  ) : null}
                  {exercises.length > 0 && (
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} style={{ marginLeft: 8 }} />
                  )}
                </View>

                {isOpen && exercises.length > 0 && (
                  <View style={s.exList}>
                    {exercises.map((ex) => (
                      <View key={ex.exerciseId ?? ex.name} style={s.exBlock}>
                        <Text style={s.exName}>{ex.name}</Text>
                        <View style={s.setsWrap}>
                          {(ex.sets ?? []).map((set, i) => (
                            <View key={i} style={s.setChip}>
                              <Text style={s.setChipText}>
                                {t('workoutHistory.setsLabel', { reps: set.reps, weight: set.weight })}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {isOpen && exercises.length === 0 && entry.notes ? (
                  <Text style={s.notes}>{entry.notes}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: dark.bg0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  emptyTitle: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textSecondary },
  emptySub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: dark.lineSoft,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.lineSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { flex: 1, fontFamily: 'Sora-Bold', fontSize: 18, color: colors.textPrimary },

  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: dark.bg1, borderRadius: 16,
    borderWidth: 1, borderColor: dark.lineSoft, padding: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  cardDate: { fontFamily: 'Sora-Regular', fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  cardDuration: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.accent },

  exList: { marginTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: dark.lineSoft, paddingTop: 12 },
  exBlock: { gap: 6 },
  exName: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textPrimary },
  setsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  setChip: {
    backgroundColor: dark.bg2, borderRadius: 8,
    borderWidth: 1, borderColor: dark.line,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  setChipText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: colors.textSecondary },
  notes: { fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textSecondary, marginTop: 10, lineHeight: 18 },
});
