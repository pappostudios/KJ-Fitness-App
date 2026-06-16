import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, Alert, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, addDoc, getDocs, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients, dark } from '../../theme/colors';
import { sendPushNotificationToMany } from '../../utils/sendPushNotification';

function getWeekLabel() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? 1 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function getMondayISO() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? 1 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

function Eyebrow({ children, accent, style }) {
  return (
    <Text style={[styles.eyebrow, accent && { color: colors.accent }, style]}>
      {children}
    </Text>
  );
}

export default function CoachWeeklyPlanScreen({ navigation }) {
  const { t, isRTL } = useLanguage();

  const DAYS_KEYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_LABELS = [
    t('weeklyPlan.days.0'),
    t('weeklyPlan.days.1'),
    t('weeklyPlan.days.2'),
    t('weeklyPlan.days.3'),
    t('weeklyPlan.days.4'),
    t('weeklyPlan.days.5'),
    t('weeklyPlan.days.6'),
  ];

  const [workouts, setWorkouts] = useState(
    DAYS_KEYS.map((day, i) => ({ day, short: DAY_LABELS[i], name: '' })),
  );
  const [nutritionTip, setNutritionTip] = useState('');
  const [insight, setInsight] = useState('');
  const [saving, setSaving] = useState(false);

  const updateWorkout = useCallback((index, value) => {
    setWorkouts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: value };
      return next;
    });
  }, []);

  const filledDays = workouts.filter((w) => w.name.trim()).length;

  const handlePublish = useCallback(async () => {
    if (filledDays === 0) {
      Alert.alert(t('weeklyPlan.emptyPlan'), t('weeklyPlan.emptyPlanMsg'));
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'weeklyPlans'), {
        weekLabel: getWeekLabel(),
        weekStart: getMondayISO(),
        workouts: workouts.map((w) => ({
          day: w.day,
          short: w.short,
          name: w.name.trim() || t('plansHistory.rest'),
        })),
        nutritionTip: nutritionTip.trim(),
        insight: insight.trim(),
        isPublished: true,
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      const snap = await getDocs(
        query(collection(db, 'users'), where('status', '==', 'approved')),
      );
      const tokens = snap.docs.map((d) => d.data().pushToken).filter(Boolean);
      await sendPushNotificationToMany(
        tokens,
        'New Weekly Plan',
        t('weeklyPlan.publishNotification'),
        { screen: 'Library' },
      );

      Alert.alert(t('weeklyPlan.published'), t('weeklyPlan.publishedMsg', { count: tokens.length }), [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert(t('weeklyPlan.error'), t('weeklyPlan.errorMsg'));
    } finally {
      setSaving(false);
    }
  }, [workouts, nutritionTip, insight, navigation, filledDays, t]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Eyebrow>{t('weeklyPlan.eyebrow')}</Eyebrow>
              <Text style={styles.headerTitle}>{t('weeklyPlan.title')}</Text>
              <Text style={styles.headerSub}>{getWeekLabel()}</Text>
            </View>
          </View>

          {/* Workouts card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="barbell-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('weeklyPlan.workouts')}</Text>
                <Text style={styles.cardSub}>{t('weeklyPlan.daysFilled', { count: filledDays })}</Text>
              </View>
            </View>

            {workouts.map((w, i) => (
              <View key={w.day} style={styles.dayRow}>
                <View style={styles.dayLabel}>
                  <Text style={styles.dayShort}>{DAY_LABELS[i]}</Text>
                </View>
                <TextInput
                  style={[styles.dayInput, w.name.trim() && styles.dayInputFilled]}
                  value={w.name}
                  onChangeText={(v) => updateWorkout(i, v)}
                  placeholder={t('weeklyPlan.sessionPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                />
              </View>
            ))}
          </View>

          {/* Nutrition tip card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="nutrition-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('weeklyPlan.nutritionTip')}</Text>
                <Text style={styles.cardSub}>{t('weeklyPlan.nutritionSub')}</Text>
              </View>
            </View>
            <TextInput
              style={styles.textArea}
              value={nutritionTip}
              onChangeText={setNutritionTip}
              placeholder={t('weeklyPlan.nutritionPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Weekly message card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="chatbubble-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('weeklyPlan.weeklyMessage')}</Text>
                <Text style={styles.cardSub}>{t('weeklyPlan.weeklyMessageSub')}</Text>
              </View>
            </View>
            <TextInput
              style={styles.textArea}
              value={insight}
              onChangeText={setInsight}
              placeholder={t('weeklyPlan.weeklyMessagePlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Push notice */}
          <View style={styles.infoBox}>
            <Ionicons name="notifications-outline" size={16} color={colors.accent} style={{ marginTop: 1 }} />
            <Text style={styles.infoText}>
              {t('weeklyPlan.publishNotification')}
            </Text>
          </View>

          {/* Publish button */}
          <TouchableOpacity
            style={styles.publishBtn}
            onPress={handlePublish}
            disabled={saving}
            activeOpacity={0.85}
          >
            <LinearGradient colors={gradients.primary} style={styles.publishGradient}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.publishInner}>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.publishText}>{t('weeklyPlan.publishBtn', { count: filledDays })}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dark.bg0 },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16 },

  eyebrow: {
    fontFamily: 'Sora-SemiBold', fontSize: 10.5, letterSpacing: 1.89,
    textTransform: 'uppercase', color: colors.textMuted,
  },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.lineSoft,
    justifyContent: 'center', alignItems: 'center', marginTop: 4,
  },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 26, color: colors.textPrimary, marginTop: 2 },
  headerSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, marginTop: 2 },

  card: {
    backgroundColor: dark.bg1, borderRadius: 18,
    borderWidth: 1, borderColor: dark.lineSoft, padding: 18, gap: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(229,57,53,0.12)', borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.25)', justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  cardSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, marginTop: 2 },

  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayLabel: { width: 52, alignItems: 'center', gap: 2 },
  dayShort: { fontFamily: 'Sora-SemiBold', fontSize: 11, letterSpacing: 0.5, color: colors.accent },
  dayInput: {
    flex: 1, backgroundColor: dark.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: dark.line,
    paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textPrimary,
  },
  dayInputFilled: { borderColor: 'rgba(229,57,53,0.35)' },

  textArea: {
    backgroundColor: dark.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: dark.line,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textPrimary,
    minHeight: 80,
  },

  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(229,57,53,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(229,57,53,0.2)', padding: 14,
  },
  infoText: { fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textSecondary, flex: 1, lineHeight: 19 },

  publishBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  publishGradient: { padding: 16, alignItems: 'center' },
  publishInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  publishText: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: '#fff' },
});
