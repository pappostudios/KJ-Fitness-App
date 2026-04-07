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
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function ClientProfileScreen({ navigation }) {
  const { user, profile, logOut } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [goals, setGoals] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Populate fields from profile
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
      Alert.alert('שגיאה', 'נא להזין שם');
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
      Alert.alert('✓', 'הפרופיל עודכן בהצלחה');
    } catch (err) {
      Alert.alert('שגיאה', 'לא ניתן לשמור. נסה שוב.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('התנתקות', 'האם להתנתק מהאפליקציה?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'התנתק', style: 'destructive', onPress: logOut },
    ]);
  };

  const markDirty = (setter) => (val) => {
    setter(val);
    setDirty(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#0D0D1A', '#141428']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>הפרופיל שלי</Text>
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
            <LinearGradient
              colors={[colors.primaryGlow, '#0A2A30']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{getInitials(name || profile?.name)}</Text>
            </LinearGradient>
            <Text style={styles.emailLabel}>{user?.email}</Text>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <Field
              label="שם מלא"
              icon="person-outline"
              value={name}
              onChangeText={markDirty(setName)}
              placeholder="השם שלך"
            />
            <Divider />
            <Field
              label="טלפון"
              icon="call-outline"
              value={phone}
              onChangeText={markDirty(setPhone)}
              placeholder="05X-XXXXXXX"
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.sectionHeading}>יעדים ומטרות</Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.textArea}
              value={goals}
              onChangeText={markDirty(setGoals)}
              placeholder="מה המטרות שלך? (ירידה במשקל, חיזוק, גמישות...)"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              textAlign="right"
            />
          </View>

          <Text style={styles.sectionHeading}>הערות רפואיות / אחרות</Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={markDirty(setNotes)}
              placeholder="פציעות, מגבלות, תרופות וכד'..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              textAlign="right"
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
                <Text style={styles.saveBtnText}>שמור שינויים</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sign out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={colors.error || '#FF5252'} />
            <Text style={styles.signOutText}>התנתק</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Field component ──────────────────────────────────────────────────────────
function Field({ label, icon, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={colors.primary} style={styles.fieldIcon} />
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType || 'default'}
          textAlign="right"
        />
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// ── Styles ───────────────────────────────────────────────────────────────────
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

  // ── Avatar ──
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

  // ── Form card ──
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
  fieldLabel: { ...typography.caption, color: colors.textMuted, textAlign: 'right', marginBottom: 2 },
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
    textAlign: 'right',
    marginTop: 4,
  },

  // ── Save ──
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

  // ── Sign out ──
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  signOutText: { ...typography.body, color: colors.error || '#FF5252', fontWeight: '600' },
});
