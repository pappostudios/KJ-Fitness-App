import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator,
  StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients, dark } from '../../theme/colors';
import { MonthCalendar, WeekStrip, toISO, addMonths, MONTH_NAMES } from '../../components/CalendarView';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending_confirmation: { label: 'Awaiting Your Confirmation', color: '#F59E0B', icon: 'time-outline' },
  confirmed:            { label: 'Confirmed',                  color: '#10B981', icon: 'checkmark-circle-outline' },
  cancelled:            { label: 'Cancelled',                  color: '#EF4444', icon: 'close-circle-outline' },
};

const PAYMENT_CONFIG = {
  unpaid:  { label: 'Payment Due',  color: '#EF4444' },
  pending: { label: 'Payment Sent', color: '#F59E0B' },
  paid:    { label: 'Paid ✓',       color: '#10B981' },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClientScheduleScreen() {
  const { user } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

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
      Alert.alert('Error', 'Could not confirm the session. Try again.');
    } finally {
      setActing(false);
    }
  }, []);

  const declineSession = useCallback((booking) => {
    Alert.alert(
      'Decline Session',
      'Are you sure you want to decline this session?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Decline', style: 'destructive',
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
              Alert.alert('Error', 'Could not decline the session. Try again.');
            } finally {
              setActing(false);
            }
          },
        },
      ],
    );
  }, []);

  const requestPayment = useCallback(async (booking) => {
    Alert.alert(
      'Confirm Payment',
      'Mark this session as paid?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          onPress: async () => {
            setActing(true);
            try {
              await updateDoc(doc(db, 'bookings', booking.id), { paymentStatus: 'pending' });
              setDetailBooking((prev) => prev?.id === booking.id
                ? { ...prev, paymentStatus: 'pending' }
                : prev,
              );
            } catch {
              Alert.alert('Error', 'Could not update payment. Try again.');
            } finally {
              setActing(false);
            }
          },
        },
      ],
    );
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* Header */}
      <LinearGradient colors={gradients.hero} style={s.header}>
        <Text style={s.headerTitle}>My Schedule</Text>
        <Text style={s.headerSub}>
          {bookings.filter((b) => b.status !== 'cancelled').length} upcoming sessions
          {pendingCount > 0 ? `  ·  ${pendingCount} need confirmation` : ''}
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
                {m === 'month' ? 'Month' : 'Week'}
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

        {/* Selected day */}
        <View style={s.dayHeader}>
          <Text style={s.dayHeaderDate}>
            {selectedDate === toISO(new Date()) ? 'Today' : selectedDate}
          </Text>
          <Text style={s.dayHeaderCount}>{dayBookings.length} sessions</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
        ) : dayBookings.length === 0 ? (
          <View style={s.emptyDay}>
            <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
            <Text style={s.emptyDayTitle}>No sessions this day</Text>
            <Text style={s.emptyDaySub}>Your coach will schedule sessions for you</Text>
          </View>
        ) : (
          <View style={s.sessionsList}>
            {dayBookings.map((b) => (
              <ClientSessionCard key={b.id} booking={b} onPress={() => setDetailBooking(b)} />
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
                      {detailBooking.sessionType === 'group' ? 'Group Session' : 'Private Session'}
                    </Text>
                  </View>
                </View>

                {/* Status banner */}
                {detailBooking.status === 'pending_confirmation' && (
                  <View style={s.pendingBanner}>
                    <Ionicons name="alert-circle-outline" size={18} color="#F59E0B" />
                    <Text style={s.pendingBannerText}>This session needs your confirmation</Text>
                  </View>
                )}

                {/* Meta */}
                <View style={s.metaList}>
                  <MetaRow icon="calendar-outline" text={detailBooking.date} />
                  <MetaRow icon="time-outline" text={`${detailBooking.time}  ·  ${detailBooking.duration} min`} />
                  <MetaRow icon="location-outline" text={detailBooking.location || 'Not specified'} />
                  <MetaRow
                    icon="card-outline"
                    text={PAYMENT_CONFIG[detailBooking.paymentStatus ?? 'unpaid']?.label}
                    color={PAYMENT_CONFIG[detailBooking.paymentStatus ?? 'unpaid']?.color}
                  />
                </View>

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
                                <Text style={s.confirmBtnText}>Confirm Attendance</Text>
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
                        <Text style={s.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {detailBooking.status === 'confirmed' && detailBooking.paymentStatus === 'unpaid' && (
                    <TouchableOpacity
                      style={[s.payBtn, acting && s.btnDisabled]}
                      onPress={() => requestPayment(detailBooking)}
                      disabled={acting}
                      activeOpacity={0.85}
                    >
                      <LinearGradient colors={['#10B981', '#059669']} style={s.confirmBtnGrad}>
                        {acting
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <>
                              <Ionicons name="card-outline" size={18} color="#fff" />
                              <Text style={s.confirmBtnText}>Pay for Session</Text>
                            </>
                        }
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity style={s.closeBtn} onPress={() => setDetailBooking(null)}>
                  <Text style={s.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ClientSessionCard({ booking, onPress }) {
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
              {booking.sessionType === 'group' ? 'Group' : 'Private'}
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
            <Text style={s.pendingTagText}>Tap to confirm</Text>
          </View>
        )}
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
  payBtn: { borderRadius: 14, overflow: 'hidden' },
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
});
