import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, query, where, orderBy, limit, onSnapshot, getDocs,
  addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients, dark } from '../../theme/colors';

const FREEFORM_TYPES = [
  { key: 'strength',    emoji: '💪' },
  { key: 'cardio',      emoji: '🏃' },
  { key: 'flexibility', emoji: '🧘' },
  { key: 'swimming',    emoji: '🏊' },
  { key: 'cycling',     emoji: '🚴' },
  { key: 'sports',      emoji: '⚽' },
  { key: 'other',       emoji: '🏋️' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function LogWorkoutScreen({ navigation }) {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();

  const [activeProgram, setActiveProgram] = useState(null);
  const [loadingProgram, setLoadingProgram] = useState(true);
  const [recentEntries, setRecentEntries] = useState([]);
  const [step, setStep] = useState('pick'); // 'pick' | 'structured' | 'freeform'
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [exerciseSets, setExerciseSets] = useState({}); // { [exerciseId]: [{reps, weight}] }
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [freeformType, setFreeformType] = useState('strength');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'trainingPrograms'),
      where('clientId', '==', user.uid),
      where('isActive', '==', true),
      limit(1),
    );
    const unsub = onSnapshot(q, (snap) => {
      setActiveProgram(snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null);
      setLoadingProgram(false);
    }, (err) => {
      console.warn('[LogWorkout] activeProgram snapshot error:', err.code, err.message);
      setLoadingProgram(false);
    });
    return unsub;
  }, [user]);

  // One-time fetch of recent logs to pre-fill weights for structured logging
  useEffect(() => {
    if (!user) return;
    getDocs(query(
      collection(db, 'progress'),
      where('clientId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(30),
    )).then((snap) => {
      setRecentEntries(snap.docs.map((d) => d.data()));
    }).catch(() => {});
  }, [user]);

  function lastWeightFor(exerciseName) {
    for (const entry of recentEntries) {
      const match = (entry.exercises ?? []).find((ex) => ex.name === exerciseName);
      if (match?.sets?.length) {
        const top = Math.max(...match.sets.map((s) => s.weight || 0));
        if (top > 0) return String(top);
      }
    }
    return '';
  }

  const pickWorkout = (w) => {
    const initial = {};
    w.exercises.forEach((ex) => {
      const prefillWeight = lastWeightFor(ex.name);
      const count = Math.max(ex.targetSets || 1, 1);
      initial[ex.id] = Array.from({ length: count }, () => ({ reps: '', weight: prefillWeight }));
    });
    setExerciseSets(initial);
    setSelectedWorkout(w);
    setDuration(w.estMinutes != null ? String(w.estMinutes) : '');
    setStep('structured');
  };

  const pickFreeform = () => {
    setDuration('');
    setStep('freeform');
  };

  const backToPick = () => {
    setStep('pick');
    setSelectedWorkout(null);
    setNotes('');
  };

  const addSetRow = (exId) => {
    setExerciseSets((prev) => ({ ...prev, [exId]: [...prev[exId], { reps: '', weight: '' }] }));
  };

  const removeSetRow = (exId, idx) => {
    setExerciseSets((prev) => ({ ...prev, [exId]: prev[exId].filter((_, i) => i !== idx) }));
  };

  const updateSetRow = (exId, idx, patch) => {
    setExerciseSets((prev) => {
      const rows = [...prev[exId]];
      rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, [exId]: rows };
    });
  };

  const handleSaveStructured = async () => {
    setSaving(true);
    try {
      const exercises = selectedWorkout.exercises
        .map((ex) => {
          const sets = (exerciseSets[ex.id] ?? [])
            .filter((s) => s.reps || s.weight)
            .map((s) => ({ reps: parseInt(s.reps, 10) || 0, weight: parseFloat(s.weight) || 0 }));
          return {
            exerciseId: ex.id,
            name: ex.name,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps,
            sets,
          };
        })
        .filter((e) => e.sets.length > 0);

      await addDoc(collection(db, 'progress'), {
        clientId: user.uid,
        date: todayISO(),
        createdAt: serverTimestamp(),
        type: 'strength',
        duration: parseInt(duration, 10) || 0,
        notes: notes.trim(),
        programId: activeProgram.id,
        workoutKey: selectedWorkout.key,
        workoutName: selectedWorkout.name,
        exercises,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('trainingProgram.error'), e.message ?? t('trainingProgram.errorMsg'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFreeform = async () => {
    setSaving(true);
    try {
      await addDoc(collection(db, 'progress'), {
        clientId: user.uid,
        date: todayISO(),
        createdAt: serverTimestamp(),
        type: freeformType,
        duration: parseInt(duration, 10) || 0,
        notes: notes.trim(),
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('trainingProgram.error'), e.message ?? t('trainingProgram.errorMsg'));
    } finally {
      setSaving(false);
    }
  };

  const headerTitle =
    step === 'pick' ? t('logWorkout.title') :
    step === 'structured' ? selectedWorkout.name :
    t('logWorkout.freeform');

  const onBack = () => {
    if (step === 'pick') navigation.goBack();
    else backToPick();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {step === 'pick' && (
            loadingProgram ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
            ) : (
              <>
                <Text style={styles.pickLabel}>{t('logWorkout.pickWorkout')}</Text>
                {activeProgram ? (
                  <View style={styles.workoutChipList}>
                    {activeProgram.workouts.map((w) => (
                      <TouchableOpacity key={w.key} style={styles.workoutChip} onPress={() => pickWorkout(w)} activeOpacity={0.85}>
                        <Ionicons name="barbell-outline" size={18} color={colors.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.workoutChipName}>{w.name}</Text>
                          <Text style={styles.workoutChipSub}>{w.exercises.length} {t('trainingProgram.exercisesLabel')}</Text>
                        </View>
                        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noProgramBox}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noProgramTitle}>{t('logWorkout.noActiveProgram')}</Text>
                      <Text style={styles.noProgramSub}>{t('logWorkout.noActiveProgramSub')}</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity style={styles.freeformChip} onPress={pickFreeform} activeOpacity={0.85}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.freeformChipText}>{t('logWorkout.freeform')}</Text>
                </TouchableOpacity>
              </>
            )
          )}

          {step === 'structured' && selectedWorkout && (
            <>
              {selectedWorkout.exercises.map((ex) => (
                <View key={ex.id} style={styles.exerciseCard}>
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                  <Text style={styles.exerciseTarget}>
                    {t('logWorkout.targetLabel', {
                      sets: ex.targetSets, reps: ex.targetReps, weight: ex.targetWeight || '—',
                    })}
                  </Text>

                  <View style={styles.setHeaderRow}>
                    <Text style={[styles.setHeaderText, { flex: 0.6 }]}>{t('logWorkout.set')}</Text>
                    <Text style={styles.setHeaderText}>{t('logWorkout.reps')}</Text>
                    <Text style={styles.setHeaderText}>{t('logWorkout.weight')}</Text>
                    <View style={{ width: 28 }} />
                  </View>

                  {(exerciseSets[ex.id] ?? []).map((s, idx) => (
                    <View key={idx} style={styles.setRow}>
                      <Text style={styles.setIndex}>{idx + 1}</Text>
                      <TextInput
                        style={styles.setInput}
                        value={s.reps}
                        onChangeText={(v) => updateSetRow(ex.id, idx, { reps: v })}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                      />
                      <TextInput
                        style={styles.setInput}
                        value={s.weight}
                        onChangeText={(v) => updateSetRow(ex.id, idx, { weight: v })}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                      />
                      <TouchableOpacity onPress={() => removeSetRow(ex.id, idx)} style={styles.setRemoveBtn}>
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity style={styles.addSetBtn} onPress={() => addSetRow(ex.id)} activeOpacity={0.8}>
                    <Ionicons name="add" size={14} color={colors.accent} />
                    <Text style={styles.addSetBtnText}>{t('logWorkout.addSet')}</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.formCard}>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>{t('logWorkout.duration')}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={duration}
                    onChangeText={setDuration}
                    keyboardType="numeric"
                    placeholder="45"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <TextInput
                  style={[styles.formInput, styles.formInputMulti]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('logWorkout.notesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveStructured} disabled={saving} activeOpacity={0.85}>
                <LinearGradient colors={gradients.primary} style={styles.saveBtnInner}>
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.saveBtnText}>{t('logWorkout.saveLog')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {step === 'freeform' && (
            <>
              <View style={styles.typeChipRow}>
                {FREEFORM_TYPES.map((tp) => (
                  <TouchableOpacity
                    key={tp.key}
                    style={[styles.typeChip, freeformType === tp.key && styles.typeChipActive]}
                    onPress={() => setFreeformType(tp.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.typeChipEmoji}>{tp.emoji}</Text>
                    <Text style={[styles.typeChipText, freeformType === tp.key && styles.typeChipTextActive]}>
                      {t(`workoutType.${tp.key}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.formCard}>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>{t('logWorkout.duration')}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={duration}
                    onChangeText={setDuration}
                    keyboardType="numeric"
                    placeholder="30"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <TextInput
                  style={[styles.formInput, styles.formInputMulti]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('logWorkout.notesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveFreeform} disabled={saving} activeOpacity={0.85}>
                <LinearGradient colors={gradients.primary} style={styles.saveBtnInner}>
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.saveBtnText}>{t('logWorkout.saveLog')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: dark.bg0 },
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
  headerTitle: { flex: 1, fontFamily: 'Sora-Bold', fontSize: 17, color: colors.textPrimary },

  content: { padding: 16, gap: 14 },

  pickLabel: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textPrimary, marginBottom: 2 },
  workoutChipList: { gap: 10 },
  workoutChip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: dark.bg1, borderRadius: 16,
    borderWidth: 1, borderColor: dark.lineSoft, padding: 14,
  },
  workoutChipName: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  workoutChipSub: { fontFamily: 'Sora-Regular', fontSize: 11.5, color: colors.textMuted, marginTop: 2 },

  noProgramBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: dark.bg1, borderRadius: 14,
    borderWidth: 1, borderColor: dark.lineSoft, padding: 14,
  },
  noProgramTitle: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textPrimary },
  noProgramSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 17 },

  freeformChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: dark.line,
    paddingVertical: 14, marginTop: 4,
  },
  freeformChipText: { fontFamily: 'Sora-SemiBold', fontSize: 13.5, color: colors.textPrimary },

  exerciseCard: {
    backgroundColor: dark.bg1, borderRadius: 16,
    borderWidth: 1, borderColor: dark.lineSoft, padding: 14, gap: 8,
  },
  exerciseName: { fontFamily: 'Sora-Bold', fontSize: 15, color: colors.textPrimary },
  exerciseTarget: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },

  setHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  setHeaderText: {
    flex: 1, fontFamily: 'Sora-SemiBold', fontSize: 10, letterSpacing: 0.5,
    textTransform: 'uppercase', color: colors.textMuted, textAlign: 'center',
  },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setIndex: { flex: 0.6, fontFamily: 'JetBrainsMono-Medium', fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  setInput: {
    flex: 1, backgroundColor: dark.bg2, borderRadius: 10,
    borderWidth: 1, borderColor: dark.line,
    paddingVertical: 9, textAlign: 'center',
    fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary,
  },
  setRemoveBtn: { width: 28, alignItems: 'center' },

  addSetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: dark.line,
    paddingVertical: 8, marginTop: 2,
  },
  addSetBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.accent },

  typeChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: dark.bg1, borderRadius: 999,
    borderWidth: 1, borderColor: dark.lineSoft,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  typeChipActive: { backgroundColor: 'rgba(21,194,203,0.15)', borderColor: colors.accent },
  typeChipEmoji: { fontSize: 14 },
  typeChipText: { fontFamily: 'Sora-SemiBold', fontSize: 12.5, color: colors.textMuted },
  typeChipTextActive: { color: colors.accent },

  formCard: {
    backgroundColor: dark.bg1, borderRadius: 16,
    borderWidth: 1, borderColor: dark.lineSoft, overflow: 'hidden',
  },
  formRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: dark.lineSoft,
  },
  formLabel: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textPrimary },
  formInput: {
    fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textPrimary,
    textAlign: 'right', minWidth: 80, padding: 0,
  },
  formInputMulti: {
    margin: 14, textAlign: 'left', height: 70,
    textAlignVertical: 'top', borderWidth: 0,
  },

  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  saveBtnInner: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontFamily: 'Sora-Bold', fontSize: 15, color: '#fff' },
});
