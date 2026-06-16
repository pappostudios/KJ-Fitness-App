import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator,
  StyleSheet, Alert, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, orderBy, onSnapshot, addDoc,
  doc, updateDoc, serverTimestamp, setDoc, increment,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useLanguage } from '../../context/LanguageContext';
import { MonthCalendar, WeekStrip, toISO, addDays, addMonths, MONTH_NAMES } from '../../components/CalendarView';

// ── Constants ─────────────────────────────────────────────────────────────────

const DURATION_PRESETS = [30, 45, 60, 90];

// ── Main Component ────────────────────────────────────────────────────────────

export default function ScheduleScreen({ navigation }) {
  const { t, isRTL } = useLanguage();

  const STATUS_CONFIG = {
    pending_confirmation: { label: t('schedule.pending'), color: '#F59E0B' },
    confirmed:            { label: t('schedule.confirmed'), color: '#10B981' },
    cancelled:            { label: t('schedule.cancelled'), color: '#EF4444' },
  };

  const PAYMENT_CONFIG = {
    unpaid:  { label: t('schedule.unpaidStatus'), color: '#EF4444' },
    pending: { label: t('schedule.pendingPayment'), color: '#F59E0B' },
    paid:    { label: t('schedule.paid'), color: '#10B981' },
  };

  const [clients, setClients] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const [viewMode, setViewMode] = useState('month');
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toISO(new Date()));

  // Detail modal
  const [detailBooking, setDetailBooking] = useState(null);

  // Add session modal — step 1: client, step 2: details
  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState('client');
  const [clientSearch, setClientSearch] = useState('');
  const [formClient, setFormClient] = useState(null);
  const [formDate, setFormDate] = useState(new Date());
  const [formTime, setFormTime] = useState('09:00');
  const [formDuration, setFormDuration] = useState(60);
  const [formCustomDuration, setFormCustomDuration] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formType, setFormType] = useState('private');
  const [saving, setSaving] = useState(false);

  // ── Listeners ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'client'),
      where('status', '==', 'approved'),
      orderBy('name'),
    );
    return onSnapshot(q, (snap) =>
      setClients(snap.docs.map((d) => ({
        uid: d.id,
        name: d.data().name || d.data().displayName || d.data().email || 'Client',
      }))),
    );
  }, []);

  useEffect(() => {
    const today = toISO(new Date());
    const q = query(
      collection(db, 'bookings'),
      where('date', '>=', today),
      orderBy('date'),
      orderBy('time'),
    );
    return onSnapshot(q, (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const dotDates = useMemo(() => {
    const s = new Set();
    bookings.forEach((b) => { if (b.status !== 'cancelled') s.add(b.date); });
    return s;
  }, [bookings]);

  const dayBookings = useMemo(
    () => bookings.filter((b) => b.date === selectedDate && b.status !== 'cancelled'),
    [bookings, selectedDate],
  );

  const filteredClients = useMemo(
    () => clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase())),
    [clients, clientSearch],
  );

  const totalActive = bookings.filter((b) => b.status !== 'cancelled').length;
  const pendingCount = bookings.filter((b) => b.status === 'pending_confirmation').length;
  const unpaidCount = bookings.filter((b) => b.status === 'confirmed' && b.paymentStatus !== 'paid').length;

  // ── Add session ───────────────────────────────────────────────────────────
  const openAdd = useCallback(() => {
    setAddStep('client');
    setClientSearch('');
    setFormClient(null);
    setFormDate(new Date());
    setFormTime('09:00');
    setFormDuration(60);
    setFormCustomDuration('');
    setFormLocation('');
    setFormType('private');
    setShowAdd(true);
  }, []);

  const saveSession = useCallback(async () => {
    if (!formClient) return;
    if (!/^\d{1,2}:\d{2}$/.test(formTime)) {
      Alert.alert(t('schedule.invalidTime'), t('schedule.invalidTimeMsg'));
      return;
    }
    const duration = formCustomDuration ? parseInt(formCustomDuration, 10) : formDuration;
    if (!duration || isNaN(duration) || duration < 1) {
      Alert.alert(t('schedule.invalidDuration'), t('schedule.invalidDurationMsg'));
      return;
    }
    setSaving(true);
    try {
      const dateISO = toISO(formDate);
      const docRef = await addDoc(collection(db, 'bookings'), {
        clientId: formClient.uid,
        clientName: formClient.name,
        date: dateISO,
        time: formTime,
        duration,
        location: formLocation.trim() || t('schedule.notSpecified'),
        sessionType: formType,
        status: 'pending_confirmation',
        clientConfirmed: false,
        paymentStatus: 'unpaid',
        price: null,
        createdAt: serverTimestamp(),
      });

      // Notify client via their conversation
      const convId = formClient.uid;
      const msgText = t('schedule.sessionInviteMsg', { date: dateISO, time: formTime });
      await addDoc(collection(db, 'conversations', convId, 'messages'), {
        text: msgText,
        senderId: 'coach',
        senderRole: 'coach',
        type: 'session_invite',
        bookingId: docRef.id,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'conversations', convId), {
        clientId: formClient.uid,
        clientName: formClient.name,
        lastMessage: msgText,
        lastMessageAt: serverTimestamp(),
        unreadByClient: increment(1),
      }, { merge: true });

      setShowAdd(false);
      setSelectedDate(dateISO);
    } catch (e) {
      Alert.alert(t('schedule.invalidTime'), 'Could not save the session. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [formClient, formDate, formTime, formDuration, formCustomDuration, formLocation, formType, t]);

  // ── Cancel booking ────────────────────────────────────────────────────────
  const cancelBooking = useCallback((booking) => {
    Alert.alert(
      t('schedule.cancelConfirmTitle'),
      t('schedule.cancelConfirmMsg', { name: booking.clientName, date: booking.date }),
      [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('common.yes'), style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'bookings', booking.id), {
                status: 'cancelled',
                cancelledAt: serverTimestamp(),
              });
              setDetailBooking(null);
            } catch {
              Alert.alert(t('common.error'), 'Could not cancel the session.');
            }
          },
        },
      ],
    );
  }, [t]);

  const markAsPaid = useCallback(async (booking) => {
    try {
      await updateDoc(doc(db, 'bookings', booking.id), { paymentStatus: 'paid' });
      setDetailBooking((prev) => prev?.id === booking.id ? { ...prev, paymentStatus: 'paid' } : prev);
    } catch {
      Alert.alert(t('common.error'), 'Could not update payment status.');
    }
  }, [t]);

  const goToClientProgress = useCallback((booking) => {
    setDetailBooking(null);
    navigation?.navigate('ClientProgress', {
      clientId: booking.clientId,
      clientName: booking.clientName,
    });
  }, [navigation]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* Header */}
      <LinearGradient colors={gradients.hero} style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>{t('schedule.title')}</Text>
            <Text style={s.headerSub}>
              {t('schedule.sessions', { count: totalActive })}
              {pendingCount > 0 ? `  ·  ${t('schedule.awaitingConf', { count: pendingCount })}` : ''}
              {unpaidCount > 0 ? `  ·  ${t('schedule.unpaid', { count: unpaidCount })}` : ''}
            </Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openAdd} activeOpacity={0.85}>
            <LinearGradient colors={gradients.primary} style={s.addBtnGrad}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={s.addBtnText}>{t('schedule.addSession')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* View mode toggle */}
        <View style={s.modeToggle}>
          {['month', 'week'].map((m) => (
            <TouchableOpacity
              key={m}
              style={[s.modeBtn, viewMode === m && s.modeBtnActive]}
              onPress={() => setViewMode(m)}
            >
              <Text style={[s.modeBtnText, viewMode === m && s.modeBtnTextActive]}>
                {m === 'month' ? t('schedule.month') : t('schedule.week')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Calendar */}
        <View style={s.calSection}>
          {viewMode === 'month' && (
            <>
              <View style={s.monthNav}>
                <TouchableOpacity
                  onPress={() => setCalMonth((m) => addMonths(m, -1))}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.accent} />
                </TouchableOpacity>
                <Text style={s.monthTitle}>
                  {MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}
                </Text>
                <TouchableOpacity
                  onPress={() => setCalMonth((m) => addMonths(m, 1))}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.accent} />
                </TouchableOpacity>
              </View>
              <MonthCalendar
                year={calMonth.getFullYear()}
                month={calMonth.getMonth()}
                selected={selectedDate}
                onSelect={setSelectedDate}
                dotDates={dotDates}
              />
            </>
          )}
          {viewMode === 'week' && (
            <WeekStrip
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              dotDates={dotDates}
            />
          )}
        </View>

        {/* Selected day sessions */}
        <View style={s.dayHeader}>
          <Text style={s.dayHeaderDate}>
            {selectedDate === toISO(new Date()) ? t('schedule.today') : selectedDate}
          </Text>
          <Text style={s.dayHeaderCount}>{t('schedule.sessions', { count: dayBookings.length })}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
        ) : dayBookings.length === 0 ? (
          <View style={s.emptyDay}>
            <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
            <Text style={s.emptyDayTitle}>{t('schedule.noSessions')}</Text>
            <TouchableOpacity onPress={openAdd} activeOpacity={0.8}>
              <Text style={s.emptyDayAdd}>{t('schedule.addSessionHint')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.sessionsList}>
            {dayBookings.map((b) => (
              <SessionCard key={b.id} booking={b} onPress={() => setDetailBooking(b)} statusConfig={STATUS_CONFIG} t={t} />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Session Detail Modal ───────────────────────────────────────────── */}
      <Modal
        visible={!!detailBooking}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailBooking(null)}
      >
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setDetailBooking(null)}>
          <TouchableOpacity activeOpacity={1} style={s.detailSheet} onPress={() => {}}>
            {detailBooking && (
              <>
                <View style={s.modalHandle} />
                <Text style={s.detailName}>{detailBooking.clientName}</Text>

                <View style={s.typeBadgeRow}>
                  <View style={[s.typeBadge, detailBooking.sessionType === 'group' && s.typeBadgeGroup]}>
                    <Text style={s.typeBadgeText}>
                      {detailBooking.sessionType === 'group' ? t('schedule.groupSession') : t('schedule.privateSession')}
                    </Text>
                  </View>
                  <View style={[s.statusBadge, { borderColor: STATUS_CONFIG[detailBooking.status]?.color, backgroundColor: STATUS_CONFIG[detailBooking.status]?.color + '22' }]}>
                    <Text style={[s.statusBadgeText, { color: STATUS_CONFIG[detailBooking.status]?.color }]}>
                      {STATUS_CONFIG[detailBooking.status]?.label}
                    </Text>
                  </View>
                </View>

                <View style={s.metaList}>
                  <MetaRow icon="calendar-outline" text={detailBooking.date} />
                  <MetaRow icon="time-outline" text={`${detailBooking.time}  ·  ${detailBooking.duration} min`} />
                  <MetaRow icon="location-outline" text={detailBooking.location || t('schedule.notSpecified')} />
                  <MetaRow
                    icon="card-outline"
                    text={PAYMENT_CONFIG[detailBooking.paymentStatus ?? 'unpaid']?.label}
                    color={PAYMENT_CONFIG[detailBooking.paymentStatus ?? 'unpaid']?.color}
                  />
                </View>

                <View style={s.detailActions}>
                  {detailBooking.paymentStatus !== 'paid' && detailBooking.status === 'confirmed' && (
                    <ActionButton
                      icon="checkmark-circle-outline"
                      label={t('schedule.markAsPaid')}
                      color="#10B981"
                      onPress={() => markAsPaid(detailBooking)}
                    />
                  )}
                  <ActionButton
                    icon="bar-chart-outline"
                    label={t('schedule.lastSummary')}
                    color={colors.accent}
                    onPress={() => goToClientProgress(detailBooking)}
                  />
                  <ActionButton
                    icon="close-circle-outline"
                    label={t('schedule.cancelSession')}
                    color={colors.error}
                    onPress={() => cancelBooking(detailBooking)}
                  />
                </View>

                <TouchableOpacity style={s.closeBtn} onPress={() => setDetailBooking(null)}>
                  <Text style={s.closeBtnText}>{t('schedule.close')}</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Add Session Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={showAdd}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setShowAdd(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.overlay}
        >
          <View style={s.addSheet}>
            <View style={s.modalHandle} />

            {addStep === 'client' ? (
              <>
                <Text style={s.modalTitle}>{t('schedule.selectClient')}</Text>

                <View style={s.searchBar}>
                  <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                  <TextInput
                    style={s.searchInput}
                    value={clientSearch}
                    onChangeText={setClientSearch}
                    placeholder={t('schedule.searchClient')}
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                  />
                  {clientSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setClientSearch('')}>
                      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView style={s.clientList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {filteredClients.length === 0 ? (
                    <Text style={s.noResults}>{t('schedule.noClients')}</Text>
                  ) : filteredClients.map((c) => {
                    const isSelected = formClient?.uid === c.uid;
                    return (
                      <TouchableOpacity
                        key={c.uid}
                        style={[s.clientRow, isSelected && s.clientRowActive]}
                        onPress={() => setFormClient(c)}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={isSelected ? gradients.primary : ['#333', '#333']}
                          style={s.clientAvatar}
                        >
                          <Text style={s.clientAvatarText}>{c.name[0]?.toUpperCase() ?? '?'}</Text>
                        </LinearGradient>
                        <Text style={[s.clientName, isSelected && s.clientNameActive]}>{c.name}</Text>
                        {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={[s.primaryBtn, !formClient && s.primaryBtnDisabled]}
                  onPress={() => formClient && setAddStep('details')}
                  disabled={!formClient}
                >
                  <LinearGradient colors={gradients.primary} style={s.primaryBtnGrad}>
                    <Text style={s.primaryBtnText}>{t('schedule.next')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={s.ghostBtn} onPress={() => setShowAdd(false)}>
                  <Text style={s.ghostBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Step header */}
                <View style={s.stepHeader}>
                  <TouchableOpacity onPress={() => setAddStep('client')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="arrow-back" size={20} color={colors.accent} />
                  </TouchableOpacity>
                  <Text style={s.modalTitle}>{t('schedule.sessionDetails')}</Text>
                </View>

                <View style={s.selectedClient}>
                  <Ionicons name="person-circle-outline" size={18} color={colors.accent} />
                  <Text style={s.selectedClientText}>{formClient?.name}</Text>
                </View>

                {/* Date */}
                <Field label={t('schedule.date')}>
                  <View style={s.datePicker}>
                    <TouchableOpacity style={s.dateArrow} onPress={() => setFormDate((d) => addDays(d, -1))}>
                      <Ionicons name="chevron-back" size={20} color={colors.accent} />
                    </TouchableOpacity>
                    <Text style={s.dateValue}>{toISO(formDate)}</Text>
                    <TouchableOpacity style={s.dateArrow} onPress={() => setFormDate((d) => addDays(d, 1))}>
                      <Ionicons name="chevron-forward" size={20} color={colors.accent} />
                    </TouchableOpacity>
                  </View>
                </Field>

                {/* Time */}
                <Field label={t('schedule.startTime')}>
                  <TextInput
                    style={s.textInput}
                    value={formTime}
                    onChangeText={setFormTime}
                    placeholder={t('schedule.timePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </Field>

                {/* Duration */}
                <Field label={t('schedule.duration')}>
                  <View style={s.chipRow}>
                    {DURATION_PRESETS.map((d) => {
                      const active = formDuration === d && !formCustomDuration;
                      return (
                        <TouchableOpacity
                          key={d}
                          style={[s.chip, active && s.chipActive]}
                          onPress={() => { setFormDuration(d); setFormCustomDuration(''); }}
                        >
                          <Text style={[s.chipText, active && s.chipTextActive]}>{d}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TextInput
                    style={[s.textInput, { marginTop: 8 }]}
                    value={formCustomDuration}
                    onChangeText={setFormCustomDuration}
                    placeholder="Custom duration..."
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                  />
                </Field>

                {/* Location */}
                <Field label={t('schedule.location')}>
                  <TextInput
                    style={s.textInput}
                    value={formLocation}
                    onChangeText={setFormLocation}
                    placeholder={t('schedule.locationPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                  />
                </Field>

                {/* Session type */}
                <Field label={t('schedule.sessionType')}>
                  <View style={s.chipRow}>
                    {[['private', t('schedule.private')], ['group', t('schedule.group')]].map(([val, lbl]) => {
                      const active = formType === val;
                      return (
                        <TouchableOpacity
                          key={val}
                          style={[s.chip, s.chipWide, active && s.chipActive]}
                          onPress={() => setFormType(val)}
                        >
                          <Text style={[s.chipText, active && s.chipTextActive]}>{lbl}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Field>

                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={saveSession}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={gradients.primary} style={s.primaryBtnGrad}>
                    {saving
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.primaryBtnText}>{t('schedule.saveSession')}</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={s.ghostBtn} onPress={() => setShowAdd(false)} disabled={saving}>
                  <Text style={s.ghostBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>

                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SessionCard({ booking, onPress, statusConfig, t }) {
  const statusCfg = statusConfig[booking.status] ?? { label: booking.status, color: colors.textMuted };
  return (
    <TouchableOpacity style={s.sessionCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.sessionAccent, { backgroundColor: statusCfg.color }]} />
      <View style={s.sessionBody}>
        <View style={s.sessionTop}>
          <Text style={s.sessionClient}>{booking.clientName}</Text>
          <View style={[s.sessionTypePill, booking.sessionType === 'group' && s.sessionTypePillGroup]}>
            <Text style={s.sessionTypePillText}>
              {booking.sessionType === 'group' ? t('schedule.group') : t('schedule.private')}
            </Text>
          </View>
        </View>
        <Text style={s.sessionMeta}>{booking.time}  ·  {booking.duration} min</Text>
        {booking.location && booking.location !== t('schedule.notSpecified') && (
          <Text style={s.sessionLocation} numberOfLines={1}>
            <Ionicons name="location-outline" size={11} color={colors.textMuted} />  {booking.location}
          </Text>
        )}
      </View>
      <View style={[s.statusDot, { backgroundColor: statusCfg.color }]} />
    </TouchableOpacity>
  );
}

function MetaRow({ icon, text, color }) {
  return (
    <View style={s.metaRow}>
      <Ionicons name={icon} size={16} color={color ?? colors.textMuted} />
      <Text style={[s.metaText, color && { color }]}>{text}</Text>
    </View>
  );
}

function ActionButton({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity
      style={[s.actionBtn, { borderColor: color + '55', backgroundColor: color + '18' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[s.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, children }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: dark.bg0 },
  scroll: { flex: 1 },

  // Header
  header: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14 },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 22, color: colors.textPrimary },
  headerSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, marginTop: 3 },
  addBtn: { borderRadius: 12, overflow: 'hidden' },
  addBtnGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, gap: 6 },
  addBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: '#fff' },

  // View mode toggle
  modeToggle: { flexDirection: 'row', gap: 8, paddingBottom: 14 },
  modeBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 10,
    backgroundColor: dark.bg2, alignItems: 'center',
    borderWidth: 1, borderColor: dark.line,
  },
  modeBtnActive: { backgroundColor: colors.accent + '22', borderColor: colors.accent },
  modeBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.textMuted },
  modeBtnTextActive: { color: colors.accent },

  // Calendar section
  calSection: { padding: 16, paddingBottom: 8 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthTitle: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textPrimary },

  // Day header
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: dark.line,
    marginTop: 4,
  },
  dayHeaderDate: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  dayHeaderCount: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },

  // Empty day
  emptyDay: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyDayTitle: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textMuted },
  emptyDayAdd: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.accent },

  // Sessions list
  sessionsList: { paddingHorizontal: 16, gap: 10 },
  sessionCard: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: dark.bg1, borderRadius: 14,
    borderWidth: 1, borderColor: dark.line, overflow: 'hidden',
  },
  sessionAccent: { width: 4, alignSelf: 'stretch' },
  sessionBody: { flex: 1, padding: 12, gap: 4 },
  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionClient: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textPrimary },
  sessionMeta: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },
  sessionLocation: { fontFamily: 'Sora-Regular', fontSize: 11, color: colors.textMuted },
  sessionTypePill: {
    backgroundColor: colors.accent + '22', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  sessionTypePillGroup: { backgroundColor: '#8B5CF6' + '22' },
  sessionTypePillText: { fontFamily: 'Sora-SemiBold', fontSize: 10, color: colors.accent },
  statusDot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'center', marginRight: 12 },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4,
    borderRadius: 2, backgroundColor: dark.line, marginBottom: 16,
  },

  // Detail modal
  detailSheet: {
    backgroundColor: dark.bg1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  detailName: { fontFamily: 'Sora-Bold', fontSize: 22, color: colors.textPrimary, marginBottom: 10 },
  typeBadgeRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  typeBadge: {
    backgroundColor: colors.accent + '22', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  typeBadgeGroup: { backgroundColor: '#8B5CF6' + '22' },
  typeBadgeText: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.accent },
  statusBadge: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  statusBadgeText: { fontFamily: 'Sora-SemiBold', fontSize: 12 },
  metaList: { gap: 12, marginBottom: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText: { fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textSecondary, flex: 1 },
  detailActions: { gap: 10, marginBottom: 16 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1,
  },
  actionBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14 },
  closeBtn: { alignItems: 'center', paddingVertical: 12 },
  closeBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textMuted },

  // Add session modal
  addSheet: {
    backgroundColor: dark.bg1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 8, maxHeight: '92%',
  },
  modalTitle: { fontFamily: 'Sora-Bold', fontSize: 20, color: colors.textPrimary, textAlign: 'center', marginBottom: 16 },

  // Client picker
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: dark.bg2, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: dark.line, marginBottom: 12,
  },
  searchInput: {
    flex: 1, fontFamily: 'Sora-Regular', fontSize: 14,
    color: colors.textPrimary,
  },
  clientList: { maxHeight: 280, marginBottom: 12 },
  noResults: { fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 24 },
  clientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: dark.line,
  },
  clientRowActive: { backgroundColor: colors.accent + '12', borderRadius: 10, borderBottomColor: 'transparent' },
  clientAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  clientAvatarText: { fontFamily: 'Sora-Bold', fontSize: 15, color: '#fff' },
  clientName: { flex: 1, fontFamily: 'Sora-Regular', fontSize: 15, color: colors.textSecondary },
  clientNameActive: { color: colors.textPrimary, fontFamily: 'Sora-SemiBold' },

  // Step 2 - Details form
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  selectedClient: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.accent + '15', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16,
  },
  selectedClientText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.accent },

  field: { marginBottom: 16 },
  fieldLabel: {
    fontFamily: 'Sora-SemiBold', fontSize: 11,
    color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 8,
  },
  datePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: dark.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: dark.line,
  },
  dateArrow: { padding: 12 },
  dateValue: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textPrimary },
  textInput: {
    backgroundColor: dark.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: dark.line,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: 'Sora-Regular', fontSize: 15, color: colors.textPrimary,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.line,
  },
  chipWide: { flex: 1, alignItems: 'center' },
  chipActive: { backgroundColor: colors.accent + '22', borderColor: colors.accent },
  chipText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textMuted },
  chipTextActive: { color: colors.accent },

  // Buttons
  primaryBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnGrad: { paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 16, color: '#fff' },
  ghostBtn: { alignItems: 'center', paddingVertical: 14 },
  ghostBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textMuted },
});
