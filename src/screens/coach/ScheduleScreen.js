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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

// ── Constants ─────────────────────────────────────────────────────────────────

// Time options: 06:00 – 21:00 in 30-min steps
const TIMES = [];
for (let h = 6; h <= 21; h++) {
  TIMES.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 21) TIMES.push(`${String(h).padStart(2, '0')}:30`);
}

const DURATIONS = [45, 60];

// ── Payment helpers ───────────────────────────────────────────────────────────

const PAYMENT_LABEL = {
  unpaid: 'לא שולם',
  pending: 'ממתין',
  paid: 'שולם ✓',
};

const PAYMENT_COLOR = {
  unpaid: colors.error,
  pending: colors.warning,
  paid: colors.success,
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function groupByDate(items) {
  const map = {};
  items.forEach((s) => {
    if (!map[s.date]) map[s.date] = [];
    map[s.date].push(s);
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}

function formatDateHeader(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today = toISO(new Date());
  const tomorrow = toISO(addDays(new Date(), 1));
  if (iso === today) return 'היום';
  if (iso === tomorrow) return 'מחר';
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatDateShort(date) {
  return date.toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [tab, setTab] = useState('availability'); // 'availability' | 'bookings'

  // Add-slot modal state
  const [showModal, setShowModal] = useState(false);
  const [newDate, setNewDate] = useState(new Date());
  const [newTime, setNewTime] = useState('09:00');
  const [newDuration, setNewDuration] = useState(60);
  const [saving, setSaving] = useState(false);

  // ── Live: all upcoming slots ──────────────────────────────────────────────
  useEffect(() => {
    const today = toISO(new Date());
    const q = query(
      collection(db, 'slots'),
      where('date', '>=', today),
      orderBy('date', 'asc'),
      orderBy('time', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setSlots(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingSlots(false);
    });
    return unsub;
  }, []);

  // ── Live: all upcoming confirmed bookings with payment status ─────────────
  useEffect(() => {
    const today = toISO(new Date());
    const q = query(
      collection(db, 'bookings'),
      where('date', '>=', today),
      where('status', '==', 'confirmed'),
      orderBy('date', 'asc'),
      orderBy('time', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingBookings(false);
    });
    return unsub;
  }, []);

  // ── Add a new slot ────────────────────────────────────────────────────────
  const addSlot = useCallback(async () => {
    setSaving(true);
    try {
      await addDoc(collection(db, 'slots'), {
        date: toISO(newDate),
        time: newTime,
        duration: newDuration,
        isBooked: false,
        bookedBy: null,
        bookedByName: null,
        createdAt: serverTimestamp(),
      });
      setShowModal(false);
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשמור את הסלוט. נסה שוב.');
    } finally {
      setSaving(false);
    }
  }, [newDate, newTime, newDuration]);

  // ── Delete a slot ─────────────────────────────────────────────────────────
  const deleteSlot = useCallback((slot) => {
    if (slot.isBooked) {
      Alert.alert('לא ניתן למחוק', 'הסלוט הזה כבר הוזמן על ידי לקוח.\nבטל את ההזמנה תחילה.');
      return;
    }
    Alert.alert('מחיקת סלוט', `למחוק את ${slot.time}?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'slots', slot.id));
          } catch {
            Alert.alert('שגיאה', 'לא הצלחנו למחוק.');
          }
        },
      },
    ]);
  }, []);

  // ── Cancel a booking (coach side) ────────────────────────────────────────
  const cancelBooking = useCallback((booking) => {
    Alert.alert(
      'ביטול אימון',
      `לבטל את האימון של ${booking.clientName} בתאריך ${booking.date} בשעה ${booking.time}?`,
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
                tx.update(slotRef, {
                  isBooked: false,
                  bookedBy: null,
                  bookedByName: null,
                });
              });
            } catch {
              Alert.alert('שגיאה', 'לא הצלחנו לבטל את האימון. נסה שוב.');
            }
          },
        },
      ]
    );
  }, []);

  // ── Mark booking as paid ──────────────────────────────────────────────────
  const markAsPaid = useCallback((bookingId, clientName) => {
    Alert.alert(
      'אישור תשלום',
      `לסמן את האימון של ${clientName} כשולם?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אשר תשלום',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'bookings', bookingId), { paymentStatus: 'paid' });
            } catch {
              Alert.alert('שגיאה', 'לא הצלחנו לעדכן את סטטוס התשלום.');
            }
          },
        },
      ]
    );
  }, []);

  const openAddModal = useCallback(() => {
    setNewDate(new Date());
    setNewTime('09:00');
    setNewDuration(60);
    setShowModal(true);
  }, []);

  // Counts for tab labels
  const freeCount = slots.filter((s) => !s.isBooked).length;
  const bookedCount = bookings.length;
  const unpaidCount = bookings.filter((b) => b.paymentStatus !== 'paid').length;

  // Grouped data per tab
  const availabilityGroups = groupByDate(slots.filter((s) => !s.isBooked));
  const bookedSlotGroups = groupByDate(slots.filter((s) => s.isBooked));
  const bookingGroups = groupByDate(bookings);

  const isLoading = tab === 'availability' ? loadingSlots : loadingBookings;
  const isEmpty = tab === 'availability'
    ? availabilityGroups.length === 0
    : bookingGroups.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <LinearGradient colors={gradients.hero} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>לוח זמנים</Text>
            <Text style={styles.headerSub}>
              {freeCount} פנוי · {bookedCount} הוזמן
              {unpaidCount > 0 ? ` · ${unpaidCount} ממתינים לתשלום` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.85}>
            <LinearGradient colors={gradients.primary} style={styles.addBtnGradient}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>הוסף</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TabButton
            label={`זמינות (${freeCount})`}
            active={tab === 'availability'}
            onPress={() => setTab('availability')}
          />
          <TabButton
            label={`הזמנות (${bookedCount})`}
            active={tab === 'bookings'}
            onPress={() => setTab('bookings')}
            badge={unpaidCount > 0 ? unpaidCount : 0}
          />
        </View>
      </LinearGradient>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isEmpty ? (
        <EmptyState tab={tab} onAdd={openAddModal} />
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {tab === 'availability' && availabilityGroups.map(({ date, items }) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{formatDateHeader(date)}</Text>
              {items.map((slot) => (
                <CoachSlotCard
                  key={slot.id}
                  slot={slot}
                  onDelete={() => deleteSlot(slot)}
                />
              ))}
            </View>
          ))}

          {tab === 'bookings' && bookingGroups.map(({ date, items }) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{formatDateHeader(date)}</Text>
              {items.map((booking) => (
                <CoachBookingCard
                  key={booking.id}
                  booking={booking}
                  onMarkPaid={() => markAsPaid(booking.id, booking.clientName)}
                  onCancel={() => cancelBooking(booking)}
                />
              ))}
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add Slot Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>הוספת סלוט חדש</Text>

            {/* Date */}
            <FormGroup label="תאריך">
              <View style={styles.datePicker}>
                <TouchableOpacity
                  style={styles.dateArrow}
                  onPress={() => setNewDate((d) => addDays(d, -1))}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.dateValue}>{formatDateShort(newDate)}</Text>
                <TouchableOpacity
                  style={styles.dateArrow}
                  onPress={() => setNewDate((d) => addDays(d, 1))}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </FormGroup>

            {/* Time */}
            <FormGroup label="שעה">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timeGrid}
              >
                {TIMES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.timeChip, newTime === t && styles.chipSelected]}
                    onPress={() => setNewTime(t)}
                  >
                    <Text style={[styles.timeChipText, newTime === t && styles.chipTextSelected]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </FormGroup>

            {/* Duration */}
            <FormGroup label="משך האימון">
              <View style={styles.durationRow}>
                {DURATIONS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.durationChip, newDuration === d && styles.chipSelected]}
                    onPress={() => setNewDuration(d)}
                  >
                    <Text style={[styles.durationText, newDuration === d && styles.chipTextSelected]}>
                      {d} דק׳
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FormGroup>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={addSlot}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient colors={gradients.primary} style={styles.saveBtnGradient}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>שמור סלוט ✓</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowModal(false)}
              disabled={saving}
            >
              <Text style={styles.cancelText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TabButton({ label, active, onPress, badge = 0 }) {
  return (
    <TouchableOpacity
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.tabBtnInner}>
        <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
        {badge > 0 && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function FormGroup({ label, children }) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.formLabel}>{label}</Text>
      {children}
    </View>
  );
}

