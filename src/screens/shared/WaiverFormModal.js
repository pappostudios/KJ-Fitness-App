import React, { useState, useRef } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients } from '../../theme/colors';
import { sendPushNotification } from '../../utils/sendPushNotification';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Question banks (bilingual) ────────────────────────────────────────────────
const PARQ = [
  { key: 'heartCondition', en: 'Has a doctor ever said you have a heart condition?', he: 'האם רופא אי פעם אמר לך שיש לך בעיה לבבית?' },
  { key: 'medAdvised', en: 'Has a doctor recommended only medically advised physical activity?', he: 'האם רופא המליץ לך לבצע רק פעילות גופנית באישור רפואי?' },
  { key: 'chestPain', en: 'Do you have chest pain brought on by physical activity?', he: 'האם אתה/את חווה כאבים בחזה כתוצאה מפעילות גופנית?' },
  { key: 'dizziness', en: 'Do you tend to lose consciousness or fall over as a result of dizziness?', he: 'האם אתה/את נוטה לאבד הכרה או ליפול עקב סחרחורת?' },
  { key: 'boneJoint', en: 'Do you have a bone/joint problem that could be aggravated by activity?', he: 'האם יש לך בעיית עצמות/מפרקים שעלולה להחמיר עקב פעילות?' },
  { key: 'otherReason', en: 'Are you aware of any reason against exercising without medical supervision?', he: 'האם ידוע לך על סיבה כלשהי המונעת ממך להתאמן ללא פיקוח רפואי?' },
  { key: 'over65', en: 'Are you over the age of 65 and not accustomed to vigorous exercise?', he: 'האם אתה/את מעל גיל 65 ולא רגיל/ה לפעילות גופנית מאומצת?' },
  { key: 'pregnant', en: 'Are you pregnant?', he: 'האם את בהריון?' },
];

const MEDICAL = [
  { key: 'heartCondition', en: 'Heart Condition', he: 'בעיה לבבית' },
  { key: 'diabetes', en: 'Diabetes', he: 'סוכרת' },
  { key: 'asthma', en: 'Asthma (uncontrolled)', he: 'אסתמה (לא מאוזנת)' },
  { key: 'shortBreath', en: 'Shortness of Breath', he: 'קוצר נשימה' },
  { key: 'highBP', en: 'High Blood Pressure', he: 'לחץ דם גבוה' },
  { key: 'recentSurgery', en: 'Recent Surgery (last 3 months)', he: 'ניתוח לאחרונה (3 חודשים)' },
  { key: 'hernia', en: 'Hernia', he: 'בקע' },
  { key: 'arthritis', en: 'Arthritis / Rheumatism', he: 'דלקת מפרקים / שיגרון' },
  { key: 'knee', en: 'Knee Problems', he: 'בעיות ברכיים' },
  { key: 'shoulder', en: 'Shoulder Problems', he: 'בעיות כתפיים' },
  { key: 'back', en: 'Back Problems', he: 'בעיות גב' },
  { key: 'ankleWrist', en: 'Ankle / Wrist Problems', he: 'בעיות קרסול / שורש כף יד' },
  { key: 'otherInjury', en: 'Any injuries not listed', he: 'פציעות אחרות שלא צוינו' },
];

const FOLLOWUP = [
  { key: 'consulted', en: 'Have you consulted your physician regarding increasing your physical activity and/or performing a fitness assessment?', he: 'האם התייעצת עם הרופא שלך לגבי הגברת הפעילות הגופנית ו/או ביצוע הערכת כושר?' },
  { key: 'willConsult', en: 'If you answered NO above, will you consult your physician before increasing your physical activity and/or performing a fitness assessment?', he: 'אם ענית "לא" לעיל, האם תתייעץ/י עם הרופא שלך לפני הגברת הפעילות הגופנית ו/או ביצוע הערכת כושר?' },
];

const CERTIFY = {
  en: 'I certify that the above statements are true and correct. I understand that a physician’s note may be requested. If a note is requested, I should NOT proceed with the workout until the note is received.',
  he: 'אני מאשר/ת כי ההצהרות לעיל נכונות ומדויקות. אני מבין/ה כי ייתכן שתידרש אסמכתא רפואית. אם תתבקש אסמכתא, לא אתחיל באימון עד לקבלתה.',
};

