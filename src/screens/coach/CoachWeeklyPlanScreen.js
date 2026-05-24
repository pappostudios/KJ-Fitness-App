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
import { colors, gradients, dark } from '../../theme/colors';
import { sendPushNotificationToMany } from '../../utils/sendPushNotification';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

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
  const [workouts, setWorkouts] = useState(
    DAYS.map((day, i) => ({ day, short: DAY_SHORT[i], name: '' })),
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
      Alert.alert('Empty Plan', 'Add at least one day before publishing.');
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
          name: w.name.trim() || 'Rest',
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
        'Your coach has published this week\'s training plan. Check it out!',
        { screen: 'Library' },
      );

      Alert.alert('Published', `Plan sent to ${tokens.length} clients.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not publish. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [workouts, nutritionTip, insight, navigation, filledDays]);

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
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Eyebrow>PLAN</Eyebrow>
              <Text style={styles.headerTitle}>Weekly Plan</Text>
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
                <Text style={styles.cardTitle}>Workouts</Text>
                <Text style={styles.cardSub}>{filledDays} days filled</Text>
              </View>
            </View>

            {workouts.map((w, i) => (
              <View key={w.day} style={styles.dayRow}>
                <View style={styles.dayLabel}>
                  <Text style={styles.dayShort}>{w.short}</Text>
                  <Text style={styles.dayFull}>{w.day.slice(0, 3)}</Text>
                </View>
                <TextInput
                  style={[styles.dayInput, w.name.trim() && styles.dayInputFilled]}
                  value={w.name}
                  onChangeText={(v) => updateWorkout(i, v)}
                  placeholder="Session name / Rest"
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
                <Text style={styles.cardTitle}>Nutrition Tip</Text>
                <Text style={styles.cardSub}>Shown at the bottom of the plan card</Text>
              </View>
            </View>
            <TextInput
              style={styles.textArea}
              value={nutritionTip}
              onChangeText={setNutritionTip}
              placeholder="e.g. Include protein in every meal..."
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
                <Text style={styles.cardTitle}>Weekly Message</Text>
                <Text style={styles.cardSub}>Motivation and inspiration for clients</Text>
              </View>
            </View>
            <TextInput
              style={styles.textArea}
              value={insight}
              onChangeText={setInsight}
              placeholder="e.g. This week we focus on consistency..."
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
              All approved clients will receive a push notification when you publish.
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
                  <Text style={styles.publishText}>Publish Plan ({filledDays} days)</Text>
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
  dayLabel: { width: 44, alignItems: 'center', gap: 2 },
  dayShort: { fontFamily: 'Sora-SemiBold', fontSize: 11, letterSpacing: 0.5, color: colors.accent },
  dayFull: { fontFamily: 'Sora-Regular', fontSize: 10, color: colors.textMuted },
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