function CoachSlotCard({ slot, onDelete }) {
  return (
    <View style={styles.slotCard}>
      <View style={styles.slotAccent} />
      <View style={styles.slotInfo}>
        <Text style={styles.slotTime}>{slot.time}</Text>
        <Text style={styles.slotDurationText}>{slot.duration} דקות</Text>
      </View>
      <View style={styles.slotRight}>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CoachBookingCard({ booking, onMarkPaid, onCancel }) {
  const payStatus = booking.paymentStatus || 'unpaid';
  const isPaid = payStatus === 'paid';
  const statusColor = PAYMENT_COLOR[payStatus];

  return (
    <View style={[styles.bookingCard, isPaid && styles.bookingCardPaid]}>
      <View style={[styles.bookingAccent, { backgroundColor: statusColor }]} />
      <View style={styles.bookingBody}>
        {/* Top row */}
        <View style={styles.bookingTopRow}>
          <View style={styles.bookingInfo}>
            <Text style={styles.clientName}>{booking.clientName}</Text>
            <Text style={styles.bookingTime}>{booking.time} · {booking.duration} דקות</Text>
            {booking.price ? (
              <Text style={styles.bookingPrice}>₪{booking.price}</Text>
            ) : null}
          </View>
          {/* Payment status badge */}
          <View style={[
            styles.payBadge,
            { borderColor: statusColor, backgroundColor: statusColor + '22' },
          ]}>
            <Text style={[styles.payBadgeText, { color: statusColor }]}>
              {PAYMENT_LABEL[payStatus]}
            </Text>
          </View>
        </View>

        {/* Actions row */}
        <View style={styles.bookingActions}>
          {!isPaid && (
            <TouchableOpacity style={styles.markPaidBtn} onPress={onMarkPaid} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
              <Text style={styles.markPaidText}>שולם</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelBookingBtn} onPress={onCancel} activeOpacity={0.8}>
            <Ionicons name="close-circle-outline" size={14} color={colors.error} />
            <Text style={styles.cancelBookingText}>ביטול</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function EmptyState({ tab, onAdd }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyIcon}>{tab === 'bookings' ? '📬' : '📅'}</Text>
      <Text style={styles.emptyTitle}>
        {tab === 'bookings' ? 'אין הזמנות עדיין' : 'אין סלוטים עדיין'}
      </Text>
      {tab === 'availability' && (
        <>
          <Text style={styles.emptySub}>הוסף שעות פנויות כדי שלקוחות יוכלו להזמין</Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={onAdd}>
            <LinearGradient colors={gradients.primary} style={styles.emptyAddGradient}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyAddText}>הוסף סלוט</Text>
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },

  // Header
  header: { paddingTop: 20, paddingBottom: 0, paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
  },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },
  addBtn: { borderRadius: 14, overflow: 'hidden' },
  addBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  addBtnText: { ...typography.button, color: '#fff' },

  // Tabs
  tabs: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  tabBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabBtnText: { ...typography.buttonSmall, color: colors.textSecondary },
  tabBtnTextActive: { color: colors.primary },
  tabBadge: {
    backgroundColor: colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // Empty state
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...typography.h3, color: colors.textSecondary },
  emptySub: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },
  emptyAddBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  emptyAddGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
  },
  emptyAddText: { ...typography.button, color: '#fff' },

  // Date group
  dateGroup: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  dateHeader: { ...typography.label, color: colors.primary, marginBottom: 2 },

  // Availability slot card (free slots only)
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  slotAccent: { width: 4, alignSelf: 'stretch', backgroundColor: colors.textMuted },
  slotInfo: { flex: 1, padding: 14, gap: 3 },
  slotTime: { ...typography.h4, color: colors.textPrimary },
  slotDurationText: { ...typography.bodySmall, color: colors.textSecondary },
  slotRight: { paddingRight: 16 },
  deleteBtn: { padding: 4 },

  // Booking card (bookings tab)
  bookingCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  bookingCardPaid: { opacity: 0.8 },
  bookingAccent: { width: 4, alignSelf: 'stretch' },
  bookingBody: { flex: 1, padding: 12, gap: 10 },
  bookingTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  bookingInfo: { flex: 1, gap: 3 },
  clientName: { ...typography.h4, color: colors.textPrimary },
  bookingTime: { ...typography.bodySmall, color: colors.textSecondary },
  bookingPrice: { ...typography.caption, color: colors.primary, fontWeight: '700', marginTop: 2 },
  bookingActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  // Payment badge
  payBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  payBadgeText: { ...typography.caption, fontWeight: '700', fontSize: 11 },

  // Mark as paid
  markPaidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(76,175,80,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.success,
  },
  markPaidText: { ...typography.caption, color: colors.success, fontWeight: '700' },

  // Cancel booking
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 44,
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

  // Form elements
  formGroup: { gap: 8 },
  formLabel: { ...typography.label, color: colors.textSecondary },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundAlt,
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  dateArrow: { padding: 10 },
  dateValue: { ...typography.h4, color: colors.textPrimary },
  timeGrid: { gap: 8, paddingVertical: 4 },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  timeChipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  chipTextSelected: { color: colors.primary },
  durationRow: { flexDirection: 'row', gap: 12 },
  durationChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  durationText: { ...typography.h4, color: colors.textSecondary },

  // Modal buttons
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  saveBtnGradient: { padding: 16, alignItems: 'center' },
  saveBtnText: { ...typography.button, color: '#fff' },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelText: { ...typography.button, color: colors.textSecondary },
});
