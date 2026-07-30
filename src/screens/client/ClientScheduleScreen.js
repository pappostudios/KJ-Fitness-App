import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator,
  StyleSheet, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc,
  serverTimestamp, runTransaction, addDoc, setDoc, increment,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { sendPushNotification } from '../../utils/sendPushNotification';
import { colors, gradients, dark } from '../../theme/colors';
import { MonthCalendar, WeekStrip, toISO, addMonths, MONTH_NAMES } from '../../components/CalendarView';

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClientScheduleScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();

  const STATUS_CONFIG = {
    requested:            { label: t('clientSchedule.requested'),    color: '#8B5CF6', icon: 'hourglass-outline' },
    pending_confirmation: { label: t('clientSchedule.awaitingConf'), color: '#F59E0B', icon: 'time-outline' },
    confirmed:            { label: t('clientSchedule.confirmed'),    color: '#10B981', icon: 'checkmark-circle-outline' },
    cancelled:            { label: t('clientSchedule.cancelled'),    color: '#EF4444', icon: 'close-circle-outline' },
  };

  const PAYMENT_CONFIG = {
    unpaid:  { label: t('clientSchedule.paymentDue'),  color: '#EF4444' },
    pending: { label: t('clientSchedule.paymentSent'), color: '#F59E0B' },
    paid:    { label: t('clientSchedule.paid'),        color: '#10B981' },
  };

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openSlots, setOpenSlots] = useState([]);
  const [showBook, setShowBook] = useState(false);
  const [bookingSlotId, setBookingSlotId] = useState(null);

  const [viewMode, setViewMode] = useState('month');
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toISO(new Date()));
  const [detailBooking, setDetailBooking] = useState(null);
  const [acting, setActing] = useState(false);

  // ── Live bookings for this client ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const today = toISO(new Date());
    const q = query(
      collection(db, 'bookings'),
      where('clientId', '==', user.uid),
      where('date', '>=', today),
      orderBy('date'),
      orderBy('time'),
    );
    return onSnapshot(q, (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user?.uid]);

  // ── Open availability slots the client can request ─────────────────────────
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
      setOpenSlots(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn('[ClientSchedule] slots:', err.code));
  }, []);

  // ── Request a session by booking an open slot (coach approves) ─────────────
  const requestSlot = useCallback((slot) => {
    Alert.alert(
      t('clientSchedule.bookSlotTitle'),
      t('clientSchedule.bookSlotConfirm', { date: slot.date, time: slot.time }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('clientSchedule.requestBtn'),
          onPress: async () => {
            setBookingSlotId(slot.id);
            const clientName = user.displayName || user.email || 'Client';
            try {
              const bookingRef = doc(collection(db, 'bookings'));
              await runTransaction(db, async (tx) => {
                const slotRef = doc(db, 'slots', slot.id);
                const slotSnap = await tx.get(slotRef);
                if (!slotSnap.exists() || slotSnap.data().isBooked) {
                  throw new Error('taken');
                }
                tx.update(slotRef, { isBooked: true, bookedBy: user.uid });
                tx.set(bookingRef, {
                  clientId: user.uid,
                  clientName,
                  date: slot.date,
                  time: slot.time,
                  duration: slot.duration,
                  location: slot.location || t('schedule.notSpecified'),
                  sessionType: 'private',
                  status: 'requested',
                  clientConfirmed: true,
                  paymentStatus: 'unpaid',
                  price: null,
                  workoutPlan: null,
                  slotId: slot.id,
                  createdAt: serverTimestamp(),
                });
              });

              // Post an invite-style message + notify the coach
              const msgText = t('clientSchedule.requestMsg', { date: slot.date, time: slot.time });
              await addDoc(collection(db, 'conversations', user.uid, 'messages'), {
                text: msgText,
                senderId: user.uid,
                senderRole: 'client',
                type: 'session_invite',
                bookingId: bookingRef.id,
                createdAt: serverTimestamp(),
              });
              await setDoc(doc(db, 'conversations', user.uid), {
                clientId: user.uid,
                clientName,
                lastMessage: msgText,
                lastMessageAt: serverTimestamp(),
                unreadByCoach: increment(1),
              }, { merge: true });
              try {
                const tokenSnap = await getDoc(doc(db, 'settings', 'coachToken'));
                const token = tokenSnap.data()?.pushToken;
                if (token) {
                  await sendPushNotification(
                    token,
                    t('clientSchedule.requestPushTitle'),
                    t('clientSchedule.requestPushBody', { name: clientName, date: slot.date, time: slot.time }),
                    { screen: 'Schedule' },
                  );
                }
              } catch { /* non-blocking */ }

              setShowBook(false);
              setSelectedDate(slot.date);
            } catch (e) {
              Alert.alert(
                t('common.error'),
                e.message === 'taken' ? t('clientSchedule.slotTaken') : t('clientSchedule.bookError'),
              );
            } finally {
              setBookingSlotId(null);
            }
          },
        },
      ],
    );
  }, [t, user]);

  // ── Open a specific booking when arriving from a chat invite ───────────────
  useEffect(() => {
    const openId = route?.params?.openBookingId;
    if (!openId) return;
    // Clear the param immediately so it doesn't re-trigger on re-render
    navigation?.setParams?.({ openBookingId: undefined });
    const found = bookings.find((b) => b.id === openId);
    if (found) {
      setDetailBooking(found);
      setSelectedDate(found.date);
    } else {
      // Past session not in the date-filtered list — fetch it directly
      getDoc(doc(db, 'bookings', openId)).then((snap) => {
        if (snap.exists()) {
          const b = { id: snap.id, ...snap.data() };
          setDetailBooking(b);
          setSelectedDate(b.date);
        }
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.openBookingId, bookings]);

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

  const pendingCount = bookings.filter((b) => b.status === 'pending_confirmation').length;

  // ── Actions ───────────────────────────────────────────────────────────────
  const confirmSession = useCallback(async (booking) => {
    setActing(true);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'confirmed',
        clientConfirmed: true,
        confirmedAt: serverTimestamp(),
      });
      setDetailBooking((prev) => prev?.id === booking.id
        ? { ...prev, status: 'confirmed', clientConfirmed: true }
        : prev,
      );
    } catch {
      Alert.alert(t('common.error'), 'Could not confirm the session. Try again.');
    } finally {
      setActing(false);
    }
  }, [t]);

  const declineSession = useCallback((booking) => {
    Alert.alert(
      t('clientSchedule.declineTitle'),
      t('clientSchedule.declineConfirm'),
      [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('clientSchedule.decline'), style: 'destructive',
          onPress: async () => {
            setActing(true);
            try {
              await updateDoc(doc(db, 'bookings', booking.id), {
                status: 'cancelled',
                clientConfirmed: false,
                cancelledAt: serverTimestamp(),
              });
              setDetailBooking(null);
            } catch {
              Alert.alert(t('common.error'), 'Could not decline the session. Try again.');
            } finally {
              setActing(false);
            }
          },
        },
      ],
    );
  }, [t]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* Header */}
      <LinearGradient colors={gradients.hero} style={s.header}>
        <Text style={s.headerTitle}>{t('clientSchedule.title')}</Text>
        <Text style={s.headerSub}>
          {t('clientSchedule.upcoming', { count: bookings.filter((b) => b.status !== 'cancelled').length })}
          {pendingCount > 0 ? `  ·  ${t('clientSchedule.needConfirmation', { count: pendingCount })}` : ''}
        </Text>

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

        {/* Book a session CTA */}
        <View style={s.bookCtaWrap}>
          <TouchableOpacity style={s.bookCta} onPress={() => setShowBook(true)} activeOpacity={0.85}>
            <LinearGradient colors={gradients.primary} style={s.bookCtaInner}>
              <Ionicons name="add-circle-outline" size={18} color={colors.accentInk} />
              <Text style={s.bookCtaText}>
                {t('clientSchedule.bookSession')}
                {openSlots.length > 0 ? ` · ${t('clientSchedule.slotsAvailable', { count: openSlots.length })}` : ''}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

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

        {/* Selected day */}
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
            <Text style={s.emptyDayTitle}>{t('clientSchedule.noSessions')}</Text>
            <Text style={s.emptyDaySub}>{t('clientSchedule.noSessionsSub')}</Text>
          </View>
        ) : (
          <View style={s.sessionsList}>
            {dayBookings.map((b) => (
              <ClientSessionCard key={b.id} booking={b} onPress={() => setDetailBooking(b)} t={t} />
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

                {/* Session type + status */}
                <View style={s.detailTopRow}>
                  <View style={[s.typeBadge, detailBooking.sessionType === 'group' && s.typeBadgeGroup]}>
                    <Ionicons
                      name={detailBooking.sessionType === 'group' ? 'people-outline' : 'person-outline'}
                      size={13}
                      color={detailBooking.sessionType === 'group' ? '#8B5CF6' : colors.accent}
                    />
                    <Text style={[s.typeBadgeText, detailBooking.sessionType === 'group' && s.typeBadgeTextGroup]}>
                      {detailBooking.sessionType === 'group' ? t('clientSchedule.groupSession') : t('clientSchedule.privateSession')}
                    </Text>
                  </View>
                </View>

                {/* Status banner */}
                {detailBooking.status === 'pending_confirmation' && (
                  <View style={s.pendingBanner}>
                    <Ionicons name="alert-circle-outline" size={18} color="#F59E0B" />
                    <Text style={s.pendingBannerText}>{t('clientSchedule.needsConfirmationMsg')}</Text>
                  </View>
                )}

                {/* Meta */}
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

                {/* Workout Plan */}
                {detailBooking.workoutPlan?.pdfUrl ? (
                  <TouchableOpacity
                    style={s.workoutPlanCard}
                    onPress={() => Linking.openURL(detailBooking.workoutPlan.pdfUrl).catch(() => {})}
                    activeOpacity={0.8}
                  >
                    <View style={s.workoutPlanIcon}>
                      <Ionicons name="document-text-outline" size={22} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.workoutPlanLabel}>{t('schedule.workoutPlan')}</Text>
                      <Text style={s.workoutPlanTitle} numberOfLines={1}>
                        {detailBooking.workoutPlan.pdfTitle || 'Workout Plan'}
                      </Text>
                    </View>
                    <View style={s.workoutPlanOpenBtn}>
                      <Text style={s.workoutPlanOpenText}>{t('schedule.openWorkout')}</Text>
                      <Ionicons name="open-outline" size={13} color={colors.accent} />
                    </View>
                  </TouchableOpacity>
                ) : null}

                {/* Actions */}
                <View style={s.detailActions}>
                  {detailBooking.status === 'pending_confirmation' && (
                    <>
                      <TouchableOpacity
                        style={[s.confirmBtn, acting && s.btnDisabled]}
                        onPress={() => confirmSession(detailBooking)}
                        disabled={acting}
                        activeOpacity={0.85}
                      >
                        <LinearGradient colors={gradients.primary} style={s.confirmBtnGrad}>
                          {acting
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <>
                                <Ionicons name="checkmark" size={18} color="#fff" />
                                <Text style={s.confirmBtnText}>{t('clientSchedule.confirmAttendance')}</Text>
                              </>
                          }
                        </LinearGradient>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.declineBtn, acting && s.btnDisabled]}
                        onPress={() => declineSession(detailBooking)}
                        disabled={acting}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={16} color={colors.error} />
                        <Text style={s.declineBtnText}>{t('clientSchedule.decline')}</Text>
                      </TouchableOpacity>
                    </>
                  )}

                </View>

                <TouchableOpacity style={s.closeBtn} onPress={() => setDetailBooking(null)}>
                  <Text style={s.closeBtnText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Book a session Modal ───────────────────────────────────────────── */}
      <Modal visible={showBook} transparent animationType="slide" onRequestClose={() => setShowBook(false)}>
        <View style={s.overlay}>
          <View style={s.bookSheet}>
            <View style={s.modalHandle} />
            <Text style={s.bookSheetTitle}>{t('clientSchedule.availableSlots')}</Text>
            <Text style={s.bookSheetSub}>{t('clientSchedule.availableSlotsSub')}</Text>

            {openSlots.length === 0 ? (
              <View style={s.bookEmpty}>
                <Ionicons name="calendar-outline" size={36} color={colors.textMuted} />
                <Text style={s.bookEmptyText}>{t('clientSchedule.noSlots')}</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {openSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot.id}
                    style={s.slotCard}
                    onPress={() => requestSlot(slot)}
                    disabled={!!bookingSlotId}
                    activeOpacity={0.8}
                  >
                    <View style={s.slotCardIcon}>
                      <Ionicons name="time-outline" size={20} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.slotCardDate}>{slot.date}</Text>
                      <Text style={s.slotCardTime}>
                        {slot.time} · {slot.duration} min
                        {slot.location && slot.location !== t('schedule.notSpecified') ? ` · ${slot.location}` : ''}
                      </Text>
                    </View>
                    {bookingSlotId === slot.id
                      ? <ActivityIndicator size="small" color={colors.accent} />
                      : <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textMuted} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={s.closeBtn} onPress={() => setShowBook(false)} disabled={!!bookingSlotId}>
              <Text style={s.closeBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ClientSessionCard({ booking, onPress, t }) {
  const STATUS_CONFIG = {
    requested:            { color: '#8B5CF6', icon: 'hourglass-outline' },
    pending_confirmation: { color: '#F59E0B', icon: 'time-outline' },
    confirmed:            { color: '#10B981', icon: 'checkmark-circle-outline' },
    cancelled:            { color: '#EF4444', icon: 'close-circle-outline' },
  };
  const statusCfg = STATUS_CONFIG[booking.status] ?? { color: colors.textMuted, icon: 'ellipse-outline' };
  const isPending = booking.status === 'pending_confirmation';

  return (
    <TouchableOpacity
      style={[s.sessionCard, isPending && s.sessionCardPending]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[s.sessionAccent, { backgroundColor: statusCfg.color }]} />
      <View style={s.sessionBody}>
        <View style={s.sessionTop}>
          <Text style={s.sessionTime}>{booking.time}</Text>
          <View style={[s.typePill, booking.sessionType === 'group' && s.typePillGroup]}>
            <Text style={[s.typePillText, booking.sessionType === 'group' && s.typePillTextGroup]}>
              {booking.sessionType === 'group' ? t('clientSchedule.group') : t('clientSchedule.private')}
            </Text>
          </View>
        </View>
        <Text style={s.sessionDuration}>{booking.duration} min</Text>
        {booking.location && booking.location !== 'Not specified' && (
          <Text style={s.sessionLocation} numberOfLines={1}>
            <Ionicons name="location-outline" size={11} color={colors.textMuted} />  {booking.location}
          </Text>
        )}
        {isPending && (
          <View style={s.pendingTag}>
            <Ionicons name="alert-circle-outline" size={12} color="#F59E0B" />
            <Text style={s.pendingTagText}>{t('clientSchedule.tapToConfirm')}</Text>
          </View>
        )}
        {booking.workoutPlan?.pdfUrl ? (
          <View style={s.workoutTag}>
            <Ionicons name="document-text-outline" size={11} color={colors.accent} />
            <Text style={s.workoutTagText}>{t('schedule.workoutPlan')}</Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginRight: 12, alignSelf: 'center' }} />
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

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: dark.bg0 },
  scroll: { flex: 1 },

  // Header
  header: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 0 },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 22, color: colors.textPrimary, marginBottom: 4 },
  headerSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },
  modeToggle: { flexDirection: 'row', gap: 8, paddingVertical: 14 },
  modeBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 10,
    backgroundColor: dark.bg2, alignItems: 'center',
    borderWidth: 1, borderColor: dark.line,
  },
  modeBtnActive: { backgroundColor: colors.accent + '22', borderColor: colors.accent },
  modeBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.textMuted },
  modeBtnTextActive: { color: colors.accent },

  // Calendar
  calSection: { padding: 16, paddingBottom: 8 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthTitle: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textPrimary },

  // Day header
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: dark.line, marginTop: 4,
  },
  dayHeaderDate: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  dayHeaderCount: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },

  // Empty
  emptyDay: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyDayTitle: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textMuted },
  emptyDaySub: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  // Session cards
  sessionsList: { paddingHorizontal: 16, gap: 10 },
  sessionCard: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: dark.bg1, borderRadius: 14,
    borderWidth: 1, borderColor: dark.line, overflow: 'hidden',
  },
  sessionCardPending: { borderColor: '#F59E0B' + '55' },
  sessionAccent: { width: 4, alignSelf: 'stretch' },
  sessionBody: { flex: 1, padding: 12, gap: 3 },
  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionTime: { fontFamily: 'Sora-Bold', fontSize: 18, color: colors.textPrimary },
  sessionDuration: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },
  sessionLocation: { fontFamily: 'Sora-Regular', fontSize: 11, color: colors.textMuted, marginTop: 2 },
  typePill: {
    backgroundColor: colors.accent + '22', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  typePillGroup: { backgroundColor: '#8B5CF6' + '22' },
  typePillText: { fontFamily: 'Sora-SemiBold', fontSize: 10, color: colors.accent },
  typePillTextGroup: { color: '#8B5CF6' },
  pendingTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  pendingTagText: { fontFamily: 'Sora-SemiBold', fontSize: 11, color: '#F59E0B' },

  // Book a session CTA
  bookCtaWrap: { paddingHorizontal: 16, paddingTop: 14 },
  bookCta: { borderRadius: 14, overflow: 'hidden' },
  bookCtaInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  bookCtaText: { fontFamily: 'Sora-Bold', fontSize: 14, color: colors.accentInk },

  // Book sheet
  bookSheet: {
    backgroundColor: dark.bg1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 32, maxHeight: '85%',
  },
  bookSheetTitle: { fontFamily: 'Sora-Bold', fontSize: 20, color: colors.textPrimary, textAlign: 'center' },
  bookSheetSub: { fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  bookEmpty: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  bookEmptyText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textMuted },
  slotCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: dark.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: dark.line,
    padding: 14, marginBottom: 10,
  },
  slotCardIcon: {
    width: 40, height: 40, borderRadius: 11,
    backgroundColor: colors.accent + '15', alignItems: 'center', justifyContent: 'center',
  },
  slotCardDate: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  slotCardTime: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Detail modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4,
    borderRadius: 2, backgroundColor: dark.line, marginBottom: 16,
  },
  detailSheet: {
    backgroundColor: dark.bg1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  detailTopRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent + '22', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  typeBadgeGroup: { backgroundColor: '#8B5CF6' + '22' },
  typeBadgeText: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.accent },
  typeBadgeTextGroup: { color: '#8B5CF6' },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F59E0B' + '18', borderRadius: 10,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#F59E0B' + '40',
  },
  pendingBannerText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: '#F59E0B', flex: 1 },

  metaList: { gap: 14, marginBottom: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText: { fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textSecondary, flex: 1 },

  detailActions: { gap: 10, marginBottom: 12 },
  confirmBtn: { borderRadius: 14, overflow: 'hidden' },
  confirmBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  confirmBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: '#fff' },
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 14,
    borderWidth: 1, borderColor: colors.error + '40',
    backgroundColor: colors.error + '12',
  },
  declineBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.error },
  btnDisabled: { opacity: 0.5 },

  closeBtn: { alignItems: 'center', paddingVertical: 12 },
  closeBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textMuted },

  // Workout plan card (detail modal)
  workoutPlanCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.accent + '10', borderRadius: 14,
    borderWidth: 1, borderColor: colors.accent + '40',
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  workoutPlanIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: colors.accent + '20', alignItems: 'center', justifyContent: 'center',
  },
  workoutPlanLabel: { fontFamily: 'Sora-Regular', fontSize: 10.5, color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.8 },
  workoutPlanTitle: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary, marginTop: 2 },
  workoutPlanOpenBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  workoutPlanOpenText: { fontFamily: 'Sora-SemiBold', fontSize: 12, color: colors.accent },

  // Workout tag on session card
  workoutTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  workoutTagText: { fontFamily: 'Sora-Regular', fontSize: 11, color: colors.accent },
});
