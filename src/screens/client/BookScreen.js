import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  runTransaction,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useCoachSettings } from '../../hooks/useCoachSettings';
import { sendPushNotification } from '../../utils/sendPushNotification';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildDays(count = 14) {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      iso: toISO(d),
      dayName: d.toLocaleDateString('he-IL', { weekday: 'short' }),
      dayNum: d.getDate(),
      monthName: d.toLocaleDateString('he-IL', { month: 'short' }),
      isToday: i === 0,
    });
  }
  return days;
}

function formatDateLong(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ── Session reminder scheduler ────────────────────────────────────────────────

async function scheduleSessionReminders(dateISO, time) {
  try {
    // expo-notifications is disabled in Expo Go (SDK 53+).
    // This function is a no-op until a dev build is used.
    return;
    // eslint-disable-next-line no-unreachable
    const Notifications = require('expo-notifications');
    const [h, m] = time.split(':').map(Number);
    const sessionDate = new Date(dateISO + 'T00:00:00');
    sessionDate.setHours(h, m, 0, 0);
    const now = Date.now();
    const sessionMs = sessionDate.getTime();

    const remind24h = new Date(sessionMs - 24 * 60 * 60 * 1000);
    const remind1h  = new Date(sessionMs -      60 * 60 * 1000);

    if (remind24h.getTime() > now) {
      await Notifications.scheduleNotificationAsync({
        content: { title: '⏰ תזכורת לאימון מחר', body: `יש לך אימון מחר בשעה ${time}. אל תשכחי!`, sound: true },
        trigger: { date: remind24h },
      });
    }
    if (remind1h.getTime() > now) {
      await Notifications.scheduleNotificationAsync({
        content: { title: '🏃 האימון שלך בעוד שעה!', body: `בשעה ${time} — התכוני!`, sound: true },
        trigger: { date: remind1h },
      });
    }
  } catch {
    // Non-critical
  }
}

// ── Payment status helpers ────────────────────────────────────────────────────

const PAYMENT_LABEL = {
  unpaid: 'לא שולם',
  pending: 'ממתין לאישור',
  paid: 'שולם ✓',
};

const PAYMENT_COLOR = {
  unpaid: colors.error,
  pending: colors.warning,
  paid: colors.success,
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function BookScreen() {
  const { user, profile } = useAuth();
  const { settings } = useCoachSettings();

  const [days] = useState(() => buildDays(14));
  const [selectedDay, setSelectedDay] = useState(() => buildDays(14)[0]);
  const [slots, setSlots] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [booking, setBooking] = useState(false);

  // ── Live: available slots for selected day ────────────────────────────────
  useEffect(() => {
    setLoadingSlots(true);
    const q = query(
      collection(db, 'slots'),
      where('date', '==', selectedDay.iso),
      where('isBooked', '==', false),
      orderBy('time', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setSlots(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingSlots(false);
    });
    return unsub;
  }, [selectedDay.iso]);

  // ── Live: my upcoming confirmed bookings ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const today = toISO(new Date());
    const q = query(
      collection(db, 'bookings'),
      where('clientId', '==', user.uid),
      where('date', '>=', today),
      where('status', '==', 'confirmed'),
      orderBy('date', 'asc'),
      orderBy('time', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMyBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingBookings(false);
    });
    return unsub;
  }, [user]);

  // ── Book a slot (transactional — prevents double-booking) ─────────────────
  const confirmBooking = useCallback(async () => {
    if (!selectedSlot || !user) return;
    setBooking(true);
    try {
      const slotRef = doc(db, 'slots', selectedSlot.id);
      await runTransaction(db, async (tx) => {
        const slotSnap = await tx.get(slotRef);
        if (!slotSnap.exists() || slotSnap.data().isBooked) {
          throw new Error('slot_taken');
        }
        // Mark slot as booked
        tx.update(slotRef, {
          isBooked: true,
          bookedBy: user.uid,
          bookedByName: profile?.name ?? user.email,
        });
        // Create booking record with paymentStatus
        const bookingRef = doc(collection(db, 'bookings'));
        tx.set(bookingRef, {
          slotId: selectedSlot.id,
          clientId: user.uid,
          clientName: profile?.name ?? user.email,
          date: selectedSlot.date,
          time: selectedSlot.time,
          duration: selectedSlot.duration,
          status: 'confirmed',
          paymentStatus: 'unpaid',
          price: settings.sessionPrice || '',
          createdAt: serverTimestamp(),
        });
      });
      // Notify coach about new booking
      const coachSnap = await getDoc(doc(db, 'settings', 'coach'));
      const coachToken = coachSnap.exists() ? coachSnap.data().pushToken : null;
      await sendPushNotification(
        coachToken,
        '📅 הזמנה חדשה!',
        `${profile?.name ?? 'לקוח'} קבע אימון ל-${selectedSlot.date} בשעה ${selectedSlot.time}`,
        { screen: 'Schedule' }
      );

      // Schedule local reminder notifications for the client
      await scheduleSessionReminders(selectedSlot.date, selectedSlot.time, profile?.name);

      setSelectedSlot(null);
    } catch (err) {
      if (err.message === 'slot_taken') {
        Alert.alert('המקום כבר נלקח', 'מישהו הזמין את השעה הזו. בחר מועד אחר.');
      } else {
        Alert.alert('שגיאה', 'לא הצלחנו לסיים את ההזמנה. נסה שוב.');
      }
    } finally {
      setBooking(false);
    }
  }, [selectedSlot, user, profile, settings.sessionPrice]);

  // ── Cancel a booking ──────────────────────────────────────────────────────
  const cancelBooking = useCallback((booking) => {
    Alert.alert(
      'ביטול אימון',
      `האם לבטל את האימון בתאריך ${formatDateLong(booking.date)} בשעה ${booking.time}?`,
      [
        { text: 'לא', style: 'cancel' },
        {
          text: 'כן, בטל',
          style: 'destructive',
          onPress: async () => {
            try {
              const bookingRef = doc(db, 'bookings', booking.id);
              const slotRef = doc(db, 'slots', booking.slotId);
              await runTransaction(db, async (tx) => {
                tx.update(bookingRef, { status: 'cancelled', cancelledAt: serverTimestamp() });
                // Free the slot so others can book it
                tx.update(slotRef, {
                  isBooked: false,
                  bookedBy: null,
                  bookedByName: null,
                });
              });
              // Notify coach
              const coachSnap = await getDoc(doc(db, 'settings', 'coach'));
              const coachToken = coachSnap.exists() ? coachSnap.data().pushToken : null;
              await sendPushNotification(
                coachToken,
                '❌ ביטול אימון',
                `${profile?.name ?? 'לקוח'} ביטל את האימון ל-${booking.date} בשעה ${booking.time}`,
                { screen: 'Schedule' }
              );
            } catch {
              Alert.alert('שגיאה', 'לא הצלחנו לבטל את האימון. נסה שוב.');
            }
          },
        },
      ]
    );
  }, [profile]);

  // ── Mark payment as pending after opening Bit ─────────────────────────────
  const handlePayWithBit = useCallback(async (bookingId) => {
    const bitLink = settings.bitLink;
    if (!bitLink) {
      Alert.alert('קישור Bit חסר', 'המאמנת טרם הגדירה קישור Bit. צרי קשר איתה ישירות.');
      return;
    }
    try {
      await Linking.openURL(bitLink);
      // Mark as pending once client taps the button
      await updateDoc(doc(db, 'bookings', bookingId), { paymentStatus: 'pending' });
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לפתוח את Bit. נסי שוב.');
    }
  }, [settings.bitLink]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={gradients.hero} style={styles.header}>
          <Text style={styles.headerTitle}>קביעת אימון</Text>
          <Text style={styles.headerSub}>בחר יום ושעה פנויה</Text>
        </LinearGradient>

        {/* Day strip */}
        <View style={styles.dayStripContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayStrip}
          >
            {days.map((day) => {
              const isSelected = day.iso === selectedDay.iso;
              return (
                <TouchableOpacity
                  key={day.iso}
                  style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                    {day.dayName}
                  </Text>
                  <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                    {day.dayNum}
                  </Text>
                  {day.isToday && (
                    <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Available slots */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedDay.isToday
              ? 'היום'
              : `${selectedDay.dayName} ${selectedDay.dayNum} ${selectedDay.monthName}`}
          </Text>

          {loadingSlots ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : slots.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>אין שעות פנויות</Text>
              <Text style={styles.emptySub}>נסה יום אחר</Text>
            </View>
          ) : (
            slots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} onBook={() => setSelectedSlot(slot)} />
            ))
          )}
        </View>

        {/* My upcoming sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>האימונים הקרובים שלי</Text>
          {loadingBookings ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          ) : myBookings.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptySub}>עוד אין אימונים קבועים</Text>
            </View>
          ) : (
            myBookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onPayWithBit={() => handlePayWithBit(b.id)}
                onCancel={() => cancelBooking(b)}
              />
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Booking confirmation modal */}
      <Modal
        visible={!!selectedSlot}
        transparent
        animationType="slide"
        onRequestClose={() => !booking && setSelectedSlot(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>אישור הזמנה</Text>

            {selectedSlot && (
              <>
                <View style={styles.modalInfo}>
                  <ModalRow icon="calendar-outline" label={formatDateLong(selectedSlot.date)} />
                  <ModalRow icon="time-outline" label={selectedSlot.time} />
                  <ModalRow icon="timer-outline" label={`${selectedSlot.duration} דקות`} />
                  {settings.sessionPrice ? (
                    <ModalRow icon="cash-outline" label={`₪${settings.sessionPrice}`} />
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={confirmBooking}
                  disabled={booking}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={gradients.primary} style={styles.confirmGradient}>
                    {booking
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.confirmText}>אישור הזמנה ✓</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setSelectedSlot(null)}
                  disabled={booking}
                >
                  <Text style={styles.cancelText}>ביטול</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SlotCard({ slot, onBook }) {
  return (
    <View style={styles.slotCard}>
      <View style={styles.slotLeft}>
        <Text style={styles.slotTime}>{slot.time}</Text>
        <Text style={styles.slotDuration}>{slot.duration} דקות</Text>
      </View>
      <TouchableOpacity style={styles.bookBtn} onPress={onBook} activeOpacity={0.8}>
        <LinearGradient colors={gradients.primary} style={styles.bookBtnGradient}>
          <Text style={styles.bookBtnText}>הזמן</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function BookingCard({ booking, onPayWithBit, onCancel }) {
  const dateStr = formatDateLong(booking.date);
  const payStatus = booking.paymentStatus || 'unpaid';
  const isPaid = payStatus === 'paid';

  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingAccent} />
      <View style={styles.bookingBody}>
        {/* Top row: info + payment badge */}
        <View style={styles.bookingTopRow}>
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingDate}>{dateStr}</Text>
            <Text style={styles.bookingTime}>{booking.time} · {booking.duration} דקות</Text>
            {booking.price ? (
              <Text style={styles.bookingPrice}>₪{booking.price}</Text>
            ) : null}
          </View>
          <View style={[
            styles.payStatusBadge,
            { borderColor: PAYMENT_COLOR[payStatus], backgroundColor: PAYMENT_COLOR[payStatus] + '22' },
          ]}>
            <Text style={[styles.payStatusText, { color: PAYMENT_COLOR[payStatus] }]}>
              {PAYMENT_LABEL[payStatus]}
            </Text>
          </View>
        </View>

        {/* Action row */}
        <View style={styles.bookingActions}>
          {/* Bit pay button — only when not paid */}
          {!isPaid && (
            <TouchableOpacity
              style={styles.bitPayBtn}
              onPress={onPayWithBit}
              activeOpacity={0.85}
            >
              <Text style={styles.bitPayIcon}>💙</Text>
              <Text style={styles.bitPayText}>Bit</Text>
            </TouchableOpacity>
          )}
          {/* Cancel button */}
          <TouchableOpacity
            style={styles.cancelBookingBtn}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={14} color={colors.error} />
            <Text style={styles.cancelBookingText}>ביטול</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ModalRow({ icon, label }) {
  return (
    <View style={styles.modalRow}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.modalLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },

  header: { paddingTop: 20, paddingBottom: 24, paddingHorizontal: 20 },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },

  // Day strip
  dayStripContainer: { borderBottomWidth: 1, borderBottomColor: colors.border },
  dayStrip: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  dayChip: {
    width: 52,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    gap: 4,
  },
  dayChipSelected: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  dayName: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  dayNameSelected: { color: colors.primary },
  dayNum: { ...typography.h4, color: colors.textPrimary },
  dayNumSelected: { color: colors.primary },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textMuted },
  todayDotSelected: { backgroundColor: colors.primary },

  // Sections
  section: { padding: 16, gap: 10 },
  sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: 4 },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyIcon: { fontSize: 38 },
  emptyTitle: { ...typography.h4, color: colors.textSecondary },
  emptySub: { ...typography.bodySmall, color: colors.textMuted },

  // Slot card
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
  },
  slotLeft: { gap: 2 },
  slotTime: { ...typography.h3, color: colors.textPrimary },
  slotDuration: { ...typography.bodySmall, color: colors.textSecondary },
  bookBtn: { borderRadius: 12, overflow: 'hidden' },
  bookBtnGradient: { paddingHorizontal: 24, paddingVertical: 10 },
  bookBtnText: { ...typography.button, color: '#fff' },

  // Booking card
  bookingCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  bookingAccent: { width: 4, alignSelf: 'stretch', backgroundColor: colors.primary },
  bookingBody: { flex: 1, padding: 12, gap: 10 },
  bookingTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  bookingInfo: { flex: 1, gap: 3 },
  bookingDate: { ...typography.h4, color: colors.textPrimary },
  bookingTime: { ...typography.bodySmall, color: colors.textSecondary },
  bookingPrice: { ...typography.caption, color: colors.primary, fontWeight: '700', marginTop: 2 },
  bookingActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  // Payment status badge
  payStatusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  payStatusText: { ...typography.caption, fontWeight: '700', fontSize: 11 },

  // Bit pay button
  bitPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bit,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bitPayIcon: { fontSize: 13 },
  bitPayText: { ...typography.caption, color: '#fff', fontWeight: '700' },

  // Cancel booking button
  cancelBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.error + '15',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  cancelBookingText: { ...typography.caption, color: colors.error, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  modalTitle: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },
  modalInfo: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalLabel: { ...typography.body, color: colors.textPrimary },
  confirmBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  confirmGradient: { padding: 16, alignItems: 'center' },
  confirmText: { ...typography.button, color: '#fff' },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelText: { ...typography.button, color: colors.textSecondary },
});
