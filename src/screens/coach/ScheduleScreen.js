import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator,
  StyleSheet, Alert, TextInput, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, orderBy, onSnapshot, addDoc,
  doc, getDoc, updateDoc, deleteDoc, serverTimestamp, setDoc, increment,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { sendPushNotification } from '../../utils/sendPushNotification';
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
    requested:            { label: t('schedule.requested'), color: '#8B5CF6' },
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
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Availability editor
  const [showAvailability, setShowAvailability] = useState(false);
  const [slotDate, setSlotDate] = useState(new Date());
  const [slotTime, setSlotTime] = useState('09:00');
  const [slotDuration, setSlotDuration] = useState(60);
  const [slotCustomDuration, setSlotCustomDuration] = useState('');
  const [slotLocation, setSlotLocation] = useState('');
  const [savingSlot, setSavingSlot] = useState(false);

  // Calendar state
  const [viewMode, setViewMode] = useState('month');
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toISO(new Date()));

  // Detail modal
  const [detailBooking, setDetailBooking] = useState(null);

  // Add session modal — step 1: clients, step 2: details
  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState('client');
  const [clientSearch, setClientSearch] = useState('');
  const [formClients, setFormClients] = useState([]);  // array of {uid, name}
  const [formDate, setFormDate] = useState(new Date());
  const [formTime, setFormTime] = useState('09:00');
  const [formDuration, setFormDuration] = useState(60);
  const [formCustomDuration, setFormCustomDuration] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formType, setFormType] = useState('private');
  const [formWorkoutPlan, setFormWorkoutPlan] = useState(null); // { pdfUrl, pdfTitle }
  const [showPdfPicker, setShowPdfPicker] = useState(false);
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

  // Open availability slots (future, unbooked)
  useEffect(() => {
    const today = toISO(new Date());
    const q = query(
      collection(db, 'slots'),
      where('isBooked', '==', false),
      where('date', '>=', today),
      orderBy('date'),
      orderBy('time'),
    );
    return onSnapshot(q, (snap) => {
      setSlots(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn('[Schedule] slots listener:', err.code));
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
    setFormClients([]);
    setFormDate(new Date());
    setFormTime('09:00');
    setFormDuration(60);
    setFormCustomDuration('');
    setFormLocation('');
    setFormType('private');
    setFormWorkoutPlan(null);
    setShowAdd(true);
  }, []);

  const toggleClient = useCallback((client) => {
    setFormClients((prev) =>
      prev.some((c) => c.uid === client.uid)
        ? prev.filter((c) => c.uid !== client.uid)
        : [...prev, client]
    );
  }, []);

  const saveSession = useCallback(async () => {
    if (formClients.length === 0) return;
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
      const msgText = t('schedule.sessionInviteMsg', { date: dateISO, time: formTime });

      await Promise.all(formClients.map(async (client) => {
        const docRef = await addDoc(collection(db, 'bookings'), {
          clientId: client.uid,
          clientName: client.name,
          date: dateISO,
          time: formTime,
          duration,
          location: formLocation.trim() || t('schedule.notSpecified'),
          sessionType: formType,
          status: 'pending_confirmation',
          clientConfirmed: false,
          paymentStatus: 'unpaid',
          price: null,
          workoutPlan: formWorkoutPlan ?? null,
          createdAt: serverTimestamp(),
        });

        const convId = client.uid;
        await addDoc(collection(db, 'conversations', convId, 'messages'), {
          text: msgText,
          senderId: 'coach',
          senderRole: 'coach',
          type: 'session_invite',
          bookingId: docRef.id,
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'conversations', convId), {
          clientId: client.uid,
          clientName: client.name,
          lastMessage: msgText,
          lastMessageAt: serverTimestamp(),
          unreadByClient: increment(1),
        }, { merge: true });
      }));

      setShowAdd(false);
      setSelectedDate(dateISO);
    } catch (e) {
      Alert.alert(t('schedule.invalidTime'), 'Could not save the session. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [formClients, formDate, formTime, formDuration, formCustomDuration, formLocation, formType, formWorkoutPlan, t]);

  // ── Availability slots ──────────────────────────────────────────────────────
  const openAvailability = useCallback(() => {
    setSlotDate(new Date());
    setSlotTime('09:00');
    setSlotDuration(60);
    setSlotCustomDuration('');
    setSlotLocation('');
    setShowAvailability(true);
  }, []);

  const addSlot = useCallback(async () => {
    if (!/^\d{1,2}:\d{2}$/.test(slotTime)) {
      Alert.alert(t('schedule.invalidTime'), t('schedule.invalidTimeMsg'));
      return;
    }
    const duration = slotCustomDuration ? parseInt(slotCustomDuration, 10) : slotDuration;
    if (!duration || isNaN(duration) || duration < 1) {
      Alert.alert(t('schedule.invalidDuration'), t('schedule.invalidDurationMsg'));
      return;
    }
    setSavingSlot(true);
    try {
      await addDoc(collection(db, 'slots'), {
        date: toISO(slotDate),
        time: slotTime,
        duration,
        location: slotLocation.trim() || t('schedule.notSpecified'),
        isBooked: false,
        bookedBy: null,
        createdAt: serverTimestamp(),
      });
      setSlotTime('09:00');
      setSlotCustomDuration('');
      setSlotLocation('');
    } catch {
      Alert.alert(t('common.error'), t('schedule.slotError'));
    } finally {
      setSavingSlot(false);
    }
  }, [slotDate, slotTime, slotDuration, slotCustomDuration, slotLocation, t]);

  const deleteSlot = useCallback((slot) => {
    Alert.alert(t('schedule.deleteSlot'), t('schedule.deleteSlotConfirm', { date: slot.date, time: slot.time }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.yes'), style: 'destructive',
        onPress: () => deleteDoc(doc(db, 'slots', slot.id)).catch(() => {}),
      },
    ]);
  }, [t]);

  // ── Confirm / decline a client-requested session ───────────────────────────
  const confirmRequest = useCallback(async (booking) => {
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'confirmed',
        confirmedAt: serverTimestamp(),
      });
      setDetailBooking((prev) => prev?.id === booking.id ? { ...prev, status: 'confirmed' } : prev);
      // Notify the client
      try {
        const userSnap = await getDoc(doc(db, 'users', booking.clientId));
        const token = userSnap.data()?.pushToken;
        if (token) {
          await sendPushNotification(
            token,
            t('schedule.confirmedPushTitle'),
            t('schedule.confirmedPushBody', { date: booking.date, time: booking.time }),
            { screen: 'Schedule' },
          );
        }
      } catch { /* non-blocking */ }
    } catch {
      Alert.alert(t('common.error'), t('schedule.slotError'));
    }
  }, [t]);

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
              // Reopen the availability slot if this booking came from one
              if (booking.slotId) {
                await updateDoc(doc(db, 'slots', booking.slotId), { isBooked: false, bookedBy: null })
                  .catch(() => {});
              }
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

  // ── Duplicate a session ─────────────────────────────────────────────────────
  // Pre-fills the add-session form from an existing booking, then opens the modal
  // so the coach can change the date and/or clients before saving (reuses saveSession).
  const duplicateBooking = useCallback((booking) => {
    setDetailBooking(null);
    const isPreset = DURATION_PRESETS.includes(booking.duration);
    setFormClients([{ uid: booking.clientId, name: booking.clientName }]);
    setFormDate(new Date(booking.date + 'T00:00:00'));
    setFormTime(booking.time);
    setFormDuration(isPreset ? booking.duration : 60);
    setFormCustomDuration(isPreset ? '' : String(booking.duration));
    setFormLocation(booking.location && booking.location !== t('schedule.notSpecified') ? booking.location : '');
    setFormType(booking.sessionType ?? 'private');
    setFormWorkoutPlan(booking.workoutPlan ?? null);
    setClientSearch('');
    setAddStep('client');
    setShowAdd(true);
  }, [t]);

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
          <View style={s.headerBtns}>
            <TouchableOpacity style={s.availBtn} onPress={openAvailability} activeOpacity={0.85}>
              <Ionicons name="time-outline" size={16} color={colors.accent} />
              <Text style={s.availBtnText}>{t('schedule.availability')}{slots.length > 0 ? ` · ${slots.length}` : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.addBtn} onPress={openAdd} activeOpacity={0.85}>
              <LinearGradient colors={gradients.primary} style={s.addBtnGrad}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={s.addBtnText}>{t('schedule.addSession')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
                  {detailBooking.status === 'requested' && (
                    <>
                      <View style={s.requestBanner}>
                        <Ionicons name="hand-left-outline" size={16} color="#8B5CF6" />
                        <Text style={s.requestBannerText}>{t('schedule.requestedBanner', { name: detailBooking.clientName })}</Text>
                      </View>
                      <ActionButton
                        icon="checkmark-circle-outline"
                        label={t('schedule.confirmRequest')}
                        color="#10B981"
                        onPress={() => confirmRequest(detailBooking)}
                      />
                    </>
                  )}
                  {detailBooking.paymentStatus !== 'paid' && detailBooking.status === 'confirmed' && (
                    <ActionButton
                      icon="checkmark-circle-outline"
                      label={t('schedule.markAsPaid')}
                      color="#10B981"
                      onPress={() => markAsPaid(detailBooking)}
                    />
                  )}
                  <ActionButton
                    icon="copy-outline"
                    label={t('schedule.duplicate')}
                    color={colors.accent}
                    onPress={() => duplicateBooking(detailBooking)}
                  />
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

                {/* Select all / none row */}
                {filteredClients.length > 0 && (
                  <View style={s.selectAllRow}>
                    <Text style={s.selectedCountText}>
                      {formClients.length > 0
                        ? `${formClients.length} selected`
                        : 'Tap to select clients'}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        filteredClients.every((c) => formClients.some((fc) => fc.uid === c.uid))
                          ? setFormClients((prev) => prev.filter((fc) => !filteredClients.some((c) => c.uid === fc.uid)))
                          : setFormClients((prev) => {
                              const existing = new Set(prev.map((c) => c.uid));
                              return [...prev, ...filteredClients.filter((c) => !existing.has(c.uid))];
                            })
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={s.selectAllText}>
                        {filteredClients.every((c) => formClients.some((fc) => fc.uid === c.uid))
                          ? 'Deselect all'
                          : 'Select all'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <ScrollView style={s.clientList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {filteredClients.length === 0 ? (
                    <Text style={s.noResults}>{t('schedule.noClients')}</Text>
                  ) : filteredClients.map((c) => {
                    const isSelected = formClients.some((fc) => fc.uid === c.uid);
                    return (
                      <TouchableOpacity
                        key={c.uid}
                        style={[s.clientRow, isSelected && s.clientRowActive]}
                        onPress={() => toggleClient(c)}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={isSelected ? gradients.primary : ['#333', '#333']}
                          style={s.clientAvatar}
                        >
                          <Text style={s.clientAvatarText}>{c.name[0]?.toUpperCase() ?? '?'}</Text>
                        </LinearGradient>
                        <Text style={[s.clientName, isSelected && s.clientNameActive]}>{c.name}</Text>
                        <View style={[s.checkbox, isSelected && s.checkboxChecked]}>
                          {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={[s.primaryBtn, formClients.length === 0 && s.primaryBtnDisabled]}
                  onPress={() => formClients.length > 0 && setAddStep('details')}
                  disabled={formClients.length === 0}
                >
                  <LinearGradient colors={gradients.primary} style={s.primaryBtnGrad}>
                    <Text style={s.primaryBtnText}>
                      {formClients.length > 0
                        ? `${t('schedule.next')} · ${formClients.length} ${formClients.length === 1 ? 'client' : 'clients'}`
                        : t('schedule.next')}
                    </Text>
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

                <View style={s.selectedClientBox}>
                  <View style={s.selectedClientHeader}>
                    <Ionicons name="people-outline" size={16} color={colors.accent} />
                    <Text style={s.selectedClientText}>
                      {formClients.length === 1
                        ? formClients[0].name
                        : `${formClients.length} clients`}
                    </Text>
                  </View>
                  {formClients.length > 1 && (
                    <Text style={s.selectedClientNames} numberOfLines={2}>
                      {formClients.map((c) => c.name).join(', ')}
                    </Text>
                  )}
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
                    placeholder={t('schedule.customDuration')}
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

                {/* Workout Plan */}
                <Field label={t('schedule.workoutPlanOptional')}>
                  {formWorkoutPlan ? (
                    <View style={s.pdfAttached}>
                      <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                      <Text style={s.pdfAttachedTitle} numberOfLines={1}>{formWorkoutPlan.pdfTitle || 'Workout Plan'}</Text>
                      <TouchableOpacity onPress={() => setShowPdfPicker(true)} activeOpacity={0.7}>
                        <Text style={s.pdfChangeBtn}>{t('schedule.changeWorkout')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setFormWorkoutPlan(null)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={s.pdfAttachBtn} onPress={() => setShowPdfPicker(true)} activeOpacity={0.8}>
                      <Ionicons name="attach-outline" size={18} color={colors.accent} />
                      <Text style={s.pdfAttachBtnText}>{t('schedule.attachWorkout')}</Text>
                    </TouchableOpacity>
                  )}
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

      {/* ── Availability Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={showAvailability}
        transparent
        animationType="slide"
        onRequestClose={() => !savingSlot && setShowAvailability(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
          <View style={s.addSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t('schedule.availabilityTitle')}</Text>
            <Text style={s.availSub}>{t('schedule.availabilitySub')}</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Add slot form */}
              <Field label={t('schedule.date')}>
                <View style={s.datePicker}>
                  <TouchableOpacity style={s.dateArrow} onPress={() => setSlotDate((d) => addDays(d, -1))}>
                    <Ionicons name="chevron-back" size={20} color={colors.accent} />
                  </TouchableOpacity>
                  <Text style={s.dateValue}>{toISO(slotDate)}</Text>
                  <TouchableOpacity style={s.dateArrow} onPress={() => setSlotDate((d) => addDays(d, 1))}>
                    <Ionicons name="chevron-forward" size={20} color={colors.accent} />
                  </TouchableOpacity>
                </View>
              </Field>

              <Field label={t('schedule.startTime')}>
                <TextInput
                  style={s.textInput}
                  value={slotTime}
                  onChangeText={setSlotTime}
                  placeholder={t('schedule.timePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </Field>

              <Field label={t('schedule.duration')}>
                <View style={s.chipRow}>
                  {DURATION_PRESETS.map((d) => {
                    const active = slotDuration === d && !slotCustomDuration;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => { setSlotDuration(d); setSlotCustomDuration(''); }}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>

              <Field label={t('schedule.location')}>
                <TextInput
                  style={s.textInput}
                  value={slotLocation}
                  onChangeText={setSlotLocation}
                  placeholder={t('schedule.locationPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <TouchableOpacity style={s.primaryBtn} onPress={addSlot} disabled={savingSlot} activeOpacity={0.85}>
                <LinearGradient colors={gradients.primary} style={s.primaryBtnGrad}>
                  {savingSlot
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.primaryBtnText}>{t('schedule.addSlot')}</Text>}
                </LinearGradient>
              </TouchableOpacity>

              {/* Existing open slots */}
              <Text style={s.pdfSectionLabel}>{t('schedule.openSlots')}</Text>
              {slots.length === 0 ? (
                <Text style={s.noPdfs}>{t('schedule.noSlots')}</Text>
              ) : (
                slots.map((sl) => (
                  <View key={sl.id} style={s.slotRow}>
                    <View style={s.slotRowIcon}>
                      <Ionicons name="time-outline" size={18} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.slotRowTitle}>{sl.date} · {sl.time}</Text>
                      <Text style={s.slotRowSub}>{sl.duration} min{sl.location && sl.location !== t('schedule.notSpecified') ? ` · ${sl.location}` : ''}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteSlot(sl)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <TouchableOpacity style={s.ghostBtn} onPress={() => setShowAvailability(false)} disabled={savingSlot}>
                <Text style={s.ghostBtnText}>{t('schedule.close')}</Text>
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── PDF Picker Modal ──────────────────────────────────────────────── */}
      {showPdfPicker && (
        <PdfPickerModal
          visible={showPdfPicker}
          onSelect={(plan) => { setFormWorkoutPlan(plan); setShowPdfPicker(false); }}
          onClose={() => setShowPdfPicker(false)}
          t={t}
        />
      )}
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

// ── PDF Picker Modal ──────────────────────────────────────────────────────────
function PdfPickerModal({ visible, onSelect, onClose, t }) {
  const [libraryPdfs, setLibraryPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pasteUrl, setPasteUrl] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const q = query(
      collection(db, 'library'),
      where('type', '==', 'pdf'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setLibraryPdfs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [visible]);

  const filtered = libraryPdfs.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const handlePasteAttach = () => {
    if (!pasteUrl.trim()) return;
    onSelect({ pdfUrl: pasteUrl.trim(), pdfTitle: pasteTitle.trim() || 'Workout Plan' });
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploading(true);
      setUploadProgress(0);

      const filename = `${Date.now()}_${asset.name}`;
      const storageRef = ref(storage, `workout-plans/${filename}`);

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, blob);
        task.on(
          'state_changed',
          (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          () => resolve(),
        );
      });

      const downloadURL = await getDownloadURL(storageRef);
      onSelect({ pdfUrl: downloadURL, pdfTitle: asset.name.replace(/\.pdf$/i, '') });
    } catch (e) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload file.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
        <View style={s.pdfSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>{t('schedule.pdfPickerTitle')}</Text>

          {/* Upload from device */}
          <TouchableOpacity
            style={[s.uploadFileBtn, uploading && { opacity: 0.6 }]}
            onPress={handlePickFile}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <LinearGradient colors={gradients.primary} style={s.uploadFileBtnInner}>
              {uploading ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.uploadFileBtnText}>{uploadProgress}%</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  <Text style={s.uploadFileBtnText}>Upload from Phone</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Library search */}
          <Text style={s.pdfSectionLabel}>{t('schedule.libraryPdfs')}</Text>
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t('schedule.searchClient')}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
          ) : filtered.length === 0 ? (
            <Text style={s.noPdfs}>{t('schedule.noPdfsInLibrary')}</Text>
          ) : (
            <ScrollView style={s.pdfList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {filtered.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={s.pdfRow}
                  onPress={() => onSelect({ pdfUrl: p.url, pdfTitle: p.title })}
                  activeOpacity={0.75}
                >
                  <View style={s.pdfRowIcon}>
                    <Ionicons name="document-text-outline" size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pdfRowTitle}>{p.title}</Text>
                    {p.description ? <Text style={s.pdfRowDesc} numberOfLines={1}>{p.description}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Paste URL section */}
          <Text style={s.pdfSectionLabel}>{t('schedule.orPasteUrl')}</Text>
          <TextInput
            style={[s.textInput, { marginBottom: 8 }]}
            value={pasteUrl}
            onChangeText={setPasteUrl}
            placeholder={t('schedule.pdfUrlPlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="url"
            autoCapitalize="none"
          />
          <TextInput
            style={[s.textInput, { marginBottom: 10 }]}
            value={pasteTitle}
            onChangeText={setPasteTitle}
            placeholder={t('schedule.pdfTitlePlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity
            style={[s.primaryBtn, !pasteUrl.trim() && s.primaryBtnDisabled]}
            onPress={handlePasteAttach}
            disabled={!pasteUrl.trim()}
            activeOpacity={0.85}
          >
            <LinearGradient colors={gradients.primary} style={s.primaryBtnGrad}>
              <Text style={s.primaryBtnText}>{t('schedule.attachButton')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.ghostBtn} onPress={onClose} disabled={uploading}>
            <Text style={s.ghostBtnText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.accent + '15', borderRadius: 12,
    borderWidth: 1, borderColor: colors.accent + '33',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  availBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 12.5, color: colors.accent },
  addBtn: { borderRadius: 12, overflow: 'hidden' },
  addBtnGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, gap: 6 },
  addBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: '#fff' },

  availSub: { fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginTop: -8, marginBottom: 14 },
  requestBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(139,92,246,0.12)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)',
    padding: 12, marginBottom: 2,
  },
  requestBannerText: { fontFamily: 'Sora-SemiBold', fontSize: 12.5, color: '#8B5CF6', flex: 1 },
  slotRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: dark.line,
  },
  slotRowIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: colors.accent + '15', alignItems: 'center', justifyContent: 'center',
  },
  slotRowTitle: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  slotRowSub: { fontFamily: 'Sora-Regular', fontSize: 11.5, color: colors.textMuted, marginTop: 2 },

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
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: dark.line,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: dark.bg2,
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectAllRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 6, paddingHorizontal: 2,
  },
  selectedCountText: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },
  selectAllText: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.accent },

  // Step 2 - Details form
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  selectedClientBox: {
    backgroundColor: colors.accent + '15', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, gap: 4,
  },
  selectedClientHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedClientText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.accent },
  selectedClientNames: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.accent, opacity: 0.75 },

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

  // Workout plan attachment
  pdfAttachBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.accent + '12', borderRadius: 12,
    borderWidth: 1, borderColor: colors.accent + '44', borderStyle: 'dashed',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  pdfAttachBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.accent },
  pdfAttached: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.accent + '12', borderRadius: 12,
    borderWidth: 1, borderColor: colors.accent + '44',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  pdfAttachedTitle: { flex: 1, fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.accent },
  pdfChangeBtn: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },

  // PDF picker modal
  pdfSheet: {
    backgroundColor: dark.bg1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 8, maxHeight: '90%',
  },
  pdfPickerSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: -8, marginBottom: 14 },
  pdfSectionLabel: {
    fontFamily: 'Sora-SemiBold', fontSize: 10.5, letterSpacing: 1.4,
    textTransform: 'uppercase', color: colors.textMuted,
    marginTop: 14, marginBottom: 8,
  },
  pdfList: { maxHeight: 200, marginBottom: 4 },
  noPdfs: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  pdfRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: dark.line,
  },
  pdfRowIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: colors.accent + '15', alignItems: 'center', justifyContent: 'center',
  },
  pdfRowTitle: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  pdfRowDesc: { fontFamily: 'Sora-Regular', fontSize: 11, color: colors.textMuted, marginTop: 2 },

  uploadFileBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  uploadFileBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13,
  },
  uploadFileBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: '#fff' },
});
