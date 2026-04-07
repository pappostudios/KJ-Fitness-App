/**
 * CoachSettingsScreen
 *
 * Lets the coach configure:
 *   - Their Bit payment link  (e.g. https://bit.me/kjfitness)
 *   - Default session price   (displayed to clients on booking + SessionCard)
 *
 * Data is saved to Firestore: `settings/coach`
 * and read app-wide via the `useCoachSettings` hook.
 */

import React, { useState, useEffect } from 'react';
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
import { doc, setDoc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { useCoachSettings } from '../../hooks/useCoachSettings';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function CoachSettingsScreen({ navigation }) {
  const { settings, loading } = useCoachSettings();

  const [bitLink, setBitLink] = useState('');
  const [sessionPrice, setSessionPrice] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-fill fields once settings load
  useEffect(() => {
    if (!loading) {
      setBitLink(settings.bitLink || '');
      setSessionPrice(settings.sessionPrice || '');
    }
  }, [loading, settings.bitLink, settings.sessionPrice]);

  const handleSave = async () => {
    const trimmedLink = bitLink.trim();
    const trimmedPrice = sessionPrice.trim();

    if (trimmedLink && !trimmedLink.startsWith('http')) {
      Alert.alert('קישור לא תקין', 'הקישור חייב להתחיל ב-https://\nלדוגמה: https://bit.me/kjfitness');
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, 'settings', 'coach'),
        { bitLink: trimmedLink, sessionPrice: trimmedPrice },
        { merge: true }
      );
      Alert.alert('נשמר בהצלחה ✓', 'ההגדרות עודכנו.');
      navigation.goBack();
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשמור. נסה שוב.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

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
              <Text style={styles.headerTitle}>הגדרות תשלום</Text>
              <Text style={styles.headerSub}>הגדר את קישור Bit ומחיר האימון</Text>
            </View>
          </View>

          {/* Bit link card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Text style={styles.cardEmoji}>💙</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>קישור Bit</Text>
                <Text style={styles.cardSub}>הלקוחות יופנו לקישור זה לתשלום</Text>
              </View>
            </View>
            <TextInput
              style={styles.input}
              value={bitLink}
              onChangeText={setBitLink}
              placeholder="https://bit.me/kjfitness"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
            />
            <Text style={styles.hint}>
              פתחי את אפליקציית Bit ← פרופיל ← שתפי קישור אישי
            </Text>
          </View>

          {/* Session price card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="cash-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>מחיר אימון (₪)</Text>
                <Text style={styles.cardSub}>יוצג ללקוחות בעת הזמנה ותשלום</Text>
              </View>
            </View>
            <TextInput
              style={styles.input}
              value={sessionPrice}
              onChangeText={setSessionPrice}
              placeholder="180"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              returnKeyType="done"
              maxLength={6}
            />
          </View>

          {/* Info box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
            <Text style={styles.infoText}>
              לאחר שהלקוח ישלם בBit, סמן את ההזמנה כ"שולמה" מלשונית הזמנות בלוח הזמנים.
            </Text>
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <LinearGradient colors={gradients.primary} style={styles.saveBtnGradient}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : (
                  <View style={styles.saveBtnInner}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>שמור הגדרות</Text>
                  </View>
                )
              }
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },

  // Cards
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardEmoji: { fontSize: 20 },
  cardTitle: { ...typography.h4, color: colors.textPrimary },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  // Input
  input: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...typography.body,
    color: colors.textPrimary,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -4,
  },

  // Info box
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.primaryGlow,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,188,212,0.2)',
    padding: 14,
    alignItems: 'flex-start',
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },

  // Save button
  saveBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  saveBtnGradient: { padding: 16, alignItems: 'center' },
  saveBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtnText: { ...typography.button, color: '#fff' },
});
