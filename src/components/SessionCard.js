/**
 * SessionCard
 *
 * Displays the client's next upcoming session on the Home screen.
 * Accepts real booking data and the coach's Bit payment link as props.
 *
 * Props:
 *   booking     : object | null  — Firestore booking document
 *   bitLink     : string         — coach's Bit payment URL
 *   onReschedule: () => void     — called when the reschedule button is tapped
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionCard({ booking, bitLink, onReschedule }) {
  // ── No upcoming session ───────────────────────────────────────────────────
  if (!booking) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>אין אימון קרוב</Text>
        <Text style={styles.emptySub}>עברי ללשונית הזמנה לקבוע אימון</Text>
      </View>
    );
  }

  const payStatus = booking.paymentStatus || 'unpaid';
  const isPaid = payStatus === 'paid';

  // ── Pay with Bit ──────────────────────────────────────────────────────────
  const handleBitPress = async () => {
    if (!bitLink) {
      Alert.alert('קישור Bit חסר', 'המאמנת טרם הגדירה קישור Bit. פנה אליה ישירות.');
      return;
    }
    try {
      await Linking.openURL(bitLink);
      // Mark payment as pending once client opens Bit
      if (booking.id) {
        await updateDoc(doc(db, 'bookings', booking.id), { paymentStatus: 'pending' });
      }
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לפתוח את Bit. נסי שוב.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="calendar" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>האימון הבא</Text>
          <Text style={styles.title}>{formatDateShort(booking.date)}</Text>
        </View>
        {booking.price ? (
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>₪{booking.price}</Text>
          </View>
        ) : null}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Details row */}
      <View style={styles.detailsRow}>
        <View style={styles.detail}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.detailText}>{booking.time}</Text>
        </View>
        <View style={styles.detail}>
          <Ionicons name="timer-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.detailText}>{booking.duration} דקות</Text>
        </View>
        {/* Payment status pill */}
        <View style={[
          styles.payPill,
          { borderColor: PAYMENT_COLOR[payStatus], backgroundColor: PAYMENT_COLOR[payStatus] + '22' },
        ]}>
          <Text style={[styles.payPillText, { color: PAYMENT_COLOR[payStatus] }]}>
            {PAYMENT_LABEL[payStatus]}
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {/* Bit pay button — hidden once paid */}
        {!isPaid && (
          <TouchableOpacity
            style={styles.bitButton}
            activeOpacity={0.85}
            onPress={handleBitPress}
          >
            <Text style={styles.bitIcon}>💙</Text>
            <Text style={styles.bitButtonText}>שלם בBit</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.rescheduleButton, isPaid && styles.rescheduleButtonFull]}
          activeOpacity={0.8}
          onPress={onReschedule}
        >
          <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.rescheduleText}>שנה מועד</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyTitle: { ...typography.h4, color: colors.textSecondary },
  emptySub: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { ...typography.label, color: colors.textMuted, fontSize: 10, marginBottom: 2 },
  title: { ...typography.h4, color: colors.textPrimary },
  priceBadge: {
    backgroundColor: colors.primaryGlow,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,188,212,0.25)',
  },
  priceText: { ...typography.h4, color: colors.primary, fontSize: 14 },

  divider: { height: 1, backgroundColor: colors.divider },

  detailsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { ...typography.bodySmall, color: colors.textSecondary },

  // Payment pill in details row
  payPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    marginLeft: 'auto',
  },
  payPillText: { ...typography.caption, fontWeight: '700', fontSize: 11 },

  actions: { flexDirection: 'row', gap: 10 },

  bitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.bit,
    borderRadius: 14,
    paddingVertical: 12,
  },
  bitIcon: { fontSize: 16 },
  bitButtonText: { ...typography.button, color: '#fff' },

  rescheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.cardElevated,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  rescheduleButtonFull: { flex: 1 },
  rescheduleText: { ...typography.buttonSmall, color: colors.textSecondary },
});
