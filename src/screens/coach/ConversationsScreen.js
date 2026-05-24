import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { colors, gradients, dark } from '../../theme/colors';

function Eyebrow({ children, style }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

export default function ConversationsScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadByCoach ?? 0), 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />

      {/* Header */}
      <View style={styles.header}>
        <Eyebrow>MESSAGES</Eyebrow>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Conversations</Text>
          {totalUnread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>
        <Text style={styles.headerSub}>
          {totalUnread > 0 ? `${totalUnread} unread` : `${conversations.length} conversations`}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={28} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySub}>Client messages will appear here</Text>
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
                  clientName: item.clientName ?? 'Client',
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

function ConversationRow({ conversation, onPress }) {
  const { clientName, lastMessage, lastMessageAt, unreadByCoach } = conversation;
  const hasUnread = (unreadByCoach ?? 0) > 0;
  const timeStr = lastMessageAt?.toDate ? formatTime(lastMessageAt.toDate()) : '';
  const initials = getInitials(clientName ?? '?');

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {/* Avatar */}
      {hasUnread ? (
        <LinearGradient
          colors={gradients.avatar}
          style={styles.rowAvatar}
        >
          <Text style={styles.rowAvatarText}>{initials}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.rowAvatar, styles.rowAvatarInactive]}>
          <Text style={[styles.rowAvatarText, { color: colors.textMuted }]}>{initials}</Text>
        </View>
      )}

      {/* Text */}
      <View style={styles.rowContent}>
        <View style={styles.rowTopLine}>
          <Text style={[styles.rowName, hasUnread && styles.rowNameUnread]} numberOfLines={1}>
            {clientName ?? 'Client'}
          </Text>
          <Text style={[styles.rowTime, hasUnread && { color: colors.accent }]}>
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
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {unreadByCoach > 9 ? '9+' : unreadByCoach}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function getInitials(name) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(date) {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dark.bg0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  list: { paddingVertical: 8 },

  eyebrow: {
    fontFamily: 'Sora-SemiBold', fontSize: 10.5, letterSpacing: 1.89,
    textTransform: 'uppercase', color: colors.textMuted,
  },

  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 28, color: colors.textPrimary },
  headerSub: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  unreadBadge: {
    backgroundColor: colors.error, borderRadius: 12,
    minWidth: 24, height: 24, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 7,
  },
  unreadBadgeText: { fontFamily: 'Sora-Bold', fontSize: 11, color: '#fff' },

  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: dark.bg2, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textSecondary },
  emptySub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, gap: 14,
  },
  rowAvatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  rowAvatarInactive: { backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.lineSoft },
  rowAvatarText: { fontFamily: 'Sora-Bold', fontSize: 16, color: '#fff' },

  rowContent: { flex: 1, gap: 4 },
  rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  rowNameUnread: { color: colors.textPrimary },
  rowTime: { fontFamily: 'Sora-Regular', fontSize: 11, color: colors.textMuted },
  rowBottomLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowPreview: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, flex: 1 },
  rowPreviewUnread: { color: colors.textSecondary, fontFamily: 'Sora-SemiBold' },
  countBadge: {
    backgroundColor: colors.accent, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8,
  },
  countBadgeText: { fontFamily: 'Sora-Bold', fontSize: 11, color: '#fff' },
  separator: { height: 1, backgroundColor: dark.lineSoft, marginLeft: 80 },
});
