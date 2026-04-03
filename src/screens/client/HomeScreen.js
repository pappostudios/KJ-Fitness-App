import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import WeeklyPlanCard from '../../components/WeeklyPlanCard';
import SessionCard from '../../components/SessionCard';
import QuickActions from '../../components/QuickActions';

// Placeholder — will come from Firebase Auth later
const MOCK_USER = {
  name: 'Sarah',
  streak: 4,
  nextMilestone: 7,
};

const MOTIVATIONAL_QUOTES = [
  { text: 'Consistency beats perfection every time.', author: 'KJ' },
  { text: 'Every rep is a vote for the person you want to become.', author: 'KJ' },
  { text: 'Rest is part of the work.', author: 'KJ' },
];

const todayQuote = MOTIVATIONAL_QUOTES[0];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function HomeScreen({ navigation }) {
  const handleQuickAction = (actionId) => {
    // Will navigate to the correct tab/screen later
    console.log('Quick action:', actionId);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              {getGreeting()}, {MOCK_USER.name} 👋
            </Text>
            <Text style={styles.subGreeting}>Ready to crush today?</Text>
          </View>

          {/* Notification bell + avatar */}
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
              {/* Unread dot */}
              <View style={styles.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar} activeOpacity={0.8}>
              <Text style={styles.avatarText}>
                {MOCK_USER.name.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Streak Banner ── */}
        <LinearGradient
          colors={['#1A1A30', '#141428']}
          style={styles.streakBanner}
        >
          <View style={styles.streakLeft}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <View>
              <Text style={styles.streakNumber}>{MOCK_USER.streak}-day streak</Text>
              <Text style={styles.streakSub}>
                {MOCK_USER.nextMilestone - MOCK_USER.streak} more days to your next milestone
              </Text>
            </View>
          </View>
          <View style={styles.streakBar}>
            {Array.from({ length: MOCK_USER.nextMilestone }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.streakDot,
                  i < MOCK_USER.streak && styles.streakDotActive,
                ]}
              />
            ))}
          </View>
        </LinearGradient>

        {/* ── Section: This Week's Plan ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>THIS WEEK</Text>
          </View>
          <WeeklyPlanCard
            onPress={() => console.log('Open weekly plan')}
          />
        </View>

        {/* ── Section: Next Session ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>NEXT SESSION</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>All bookings</Text>
            </TouchableOpacity>
          </View>
          <SessionCard
            onPress={() => console.log('Reschedule')}
          />
        </View>

        {/* ── Section: Quick Actions ── */}
        <View style={styles.section}>
          <QuickActions onPress={handleQuickAction} />
        </View>

        {/* ── Motivational Quote ── */}
        <View style={styles.quoteCard}>
          <Ionicons
            name="chatbubble-ellipses"
            size={20}
            color={colors.primary}
            style={{ marginBottom: 8 }}
          />
          <Text style={styles.quoteText}>"{todayQuote.text}"</Text>
          <Text style={styles.quoteAuthor}>— {todayQuote.author}</Text>
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 4,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subGreeting: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    backgroundColor: colors.card,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.primaryGlow,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.h4,
    color: colors.primary,
    fontSize: 16,
  },

  // ── Streak Banner ──
  streakBanner: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 10,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakEmoji: {
    fontSize: 26,
  },
  streakNumber: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  streakSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  streakBar: {
    flexDirection: 'row',
    gap: 5,
    paddingLeft: 36,
  },
  streakDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardBorder,
  },
  streakDotActive: {
    backgroundColor: colors.primary,
  },

  // ── Sections ──
  section: {
    marginBottom: 24,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
  },
  sectionLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },

  // ── Quote ──
  quoteCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  quoteText: {
    ...typography.body,
    color: colors.textPrimary,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  quoteAuthor: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 8,
    fontWeight: '700',
  },
});
