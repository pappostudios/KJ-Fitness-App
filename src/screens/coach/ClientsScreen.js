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
import { useLanguage } from '../../context/LanguageContext';

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
  const [sortByAttention, setSortByAttention] = useState(true);
  const { t, isRTL } = useLanguage();

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'client'),
      where('status', '==', 'approved'),
      orderBy('name', 'asc'),
    );
    const unsub = onSnapshot(q, async (snap) => {
      const base = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const monthStart = getMonthStart();
      const weekStart = getWeekStart();
      const sinceStart = weekStart < monthStart ? weekStart : monthStart;
      const enriched = await Promise.all(
        base.map(async (client) => {
          try {
            const recentQ = query(
              collection(db, 'progress'),
              where('clientId', '==', client.uid),
              orderBy('date', 'desc'),
              limit(1),
            );
            const sinceQ = query(
              collection(db, 'progress'),
              where('clientId', '==', client.uid),
              where('date', '>=', sinceStart),
            );
            const progQ = query(
              collection(db, 'trainingPrograms'),
              where('clientId', '==', client.uid),
              where('isActive', '==', true),
              limit(1),
            );
            const [recentSnap, sinceSnap, progSnap] = await Promise.all([
              getDocs(recentQ), getDocs(sinceQ), getDocs(progQ),
            ]);
            const docs = sinceSnap.docs.map((x) => x.data());
            const workoutsThisMonth = docs.filter((x) => x.date >= monthStart).length;
            const workoutsThisWeek = docs.filter((x) => x.date >= weekStart).length;
            const lastWorkout = recentSnap.empty ? null : recentSnap.docs[0].data();
            const target = progSnap.docs[0]?.data()?.targetSessionsPerWeek ?? 0;
            const dsl = daysSince(lastWorkout?.date);
            const status = dsl >= 10 ? 'inactive' : dsl >= 4 ? 'slipping' : 'ontrack';
            const severity = status === 'inactive' ? 2 : status === 'slipping' ? 1 : 0;
            return { ...client, lastWorkout, workoutsThisMonth, workoutsThisWeek, target, dsl, status, severity };
          } catch {
            return { ...client, lastWorkout: null, workoutsThisMonth: 0, workoutsThisWeek: 0, target: 0, dsl: Infinity, status: 'inactive', severity: 2 };
          }
        }),
      );
      setClients(enriched);
      setLoading(false);
    });
    return unsub;
  }, []);

  const attentionCount = clients.filter((c) => c.severity > 0).length;
  const sortedClients = [...clients].sort((a, b) =>
    sortByAttention
      ? (b.severity - a.severity) || (a.name ?? '').localeCompare(b.name ?? '')
      : (a.name ?? '').localeCompare(b.name ?? ''),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={dark.bg0} />

      {/* Header */}
      <View style={styles.header}>
        <Eyebrow>{t('clients.eyebrow')}</Eyebrow>
        <Text style={styles.headerTitle}>{t('clients.title')}</Text>
        <Text style={styles.headerSub}>{clients.length} {t('clients.active')}</Text>

        {clients.length > 0 && (
          <View style={styles.headerControls}>
            {attentionCount > 0 ? (
              <View style={styles.attentionPill}>
                <Ionicons name="alert-circle" size={13} color={colors.warning} />
                <Text style={styles.attentionPillText}>{t('clients.needAttention', { count: attentionCount })}</Text>
              </View>
            ) : (
              <View style={styles.allGoodPill}>
                <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                <Text style={styles.allGoodPillText}>{t('clients.allOnTrack')}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.sortToggle} onPress={() => setSortByAttention((v) => !v)} activeOpacity={0.7}>
              <Ionicons name="swap-vertical" size={13} color={colors.textMuted} />
              <Text style={styles.sortToggleText}>
                {sortByAttention ? t('clients.sortAttention') : t('clients.sortName')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
          <Text style={styles.emptyTitle}>{t('clients.noClients')}</Text>
          <Text style={styles.emptySub}>{t('clients.noClientsSub')}</Text>
        </View>
      ) : (
        <FlatList
          data={sortedClients}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ClientRow
              client={item}
              t={t}
              isRTL={isRTL}
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

const STATUS_META = {
  ontrack:  { color: '#4BC878', icon: 'checkmark-circle', key: 'clients.statusOnTrack' },
  slipping: { color: '#CBB02A', icon: 'time', key: 'clients.statusSlipping' },
  inactive: { color: '#EF5350', icon: 'alert-circle', key: 'clients.statusInactive' },
};

function ClientRow({ client, onPress, t, isRTL }) {
  const { name, email, lastWorkout, workoutsThisWeek, target, status, hasMedicalFlags } = client;
  const initials = getInitials(name ?? email ?? '?');
  const sm = STATUS_META[status] ?? STATUS_META.inactive;
  const lastDateStr = lastWorkout ? formatRelativeDate(lastWorkout.date) : t('clients.never');

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Avatar initials={initials} size={44} active={status === 'ontrack'} />

      <View style={styles.rowContent}>
        <View style={styles.rowTopLine}>
          <Text style={styles.rowName} numberOfLines={1}>{name ?? email}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sm.color + '1E', borderColor: sm.color + '55' }]}>
            <Ionicons name={sm.icon} size={10} color={sm.color} />
            <Text style={[styles.statusBadgeText, { color: sm.color }]}>{t(sm.key)}</Text>
          </View>
        </View>
        <View style={styles.rowBottomLine}>
          {target > 0 && (
            <Text style={styles.weekCount}>
              {t('clients.weekCount', { done: workoutsThisWeek, target })}
            </Text>
          )}
          <Ionicons name="time-outline" size={12} color={colors.textMuted} style={{ marginLeft: target > 0 ? 8 : 0 }} />
          <Text style={styles.rowSub}>{t('clients.lastSession', { date: lastDateStr })}</Text>
          {hasMedicalFlags && (
            <View style={styles.flagBadge}>
              <Ionicons name="warning" size={10} color={colors.error} />
              <Text style={styles.flagBadgeText}>{t('clients.medicalFlag')}</Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textMuted} />
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

function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysSince(iso) {
  if (!iso) return Infinity;
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now - d) / 86400000);
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

  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 28, color: colors.textPrimary, marginTop: 4 },
  headerSub: { fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  headerControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  attentionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(203,176,42,0.12)', borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(203,176,42,0.3)',
    paddingHorizontal: 10, paddingVertical: 5,
  },
  attentionPillText: { fontFamily: 'Sora-SemiBold', fontSize: 11.5, color: colors.warning },
  allGoodPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(75,200,120,0.12)', borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(75,200,120,0.3)',
    paddingHorizontal: 10, paddingVertical: 5,
  },
  allGoodPillText: { fontFamily: 'Sora-SemiBold', fontSize: 11.5, color: colors.success },
  sortToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 6 },
  sortToggleText: { fontFamily: 'Sora-SemiBold', fontSize: 11.5, color: colors.textMuted },

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
  rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowName: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary, flex: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  statusBadgeText: { fontFamily: 'Sora-SemiBold', fontSize: 10, letterSpacing: 0.3 },
  weekCount: { fontFamily: 'Sora-SemiBold', fontSize: 11.5, color: colors.accent },
  rowBottomLine: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  rowSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted },
  flagBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(239, 83, 80, 0.12)', borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(239, 83, 80, 0.3)',
    paddingHorizontal: 7, paddingVertical: 2, marginLeft: 4,
  },
  flagBadgeText: { fontFamily: 'Sora-SemiBold', fontSize: 10, letterSpacing: 0.3, color: colors.error },
  separator: { height: 1, backgroundColor: dark.lineSoft, marginLeft: 78 },
});
