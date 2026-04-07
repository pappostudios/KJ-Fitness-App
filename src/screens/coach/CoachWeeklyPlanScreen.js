/**
 * CoachWeeklyPlanScreen
 *
 * Coach creates and publishes a weekly training plan.
 * Each plan contains:
 *   - Up to 7 day slots (workout name per day, or "מנוחה")
 *   - A nutrition tip
 *   - A weekly insight / motivation quote
 *
 * On publish:
 *   - Saved to Firestore `weeklyPlans/` collection
 *   - All approved clients receive a push notification
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { sendPushNotificationToMany } from '../../utils/sendPushNotification';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

function getWeekLabel() {
  const today = new Date();
  // Find this Monday (or next if today is Sun)
  const day = today.getDay(); // 0=Sun
  const diff = day === 0 ? 1 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) =>
    d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoachWeeklyPlanScreen({ navigation }) {
  const [workouts, setWorkouts] = useState(
    DAYS.map((day, i) => ({ day, short: DAY_SHORT[i], name: '' }))
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

  // ── Publish ───────────────────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    const filledWorkouts = workouts.filter((w) => w.name.trim());
    if (filledWorkouts.length === 0) {
      Alert.alert('תוכנית ריקה', 'הוסף לפחות יום אחד לפני פרסום.');
      return;
    }

    setSaving(true);
    try {
      // 1. Save plan to Firestore
      await addDoc(collection(db, 'weeklyPlans'), {
        weekLabel: getWeekLabel(),
        weekStart: getMondayISO(),
        workouts: workouts.map((w) => ({
          day: w.day,
          short: w.short,
          name: w.name.trim() || 'מנוחה',
        })),
        nutritionTip: nutritionTip.trim(),
        insight: insight.trim(),
        isPublished: true,
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      // 2. Send push to all approved clients
      const snap = await getDocs(
        query(collection(db, 'users'), where('status', '==', 'approved'))
      );
      const tokens = snap.docs
        .map((d) => d.data().pushToken)
        .filter(Boolean);
      await sendPushNotificationToMany(
        tokens,
        '📋 תוכנית שבועית חדשה!',
        'קירסטן פרסמה את תוכנית האימון לשבוע הבא. בואי לראות!',
        { screen: 'Library' }
      );

      Alert.alert('פורסם בהצלחה ✓', `התוכנית נשלחה ל-${tokens.length} לקוחות.`, [
        { text: 'אישור', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert('שגיאה', 'לא הצלחנו לפרסם. נסה שוב.');
    } finally {
      setSaving(false);
    }
  }, [workouts, nutritionTip, insight, navigation]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>תוכנית שבועית</Text>
              <Text style={styles.headerSub}>{getWeekLabel()}</Text>
            </View>
          </View>

          {/* Weekly workouts */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Text style={styles.cardEmoji}>🏋️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>אימונים</Text>
                <Text style={styles.cardSub}>{filledDays} ימים מלאים</Text>
              </View>
            </View>

            {workouts.map((w, i) => (
              <View key={w.day} style={styles.dayRow}>
                <View style={styles.dayLabel}>
                  <Text style={styles.dayShort}>{w.short}</Text>
                  <Text style={styles.dayFull}>{w.day}</Text>
                </View>
                <TextInput
                  style={styles.dayInput}
                  value={w.name}
                  onChangeText={(v) => updateWorkout(i, v)}
                  placeholder="שם האימון / מנוחה"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                />
              </View>
            ))}
          </View>

          {/* Nutrition tip */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Text style={styles.cardEmoji}>🥗</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>טיפ תזונתי</Text>
                <Text style={styles.cardSub}>יופיע בתחתית הכרטיסיה</Text>
              </View>
            </View>
            <TextInput
              style={[styles.textArea]}
              value={nutritionTip}
              onChangeText={setNutritionTip}
              placeholder="לדוגמה: שלבי חלבון בכל ארוחה..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Weekly insight */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Text style={styles.cardEmoji}>💬</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>מסר שבועי</Text>
                <Text style={styles.cardSub}>השראה ומוטיבציה ללקוחות</Text>
              </View>
            </View>
            <TextInput
              style={styles.textArea}
              value={insight}
              onChangeText={setInsight}
              placeholder="לדוגמה: השבוע נתמקד בעקביות..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Push notice */}
          <View style={styles.infoBox}>
            <Ionicons name="notifications-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
            <Text style={styles.infoText}>
              בעת פרסום, כל הלקוחות המאושרים יקבלו התראת פוש עם התוכנית החדשה.
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
                  <Text style={styles.publishText}>פרסם תוכנית ({filledDays} ימים)</Text>
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },

  card: {
    backgroundColor: colors.card, borderRadius: 18,
    borderWidth: 1, borderColor: colors.cardBorder, padding: 18, gap: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.primaryGlow, justifyContent: 'center', alignItems: 'center',
  },
  cardEmoji: { fontSize: 20 },
  cardTitle: { ...typography.h4, color: colors.textPrimary },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  // Day rows
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayLabel: { width: 44, alignItems: 'center', gap: 1 },
  dayShort: { ...typography.h4, color: colors.primary, fontSize: 13 },
  dayFull: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  dayInput: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
    ...typography.body, color: colors.textPrimary,
  },

  // Text areas
  textArea: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    ...typography.body, color: colors.textPrimary,
    minHeight: 80,
  },

  // Info box
  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: colors.primaryGlow, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(0,188,212,0.2)', padding: 14,
  },
  infoText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 20 },

  // Publish button
  publishBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  publishGradient: { padding: 16, alignItems: 'center' },
  publishInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  publishText: { ...typography.button, color: '#fff' },
});
