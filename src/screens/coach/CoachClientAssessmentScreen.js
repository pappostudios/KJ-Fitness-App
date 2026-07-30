import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal, Alert, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, setDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';

// ── Jackson-Pollock 7-site body fat formula ───────────────────────────────────
function calcBodyFat(gender, age, sum7) {
  if (!sum7 || !age || sum7 <= 0 || age <= 0) return null;
  let density;
  if (gender === 'male') {
    density = 1.112 - (0.00043499 * sum7) + (0.00000055 * sum7 * sum7) - (0.00028826 * age);
  } else {
    density = 1.097 - (0.00046971 * sum7) + (0.00000056 * sum7 * sum7) - (0.00012828 * age);
  }
  const pct = (495 / density) - 450;
  return { density: parseFloat(density.toFixed(4)), pct: parseFloat(pct.toFixed(1)) };
}

// ── Default arrow directions (true = up is green/good, false = down is green/good) ──
const DEFAULT_ARROW_CONFIG = {
  weight: false, bmi: false, bodyFatPct: false, fatMass: false,
  leanMass: true, sum7: false, whr: false,
  upperArmRelaxedR: false, upperArmRelaxedL: false,
  upperArmFlexedR: true, upperArmFlexedL: true,
  forearmR: false, forearmL: false,
  midThighR: false, midThighL: false,
  calfR: false, calfL: false,
};

function getArrowConfig(saved) {
  return { ...DEFAULT_ARROW_CONFIG, ...(saved ?? {}) };
}

// ── Arrow comparison helper ───────────────────────────────────────────────────
function compareVal(current, previous, upIsGood) {
  const cur = parseFloat(current);
  const prev = parseFloat(previous);
  if (!previous || isNaN(cur) || isNaN(prev) || cur === prev) return null;
  const increased = cur > prev;
  const isGood = upIsGood ? increased : !increased;
  return {
    icon: increased ? 'arrow-up' : 'arrow-down',
    color: isGood ? '#4BB57E' : '#EF5350',
    diff: Math.abs(cur - prev).toFixed(1),
  };
}

