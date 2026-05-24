import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, query, where, orderBy, onSnapshot, getDocs, limit,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';

function Eyebrow({ children, style }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

function Avatar({ initials, size = 42, active }) {
  if (active) {
    return (
      <LinearGradient
        colors={gradients.avatar}
        style={[styles.avatarBase, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.avatarBase, styles.avatarInactive, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, styles.avatarTextInactive, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

export default function ClientsScreen({ navigation }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'client'),
      where('status', '==', 'approved'),
      orderBy('name', 'asc'),
    );
    const unsub = onSnapshot(q, async (snap) => {
      const base = snap.docs.map((d) => ({ id: d.id, ...d.data(), lastWorkout: null, workoutsThisMonth: 0 }));
      const enriched = await Promise.all(
        base.map(async (client) => {
          try {
            const monthStart = getMonthStart();
            const recentQ = query(
              collection(db, 'progress'),
              where('clientId', '==', client.uid),
              orderBy('date', 'desc'),
              limit(1),
            );
            const monthQ = query(
              collection(db, 'progress'),
              where('clientId', '==', client.uid),
              where('date', '>=', monthStart),
            );
            const [recentSnap, monthSnap] = await Promise.all([getDocs(recentQ), getDocs(monthQ)]);
            const lastWorkout = recentSnap.empty ? null : recentSnap.docs[0].data();
            return { ...client, lastWorkout, workoutsThisMonth: monthSnap.size };
          } catch {
            return client;
          }
        }),
      );
      setClients(enriched);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />

      {/* Header */}
      <View style={styles.header}>
        <Eyebrow>CLIENTS</Eyebrow>
        <Text style={styles.headerTitle}>My Clients</Text>
        <Text style={styles.headerSub}>{clients.length} active</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : clients.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="people-outline" size={28} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No clients yet</Text>
          <Text style={styles.emptySub}>Clients who join will appear here</Text>
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

function ClientRow({ client, onPress }) {
  const { name, email, lastWorkout, workoutsThisMonth } = client;
  const initials = getInitials(name ?? email ?? '?');
  const hasRecentActivity = workoutsThisMonth > 0;
  const lastDateStr = lastWorkout ? formatRelativeDate(lastWorkout.date) : '—';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Avatar initials={initials} size={44} active={hasRecentActivity} />

      <View style={styles.rowContent}>
        <View style={styles.rowTopLine}>
          <Text style={styles.rowName} numberOfLines={1}>{name ?? email}</Text>
          {workoutsThisMonth > 0 && (
            <View style={styles.monthBadge}>
              <Text style={styles.monthBadgeText}>{workoutsThisMonth} this month</Text>
            </View>
          )}
        </View>
        <View style={styles.rowBottomLine}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.rowSub}>Last session: {lastDateStr}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function getInitials(name) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatRelativeDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 28, color: colors.textPrimary, marginTop: 4 },
  headerSub: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted, marginTop: 2 },

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
  avatarBase: { alignItems: 'center', justifyContent: 'center' },
  avatarInactive: { backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.lineSoft },
  avatarText: { color: '#fff', fontFamily: 'Sora-Bold' },
  avatarTextInactive: { color: colors.textMuted },

  rowContent: { flex: 1, gap: 5 },
  rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary, flex: 1 },
  monthBadge: {
    backgroundColor: 'rgba(229,57,53,0.12)', borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(229,57,53,0.25)',
    paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8,
  },
  monthBadgeText: { fontFamily: 'Sora-SemiBold', fontSize: 10, letterSpacing: 0.3, color: colors.accent },
  rowBottomLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },
  separator: { height: 1, backgroundColor: dark.lineSoft, marginLeft: 78 },
});
