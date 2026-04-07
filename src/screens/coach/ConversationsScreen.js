import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function ConversationsScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Live: all conversations ordered by most recent ────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'conversations'),
      orderBy('lastMessageAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadByCoach ?? 0), 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <LinearGradient colors={gradients.hero} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>הודעות</Text>
            {totalUnread > 0 ? (
              <Text style={styles.headerSub}>{totalUnread} הודעות חדשות</Text>
            ) : (
              <Text style={styles.headerSub}>{conversations.length} שיחות</Text>
            )}
          </View>
          {totalUnread > 0 && (
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>אין שיחות עדיין</Text>
          <Text style={styles.emptySub}>הלקוחות ישלחו הודעות מהאפליקציה</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              onPress={() =>
                navigation.navigate('CoachChat', {
                  clientId: item.clientId,
                  clientName: item.clientName ?? 'לקוח',
                })
              }
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConversationRow({ conversation, onPress }) {
  const { clientName, lastMessage, lastMessageAt, unreadByCoach } = conversation;
  const hasUnread = (unreadByCoach ?? 0) > 0;

  const timeStr = lastMessageAt?.toDate
    ? formatTime(lastMessageAt.toDate())
    : '';

  const initials = getInitials(clientName ?? '?');

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {/* Avatar */}
      <View style={[styles.rowAvatar, hasUnread && styles.rowAvatarActive]}>
        <Text style={styles.rowAvatarText}>{initials}</Text>
      </View>

      {/* Text */}
      <View style={styles.rowContent}>
        <View style={styles.rowTopLine}>
          <Text style={[styles.rowName, hasUnread && styles.rowNameUnread]} numberOfLines={1}>
            {clientName ?? 'לקוח'}
          </Text>
          <Text style={[styles.rowTime, hasUnread && styles.rowTimeUnread]}>
            {timeStr}
          </Text>
        </View>
        <View style={styles.rowBottomLine}>
          <Text
            style={[styles.rowPreview, hasUnread && styles.rowPreviewUnread]}
            numberOfLines={1}
          >
            {lastMessage ?? '...'}
          </Text>
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadByCoach > 9 ? '9+' : unreadByCoach}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function getInitials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(date) {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  list: { paddingVertical: 8 },

  // Header
  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },
  totalBadge: {
    backgroundColor: colors.error,
    borderRadius: 14,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  totalBadgeText: { ...typography.label, color: '#fff', fontSize: 12 },

  // Empty
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...typography.h3, color: colors.textSecondary },
  emptySub: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarActive: {
    backgroundColor: colors.primaryGlow,
    borderColor: colors.primary,
  },
  rowAvatarText: { ...typography.label, color: colors.textPrimary },
  rowContent: { flex: 1, gap: 4 },
  rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { ...typography.h4, color: colors.textPrimary },
  rowNameUnread: { color: colors.primary },
  rowTime: { ...typography.caption, color: colors.textMuted },
  rowTimeUnread: { color: colors.primary },
  rowBottomLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowPreview: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  rowPreviewUnread: { color: colors.textPrimary, fontWeight: '600' },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  chevron: { marginLeft: 4 },
  separator: { height: 1, backgroundColor: colors.divider, marginLeft: 74 },
});