// ── Empty form state ──────────────────────────────────────────────────────────
function emptyForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    age: '', gender: 'male',
    height: '', weight: '',
    chest: '', midaxillary: '', triceps: '', subscapular: '',
    abdomen: '', suprailliac: '', thigh: '', calf: '', bicep: '',
    upperArmRelaxedR: '', upperArmRelaxedL: '',
    upperArmFlexedR: '', upperArmFlexedL: '',
    forearmR: '', forearmL: '',
    midThighR: '', midThighL: '',
    calfR: '', calfL: '',
    waist: '', hip: '',
    notes: '',
  };
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CoachClientAssessmentScreen({ route, navigation }) {
  const { clientId, clientName, arrowConfig: savedArrowConfig } = route.params;
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();

  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showArrowSettings, setShowArrowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [arrowConfig, setArrowConfig] = useState(getArrowConfig(savedArrowConfig));

  useEffect(() => {
    const q = query(
      collection(db, 'assessments'),
      where('clientId', '==', clientId),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setAssessments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [clientId]);

  // ── Derived form calculations ─────────────────────────────────────────────
  const sf = form;
  const sum7 = ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdomen', 'suprailliac', 'thigh']
    .reduce((s, k) => s + (parseFloat(sf[k]) || 0), 0);
  const bmi = sf.height && sf.weight
    ? (parseFloat(sf.weight) / (parseFloat(sf.height) ** 2)).toFixed(1)
    : null;
  const whr = sf.waist && sf.hip
    ? (parseFloat(sf.waist) / parseFloat(sf.hip)).toFixed(2)
    : null;
  const bf = calcBodyFat(sf.gender, parseFloat(sf.age), sum7 > 0 ? sum7 : null);
  const leanMass = bf && sf.weight ? (parseFloat(sf.weight) * (1 - bf.pct / 100)).toFixed(2) : null;
  const fatMass = bf && sf.weight ? (parseFloat(sf.weight) * (bf.pct / 100)).toFixed(2) : null;

  const setField = useCallback((key) => (val) => setForm((f) => ({ ...f, [key]: val })), []);

  // ── Save assessment ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!sf.weight || !sf.height) {
      Alert.alert('Missing data', 'Height and weight are required.');
      return;
    }
    setSaving(true);
    try {
      const num = assessments.length + 1;
      await addDoc(collection(db, 'assessments'), {
        clientId,
        date: sf.date,
        assessmentNumber: num,
        createdAt: serverTimestamp(),
        age: parseFloat(sf.age) || null,
        gender: sf.gender,
        height: parseFloat(sf.height) || null,
        weight: parseFloat(sf.weight) || null,
        bmi: bmi ? parseFloat(bmi) : null,
        skinfolds: {
          chest: parseFloat(sf.chest) || 0,
          midaxillary: parseFloat(sf.midaxillary) || 0,
          triceps: parseFloat(sf.triceps) || 0,
          subscapular: parseFloat(sf.subscapular) || 0,
          abdomen: parseFloat(sf.abdomen) || 0,
          suprailliac: parseFloat(sf.suprailliac) || 0,
          thigh: parseFloat(sf.thigh) || 0,
          calf: parseFloat(sf.calf) || 0,
          bicep: parseFloat(sf.bicep) || 0,
          sum7: sum7 || 0,
        },
        bodyFat: {
          percentage: bf?.pct ?? null,
          leanMass: leanMass ? parseFloat(leanMass) : null,
          fatMass: fatMass ? parseFloat(fatMass) : null,
          bodyDensity: bf?.density ?? null,
        },
        circumferences: {
          upperArmRelaxedR: parseFloat(sf.upperArmRelaxedR) || 0,
          upperArmRelaxedL: parseFloat(sf.upperArmRelaxedL) || 0,
          upperArmFlexedR: parseFloat(sf.upperArmFlexedR) || 0,
          upperArmFlexedL: parseFloat(sf.upperArmFlexedL) || 0,
          forearmR: parseFloat(sf.forearmR) || 0,
          forearmL: parseFloat(sf.forearmL) || 0,
          midThighR: parseFloat(sf.midThighR) || 0,
          midThighL: parseFloat(sf.midThighL) || 0,
          calfR: parseFloat(sf.calfR) || 0,
          calfL: parseFloat(sf.calfL) || 0,
          waist: parseFloat(sf.waist) || 0,
          hip: parseFloat(sf.hip) || 0,
          whr: whr ? parseFloat(whr) : null,
        },
        notes: sf.notes.trim(),
      });
      setShowForm(false);
      setForm(emptyForm());
    } catch (e) {
      Alert.alert('Error', 'Could not save assessment.');
    } finally {
      setSaving(false);
    }
  };

  // ── Save arrow config to user profile ─────────────────────────────────────
  const saveArrowConfig = async (newConfig) => {
    setArrowConfig(newConfig);
    await setDoc(doc(db, 'users', clientId), { assessmentArrowConfig: newConfig }, { merge: true });
  };

  const prev = assessments[1]; // second most recent (for comparison)
  const latest = assessments[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{t('assessment.eyebrow')}</Text>
          <Text style={styles.headerTitle}>{clientName}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowArrowSettings(true)} activeOpacity={0.8}>
          <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)} activeOpacity={0.85}>
          <LinearGradient colors={gradients.primary} style={styles.addBtnInner}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>{t('assessment.addNew')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : assessments.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="body-outline" size={28} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>{t('assessment.noAssessments')}</Text>
          <Text style={styles.emptySub}>{t('assessment.noAssessmentsSub')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {assessments.map((a, idx) => {
            const prevA = assessments[idx + 1];
            return (
              <AssessmentCard
                key={a.id}
                assessment={a}
                previous={prevA}
                arrowConfig={arrowConfig}
                t={t}
              />
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* Add Assessment Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowForm(false); setForm(emptyForm()); }} activeOpacity={0.7}>
              <Text style={styles.modalCancel}>{t('assessment.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {t('assessment.assessment', { num: assessments.length + 1 })}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving
                ? <ActivityIndicator color={colors.accent} />
                : <Text style={styles.modalSave}>{t('assessment.save')}</Text>
              }
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

              {/* Date & basic info */}
              <FormSection title={t('assessment.date')}>
                <FormRow label={t('assessment.date')}>
                  <TextInput
                    style={styles.formInput}
                    value={form.date}
                    onChangeText={setField('date')}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                  />
                </FormRow>
                <FormRow label={t('assessment.age')}>
                  <TextInput
                    style={styles.formInput}
                    value={form.age}
                    onChangeText={setField('age')}
                    keyboardType="numeric"
                    placeholder={t('assessment.agePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                  />
                </FormRow>
                <FormRow label={t('assessment.gender')}>
                  <View style={styles.genderRow}>
                    <TouchableOpacity
                      style={[styles.genderBtn, form.gender === 'male' && styles.genderBtnActive]}
                      onPress={() => setField('gender')('male')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.genderBtnText, form.gender === 'male' && styles.genderBtnTextActive]}>
                        {t('assessment.male')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.genderBtn, form.gender === 'female' && styles.genderBtnActive]}
                      onPress={() => setField('gender')('female')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.genderBtnText, form.gender === 'female' && styles.genderBtnTextActive]}>
                        {t('assessment.female')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </FormRow>
              </FormSection>

              {/* Body Composition */}
              <FormSection title={t('assessment.bodyComposition')}>
                <NumericRow label={t('assessment.height')} value={form.height} onChange={setField('height')} />
                <NumericRow label={t('assessment.weight')} value={form.weight} onChange={setField('weight')} />
                {bmi && (
                  <FormRow label={t('assessment.bmi')}>
                    <Text style={styles.calcValue}>{bmi}</Text>
                  </FormRow>
                )}
              </FormSection>

              {/* Skinfolds */}
              <FormSection title={t('assessment.skinfolds')}>
                {['chest','midaxillary','triceps','subscapular','abdomen','suprailliac','thigh','calf','bicep'].map((k) => (
                  <NumericRow key={k} label={t(`assessment.${k}`)} value={form[k]} onChange={setField(k)} />
                ))}
                {sum7 > 0 && (
                  <FormRow label={t('assessment.sum7')}>
                    <Text style={styles.calcValue}>{sum7}</Text>
                  </FormRow>
                )}
              </FormSection>

              {/* Body Fat (auto-calculated) */}
              {bf && (
                <FormSection title={t('assessment.bodyFat')}>
                  <FormRow label={t('assessment.bodyFatPct')}>
                    <Text style={styles.calcValue}>{bf.pct}%</Text>
                  </FormRow>
                  {leanMass && (
                    <FormRow label={t('assessment.leanMass')}>
                      <Text style={styles.calcValue}>{leanMass} kg</Text>
                    </FormRow>
                  )}
                  {fatMass && (
                    <FormRow label={t('assessment.fatMass')}>
                      <Text style={styles.calcValue}>{fatMass} kg</Text>
                    </FormRow>
                  )}
                  <FormRow label={t('assessment.bodyDensity')}>
                    <Text style={styles.calcValue}>{bf.density}</Text>
                  </FormRow>
                </FormSection>
              )}

              {/* Circumferences */}
              <FormSection title={t('assessment.circumferences')}>
                {[
                  'upperArmRelaxedR','upperArmRelaxedL',
                  'upperArmFlexedR','upperArmFlexedL',
                  'forearmR','forearmL',
                  'midThighR','midThighL',
                  'calfR','calfL',
                  'waist','hip',
                ].map((k) => (
                  <NumericRow key={k} label={t(`assessment.${k}`)} value={form[k]} onChange={setField(k)} />
                ))}
                {whr && (
                  <FormRow label={t('assessment.whr')}>
                    <Text style={styles.calcValue}>{whr}</Text>
                  </FormRow>
                )}
              </FormSection>

              {/* Notes */}
              <FormSection title={t('assessment.notes')}>
                <TextInput
                  style={[styles.formInput, styles.formInputMulti]}
                  value={form.notes}
                  onChangeText={setField('notes')}
                  placeholder={t('assessment.notesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </FormSection>

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Arrow Settings Modal */}
      <Modal visible={showArrowSettings} animationType="slide" presentationStyle="formSheet">
        <ArrowSettingsModal
          config={arrowConfig}
          onSave={async (c) => { await saveArrowConfig(c); setShowArrowSettings(false); }}
          onClose={() => setShowArrowSettings(false)}
          t={t}
        />
      </Modal>
    </SafeAreaView>
  );
}

// ── Assessment Card ───────────────────────────────────────────────────────────
function AssessmentCard({ assessment: a, previous, arrowConfig, t }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getArrowConfig(arrowConfig);

  function Arrow({ metricKey, current, prev }) {
    if (!prev) return null;
    const r = compareVal(current, prev, cfg[metricKey] ?? false);
    if (!r) return null;
    return (
      <View style={styles.arrowChip}>
        <Ionicons name={r.icon} size={10} color={r.color} />
        <Text style={[styles.arrowDiff, { color: r.color }]}>{r.diff}</Text>
      </View>
    );
  }

  const sf = a.skinfolds ?? {};
  const bf = a.bodyFat ?? {};
  const circ = a.circumferences ?? {};
  const psf = previous?.skinfolds ?? {};
  const pbf = previous?.bodyFat ?? {};
  const pcirc = previous?.circumferences ?? {};

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded((x) => !x)}
      activeOpacity={0.85}
    >
      {/* Card header */}
      <View style={styles.cardHeader}>
        <LinearGradient colors={gradients.avatar} style={styles.numBadge}>
          <Text style={styles.numBadgeText}>{a.assessmentNumber}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardDate}>{a.date}</Text>
          {a.notes ? <Text style={styles.cardNotes} numberOfLines={1}>{a.notes}</Text> : null}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </View>

      {/* Key metrics row */}
      <View style={styles.metricsRow}>
        <MetricChip label={t('assessment.weight')} value={a.weight} unit="kg"
          arrow={<Arrow metricKey="weight" current={a.weight} prev={previous?.weight} />} />
        <MetricChip label={t('assessment.bmi')} value={a.bmi}
          arrow={<Arrow metricKey="bmi" current={a.bmi} prev={previous?.bmi} />} />
        <MetricChip label={t('assessment.bodyFatPct')} value={bf.percentage} unit="%"
          arrow={<Arrow metricKey="bodyFatPct" current={bf.percentage} prev={pbf.percentage} />} />
        <MetricChip label={t('assessment.leanMass')} value={bf.leanMass} unit="kg"
          arrow={<Arrow metricKey="leanMass" current={bf.leanMass} prev={pbf.leanMass} />} />
      </View>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.expandedSection}>
          <DetailDivider />

          <DetailSection title={t('assessment.skinfolds')}>
            {[
              ['chest','midaxillary','triceps'],
              ['subscapular','abdomen','suprailliac'],
              ['thigh','calf','bicep'],
            ].map((row, ri) => (
              <View key={ri} style={styles.detailRow}>
                {row.map((k) => (
                  <DetailMetric key={k} label={t(`assessment.${k}`)} value={sf[k]}
                    arrow={<Arrow metricKey={k} current={sf[k]} prev={psf[k]} />} />
                ))}
              </View>
            ))}
            <View style={styles.detailRow}>
              <DetailMetric label={t('assessment.sum7')} value={sf.sum7}
                arrow={<Arrow metricKey="sum7" current={sf.sum7} prev={psf.sum7} />} />
            </View>
          </DetailSection>

          <DetailSection title={t('assessment.bodyFat')}>
            <View style={styles.detailRow}>
              <DetailMetric label={t('assessment.bodyFatPct')} value={bf.percentage ? `${bf.percentage}%` : null}
                arrow={<Arrow metricKey="bodyFatPct" current={bf.percentage} prev={pbf.percentage} />} />
              <DetailMetric label={t('assessment.leanMass')} value={bf.leanMass} unit="kg"
                arrow={<Arrow metricKey="leanMass" current={bf.leanMass} prev={pbf.leanMass} />} />
              <DetailMetric label={t('assessment.fatMass')} value={bf.fatMass} unit="kg"
                arrow={<Arrow metricKey="fatMass" current={bf.fatMass} prev={pbf.fatMass} />} />
            </View>
          </DetailSection>

          <DetailSection title={t('assessment.circumferences')}>
            {[
              ['upperArmRelaxedR','upperArmRelaxedL','upperArmFlexedR'],
              ['upperArmFlexedL','forearmR','forearmL'],
              ['midThighR','midThighL','calfR'],
              ['calfL','waist','hip'],
            ].map((row, ri) => (
              <View key={ri} style={styles.detailRow}>
                {row.map((k) => (
                  <DetailMetric key={k} label={t(`assessment.${k}`)} value={circ[k]}
                    arrow={<Arrow metricKey={k} current={circ[k]} prev={pcirc[k]} />} />
                ))}
              </View>
            ))}
            <View style={styles.detailRow}>
              <DetailMetric label={t('assessment.whr')} value={circ.whr}
                arrow={<Arrow metricKey="whr" current={circ.whr} prev={pcirc.whr} />} />
            </View>
          </DetailSection>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MetricChip({ label, value, unit, arrow }) {
  if (value == null || value === 0) return null;
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricChipLabel}>{label}</Text>
      <View style={styles.metricChipValueRow}>
        <Text style={styles.metricChipValue}>{value}{unit ? ` ${unit}` : ''}</Text>
        {arrow}
      </View>
    </View>
  );
}

