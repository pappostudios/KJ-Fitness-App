import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const ACTIONS = [
  {
    id: 'log',
    icon: 'barbell',
    label: 'Log Workout',
    sublabel: 'Track today',
    color: colors.primary,
    bg: colors.primaryGlow,
  },
  {
    id: 'message',
    icon: 'chatbubble-ellipses',
    label: 'Message Coach',
    sublabel: 'Ask anything',
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.12)',
  },
  {
    id: 'book',
    icon: 'calendar',
    label: 'Book Session',
    sublabel: 'Open slots',
    color: '#34D399',
    bg: 'rgba(52,211,153,0.12)',
  },
  {
    id: 'library',
    icon: 'play-circle',
    label: 'Library',
    sublabel: 'Videos & plans',
    color: '#FB923C',
    bg: 'rgba(251,146,60,0.12)',
  },
];

export default function QuickActions({ onPress }) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        {ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.id}
            activeOpacity={0.75}
            onPress={() => onPress && onPress(action.id)}
            style={styles.actionButton}
          >
            <View style={[styles.iconWrap, { backgroundColor: action.bg }]}>
              <Ionicons name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={styles.label}>{action.label}</Text>
            <Text style={styles.sublabel}>{action.sublabel}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 11,
  },
  sublabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 10,
  },
});
