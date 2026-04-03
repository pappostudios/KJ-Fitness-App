import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

// Placeholder — will come from Firebase later
const MOCK_SESSION = {
  date: 'Tuesday, April 7',
  time: '10:00 AM',
  type: '1-on-1 Training',
  location: 'In-Person',
  price: '₪180',
  // Coach's Bit payment link — will come from coach settings in Firebase
  bitLink: 'https://bit.me/kjfitness',
};

export default function SessionCard({ onPress }) {
  const handleBitPress = () => {
    Linking.openURL(MOCK_SESSION.bitLink).catch(() => {
      // Bit app not installed — open link in browser
      Linking.openURL(MOCK_SESSION.bitLink);
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="calendar" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>NEXT SESSION</Text>
          <Text style={styles.title}>{MOCK_SESSION.date}</Text>
        </View>
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>{MOCK_SESSION.price}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Details row */}
      <View style={styles.detailsRow}>
        <View style={styles.detail}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.detailText}>{MOCK_SESSION.time}</Text>
        </View>
        <View style={styles.detail}>
          <Ionicons name="barbell-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.detailText}>{MOCK_SESSION.type}</Text>
        </View>
        <View style={styles.detail}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.detailText}>{MOCK_SESSION.location}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.bitButton}
          activeOpacity={0.85}
          onPress={handleBitPress}
        >
          <Text style={styles.bitIcon}>💙</Text>
          <Text style={styles.bitButtonText}>Pay via Bit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          activeOpacity={0.8}
          onPress={onPress}
        >
          <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.cancelText}>Reschedule</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 14,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 2,
  },
  title: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  priceBadge: {
    backgroundColor: colors.primaryGlow,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,188,212,0.25)',
  },
  priceText: {
    ...typography.h4,
    color: colors.primary,
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  bitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#1A44E8',
    borderRadius: 14,
    paddingVertical: 12,
  },
  bitIcon: {
    fontSize: 16,
  },
  bitButtonText: {
    ...typography.button,
    color: '#fff',
  },
  cancelButton: {
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
  cancelText: {
    ...typography.buttonSmall,
    color: colors.textSecondary,
  },
});
