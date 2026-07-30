import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients } from '../../theme/colors';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Checkbox({ checked, onToggle, label, isHe }) {
  return (
    <TouchableOpacity style={s.checkRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={[s.checkbox, checked && s.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={15} color="#fff" />}
      </View>
      <Text style={[s.checkLabel, isHe && s.rtlText]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function TermsGateModal({ visible, version, onAccepted, onDeclined }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeHealth, setAgreeHealth] = useState(false);
  const [signName, setSignName] = useState('');
  const isHe = language === 'he';

  const date = todayISO();
  const nameOk = signName.trim().length >= 2;
  const canSign = scrolledToBottom && agreeTerms && agreeHealth && nameOk;

  const handleAccept = async () => {
    if (!canSign) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          agreedTermsVersion: version,
          agreedTermsAt: serverTimestamp(),
          waiverSignature: signName.trim(),
          waiverSignedDate: date,
          waiverVersion: version,
        },
        { merge: true },
      );
      onAccepted();
    } catch (e) {
      console.warn('Waiver accept error:', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 80) {
      setScrolledToBottom(true);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <LinearGradient colors={gradients.primary} style={s.header}>
            <Ionicons name="document-text" size={26} color="#fff" />
            <View style={s.headerText}>
              <Text style={s.headerTitle}>
                {isHe ? 'תנאי שירות וכתב ויתור' : 'Terms & Liability Waiver'}
              </Text>
              <Text style={s.headerSub}>{isHe ? `גרסה ${version}` : `Version ${version}`}</Text>
            </View>
          </LinearGradient>

          {/* Body + signature */}
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[s.body, isHe && s.rtlText]}>
              {isHe ? TERMS_HE(version) : TERMS_EN(version)}
            </Text>

            {/* ── Signature block ── */}
            <View style={s.signBlock}>
              <Text style={[s.signHeading, isHe && s.rtlText]}>
                {isHe ? '✍ חתימה ואישור' : '✍ Signature & Acknowledgment'}
              </Text>

              <Checkbox
                checked={agreeTerms}
                onToggle={() => setAgreeTerms((v) => !v)}
                isHe={isHe}
                label={isHe
                  ? 'קראתי, הבנתי ואני מסכים/ה לתנאי השירות ולכתב הוויתור המלא לעיל.'
                  : 'I have read, understood, and agree to the full Terms of Service and Liability Waiver above.'}
              />
              <Checkbox
                checked={agreeHealth}
                onToggle={() => setAgreeHealth((v) => !v)}
                isHe={isHe}
                label={isHe
                  ? 'אני מאשר/ת כי אני כשיר/ה פיזית, נוטל/ת אחריות מלאה על בריאותי, ומשחרר/ת את KJ Fitness מכל אחריות לפציעה.'
                  : 'I confirm I am physically fit, assume full responsibility for my health, and release KJ Fitness from all liability for injury.'}
              />

              <Text style={[s.signLabel, isHe && s.rtlText]}>
                {isHe ? 'שם מלא (חתימה דיגיטלית)' : 'Full legal name (digital signature)'}
              </Text>
              <TextInput
                style={[s.signInput, isHe && s.rtlText]}
                value={signName}
                onChangeText={setSignName}
                placeholder={isHe ? 'הקלד/י את שמך המלא' : 'Type your full name'}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />

              <View style={[s.dateRow, isHe && { flexDirection: 'row-reverse' }]}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={s.dateText}>{isHe ? `תאריך: ${date}` : `Date: ${date}`}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            {!scrolledToBottom && (
              <View style={s.scrollHintRow}>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                <Text style={s.scrollHint}>
                  {isHe ? 'גלול/י עד לסוף כדי לחתום' : 'Scroll to the bottom to sign'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
              </View>
            )}

            <TouchableOpacity
              style={[s.agreeBtn, !canSign && s.agreeBtnDisabled]}
              onPress={handleAccept}
              disabled={!canSign || saving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={canSign ? gradients.primary : ['#23312F', '#23312F']}
                style={s.agreeBtnInner}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[s.agreeBtnText, !canSign && s.agreeBtnTextDisabled]}>
                    {isHe ? 'חתום/י והמשך/י' : 'Sign & Continue'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.declineBtn} onPress={onDeclined} disabled={saving}>
              <Text style={s.declineBtnText}>
                {isHe ? 'אינני מסכים/ה — יציאה' : 'Decline — Sign Out'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Terms text ──────────────────────────────────────────────────────────────

const TERMS_EN = (version) => `TERMS OF SERVICE — KJ FITNESS
Version ${version} | Last Updated: June 17, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. AGREEMENT TO TERMS
By accessing and using the KJ Fitness application ("the App"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the App.

2. DESCRIPTION OF SERVICES
KJ Fitness provides a personal fitness coaching platform that allows you to:
  • Schedule and book personal training sessions
  • Communicate with your personal coach via secure messaging
  • Track your fitness progress and body composition
  • Access personalized workout plans and fitness content

3. HEALTH AND MEDICAL DISCLAIMER
IMPORTANT: The training programs, advice, and information provided through KJ Fitness are for fitness and educational purposes only. They are NOT a substitute for professional medical advice, diagnosis, or treatment.

  • You acknowledge that participation in physical exercise carries inherent risks of injury.
  • You confirm that you are physically fit and have no known medical conditions that would prevent safe participation in exercise.
  • You agree to consult a qualified physician or healthcare provider before beginning any new exercise program, especially if you have any medical concerns.
  • You agree to inform your coach of any injuries, medical conditions, physical limitations, or changes in your health status before and during your training program.
  • KJ Fitness and its coaches accept no liability for injuries, accidents, health complications, or any adverse outcomes arising from participation in training sessions or following workout plans.
  • By using this App and participating in any training program, you voluntarily assume full responsibility for your physical wellbeing.

4. USER RESPONSIBILITIES
By using the App, you agree to:
  • Provide accurate, current, and complete personal information.
  • Cancel scheduled sessions at least 24 hours in advance through the App.
  • Treat your coach and all communications with professionalism and respect.
  • Keep your login credentials confidential and not share your account with others.
  • Use the App only for its intended fitness and coaching purposes.
  • Notify your coach promptly of any changes in your health or physical condition.

5. SESSIONS AND CANCELLATIONS
  • Session bookings are subject to the coach's availability.
  • Cancellations must be made at least 24 hours before the scheduled session.
  • Late cancellations or no-shows may be subject to fees as communicated by your coach.
  • Payment for coaching services is arranged separately outside of this App.

6. COMMUNICATION
  • The in-app messaging feature is intended solely for fitness-related communication with your coach.
  • The App does not provide emergency medical support or crisis intervention. In any medical emergency, contact local emergency services (Magen David Adom: 101) immediately.

7. PRIVACY AND DATA
  • We collect the personal and fitness data you provide in order to deliver coaching services.
  • Your data is stored securely on Google Firebase servers.
  • We do not sell, rent, or share your personal information with third parties.
  • You may request deletion of your personal data at any time by contacting your coach.
  • By using the App, you consent to the collection and processing of your data as described herein.

8. INTELLECTUAL PROPERTY
All content within the App — including workout plans, exercise descriptions, coaching materials, and the App interface — is the intellectual property of KJ Fitness. You may not copy, reproduce, or distribute any content from the App for commercial purposes without written permission.

9. LIMITATION OF LIABILITY
To the fullest extent permitted by applicable law, KJ Fitness and its coaches shall not be liable for any direct, indirect, incidental, consequential, or special damages arising from:
  • Your use of or inability to use the App
  • Participation in any training program or workout plan
  • Reliance on any advice or information provided through the App

10. CHANGES TO TERMS
We may update these Terms of Service at any time. When we do, you will be notified through the App and required to review and accept the updated terms before you can continue using the service.

11. TERMINATION
We reserve the right to suspend or terminate your access to the App if you violate these Terms of Service or engage in conduct deemed inappropriate.

12. GOVERNING LAW
These Terms of Service are governed by the laws of the State of Israel. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts of Israel.

13. CONTACT
For questions about these Terms of Service, please contact your coach through the in-app messaging feature.`;

const TERMS_HE = (version) => `תנאי שירות — KJ FITNESS
גרסה ${version} | עדכון אחרון: 17 ביוני 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. הסכמה לתנאים
על ידי גישה לאפליקציה KJ Fitness ("האפליקציה") ושימוש בה, הינך מסכים/ה להיות כפוף/ה לתנאי שירות אלה. אם אינך מסכים/ה לתנאים, אנא הפסק/י את השימוש באפליקציה.

2. תיאור השירותים
KJ Fitness מספקת פלטפורמת אימון כושר אישי המאפשרת לך:
  • לתזמן ולהזמין אימונים אישיים
  • לתקשר עם המאמן/ת האישי/ת שלך באמצעות הודעות מאובטחות
  • לעקוב אחר ההתקדמות הגופנית והאנתרופומטרית שלך
  • לגשת לתוכניות אימון ותכנים מותאמים אישית

3. כתב ויתור רפואי ובריאותי
חשוב: תוכניות האימון, הייעוץ והמידע המסופקים דרך KJ Fitness הם לצרכי כושר וחינוך בלבד. הם אינם מהווים תחליף לייעוץ רפואי מקצועי, אבחון או טיפול.

  • הינך מאשר/ת כי השתתפות בפעילות גופנית כרוכה בסיכוני פציעה טבועים.
  • הינך מאשר/ת כי הינך כשיר/ה פיזית ואין לך מצבים רפואיים ידועים המונעים השתתפות בטוחה בפעילות גופנית.
  • הינך מסכים/ה להתייעץ עם רופא/ה או ספק שירותי בריאות מוסמך לפני תחילת כל תוכנית אימון חדשה.
  • הינך מסכים/ה ליידע את המאמן/ת שלך על כל פציעות, מצבים רפואיים, מגבלות פיזיות או שינויים במצב בריאותך לפני ובמהלך תוכנית האימון.
  • KJ Fitness והמאמנים שלה אינם אחראים לפציעות, תאונות, סיבוכים בריאותיים או כל תוצאה שלילית הנובעת מהשתתפות באימונים או מעקב אחר תוכניות אימון.
  • על ידי שימוש באפליקציה והשתתפות בכל תוכנית אימון, הינך מקבל/ת על עצמך מרצונך את מלוא האחריות לרווחתך הגופנית.

4. אחריות המשתמש/ת
על ידי שימוש באפליקציה, הינך מסכים/ה:
  • לספק מידע אישי מדויק, עדכני ומלא.
  • לבטל אימונים מתוזמנים לפחות 24 שעות מראש דרך האפליקציה.
  • להתייחס למאמן/ת ולכל התקשורת במקצועיות ובכבוד.
  • לשמור על סודיות פרטי הכניסה שלך ולא לשתף את חשבונך עם אחרים.
  • להשתמש באפליקציה לצרכי הכושר והאימון המיועדים בלבד.
  • ליידע את המאמן/ת שלך מיד על כל שינוי במצב בריאותך הגופני.

5. אימונים וביטולים
  • הזמנת אימונים כפופה לזמינות המאמן/ת.
  • ביטולים חייבים להיעשות לפחות 24 שעות לפני האימון המתוזמן.
  • ביטולים מאוחרים או אי-הופעה עשויים להיות כרוכים בחיוב כפי שנמסר על ידי המאמן/ת.
  • התשלום עבור שירותי האימון מסודר בנפרד מחוץ לאפליקציה זו.

6. תקשורת
  • תכונת ההודעות באפליקציה מיועדת אך ורק לתקשורת הקשורה לכושר עם המאמן/ת שלך.
  • האפליקציה אינה מספקת תמיכת חירום רפואי. בכל מקרה חירום רפואי, פנה/י מיד לשירותי חירום מקומיים (מגן דוד אדום: 101).

7. פרטיות ונתונים
  • אנו אוספים את הנתונים האישיים ונתוני הכושר שתספק/י על מנת לספק שירותי אימון.
  • הנתונים שלך מאוחסנים בבטחה בשרתי Google Firebase.
  • אנו לא מוכרים, משכירים או משתפים את המידע האישי שלך עם צדדים שלישיים.
  • ניתן לבקש מחיקת הנתונים האישיים שלך בכל עת על ידי פנייה למאמן/ת.
  • על ידי שימוש באפליקציה, הינך מסכים/ה לאיסוף ועיבוד הנתונים שלך כמתואר כאן.

8. קניין רוחני
כל התוכן באפליקציה — לרבות תוכניות אימון, תיאורי תרגילים, חומרי אימון וממשק האפליקציה — הוא הרכוש הרוחני של KJ Fitness. אין לשכפל, להפיץ או להשתמש בכל תוכן מהאפליקציה למטרות מסחריות ללא אישור בכתב.

9. הגבלת אחריות
במידה המרבית המותרת על פי החוק החל, KJ Fitness והמאמנים שלה לא יהיו אחראים לכל נזק ישיר, עקיף, מקרי, תוצאתי או מיוחד הנובע מ:
  • השימוש שלך באפליקציה או חוסר יכולתך להשתמש בה
  • השתתפות בכל תוכנית אימון
  • הסתמכות על כל ייעוץ או מידע שנמסר דרך האפליקציה

10. שינויים בתנאים
אנו רשאים לעדכן תנאי שירות אלה בכל עת. כאשר נעשה זאת, תקבל/י הודעה דרך האפליקציה ותידרש/י לעיין בתנאים המעודכנים ולאשר אותם לפני המשך השימוש בשירות.

11. סיום
אנו שומרים לעצמנו את הזכות להשעות או לסיים את הגישה שלך לאפליקציה אם תפר/י תנאי שירות אלה.

12. דין חל
תנאי שירות אלה כפופים לחוקי מדינת ישראל ומתפרשים בהתאם להם. כל מחלוקת הנובעת מתנאים אלה תהיה נתונה לסמכות השיפוט הבלעדית של בתי המשפט של ישראל.

13. יצירת קשר
לשאלות בנוגע לתנאי שירות אלה, אנא פנה/י למאמן/ת שלך דרך תכונת ההודעות באפליקציה.`;

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 18, color: '#fff' },
  headerSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  body: {
    fontFamily: 'Sora-Regular', fontSize: 13.5, lineHeight: 22,
    color: colors.textSecondary, writingDirection: 'ltr',
  },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },

  // ── Signature block ──
  signBlock: {
    marginTop: 24, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: colors.cardBorder,
    gap: 14,
  },
  signHeading: {
    fontFamily: 'Sora-Bold', fontSize: 16, color: colors.textPrimary,
  },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, marginTop: 1,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: {
    flex: 1, fontFamily: 'Sora-Regular', fontSize: 13, lineHeight: 19,
    color: colors.textSecondary,
  },
  signLabel: {
    fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.textMuted,
    marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  signInput: {
    backgroundColor: colors.input, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: 'Sora-SemiBold', fontSize: 16, color: colors.textPrimary,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted },

  footer: {
    padding: 20, gap: 10,
    borderTopWidth: 1, borderTopColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  scrollHintRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginBottom: 4,
  },
  scrollHint: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },

  agreeBtn: { borderRadius: 14, overflow: 'hidden' },
  agreeBtnDisabled: { opacity: 0.5 },
  agreeBtnInner: {
    paddingVertical: 15, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  agreeBtnText: { fontFamily: 'Sora-Bold', fontSize: 14, color: '#fff', textAlign: 'center' },
  agreeBtnTextDisabled: { color: colors.textMuted },

  declineBtn: { alignItems: 'center', paddingVertical: 10 },
  declineBtnText: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted },
});
