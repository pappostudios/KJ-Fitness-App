import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, query, where, orderBy, onSnapshot,
  doc, getDoc, getDocs, addDoc, updateDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients, dark, elevation } from '../../theme/colors';
import { sendPushNotification } from '../../utils/sendPushNotification';

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function makeExerciseId() {
  return `ex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultWorkouts(t) {
  return [
    { key: 'w1', order: 0, name: t('trainingProgram.workout1'), isBonus: false, isTravelVariant: false, estMinutes: '50', notes: '', exercises: [] },
    { key: 'w2', order: 1, name: t('trainingProgram.workout2'), isBonus: false, isTravelVariant: false, estMinutes: '50', notes: '', exercises: [] },
    { key: 'w3', order: 2, name: t('trainingProgram.workout3'), isBonus: false, isTravelVariant: false, estMinutes: '50', notes: '', exercises: [] },
    { key: 'w4', order: 3, name: t('trainingProgram.workout4Bonus'), isBonus: true, isTravelVariant: false, estMinutes: '45', notes: '', exercises: [] },
    { key: 'travel', order: 4, name: t('trainingProgram.travelWorkout'), isBonus: false, isTravelVariant: true, estMinutes: '30', notes: '', exercises: [] },
  ];
}

function emptyDraft(t) {
  return {
    title: '',
    startDate: todayISO(),
    weeks: '8',
    targetSessionsPerWeek: '3',
    goalNote: '',
    workouts: defaultWorkouts(t),
  };
}

function cloneForNewBlock(program) {
  return {
    title: program.title ?? '',
    startDate: todayISO(),
    weeks: String(program.weeks ?? 8),
    targetSessionsPerWeek: String(program.targetSessionsPerWeek ?? 3),
    goalNote: program.goalNote ?? '',
    workouts: (program.workouts ?? []).map((w) => ({
      ...w,
      notes: w.notes ?? '',
      estMinutes: w.estMinutes != null ? String(w.estMinutes) : '',
      exercises: (w.exercises ?? []).map((e) => ({ ...e })),
    })),
  };
}

function draftFromProgram(program) {
  return {
    title: program.title ?? '',
    startDate: program.startDate ?? todayISO(),
    weeks: String(program.weeks ?? 8),
    targetSessionsPerWeek: String(program.targetSessionsPerWeek ?? 3),
    goalNote: program.goalNote ?? '',
    workouts: (program.workouts ?? []).map((w) => ({
      ...w,
      notes: w.notes ?? '',
      estMinutes: w.estMinutes != null ? String(w.estMinutes) : '',
      exercises: (w.exercises ?? []).map((e) => ({ ...e })),
    })),
  };
}

function computeCurrentWeek(startDate, weeks) {
  if (!startDate) return null;
  const start = new Date(startDate + 'T00:00:00');
  const now = new Date();
  const diffDays = Math.floor((now - start) / 86400000);
  if (diffDays < 0) return 1;
  const w = Math.floor(diffDays / 7) + 1;
  return Math.min(w, weeks || w);
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CoachTrainingProgramScreen({ route, navigation }) {
  const { clientId, clientName } = route.params;
  const { t, isRTL } = useLanguage();

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftId, setDraftId] = useState(null);       // existing doc id when editing in place
  const [isNewBlockFlow, setIsNewBlockFlow] = useState(false);
  const [oldActiveId, setOldActiveId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedWorkout, setExpandedWorkout] = useState(null);
  const [expandedPast, setExpandedPast] = useState(null);
  const [copyWorkout, setCopyWorkout] = useState(null); // the workout being copied to another client
  const [copyingTo, setCopyingTo] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'trainingPrograms'),
      where('clientId', '==', clientId),
      orderBy('programNumber', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setPrograms(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.warn('[CoachTrainingProgram] snapshot error:', err.code, err.message);
      setLoading(false);
    });
    return unsub;
  }, [clientId]);

  const activeProgram = useMemo(() => programs.find((p) => p.isActive), [programs]);
  const pastPrograms = useMemo(() => programs.filter((p) => !p.isActive), [programs]);
  const nextProgramNumber = (programs[0]?.programNumber ?? 0) + 1;

  // ── Enter editing modes ───────────────────────────────────────────────────
  const startCreate = () => {
    setDraft(emptyDraft(t));
    setDraftId(null);
    setIsNewBlockFlow(false);
    setOldActiveId(null);
    setEditing(true);
  };

  const startEdit = () => {
    setDraft(draftFromProgram(activeProgram));
    setDraftId(activeProgram.id);
    setIsNewBlockFlow(false);
    setOldActiveId(null);
    setEditing(true);
  };

  const startNewBlock = () => {
    setDraft(cloneForNewBlock(activeProgram));
    setDraftId(null);
    setIsNewBlockFlow(true);
    setOldActiveId(activeProgram.id);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(null);
    setDraftId(null);
    setIsNewBlockFlow(false);
    setOldActiveId(null);
  };

  // ── Draft mutation helpers ────────────────────────────────────────────────
  const setField = useCallback((key, val) => setDraft((d) => ({ ...d, [key]: val })), []);

  const updateWorkout = useCallback((wIdx, patch) => {
    setDraft((d) => {
      const workouts = [...d.workouts];
      workouts[wIdx] = { ...workouts[wIdx], ...patch };
      return { ...d, workouts };
    });
  }, []);

  const addWorkout = useCallback(() => {
    setDraft((d) => ({
      ...d,
      workouts: [
        ...d.workouts,
        {
          key: `w_${Date.now()}`, order: d.workouts.length,
          name: t('trainingProgram.newWorkout'), isBonus: false, isTravelVariant: false,
          estMinutes: '', notes: '', exercises: [],
        },
      ],
    }));
  }, [t]);

  const removeWorkout = useCallback((wIdx) => {
    setDraft((d) => ({ ...d, workouts: d.workouts.filter((_, i) => i !== wIdx) }));
  }, []);

  // Duplicate a workout within the current draft (same client, new slot)
  const duplicateWorkoutInDraft = useCallback((wIdx) => {
    setDraft((d) => {
      const src = d.workouts[wIdx];
      const copy = {
        ...src,
        key: `w_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: `${src.name} (copy)`,
        exercises: (src.exercises ?? []).map((e) => ({ ...e, id: makeExerciseId() })),
      };
      const workouts = [...d.workouts];
      workouts.splice(wIdx + 1, 0, copy);
      return { ...d, workouts };
    });
  }, []);

  // Copy a workout into another client's active program
  const copyWorkoutToClient = useCallback(async (targetClientId, targetClientName, workout) => {
    setCopyingTo(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'trainingPrograms'),
        where('clientId', '==', targetClientId),
        where('isActive', '==', true),
      ));
      if (snap.empty) {
        Alert.alert(
          t('trainingProgram.noActiveProgramTarget'),
          t('trainingProgram.noActiveProgramTargetMsg', { name: targetClientName }),
        );
        return;
      }
      const targetDoc = snap.docs[0];
      const targetData = targetDoc.data();
      const newWorkout = {
        key: `w_${Date.now()}`,
        order: (targetData.workouts?.length ?? 0),
        name: (workout.name ?? '').trim() || t('trainingProgram.newWorkout'),
        isBonus: !!workout.isBonus,
        isTravelVariant: !!workout.isTravelVariant,
        estMinutes: workout.estMinutes ? parseInt(workout.estMinutes, 10) : null,
        notes: (workout.notes ?? '').trim(),
        exercises: (workout.exercises ?? []).map((e, j) => ({
          id: makeExerciseId(),
          order: j,
          name: (e.name ?? '').trim(),
          targetSets: parseInt(e.targetSets, 10) || 0,
          targetReps: (e.targetReps ?? '').trim(),
          targetWeight: (e.targetWeight ?? '').trim(),
          notes: (e.notes ?? '').trim(),
        })),
      };
      await updateDoc(targetDoc.ref, {
        workouts: [...(targetData.workouts ?? []), newWorkout],
        updatedAt: serverTimestamp(),
      });
      setCopyWorkout(null);
      Alert.alert(t('trainingProgram.copiedToClient'), t('trainingProgram.copiedToClientMsg', { name: targetClientName }));
    } catch (e) {
      Alert.alert(t('trainingProgram.error'), e.message ?? t('trainingProgram.errorMsg'));
    } finally {
      setCopyingTo(false);
    }
  }, [t]);

  const addExercise = useCallback((wIdx) => {
    setDraft((d) => {
      const workouts = [...d.workouts];
      const w = workouts[wIdx];
      workouts[wIdx] = {
        ...w,
        exercises: [
          ...w.exercises,
          { id: makeExerciseId(), order: w.exercises.length, name: '', targetSets: '3', targetReps: '8-10', targetWeight: '', notes: '' },
        ],
      };
      return { ...d, workouts };
    });
  }, []);

  const updateExercise = useCallback((wIdx, exIdx, patch) => {
    setDraft((d) => {
      const workouts = [...d.workouts];
      const exercises = [...workouts[wIdx].exercises];
      exercises[exIdx] = { ...exercises[exIdx], ...patch };
      workouts[wIdx] = { ...workouts[wIdx], exercises };
      return { ...d, workouts };
    });
  }, []);

  const removeExercise = useCallback((wIdx, exIdx) => {
    setDraft((d) => {
      const workouts = [...d.workouts];
      workouts[wIdx] = { ...workouts[wIdx], exercises: workouts[wIdx].exercises.filter((_, i) => i !== exIdx) };
      return { ...d, workouts };
    });
  }, []);

  const moveExercise = useCallback((wIdx, exIdx, dir) => {
    setDraft((d) => {
      const workouts = [...d.workouts];
      const exercises = [...workouts[wIdx].exercises];
      const target = exIdx + dir;
      if (target < 0 || target >= exercises.length) return d;
      [exercises[exIdx], exercises[target]] = [exercises[target], exercises[exIdx]];
      workouts[wIdx] = { ...workouts[wIdx], exercises };
      return { ...d, workouts };
    });
  }, []);

  // ── Save ───────────────────────────────────────────────────────────────────
  const buildPayload = (publish, preservedFields = {}) => ({
    clientId,
    clientName,
    title: draft.title.trim() || t('trainingProgram.untitled'),
    startDate: draft.startDate,
    weeks: parseInt(draft.weeks, 10) || 8,
    targetSessionsPerWeek: parseInt(draft.targetSessionsPerWeek, 10) || 3,
    goalNote: draft.goalNote.trim(),
    isActive: true,
    isPublished: publish,
    publishedAt: publish ? serverTimestamp() : (preservedFields.publishedAt ?? null),
    updatedAt: serverTimestamp(),
    workouts: draft.workouts.map((w, i) => ({
      key: w.key,
      order: i,
      name: w.name.trim() || t('trainingProgram.newWorkout'),
      isBonus: !!w.isBonus,
      isTravelVariant: !!w.isTravelVariant,
      estMinutes: w.estMinutes ? parseInt(w.estMinutes, 10) : null,
      notes: w.notes?.trim() ?? '',
      exercises: w.exercises.map((e, j) => ({
        id: e.id,
        order: j,
        name: e.name.trim(),
        targetSets: parseInt(e.targetSets, 10) || 0,
        targetReps: (e.targetReps ?? '').trim(),
        targetWeight: (e.targetWeight ?? '').trim(),
        notes: (e.notes ?? '').trim(),
      })),
    })),
  });

  const handleSave = async (publish) => {
    if (!draft.title.trim()) {
      Alert.alert(t('trainingProgram.missingTitle'), t('trainingProgram.missingTitleMsg'));
      return;
    }
    setSaving(true);
    try {
      if (isNewBlockFlow) {
        const batch = writeBatch(db);
        if (oldActiveId) {
          batch.update(doc(db, 'trainingPrograms', oldActiveId), { isActive: false, updatedAt: serverTimestamp() });
        }
        const newRef = doc(collection(db, 'trainingPrograms'));
        batch.set(newRef, {
          ...buildPayload(publish),
          programNumber: nextProgramNumber,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
      } else if (draftId) {
        const existing = programs.find((p) => p.id === draftId);
        await updateDoc(doc(db, 'trainingPrograms', draftId), buildPayload(publish, existing));
      } else {
        await addDoc(collection(db, 'trainingPrograms'), {
          ...buildPayload(publish),
          programNumber: nextProgramNumber,
          createdAt: serverTimestamp(),
        });
      }

      if (publish) {
        try {
          const userSnap = await getDoc(doc(db, 'users', clientId));
          const token = userSnap.data()?.pushToken;
          if (token) {
            await sendPushNotification(
              token,
              t('trainingProgram.publishPushTitle'),
              t('trainingProgram.publishPushBody', { title: draft.title.trim() }),
              { screen: 'Home' },
            );
          }
        } catch { /* non-blocking */ }
      }

      cancelEdit();
    } catch (e) {
      Alert.alert(t('trainingProgram.error'), e.message ?? t('trainingProgram.errorMsg'));
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (editing) {
    return (
      <>
        <EditorView
          draft={draft}
          isNewBlockFlow={isNewBlockFlow}
          saving={saving}
          expandedWorkout={expandedWorkout}
          setExpandedWorkout={setExpandedWorkout}
          setField={setField}
          updateWorkout={updateWorkout}
          addWorkout={addWorkout}
          removeWorkout={removeWorkout}
          duplicateWorkout={duplicateWorkoutInDraft}
          onCopyToClient={setCopyWorkout}
          addExercise={addExercise}
          updateExercise={updateExercise}
          removeExercise={removeExercise}
          moveExercise={moveExercise}
          onCancel={cancelEdit}
          onSaveDraft={() => handleSave(false)}
          onPublish={() => handleSave(true)}
          t={t}
          isRTL={isRTL}
        />
        <ClientPickerModal
          visible={!!copyWorkout}
          excludeClientId={clientId}
          copying={copyingTo}
          onPick={(c) => copyWorkoutToClient(c.uid, c.name, copyWorkout)}
          onClose={() => setCopyWorkout(null)}
          t={t}
          isRTL={isRTL}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={dark.bg0} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{t('trainingProgram.eyebrow')}</Text>
          <Text style={styles.headerTitle}>{clientName}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {!activeProgram ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="barbell-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>{t('trainingProgram.noProgram')}</Text>
            <Text style={styles.emptySub}>{t('trainingProgram.noProgramSub')}</Text>
            <TouchableOpacity style={styles.createBtn} onPress={startCreate} activeOpacity={0.85}>
              <LinearGradient colors={gradients.primary} style={styles.createBtnInner}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.createBtnText}>{t('trainingProgram.createProgram')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.activeCard}>
            <View style={styles.activeCardHeader}>
              <LinearGradient colors={gradients.avatar} style={styles.numBadge}>
                <Text style={styles.numBadgeText}>{activeProgram.programNumber}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeTitle}>{activeProgram.title}</Text>
                <Text style={styles.activeSub}>
                  {t('trainingProgram.weekOf', {
                    current: computeCurrentWeek(activeProgram.startDate, activeProgram.weeks) ?? 1,
                    total: activeProgram.weeks,
                  })}
                  {!activeProgram.isPublished ? ` · ${t('trainingProgram.draft')}` : ''}
                </Text>
              </View>
            </View>

            {activeProgram.goalNote ? <Text style={styles.goalNote}>{activeProgram.goalNote}</Text> : null}

            <View style={styles.workoutBadgeRow}>
              {(activeProgram.workouts ?? []).map((w) => (
                <View key={w.key} style={styles.workoutBadge}>
                  <Text style={styles.workoutBadgeText}>{w.name}</Text>
                  {w.isBonus && <View style={styles.miniTag}><Text style={styles.miniTagText}>{t('trainingProgram.bonusLabel')}</Text></View>}
                  {w.isTravelVariant && <View style={[styles.miniTag, styles.miniTagTravel]}><Text style={styles.miniTagText}>{t('trainingProgram.travelLabel')}</Text></View>}
                </View>
              ))}
            </View>

            <View style={styles.activeActionsRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={startEdit} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
                <Text style={styles.secondaryBtnText}>{t('trainingProgram.editProgram')}</Text>
              </TouchableOpacity>
              {activeProgram.isPublished && (
                <TouchableOpacity style={styles.primaryBtnSmall} onPress={startNewBlock} activeOpacity={0.85}>
                  <LinearGradient colors={gradients.primary} style={styles.primaryBtnSmallInner}>
                    <Ionicons name="refresh" size={15} color="#fff" />
                    <Text style={styles.primaryBtnSmallText}>{t('trainingProgram.startNewBlock')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {pastPrograms.length > 0 && (
          <View style={styles.pastSection}>
            <Text style={styles.pastSectionTitle}>{t('trainingProgram.pastPrograms')}</Text>
            {pastPrograms.map((p) => {
              const isOpen = expandedPast === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.pastCard}
                  onPress={() => setExpandedPast(isOpen ? null : p.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.pastCardHeader}>
                    <View style={styles.numBadgeSmall}>
                      <Text style={styles.numBadgeSmallText}>{p.programNumber}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pastTitle}>{p.title}</Text>
                      <Text style={styles.pastSub}>{p.startDate} · {p.weeks} {t('trainingProgram.weeksLabel')}</Text>
                    </View>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  </View>
                  {isOpen && (
                    <View style={styles.pastWorkouts}>
                      {(p.workouts ?? []).map((w) => (
                        <Text key={w.key} style={styles.pastWorkoutLine}>
                          • {w.name} ({(w.exercises ?? []).length} {t('trainingProgram.exercisesLabel')})
                        </Text>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Editor view ───────────────────────────────────────────────────────────────
function EditorView({
  draft, isNewBlockFlow, saving, expandedWorkout, setExpandedWorkout,
  setField, updateWorkout, addWorkout, removeWorkout, duplicateWorkout, onCopyToClient,
  addExercise, updateExercise, removeExercise, moveExercise,
  onCancel, onSaveDraft, onPublish, t, isRTL,
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={dark.bg0} />
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onCancel} activeOpacity={0.7} disabled={saving}>
          <Text style={styles.modalCancel}>{t('trainingProgram.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.modalTitle}>
          {isNewBlockFlow ? t('trainingProgram.startNewBlock') : t('trainingProgram.editProgram')}
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

          {/* Header fields */}
          <View style={styles.formCard}>
            <FormRow label={t('trainingProgram.programTitle')}>
              <TextInput
                style={styles.formInput}
                value={draft.title}
                onChangeText={(v) => setField('title', v)}
                placeholder={t('trainingProgram.programTitlePlaceholder')}
                placeholderTextColor={colors.textMuted}
              />
            </FormRow>
            <FormRow label={t('trainingProgram.startDate')}>
              <TextInput
                style={styles.formInput}
                value={draft.startDate}
                onChangeText={(v) => setField('startDate', v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />
            </FormRow>
            <FormRow label={t('trainingProgram.weeks')}>
              <TextInput
                style={styles.formInput}
                value={draft.weeks}
                onChangeText={(v) => setField('weeks', v)}
                keyboardType="numeric"
                placeholder="8"
                placeholderTextColor={colors.textMuted}
              />
            </FormRow>
            <FormRow label={t('trainingProgram.targetSessions')}>
              <TextInput
                style={styles.formInput}
                value={draft.targetSessionsPerWeek}
                onChangeText={(v) => setField('targetSessionsPerWeek', v)}
                keyboardType="numeric"
                placeholder="3"
                placeholderTextColor={colors.textMuted}
              />
            </FormRow>
            <View style={styles.formNotesWrap}>
              <Text style={styles.formLabelBlock}>{t('trainingProgram.goalNote')}</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMulti]}
                value={draft.goalNote}
                onChangeText={(v) => setField('goalNote', v)}
                placeholder={t('trainingProgram.goalNotePlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Workouts */}
          <Text style={styles.sectionTitle}>{t('trainingProgram.workoutsSection')}</Text>
          {draft.workouts.map((w, wIdx) => (
            <WorkoutEditorCard
              key={w.key}
              workout={w}
              expanded={expandedWorkout === wIdx}
              onToggle={() => setExpandedWorkout(expandedWorkout === wIdx ? null : wIdx)}
              onUpdate={(patch) => updateWorkout(wIdx, patch)}
              onRemove={() => removeWorkout(wIdx)}
              onDuplicate={() => duplicateWorkout(wIdx)}
              onCopyToClient={() => onCopyToClient(w)}
              onAddExercise={() => addExercise(wIdx)}
              onUpdateExercise={(exIdx, patch) => updateExercise(wIdx, exIdx, patch)}
              onRemoveExercise={(exIdx) => removeExercise(wIdx, exIdx)}
              onMoveExercise={(exIdx, dir) => moveExercise(wIdx, exIdx, dir)}
              t={t}
            />
          ))}

          <TouchableOpacity style={styles.addWorkoutBtn} onPress={addWorkout} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color={colors.accent} />
            <Text style={styles.addWorkoutBtnText}>{t('trainingProgram.addWorkout')}</Text>
          </TouchableOpacity>

          {/* Save actions */}
          <View style={styles.saveRow}>
            <TouchableOpacity style={styles.saveDraftBtn} onPress={onSaveDraft} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={colors.textPrimary} /> : (
                <Text style={styles.saveDraftBtnText}>{t('trainingProgram.saveDraft')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.publishBtn} onPress={onPublish} disabled={saving} activeOpacity={0.85}>
              <LinearGradient colors={gradients.primary} style={styles.publishBtnInner}>
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.publishBtnText}>{t('trainingProgram.publish')}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function WorkoutEditorCard({
  workout, expanded, onToggle, onUpdate, onRemove, onDuplicate, onCopyToClient,
  onAddExercise, onUpdateExercise, onRemoveExercise, onMoveExercise, t,
}) {
  return (
    <View style={styles.workoutCard}>
      <TouchableOpacity style={styles.workoutCardHeader} onPress={onToggle} activeOpacity={0.85}>
        <Ionicons name="barbell-outline" size={18} color={colors.accent} />
        <Text style={styles.workoutCardName} numberOfLines={1}>{workout.name || t('trainingProgram.newWorkout')}</Text>
        <Text style={styles.workoutCardCount}>{workout.exercises.length}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.workoutCardBody}>
          <FormRow label={t('trainingProgram.workoutName')}>
            <TextInput
              style={styles.formInput}
              value={workout.name}
              onChangeText={(v) => onUpdate({ name: v })}
              placeholder={t('trainingProgram.newWorkout')}
              placeholderTextColor={colors.textMuted}
            />
          </FormRow>

          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.toggleChip, workout.isBonus && styles.toggleChipActive]}
              onPress={() => onUpdate({ isBonus: !workout.isBonus })}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleChipText, workout.isBonus && styles.toggleChipTextActive]}>
                {t('trainingProgram.bonusLabel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleChip, workout.isTravelVariant && styles.toggleChipActive]}
              onPress={() => onUpdate({ isTravelVariant: !workout.isTravelVariant })}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleChipText, workout.isTravelVariant && styles.toggleChipTextActive]}>
                {t('trainingProgram.travelLabel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteWorkoutBtn} onPress={onRemove} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>

          {/* Copy actions */}
          <View style={styles.copyRow}>
            <TouchableOpacity style={styles.copyBtn} onPress={onDuplicate} activeOpacity={0.8}>
              <Ionicons name="copy-outline" size={15} color={colors.accent} />
              <Text style={styles.copyBtnText}>{t('trainingProgram.duplicateWorkout')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.copyBtn} onPress={onCopyToClient} activeOpacity={0.8}>
              <Ionicons name="person-add-outline" size={15} color={colors.accent} />
              <Text style={styles.copyBtnText}>{t('trainingProgram.copyToClient')}</Text>
            </TouchableOpacity>
          </View>

          <FormRow label={t('trainingProgram.estMinutes')}>
            <TextInput
              style={styles.formInput}
              value={workout.estMinutes}
              onChangeText={(v) => onUpdate({ estMinutes: v })}
              keyboardType="numeric"
              placeholder="50"
              placeholderTextColor={colors.textMuted}
            />
          </FormRow>

          <View style={styles.formNotesWrap}>
            <Text style={styles.formLabelBlock}>{t('trainingProgram.workoutNotes')}</Text>
            <TextInput
              style={[styles.formInput, styles.formInputMulti, { height: 60 }]}
              value={workout.notes}
              onChangeText={(v) => onUpdate({ notes: v })}
              placeholder={t('trainingProgram.workoutNotesPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>

          {/* Exercises */}
          <Text style={styles.exercisesLabel}>{t('trainingProgram.exercisesSection')}</Text>
          {workout.exercises.map((ex, exIdx) => (
            <View key={ex.id} style={styles.exerciseRow}>
              <View style={styles.exerciseReorder}>
                <TouchableOpacity onPress={() => onMoveExercise(exIdx, -1)} disabled={exIdx === 0} activeOpacity={0.7}>
                  <Ionicons name="chevron-up" size={16} color={exIdx === 0 ? dark.line : colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onMoveExercise(exIdx, 1)} disabled={exIdx === workout.exercises.length - 1} activeOpacity={0.7}>
                  <Ionicons name="chevron-down" size={16} color={exIdx === workout.exercises.length - 1 ? dark.line : colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.exerciseFields}>
                <TextInput
                  style={styles.exerciseNameInput}
                  value={ex.name}
                  onChangeText={(v) => onUpdateExercise(exIdx, { name: v })}
                  placeholder={t('trainingProgram.exerciseNamePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.exerciseMetaRow}>
                  <TextInput
                    style={styles.exerciseMetaInput}
                    value={ex.targetSets}
                    onChangeText={(v) => onUpdateExercise(exIdx, { targetSets: v })}
                    keyboardType="numeric"
                    placeholder={t('trainingProgram.sets')}
                    placeholderTextColor={colors.textMuted}
                  />
                  <TextInput
                    style={styles.exerciseMetaInput}
                    value={ex.targetReps}
                    onChangeText={(v) => onUpdateExercise(exIdx, { targetReps: v })}
                    placeholder={t('trainingProgram.reps')}
                    placeholderTextColor={colors.textMuted}
                  />
                  <TextInput
                    style={[styles.exerciseMetaInput, { flex: 1.4 }]}
                    value={ex.targetWeight}
                    onChangeText={(v) => onUpdateExercise(exIdx, { targetWeight: v })}
                    placeholder={t('trainingProgram.targetWeight')}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <TextInput
                  style={styles.exerciseNotesInput}
                  value={ex.notes}
                  onChangeText={(v) => onUpdateExercise(exIdx, { notes: v })}
                  placeholder={t('trainingProgram.exerciseNotes')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <TouchableOpacity onPress={() => onRemoveExercise(exIdx)} activeOpacity={0.7} style={styles.exerciseDeleteBtn}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addExerciseBtn} onPress={onAddExercise} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={styles.addExerciseBtnText}>{t('trainingProgram.addExercise')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function FormRow({ label, children }) {
  return (
    <View style={styles.formRow}>
      <Text style={styles.formLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── Client picker (for "Copy workout to client") ──────────────────────────────
function ClientPickerModal({ visible, excludeClientId, copying, onPick, onClose, t, isRTL }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'client'),
      where('status', '==', 'approved'),
      orderBy('name'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setClients(snap.docs
        .map((d) => ({ uid: d.id, name: d.data().name || d.data().email || 'Client' }))
        .filter((c) => c.uid !== excludeClientId));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [visible, excludeClientId]);

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>{t('trainingProgram.copyToClientTitle')}</Text>

          <View style={styles.pickerSearch}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.pickerSearchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t('schedule.searchClient')}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {copying ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
          ) : loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
          ) : filtered.length === 0 ? (
            <Text style={styles.pickerEmpty}>{t('schedule.noClients')}</Text>
          ) : (
            <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {filtered.map((c) => (
                <TouchableOpacity key={c.uid} style={styles.pickerRow} onPress={() => onPick(c)} activeOpacity={0.75}>
                  <LinearGradient colors={gradients.avatar} style={styles.pickerAvatar}>
                    <Text style={styles.pickerAvatarText}>{c.name[0]?.toUpperCase() ?? '?'}</Text>
                  </LinearGradient>
                  <Text style={styles.pickerName}>{c.name}</Text>
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.pickerCancel} onPress={onClose} disabled={copying}>
            <Text style={styles.pickerCancelText}>{t('trainingProgram.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: dark.bg0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 16 },

  eyebrow: {
    fontFamily: 'Sora-SemiBold', fontSize: 10, letterSpacing: 1.8,
    textTransform: 'uppercase', color: colors.textMuted,
  },
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
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 18, color: colors.textPrimary },

  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: dark.bg2, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textSecondary },
  emptySub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, textAlign: 'center', maxWidth: 260 },
  createBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  createBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 12 },
  createBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: '#fff' },

  activeCard: {
    backgroundColor: dark.bg1, borderRadius: 18,
    borderWidth: 1, borderColor: dark.lineSoft, padding: 16, gap: 12,
  },
  activeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  numBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  numBadgeText: { fontFamily: 'Sora-Bold', fontSize: 14, color: '#fff' },
  activeTitle: { fontFamily: 'Sora-Bold', fontSize: 16, color: colors.textPrimary },
  activeSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  goalNote: { fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },

  workoutBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  workoutBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: dark.bg2, borderRadius: 999,
    borderWidth: 1, borderColor: dark.line,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  workoutBadgeText: { fontFamily: 'Sora-SemiBold', fontSize: 11.5, color: colors.textPrimary },
  miniTag: {
    backgroundColor: 'rgba(21,194,203,0.15)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  miniTagTravel: { backgroundColor: 'rgba(201,162,0,0.15)' },
  miniTagText: { fontFamily: 'Sora-Bold', fontSize: 8.5, color: colors.accent },

  activeActionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: dark.bg2, borderRadius: 12, borderWidth: 1, borderColor: dark.line,
    paddingVertical: 11,
  },
  secondaryBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textPrimary },
  primaryBtnSmall: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  primaryBtnSmallInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  primaryBtnSmallText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: '#fff' },

  pastSection: { gap: 10 },
  pastSectionTitle: {
    fontFamily: 'Sora-SemiBold', fontSize: 10.5, letterSpacing: 1.5,
    textTransform: 'uppercase', color: colors.textMuted,
  },
  pastCard: {
    backgroundColor: dark.bg1, borderRadius: 14,
    borderWidth: 1, borderColor: dark.lineSoft, padding: 12,
  },
  pastCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numBadgeSmall: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: dark.bg2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: dark.line,
  },
  numBadgeSmallText: { fontFamily: 'Sora-Bold', fontSize: 11, color: colors.textMuted },
  pastTitle: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textPrimary },
  pastSub: { fontFamily: 'Sora-Regular', fontSize: 11, color: colors.textMuted, marginTop: 1 },
  pastWorkouts: { marginTop: 10, gap: 3 },
  pastWorkoutLine: { fontFamily: 'Sora-Regular', fontSize: 11.5, color: colors.textSecondary },

  // Editor
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: dark.lineSoft,
  },
  modalTitle: { fontFamily: 'Sora-Bold', fontSize: 16, color: colors.textPrimary },
  modalCancel: { fontFamily: 'Sora-Regular', fontSize: 15, color: colors.textMuted },

  formContent: { padding: 16, gap: 16 },
  formCard: {
    backgroundColor: dark.bg1, borderRadius: 16,
    borderWidth: 1, borderColor: dark.lineSoft, overflow: 'hidden',
  },
  formRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: dark.lineSoft,
  },
  formLabel: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textPrimary, flex: 1 },
  formLabelBlock: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textPrimary, padding: 14, paddingBottom: 0 },
  formInput: {
    fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textPrimary,
    textAlign: 'right', minWidth: 100, padding: 0, flex: 1,
  },
  formNotesWrap: {},
  formInputMulti: {
    margin: 14, marginTop: 6, textAlign: 'left', height: 70,
    textAlignVertical: 'top', borderWidth: 0, flex: undefined,
  },

  sectionTitle: {
    fontFamily: 'Sora-SemiBold', fontSize: 10.5, letterSpacing: 1.7,
    textTransform: 'uppercase', color: colors.textMuted,
  },

  workoutCard: {
    backgroundColor: dark.bg1, borderRadius: 16,
    borderWidth: 1, borderColor: dark.line, overflow: 'hidden',
    ...elevation.e1,
  },
  workoutCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
  },
  workoutCardName: { flex: 1, fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  workoutCardCount: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },
  workoutCardBody: { padding: 14, paddingTop: 0, gap: 10 },

  chipRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  toggleChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.line,
  },
  toggleChipActive: { backgroundColor: 'rgba(21,194,203,0.15)', borderColor: colors.accent },
  toggleChipText: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.textMuted },
  toggleChipTextActive: { color: colors.accent },
  deleteWorkoutBtn: { marginLeft: 'auto', padding: 6 },

  copyRow: { flexDirection: 'row', gap: 8 },
  copyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(21,194,203,0.10)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(21,194,203,0.30)',
    paddingVertical: 9,
  },
  copyBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.accent },

  // Client picker modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: dark.bg1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 8, maxHeight: '80%',
  },
  pickerHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: dark.line, marginBottom: 16 },
  pickerTitle: { fontFamily: 'Sora-Bold', fontSize: 18, color: colors.textPrimary, textAlign: 'center', marginBottom: 16 },
  pickerSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: dark.bg2, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: dark.line, marginBottom: 12,
  },
  pickerSearchInput: { flex: 1, fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textPrimary },
  pickerList: { maxHeight: 320 },
  pickerEmpty: { fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 24 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: dark.line,
  },
  pickerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pickerAvatarText: { fontFamily: 'Sora-Bold', fontSize: 15, color: '#fff' },
  pickerName: { flex: 1, fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textPrimary },
  pickerCancel: { alignItems: 'center', paddingVertical: 14 },
  pickerCancelText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textMuted },

  exercisesLabel: {
    fontFamily: 'Sora-SemiBold', fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.textMuted, marginTop: 6,
  },
  exerciseRow: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: dark.bg2, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: dark.line,
  },
  exerciseReorder: { gap: 2, paddingTop: 2 },
  exerciseFields: { flex: 1, gap: 6 },
  exerciseNameInput: {
    fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textPrimary,
    borderBottomWidth: 1, borderBottomColor: dark.line, paddingBottom: 4,
  },
  exerciseMetaRow: { flexDirection: 'row', gap: 6 },
  exerciseMetaInput: {
    flex: 1, fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textSecondary,
    backgroundColor: dark.bg1, borderRadius: 8, borderWidth: 1, borderColor: dark.line,
    paddingHorizontal: 8, paddingVertical: 6,
  },
  exerciseNotesInput: {
    fontFamily: 'Sora-Regular', fontSize: 11.5, color: colors.textMuted,
  },
  exerciseDeleteBtn: { padding: 2 },

  addExerciseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderRadius: 10, borderWidth: 1, borderColor: colors.accent + '40',
    backgroundColor: colors.accent + '10',
    paddingVertical: 9, marginTop: 2,
  },
  addExerciseBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 12.5, color: colors.accent },

  addWorkoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 14, borderWidth: 1, borderColor: colors.accent + '40',
    backgroundColor: colors.accent + '10',
    paddingVertical: 13,
  },
  addWorkoutBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 13.5, color: colors.accent },

  saveRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  saveDraftBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: dark.line,
    backgroundColor: dark.bg2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
  },
  saveDraftBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  publishBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  publishBtnInner: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  publishBtnText: { fontFamily: 'Sora-Bold', fontSize: 14, color: '#fff' },
});
