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
  where,
  orderBy,
  onSnapshot,
  getDocs,
  limit,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function ClientsScreen({ navigation }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Live: all approved clients ────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'client'),
      where('status', '==', 'approved'),
      orderBy('name', 'asc')
    );
    const unsub = onSnapshot(q, async (snap) => {
      const base = snap.docs.map((d) => ({ id: d.id, ...d.data(), lastWorkout: null, workoutsThisMonth: 0 }));

      // Enrich each client with their latest progress entry
      const enriched = await Promise.all(
        base.map(async (client) => {
          try {
            const monthStart = getMonthStart();
            const recentQ = query(
              collection(db, 'progress'),
              where('clientId', '==', client.uid),
              orderBy('date', 'desc'),
              limit(1)
            );
            const monthQ = query(
              collection(db, 'progress'),
              where('clientId', '==', client.uid),
              where('date', '>=', monthStart)
            );
            const [recentSnap, monthSnap] = await Promise.all([
              getDocs(recentQ),
              getDocs(monthQ),
            ]);
            const lastWorkout = recentSnap.empty ? null : recentSnap.docs[0].data();
            return { ...client, lastWorkout, workoutsThisMonth: monthSnap.size };
          } catch {
            return client;
          }
        })
      );

      setClients(enriched);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <LinearGradient colors={gradients.hero} style={styles.header}>
        <Text style={styles.headerTitle}>לקוחות</Text>
        <Text style={styles.headerSub}>{clients.length} לקוחות פעילים</Text>
      </LinearGradient>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : clients.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>אין לקוחות עדיין</Text>
          <Text style={styles.emptySub}>לקוחות שיצטרפו יופיעו כאן</Text>
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ClientRow
              client={item}
              onPress={() =>
                navigation.navigate('ClientProgress', {
                  clientId: item.uid,
                  clientName: item.name ?? item.email,
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

function ClientRow({ client, onPress }) {
  const { name, email, lastWorkout, workoutsThisMonth } = client;
  const initials = getInitials(name ?? email ?? '?');
  const hasRecentActivity = workoutsThisMonth > 0;

  const lastDateStr = lastWorkout
    ? formatRelativeDate(lastWorkout.date)
    : 'אין עדיין';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.avatar, hasRecentActivity && styles.avatarActive]}>
        <Text style={[styles.avatarText, hasRecentActivity && styles.avatarTextActive]}>
          {initials}
        </Text>
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowTopLine}>
          <Text style={styles.rowName} numberOfLines={1}>{name ?? email}</Text>
          <View style={styles.monthBadge}>
            <Text style={styles.monthBadgeText}>{workoutsThisMonth} החודש</Text>
          </View>
        </View>
        <View style={styles.rowBottomLine}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.rowSub}>אימון אחרון: {lastDateStr}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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

function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatRelativeDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  if (diffDays < 30) return `לפני ${Math.floor(diffDays / 7)} שבועות`;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  list: { paddingVertical: 8 },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },

  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...typography.h3, color: colors.textSecondary },
  emptySub: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  avatarText: { ...typography.label, color: colors.textSecondary },
  avatarTextActive: { color: colors.primary },
  rowContent: { flex: 1, gap: 5 },
  rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { ...typography.h4, color: colors.textPrimary, flex: 1 },
  monthBadge: {
    backgroundColor: colors.primaryGlow,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  monthBadgeText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  rowBottomLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowSub: { ...typography.bodySmall, color: colors.textMuted },
  separator: { height: 1, backgroundColor: colors.divider, marginLeft: 74 },
});
