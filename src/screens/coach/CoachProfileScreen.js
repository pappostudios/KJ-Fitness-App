import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';

function Eyebrow({ children, style }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

function Avatar({ initials, size = 80 }) {
  return (
    <LinearGradient
      colors={gradients.avatar}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </LinearGradient>
  );
}

export default function CoachProfileScreen({ navigation }) {
  const { user, profile, logOut } = useAuth();
  const { t, isRTL, language, setLanguage } = useLanguage();

  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty]   = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name   || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const initials = name.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'KJ';

  const markDirty = (setter) => (val) => { setter(val); setDirty(true); };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('coachProfile.error'), t('coachProfile.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { name: name.trim(), phone: phone.trim(), updatedAt: serverTimestamp() },
        { merge: true },
      );
      setDirty(false);
      Alert.alert(t('coachProfile.saved'), t('coachProfile.savedMsg'));
    } catch {
      Alert.alert(t('coachProfile.error'), t('coachProfile.errorMsg'));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('coachProfile.signOutTitle'), t('coachProfile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('coachProfile.signOut'), style: 'destructive', onPress: logOut },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
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
              <Eyebrow>{t('coachProfile.eyebrow')}</Eyebrow>
              <Text style={styles.headerTitle}>{t('coachProfile.title')}</Text>
            </View>
          </View>

          {/* Avatar + email */}
          <View style={styles.avatarSection}>
            <Avatar initials={initials} size={84} />
            <View style={styles.coachBadge}>
              <Ionicons name="shield-checkmark-outline" size={12} color={colors.accent} />
              <Text style={styles.coachBadgeText}>{t('coachProfile.coachBadge')}</Text>
            </View>
            <Text style={styles.emailText}>{user?.email}</Text>
          </View>

          {/* Edit fields */}
          <View style={styles.card}>
            <Field
              label={t('coachProfile.fullName')}
              icon="person-outline"
              value={name}
              onChangeText={markDirty(setName)}
              placeholder={t('coachProfile.namePlaceholder')}
            />
            <View style={styles.divider} />
            <Field
              label={t('coachProfile.phone')}
              icon="call-outline"
              value={phone}
              onChangeText={markDirty(setPhone)}
              placeholder={t('coachProfile.phonePlaceholder')}
              keyboardType="phone-pad"
            />
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, !dirty && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!dirty || saving}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={dirty ? gradients.primary : [dark.bg2, dark.bg2]}
              style={styles.saveBtnGradient}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color={dirty ? '#fff' : colors.textMuted} />
                  <Text style={[styles.saveBtnText, !dirty && { color: colors.textMuted }]}>
                    {t('coachProfile.save')}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.sectionDivider} />

          {/* Language */}
          <View style={styles.card}>
            <View style={styles.langSection}>
              <View style={styles.langHeader}>
                <View style={styles.linkIconWrap}>
                  <Ionicons name="language-outline" size={18} color={colors.accent} />
                </View>
                <Text style={styles.linkText}>{t('settings.language')}</Text>
              </View>
              <View style={styles.langRow}>
                <TouchableOpacity
                  style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                  onPress={() => setLanguage('en')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>English</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langBtn, language === 'he' && styles.langBtnActive]}
                  onPress={() => setLanguage('he')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langBtnText, language === 'he' && styles.langBtnTextActive]}>עברית</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.sectionDivider} />

          {/* Quick links */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('CoachSettings')}
              activeOpacity={0.7}
            >
              <View style={styles.linkIconWrap}>
                <Ionicons name="card-outline" size={18} color={colors.accent} />
              </View>
              <Text style={styles.linkText}>{t('coachProfile.paymentSettings')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('CoachWeeklyPlan')}
              activeOpacity={0.7}
            >
              <View style={styles.linkIconWrap}>
                <Ionicons name="calendar-outline" size={18} color={colors.accent} />
              </View>
              <Text style={styles.linkText}>{t('coachProfile.weeklyPlan')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Sign out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.signOutText}>{t('coachProfile.signOut')}</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, icon, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={colors.accent} style={{ marginTop: 2 }} />
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType || 'default'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dark.bg0 },
  content: { padding: 20, gap: 14 },

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

  avatarSection: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: 'Sora-Bold' },
  coachBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(229,57,53,0.12)', borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.35)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  coachBadgeText: { fontFamily: 'Sora-SemiBold', fontSize: 10, letterSpacing: 1.5, color: colors.accent },
  emailText: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted },

  card: {
    backgroundColor: dark.bg1, borderRadius: 18,
    borderWidth: 1, borderColor: dark.lineSoft, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: dark.lineSoft, marginHorizontal: 16 },

  field: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12 },
  fieldBody: { flex: 1 },
  fieldLabel: { fontFamily: 'Sora-Regular', fontSize: 11, color: colors.textMuted, marginBottom: 3 },
  fieldInput: {
    fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textPrimary, padding: 0,
  },

  saveBtn: { borderRadius: 16, overflow: 'hidden' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnGradient: {
    height: 52, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: '#fff' },

  sectionDivider: { height: 1, backgroundColor: dark.lineSoft },

  linkRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  linkIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(229,57,53,0.10)', alignItems: 'center', justifyContent: 'center',
  },
  linkText: { flex: 1, fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },

  langSection: { padding: 16, gap: 12 },
  langHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.line,
    alignItems: 'center',
  },
  langBtnActive: { backgroundColor: 'rgba(229,57,53,0.15)', borderColor: colors.accent },
  langBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textMuted },
  langBtnTextActive: { color: colors.accent },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(239,83,80,0.25)',
    backgroundColor: 'rgba(239,83,80,0.06)',
  },
  signOutText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.error },
});
