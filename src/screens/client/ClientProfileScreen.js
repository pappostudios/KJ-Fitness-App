import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function ClientProfileScreen({ navigation }) {
  const { user, profile, logOut } = useAuth();
  const { t, language, setLanguage, isRTL } = useLanguage();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [goals, setGoals] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
      setGoals(profile.goals || '');
      setNotes(profile.notes || '');
    }
  }, [profile]);

  const getInitials = (n) => {
    if (!n) return '?';
    const parts = n.trim().split(' ');
    return parts.length >= 2
      ? parts[0][0].toUpperCase() + parts[1][0].toUpperCase()
      : parts[0][0].toUpperCase();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('clientProfile.error'), t('clientProfile.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          name: name.trim(),
          phone: phone.trim(),
          goals: goals.trim(),
          notes: notes.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setDirty(false);
      Alert.alert(t('clientProfile.saved'), t('clientProfile.savedMsg'));
    } catch {
      Alert.alert(t('clientProfile.error'), t('clientProfile.errorMsg'));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('clientProfile.signOutTitle'), t('clientProfile.signOutConfirm'), [
      { text: t('clientProfile.cancel'), style: 'cancel' },
      { text: t('clientProfile.signOut'), style: 'destructive', onPress: logOut },
    ]);
  };

  const markDirty = (setter) => (val) => {
    setter(val);
    setDirty(true);
  };

  const align = isRTL ? 'right' : 'left';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['rgba(20,184,166,0.08)', '#F8FAFC']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('clientProfile.title')}</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <LinearGradient colors={gradients.avatar} style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(name || profile?.name)}</Text>
            </LinearGradient>
            <Text style={styles.emailLabel}>{user?.email}</Text>
          </View>

          {/* Language section */}
          <View style={styles.langCard}>
            <View style={styles.langCardHeader}>
              <Ionicons name="language-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.langCardTitle, { textAlign: align }]}>{t('clientProfile.language')}</Text>
                <Text style={[styles.langCardSub, { textAlign: align }]}>{t('clientProfile.languageSub')}</Text>
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

          {/* Form */}
          <View style={styles.formCard}>
            <Field
              label={t('clientProfile.fullName')}
              icon="person-outline"
              value={name}
              onChangeText={markDirty(setName)}
              placeholder={t('clientProfile.namePlaceholder')}
              align={align}
            />
            <Divider />
            <Field
              label={t('clientProfile.phone')}
              icon="call-outline"
              value={phone}
              onChangeText={markDirty(setPhone)}
              placeholder={t('clientProfile.phonePlaceholder')}
              keyboardType="phone-pad"
              align={align}
            />
          </View>

          <Text style={[styles.sectionHeading, { textAlign: align }]}>{t('clientProfile.goals')}</Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.textArea}
              value={goals}
              onChangeText={markDirty(setGoals)}
              placeholder={t('clientProfile.goalsPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              textAlign={align}
            />
          </View>

          <Text style={[styles.sectionHeading, { textAlign: align }]}>{t('clientProfile.medicalNotes')}</Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={markDirty(setNotes)}
              placeholder={t('clientProfile.medicalPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              textAlign={align}
            />
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, !dirty && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!dirty || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{t('clientProfile.save')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sign out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={colors.error || '#FF5252'} />
            <Text style={styles.signOutText}>{t('clientProfile.signOut')}</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, icon, value, onChangeText, placeholder, keyboardType, align }) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={colors.primary} style={styles.fieldIcon} />
      <View style={styles.fieldBody}>
        <Text style={[styles.fieldLabel, { textAlign: align }]}>{label}</Text>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType || 'default'}
          textAlign={align}
        />
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 12 },

  avatarSection: { alignItems: 'center', paddingVertical: 8, gap: 10 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarText: { ...typography.h1, color: colors.primary, fontSize: 30 },
  emailLabel: { ...typography.caption, color: colors.textSecondary },

  langCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    gap: 12,
  },
  langCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  langCardTitle: { ...typography.label, color: colors.textPrimary, marginBottom: 2 },
  langCardSub: { ...typography.caption, color: colors.textMuted },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  langBtnActive: {
    backgroundColor: 'rgba(20,184,166,0.12)', borderColor: colors.primary,
  },
  langBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textMuted },
  langBtnTextActive: { color: colors.primary },

  formCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  fieldIcon: { marginTop: 14 },
  fieldBody: { flex: 1 },
  fieldLabel: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  fieldInput: {
    ...typography.body,
    color: colors.textPrimary,
    padding: 0,
  },
  divider: { height: 1, backgroundColor: colors.cardBorder, marginHorizontal: 16 },

  textArea: {
    ...typography.body,
    color: colors.textPrimary,
    padding: 16,
    minHeight: 90,
  },

  sectionHeading: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: 4,
  },

  saveBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { ...typography.button, color: '#fff' },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  signOutText: { ...typography.body, color: colors.error || '#FF5252', fontWeight: '600' },
});
