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
  Switch,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doc, setDoc, serverTimestamp,
  collection, query, where, getDocs, deleteDoc,
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { db, auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients, elevation } from '../../theme/colors';
import { typography } from '../../theme/typography';

const DAILY_PREF_KEY = 'kj_daily_reminder';
const DAILY_ID_KEY = 'kj_daily_reminder_id';

export default function ClientProfileScreen({ navigation }) {
  const { user, profile, logOut } = useAuth();
  const { t, language, setLanguage, isRTL } = useLanguage();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [goals, setGoals] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dailyReminder, setDailyReminder] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
      setGoals(profile.goals || '');
      setNotes(profile.notes || '');
    }
  }, [profile]);

  useEffect(() => {
    AsyncStorage.getItem(DAILY_PREF_KEY).then((v) => setDailyReminder(v === '1')).catch(() => {});
  }, []);

  const toggleDailyReminder = async (on) => {
    setDailyReminder(on);
    try {
      // Cancel any existing daily reminder first
      const prevId = await AsyncStorage.getItem(DAILY_ID_KEY);
      if (prevId) await Notifications.cancelScheduledNotificationAsync(prevId).catch(() => {});

      if (on) {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') await Notifications.requestPermissionsAsync();
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: t('reminders.dailyTitle'),
            body: t('reminders.dailyBody'),
            sound: 'default',
            data: { screen: 'Progress' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 19, minute: 0 },
        });
        await AsyncStorage.setItem(DAILY_ID_KEY, id);
        await AsyncStorage.setItem(DAILY_PREF_KEY, '1');
      } else {
        await AsyncStorage.removeItem(DAILY_ID_KEY);
        await AsyncStorage.setItem(DAILY_PREF_KEY, '0');
      }
    } catch {
      // revert on failure
      setDailyReminder(!on);
    }
  };

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

  // ── Self-serve account deletion (Play/App Store requirement) ─────────────
  // Mirrors the coach's performRemoval in ClientProgressScreen.js, run by the
  // client on their own uid. Deletes the users doc LAST — that's what revokes
  // app access (the live profile listener in AuthContext treats a vanished
  // profile as a ghost account and signs the device out automatically).
  async function deleteCollectionWhere(coll, field, value) {
    const snap = await getDocs(query(collection(db, coll), where(field, '==', value)));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  const performAccountDeletion = async () => {
    if (!user?.uid) return;
    setDeleting(true);
    try {
      await Promise.all([
        deleteCollectionWhere('bookings', 'clientId', user.uid),
        deleteCollectionWhere('progress', 'clientId', user.uid),
        deleteCollectionWhere('assessments', 'clientId', user.uid),
      ]);

      const msgsSnap = await getDocs(collection(db, 'conversations', user.uid, 'messages'));
      await Promise.all(msgsSnap.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'conversations', user.uid)).catch(() => {});
      await deleteDoc(doc(db, 'pendingRequests', user.uid)).catch(() => {});

      // Revokes app access — must be last.
      await deleteDoc(doc(db, 'users', user.uid));

      // Best-effort: also remove the Firebase Auth credential itself. This
      // can fail with 'auth/requires-recent-login' on an old session; that's
      // fine — the account already has no data and no app access at this
      // point, so we still tell the user deletion succeeded and sign out.
      await deleteUser(auth.currentUser).catch(() => {});

      Alert.alert(t('clientProfile.deleted'), t('clientProfile.deletedMsg'), [
        { text: 'OK', onPress: logOut },
      ]);
    } catch (e) {
      Alert.alert(t('clientProfile.error'), e.message ?? t('clientProfile.deleteError'));
      setDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('clientProfile.deleteConfirmTitle'),
      t('clientProfile.deleteConfirmMsg'),
      [
        { text: t('clientProfile.cancel'), style: 'cancel' },
        { text: t('clientProfile.deleteConfirmBtn'), style: 'destructive', onPress: performAccountDeletion },
      ],
    );
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

          {/* Daily reminder toggle */}
          <View style={styles.langCard}>
            <View style={styles.reminderRow}>
              <Ionicons name="notifications-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.langCardTitle, { textAlign: align }]}>{t('clientProfile.dailyReminder')}</Text>
                <Text style={[styles.langCardSub, { textAlign: align }]}>{t('clientProfile.dailyReminderSub')}</Text>
              </View>
              <Switch
                value={dailyReminder}
                onValueChange={toggleDailyReminder}
                trackColor={{ false: '#3a3a3a', true: colors.primary }}
                thumbColor="#fff"
              />
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

          {/* Privacy policy */}
          <TouchableOpacity
            style={styles.privacyLink}
            onPress={() => Linking.openURL('https://kj-fitness-80723.web.app/privacy-policy.html')}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark-outline" size={15} color={colors.textMuted} />
            <Text style={styles.privacyLinkText}>{t('clientProfile.privacyPolicy')}</Text>
          </TouchableOpacity>

          {/* Danger zone — delete account & data */}
          <View style={styles.dangerZone}>
            <Text style={[styles.dangerTitle, { textAlign: align }]}>{t('clientProfile.dangerZone')}</Text>
            <Text style={[styles.dangerSub, { textAlign: align }]}>{t('clientProfile.dangerZoneSub')}</Text>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDeleteAccount}
              disabled={deleting}
              activeOpacity={0.8}
            >
              {deleting ? (
                <ActivityIndicator color={colors.error || '#FF5252'} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={17} color={colors.error || '#FF5252'} />
                  <Text style={styles.deleteBtnText}>{t('clientProfile.deleteAccount')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

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
    ...elevation.e1,
  },
  langCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    ...elevation.e1,
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

  privacyLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, marginTop: 4,
  },
  privacyLinkText: { fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textMuted, textDecorationLine: 'underline' },

  dangerZone: {
    marginTop: 28, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(239,83,80,0.3)',
    backgroundColor: 'rgba(239,83,80,0.06)',
  },
  dangerTitle: { fontFamily: 'Sora-SemiBold', fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.error || '#FF5252' },
  dangerSub: { fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, marginTop: 14,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,83,80,0.4)',
    backgroundColor: 'rgba(239,83,80,0.1)',
  },
  deleteBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.error || '#FF5252' },
});