function DetailSection({ title, children }) {
  return (
    <View style={styles.detailSection}>
      <Text style={styles.detailSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailMetric({ label, value, unit, arrow }) {
  return (
    <View style={styles.detailMetric}>
      <Text style={styles.detailMetricLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={styles.detailMetricValue}>{value ?? '—'}{unit ? ` ${unit}` : ''}</Text>
        {arrow}
      </View>
    </View>
  );
}

function DetailDivider() {
  return <View style={{ height: 1, backgroundColor: dark.lineSoft, marginVertical: 12 }} />;
}

// ── Arrow Settings Modal ──────────────────────────────────────────────────────
const ARROW_METRICS = [
  { key: 'weight', label: 'Weight' },
  { key: 'bmi', label: 'BMI' },
  { key: 'bodyFatPct', label: 'Body Fat %' },
  { key: 'fatMass', label: 'Fat Mass' },
  { key: 'leanMass', label: 'Lean Mass' },
  { key: 'sum7', label: 'Sum of 7 Skinfolds' },
  { key: 'whr', label: 'Waist-Hip Ratio' },
  { key: 'upperArmFlexedR', label: 'Upper Arm Flexed R' },
  { key: 'upperArmFlexedL', label: 'Upper Arm Flexed L' },
  { key: 'midThighR', label: 'Mid-thigh R' },
  { key: 'midThighL', label: 'Mid-thigh L' },
];

function ArrowSettingsModal({ config, onSave, onClose, t }) {
  const [local, setLocal] = useState({ ...config });

  const toggle = (key) => setLocal((c) => ({ ...c, [key]: !c[key] }));

  return (
    <SafeAreaView style={styles.arrowModalSafe} edges={['top']}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.modalCancel}>{t('assessment.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.modalTitle}>{t('assessment.arrowSettings')}</Text>
        <TouchableOpacity onPress={() => onSave(local)} activeOpacity={0.8}>
          <Text style={styles.modalSave}>{t('assessment.done')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.arrowSettingsSub}>{t('assessment.arrowSettingsSub')}</Text>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {ARROW_METRICS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={styles.arrowRow}
            onPress={() => toggle(key)}
            activeOpacity={0.8}
          >
            <Text style={styles.arrowRowLabel}>{label}</Text>
            <View style={styles.arrowToggle}>
              <View style={[styles.arrowOption, !local[key] && styles.arrowOptionActive]}>
                <Ionicons name="arrow-down" size={12} color={!local[key] ? '#4BB57E' : colors.textMuted} />
                <Text style={[styles.arrowOptionText, !local[key] && { color: '#4BB57E' }]}>
                  {t('assessment.downIsGood')}
                </Text>
              </View>
              <View style={[styles.arrowOption, local[key] && styles.arrowOptionActive]}>
                <Ionicons name="arrow-up" size={12} color={local[key] ? '#4BB57E' : colors.textMuted} />
                <Text style={[styles.arrowOptionText, local[key] && { color: '#4BB57E' }]}>
                  {t('assessment.upIsGood')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Form helpers ──────────────────────────────────────────────────────────────
function FormSection({ title, children }) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.formSectionTitle}>{title}</Text>
      <View style={styles.formCard}>{children}</View>
    </View>
  );
}

function FormRow({ label, children }) {
  return (
    <View style={styles.formRow}>
      <Text style={styles.formLabel}>{label}</Text>
      {children}
    </View>
  );
}

function NumericRow({ label, value, onChange }) {
  return (
    <FormRow label={label}>
      <TextInput
        style={styles.formInput}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />
    </FormRow>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: dark.bg0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  list: { padding: 16, gap: 12 },

  eyebrow: {
    fontFamily: 'Sora-SemiBold', fontSize: 10, letterSpacing: 1.8,
    textTransform: 'uppercase', color: colors.textMuted,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: dark.lineSoft,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.lineSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 18, color: colors.textPrimary },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.lineSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  addBtn: { borderRadius: 10, overflow: 'hidden' },
  addBtnInner: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  addBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: '#fff' },

  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: dark.bg2, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textSecondary },
  emptySub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, textAlign: 'center', maxWidth: 260 },

  // Assessment card
  card: {
    backgroundColor: dark.bg1, borderRadius: 18,
    borderWidth: 1, borderColor: dark.lineSoft, overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  numBadge: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  numBadgeText: { fontFamily: 'Sora-Bold', fontSize: 14, color: '#fff' },
  cardDate: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  cardNotes: { fontFamily: 'Sora-Regular', fontSize: 11, color: colors.textMuted, marginTop: 2 },

  metricsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 14, paddingBottom: 14,
  },
  metricChip: {
    backgroundColor: dark.bg2, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: dark.line, minWidth: 70,
  },
  metricChipLabel: { fontFamily: 'Sora-Regular', fontSize: 9.5, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricChipValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metricChipValue: { fontFamily: 'JetBrainsMono-Medium', fontSize: 15, color: colors.textPrimary },

  arrowChip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  arrowDiff: { fontFamily: 'Sora-SemiBold', fontSize: 10 },

  expandedSection: { paddingHorizontal: 14, paddingBottom: 14 },
  detailSection: { marginBottom: 12 },
  detailSectionTitle: {
    fontFamily: 'Sora-SemiBold', fontSize: 10.5, letterSpacing: 1.5,
    textTransform: 'uppercase', color: colors.textMuted, marginBottom: 8,
  },
  detailRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  detailMetric: {
    backgroundColor: dark.bg2, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: dark.line, minWidth: 90, flex: 1,
  },
  detailMetricLabel: { fontFamily: 'Sora-Regular', fontSize: 9, color: colors.textMuted, marginBottom: 2 },
  detailMetricValue: { fontFamily: 'JetBrainsMono-Medium', fontSize: 13, color: colors.textPrimary },

  // Modal
  modalSafe: { flex: 1, backgroundColor: dark.bg0 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: dark.lineSoft,
  },
  modalTitle: { fontFamily: 'Sora-Bold', fontSize: 16, color: colors.textPrimary },
  modalCancel: { fontFamily: 'Sora-Regular', fontSize: 15, color: colors.textMuted },
  modalSave: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.accent },

  formContent: { padding: 16, gap: 16 },
  formSection: { gap: 8 },
  formSectionTitle: {
    fontFamily: 'Sora-SemiBold', fontSize: 10.5, letterSpacing: 1.7,
    textTransform: 'uppercase', color: colors.textMuted,
  },
  formCard: {
    backgroundColor: dark.bg1, borderRadius: 16,
    borderWidth: 1, borderColor: dark.lineSoft, overflow: 'hidden',
  },
  formRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: dark.lineSoft,
  },
  formLabel: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textPrimary, flex: 1 },
  formInput: {
    fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textPrimary,
    textAlign: 'right', minWidth: 80, padding: 0,
  },
  formInputMulti: {
    margin: 14, textAlign: 'left', height: 80,
    textAlignVertical: 'top', borderWidth: 0,
  },
  calcValue: { fontFamily: 'JetBrainsMono-Medium', fontSize: 15, color: colors.accent },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.line,
  },
  genderBtnActive: { backgroundColor: 'rgba(21, 194, 203,0.15)', borderColor: colors.accent },
  genderBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textMuted },
  genderBtnTextActive: { color: colors.accent },

  // Arrow settings modal
  arrowModalSafe: { flex: 1, backgroundColor: dark.bg0 },
  arrowSettingsSub: {
    fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  arrowRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: dark.bg1, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: dark.lineSoft,
  },
  arrowRowLabel: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textPrimary },
  arrowToggle: { flexDirection: 'row', gap: 6 },
  arrowOption: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: dark.line,
    backgroundColor: dark.bg2,
  },
  arrowOptionActive: {
    backgroundColor: 'rgba(75,181,126,0.12)',
    borderColor: '#4BB57E',
  },
  arrowOptionText: { fontFamily: 'Sora-Regular', fontSize: 11, color: colors.textMuted },
});