const CANCELLATION = {
  en: 'If you need to cancel or reschedule, please give at least 24 hours’ notice to avoid charges. Cancellations made between 12–24 hours before your session will incur a 50% fee. Cancellations made less than 3 hours in advance, or no-shows, will be charged the full session amount.',
  he: 'אם עליך לבטל או לשנות מועד, יש להודיע לפחות 24 שעות מראש כדי להימנע מחיוב. ביטולים בין 12–24 שעות לפני האימון יחויבו ב-50%. ביטולים פחות מ-3 שעות מראש, או אי-הופעה, יחויבו במלוא עלות האימון.',
};

// ── Reusable bits ─────────────────────────────────────────────────────────────
function SectionTitle({ children, isHe }) {
  return <Text style={[s.sectionTitle, isHe && s.rtl]}>{children}</Text>;
}

function Field({ label, value, onChange, placeholder, error, isHe, keyboardType, autoCapitalize }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.label, isHe && s.rtl]}>{label}</Text>
      <TextInput
        style={[s.input, isHe && s.rtl, error && s.inputError]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

function YesNoRow({ label, value, onSelect, error, isHe }) {
  const yesLabel = isHe ? 'כן' : 'Yes';
  const noLabel = isHe ? 'לא' : 'No';
  return (
    <View style={[s.ynRow, error && s.ynRowError]}>
      <Text style={[s.ynLabel, isHe && s.rtl]}>{label}</Text>
      <View style={s.ynBtns}>
        <TouchableOpacity
          style={[s.ynBtn, value === 'yes' && s.ynBtnYes]}
          onPress={() => onSelect('yes')}
          activeOpacity={0.8}
        >
          <Text style={[s.ynBtnText, value === 'yes' && s.ynBtnTextActive]}>{yesLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.ynBtn, value === 'no' && s.ynBtnNo]}
          onPress={() => onSelect('no')}
          activeOpacity={0.8}
        >
          <Text style={[s.ynBtnText, value === 'no' && s.ynBtnTextActive]}>{noLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AgreeBox({ checked, onToggle, text, error, isHe }) {
  return (
    <TouchableOpacity style={[s.agreeRow, error && s.agreeRowError]} onPress={onToggle} activeOpacity={0.7}>
      <View style={[s.checkbox, checked && s.checkboxOn]}>
        {checked && <Ionicons name="checkmark" size={15} color="#fff" />}
      </View>
      <Text style={[s.agreeText, isHe && s.rtl]}>{text}</Text>
    </TouchableOpacity>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function WaiverFormModal({ visible, version, onAccepted, onDeclined }) {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const L = (o) => (isHe ? o.he : o.en);

  const scrollRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const [f, setF] = useState({
    fullName: profile?.name ?? '',
    email: user?.email ?? '',
    phone: '',
    occupation: '',
    age: '',
    parq: {},
    medical: {},
    pastInjuries: '',
    followup: {},
    emergencyName: '',
    emergencyRelation: '',
    emergencyNumber: '',
    certify: false,
    cancellation: false,
    signature: profile?.name ?? '',
  });

  const set = (key, val) => setF((prev) => ({ ...prev, [key]: val }));
  const setNested = (group, key, val) =>
    setF((prev) => ({ ...prev, [group]: { ...prev[group], [key]: val } }));

  const date = todayISO();

  // ── Validation ──
  const errors = {
    fullName: !f.fullName.trim(),
    email: !f.email.trim(),
    phone: !f.phone.trim(),
    occupation: !f.occupation.trim(),
    age: !f.age.trim(),
    parq: PARQ.some((q) => !f.parq[q.key]),
    medical: MEDICAL.some((q) => !f.medical[q.key]),
    pastInjuries: !f.pastInjuries.trim(),
    emergencyName: !f.emergencyName.trim(),
    emergencyRelation: !f.emergencyRelation.trim(),
    emergencyNumber: !f.emergencyNumber.trim(),
    certify: !f.certify,
    cancellation: !f.cancellation,
    signature: !f.signature.trim(),
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const handleSubmit = async () => {
    if (hasErrors) {
      setShowErrors(true);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      Alert.alert(
        isHe ? 'חסרים פרטים' : 'Missing information',
        isHe
          ? 'יש למלא את כל השדות המסומנים לפני הכניסה לאפליקציה.'
          : 'Please complete all required fields highlighted in red before entering the app.',
      );
      return;
    }
    // Collect medical flags (any "yes" on PAR-Q or medical history)
    const medicalFlags = [
      ...PARQ.filter((q) => f.parq[q.key] === 'yes').map((q) => q.en),
      ...MEDICAL.filter((q) => f.medical[q.key] === 'yes').map((q) => q.en),
    ];

    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          hasMedicalFlags: medicalFlags.length > 0,
          medicalFlags,
          waiver: {
            fullName: f.fullName.trim(),
            email: f.email.trim(),
            phone: f.phone.trim(),
            occupation: f.occupation.trim(),
            age: f.age.trim(),
            date,
            parq: f.parq,
            medical: f.medical,
            pastInjuries: f.pastInjuries.trim(),
            followup: f.followup,
            emergencyName: f.emergencyName.trim(),
            emergencyRelation: f.emergencyRelation.trim(),
            emergencyNumber: f.emergencyNumber.trim(),
            certify: f.certify,
            cancellation: f.cancellation,
            signature: f.signature.trim(),
            version,
            language,
          },
          agreedTermsVersion: version,
          agreedTermsAt: serverTimestamp(),
          waiverVersion: version,
          waiverSignature: f.signature.trim(),
          waiverSignedDate: date,
          waiverSignedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // Notify the coach by push if this client flagged any medical issues
      if (medicalFlags.length > 0) {
        try {
          const tokenSnap = await getDoc(doc(db, 'settings', 'coachToken'));
          const token = tokenSnap.data()?.pushToken;
          if (token) {
            await sendPushNotification(
              token,
              '⚠️ New waiver — medical flags',
              `${f.fullName.trim()} submitted a waiver with ${medicalFlags.length} medical flag${medicalFlags.length > 1 ? 's' : ''} to review.`,
              { screen: 'Clients', clientId: user.uid },
            );
          }
        } catch { /* non-blocking */ }
      }

      onAccepted();
    } catch (e) {
      Alert.alert('Error', e.message ?? 'Could not submit waiver.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Header */}
          <LinearGradient colors={gradients.primary} style={s.header}>
            <Ionicons name="clipboard" size={24} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>
                {isHe ? 'כתב ויתור ושאלון בריאות' : 'Waiver & Health Questionnaire'}
              </Text>
              <Text style={s.headerSub}>
                {isHe ? 'אימון אישי עם קירסטן' : 'Personal Training with Kirsten'}
              </Text>
            </View>
          </LinearGradient>

          <ScrollView
            ref={scrollRef}
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[s.intro, isHe && s.rtl]}>
              {isHe
                ? 'אנא ענה/י על כל השאלות בכנות לפני תחילת האימונים. כל השדות נדרשים.'
                : 'Please answer all questions truthfully before beginning your sessions. All fields are required.'}
            </Text>

            {/* 1. Personal info */}
            <SectionTitle isHe={isHe}>{isHe ? 'פרטים אישיים' : 'Personal Information'}</SectionTitle>
            <Field label={isHe ? 'שם מלא' : 'Full Name'} value={f.fullName} onChange={(v) => set('fullName', v)}
              placeholder={isHe ? 'שם מלא' : 'Full name'} error={showErrors && errors.fullName} isHe={isHe} autoCapitalize="words" />
            <Field label={isHe ? 'אימייל' : 'Email'} value={f.email} onChange={(v) => set('email', v)}
              placeholder="email@example.com" error={showErrors && errors.email} isHe={isHe} keyboardType="email-address" autoCapitalize="none" />
            <Field label={isHe ? 'מספר טלפון' : 'Phone Number'} value={f.phone} onChange={(v) => set('phone', v)}
              placeholder={isHe ? 'מספר טלפון' : 'Phone number'} error={showErrors && errors.phone} isHe={isHe} keyboardType="phone-pad" />
            <Field label={isHe ? 'עיסוק' : 'Occupation'} value={f.occupation} onChange={(v) => set('occupation', v)}
              placeholder={isHe ? 'עיסוק' : 'Occupation'} error={showErrors && errors.occupation} isHe={isHe} autoCapitalize="words" />
            <Field label={isHe ? 'גיל' : 'Age'} value={f.age} onChange={(v) => set('age', v)}
              placeholder={isHe ? 'גיל' : 'Age'} error={showErrors && errors.age} isHe={isHe} keyboardType="number-pad" />
            <View style={[s.dateRow, isHe && { flexDirection: 'row-reverse' }]}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text style={s.dateText}>{isHe ? `תאריך היום: ${date}` : `Today’s Date: ${date}`}</Text>
            </View>

            {/* 2. PAR-Q */}
            <SectionTitle isHe={isHe}>{isHe ? 'שאלון פעילות גופנית (PAR-Q)' : 'Physical Activity Questionnaire (PAR-Q)'}</SectionTitle>
            {PARQ.map((q) => (
              <YesNoRow key={q.key} label={L(q)} value={f.parq[q.key]} isHe={isHe}
                onSelect={(v) => setNested('parq', q.key, v)} error={showErrors && !f.parq[q.key]} />
            ))}

            {/* 3. Medical */}
            <SectionTitle isHe={isHe}>{isHe ? 'שאלון רפואי' : 'Medical Questionnaire'}</SectionTitle>
            <Text style={[s.subLabel, isHe && s.rtl]}>
              {isHe ? 'האם יש לך כיום או היו לך אחד מהמצבים הבאים?' : 'Do you currently have, or have you had, any of the following?'}
            </Text>
            {MEDICAL.map((q) => (
              <YesNoRow key={q.key} label={L(q)} value={f.medical[q.key]} isHe={isHe}
                onSelect={(v) => setNested('medical', q.key, v)} error={showErrors && !f.medical[q.key]} />
            ))}
            <Field label={isHe ? 'פציעות/מגבלות מהעבר שעליי לדעת?' : 'Past injuries / limitations I should know about?'}
              value={f.pastInjuries} onChange={(v) => set('pastInjuries', v)}
              placeholder={isHe ? 'פרט/י, או כתוב/כתבי "אין"' : 'Describe, or write "None"'}
              error={showErrors && errors.pastInjuries} isHe={isHe} />

            {/* 4. Follow-up */}
            <SectionTitle isHe={isHe}>{isHe ? 'שאלות המשך (אם ענית "כן" לעיל)' : 'Follow-Up (If you answered YES above)'}</SectionTitle>
            <Text style={[s.subLabel, isHe && s.rtl]}>
              {isHe ? 'אם ענית "לא" לכל השאלות, ניתן לדלג על סעיף זה.' : 'If you answered No to all of the above, you may skip this section.'}
            </Text>
            {FOLLOWUP.map((q) => (
              <YesNoRow key={q.key} label={L(q)} value={f.followup[q.key]} isHe={isHe}
                onSelect={(v) => setNested('followup', q.key, v)} error={false} />
            ))}

            {/* 5. Emergency contact */}
            <SectionTitle isHe={isHe}>{isHe ? 'איש קשר לחירום' : 'Emergency Contact'}</SectionTitle>
            <Field label={isHe ? 'שם איש הקשר' : 'Emergency Contact Name'} value={f.emergencyName} onChange={(v) => set('emergencyName', v)}
              placeholder={isHe ? 'שם מלא' : 'Full name'} error={showErrors && errors.emergencyName} isHe={isHe} autoCapitalize="words" />
            <Field label={isHe ? 'הקשר אליך?' : 'Relation to you?'} value={f.emergencyRelation} onChange={(v) => set('emergencyRelation', v)}
              placeholder={isHe ? 'לדוגמה: אמא / בן זוג / אח' : 'e.g. Mom / Spouse / Brother'} error={showErrors && errors.emergencyRelation} isHe={isHe} />
            <Field label={isHe ? 'מספר טלפון לחירום' : 'Emergency Contact Number'} value={f.emergencyNumber} onChange={(v) => set('emergencyNumber', v)}
              placeholder={isHe ? 'מספר טלפון' : 'Phone number'} error={showErrors && errors.emergencyNumber} isHe={isHe} keyboardType="phone-pad" />

            {/* 6. Agreements */}
            <SectionTitle isHe={isHe}>{isHe ? 'הצהרה ותנאים' : 'Agreement & Terms'}</SectionTitle>
            <AgreeBox checked={f.certify} onToggle={() => set('certify', !f.certify)} text={L(CERTIFY)}
              error={showErrors && errors.certify} isHe={isHe} />
            <AgreeBox checked={f.cancellation} onToggle={() => set('cancellation', !f.cancellation)} text={L(CANCELLATION)}
              error={showErrors && errors.cancellation} isHe={isHe} />

            <TouchableOpacity
              style={s.privacyLink}
              onPress={() => Linking.openURL('https://kj-fitness-80723.web.app/privacy-policy.html')}
              activeOpacity={0.7}
            >
              <Text style={[s.privacyLinkText, isHe && s.rtl]}>
                {isHe ? 'עיין במדיניות הפרטיות' : 'Read our Privacy Policy'}
              </Text>
            </TouchableOpacity>

            {/* 7. Signature */}
            <SectionTitle isHe={isHe}>{isHe ? 'חתימה' : 'Signature'}</SectionTitle>
            <Field label={isHe ? 'שם מלא (משמש כחתימה דיגיטלית)' : 'Full Name (serves as digital signature)'}
              value={f.signature} onChange={(v) => set('signature', v)}
              placeholder={isHe ? 'הקלד/י את שמך המלא' : 'Type your full name'}
              error={showErrors && errors.signature} isHe={isHe} autoCapitalize="words" />

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={saving} activeOpacity={0.85}>
              <LinearGradient colors={gradients.primary} style={s.submitInner}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitText}>{isHe ? 'שליחה וכניסה' : 'Submit & Enter'}</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.declineBtn} onPress={onDeclined} disabled={saving}>
              <Text style={s.declineText}>{isHe ? 'אינני מסכים/ה — יציאה' : 'Decline — Sign Out'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 17, color: '#fff' },
  headerSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 30 },
  intro: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 8 },

  sectionTitle: {
    fontFamily: 'Sora-Bold', fontSize: 16, color: colors.primary,
    marginTop: 24, marginBottom: 12,
  },
  subLabel: { fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textMuted, marginBottom: 10, lineHeight: 18 },

  fieldWrap: { marginBottom: 14 },
  label: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.input, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: 'Sora-Regular', fontSize: 15, color: colors.textPrimary,
  },
  inputError: { borderColor: colors.error },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dateText: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted },

  ynRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.cardBorder,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8, gap: 10,
  },
  ynRowError: { borderColor: colors.error },
  ynLabel: { flex: 1, fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  ynBtns: { flexDirection: 'row', gap: 6 },
  ynBtn: {
    minWidth: 46, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  ynBtnYes: { backgroundColor: colors.error, borderColor: colors.error },
  ynBtnNo: { backgroundColor: colors.success, borderColor: colors.success },
  ynBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textMuted },
  ynBtnTextActive: { color: '#fff' },

  agreeRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.cardBorder,
    padding: 14, marginBottom: 12,
  },
  agreeRowError: { borderColor: colors.error },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, marginTop: 1,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  agreeText: { flex: 1, fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },

  privacyLink: { paddingVertical: 10, alignItems: 'center' },
  privacyLinkText: { fontFamily: 'Sora-SemiBold', fontSize: 12.5, color: colors.accent, textDecorationLine: 'underline' },

  footer: {
    padding: 16, gap: 8,
    borderTopWidth: 1, borderTopColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  submitBtn: { borderRadius: 14, overflow: 'hidden' },
  submitInner: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: 'Sora-Bold', fontSize: 15, color: '#fff' },
  declineBtn: { alignItems: 'center', paddingVertical: 8 },
  declineText: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted },
});
