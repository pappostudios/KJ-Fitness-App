import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, Alert, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useCoachSettings } from '../../hooks/useCoachSettings';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients, dark } from '../../theme/colors';

function Eyebrow({ children, accent, style }) {
  return (
    <Text style={[styles.eyebrow, accent && { color: colors.accent }, style]}>
      {children}
    </Text>
  );
}

export default function CoachSettingsScreen({ navigation }) {
  const { settings, loading } = useCoachSettings();
  const { t, language, setLanguage } = useLanguage();
  const [bitLink, setBitLink] = useState('');
  const [sessionPrice, setSessionPrice] = useState('');
  const [saving, setSaving] = useState(false);

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
      Alert.alert(t('settings.invalidLink'), t('settings.invalidLinkMsg'));
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'settings', 'coach'),
        { bitLink: trimmedLink, sessionPrice: trimmedPrice },
        { merge: true },
      );
      Alert.alert(t('settings.saved'), t('settings.savedMsg'));
      navigation.goBack();
    } catch {
      Alert.alert(t('settings.error'), t('settings.errorMsg'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

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
              <Eyebrow>{t('settings.eyebrow')}</Eyebrow>
              <Text style={styles.headerTitle}>{t('settings.paymentTitle')}</Text>
            </View>
          </View>

          {/* Language card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="language-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('settings.language')}</Text>
                <Text style={styles.cardSub}>{t('settings.languageSub')}</Text>
              </View>
            </View>
            <View style={styles.langRow}>
              <TouchableOpacity
                style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                onPress={() => setLanguage('en')}
                activeOpacity={0.8}
              >
                <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>
                  English
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, language === 'he' && styles.langBtnActive]}
                onPress={() => setLanguage('he')}
                activeOpacity={0.8}
              >
                <Text style={[styles.langBtnText, language === 'he' && styles.langBtnTextActive]}>
                  עברית
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bit link card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="link-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('settings.bitLink')}</Text>
                <Text style={styles.cardSub}>{t('settings.bitLinkSub')}</Text>
              </View>
            </View>
            <TextInput
              style={styles.input}
              value={bitLink}
              onChangeText={setBitLink}
              placeholder={t('settings.bitPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
            />
            <View style={styles.hint}>
              <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
              <Text style={styles.hintText}>{t('settings.bitHint')}</Text>
            </View>
          </View>

          {/* Session price card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Ionicons name="cash-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('settings.sessionPrice')}</Text>
                <Text style={styles.cardSub}>{t('settings.sessionPriceSub')}</Text>
              </View>
            </View>
            <TextInput
              style={styles.input}
              value={sessionPrice}
              onChangeText={setSessionPrice}
              placeholder={t('settings.pricePlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              returnKeyType="done"
              maxLength={6}
            />
          </View>

          {/* Info box */}
          <View style={styles.infoBox}>
            <Ionicons name="notifications-outline" size={16} color={colors.accent} style={{ marginTop: 1 }} />
            <Text style={styles.infoText}>{t('settings.infoText')}</Text>
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <LinearGradient colors={gradients.primary} style={styles.saveBtnGradient}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.saveBtnInner}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>{t('settings.save')}</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  eyebrow: {
    fontFamily: 'Sora-SemiBold', fontSize: 10.5, letterSpacing: 1.89,
    textTransform: 'uppercase', color: colors.textMuted,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.lineSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 26, color: colors.textPrimary, marginTop: 2 },

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

  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.line,
    alignItems: 'center',
  },
  langBtnActive: {
    backgroundColor: 'rgba(229,57,53,0.15)', borderColor: colors.accent,
  },
  langBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textMuted },
  langBtnTextActive: { color: colors.accent },

  input: {
    backgroundColor: dark.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: dark.line,
    paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textPrimary,
  },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { fontFamily: 'Sora-Regular', fontSize: 11.5, color: colors.textMuted, flex: 1 },

  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(229,57,53,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(229,57,53,0.2)', padding: 14,
  },
  infoText: { fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textSecondary, flex: 1, lineHeight: 19 },

  saveBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  saveBtnGradient: { padding: 16, alignItems: 'center' },
  saveBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: '#fff' },
});
