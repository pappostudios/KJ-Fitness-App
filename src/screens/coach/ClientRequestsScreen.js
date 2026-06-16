import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, onSnapshot, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { colors, gradients, dark } from '../../theme/colors';
import { useLanguage } from '../../context/LanguageContext';

function Eyebrow({ children, style }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

export default function ClientRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const { t, isRTL } = useLanguage();

  useEffect(() => {
    const q = query(collection(db, 'pendingRequests'), orderBy('requestedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const handleApprove = async (request) => {
    setProcessing(request.uid);
    try {
      await updateDoc(doc(db, 'users', request.uid), {
        status: 'approved',
        approvedAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, 'pendingRequests', request.uid));
    } catch {
      Alert.alert(t('common.error'), 'Could not approve. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = (request) => {
    Alert.alert(
      t('requests.rejectTitle'),
      t('requests.rejectConfirm', { name: request.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('requests.reject'),
          style: 'destructive',
          onPress: async () => {
            setProcessing(request.uid);
            try {
              await updateDoc(doc(db, 'users', request.uid), {
                status: 'rejected',
                rejectedAt: serverTimestamp(),
              });
              await deleteDoc(doc(db, 'pendingRequests', request.uid));
            } catch {
              Alert.alert(t('common.error'), 'Could not reject. Please try again.');
            } finally {
              setProcessing(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />

      {/* Header */}
      <View style={styles.header}>
        <Eyebrow>{t('requests.eyebrow')}</Eyebrow>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t('requests.title')}</Text>
          {requests.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{requests.length}</Text>
            </View>
          )}
        </View>
      </View>

      {requests.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="checkmark-circle-outline" size={28} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>{t('requests.noPending')}</Text>
          <Text style={styles.emptySub}>{t('requests.noPendingSub')}</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.requestCard}>
              {/* Avatar */}
              <LinearGradient
                colors={['rgba(229,57,53,0.3)', 'rgba(198,40,40,0.3)']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {item.name?.charAt(0)?.toUpperCase() ?? '?'}
                </Text>
              </LinearGradient>

              {/* Info */}
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
                <Text style={styles.time}>
                  {item.requestedAt?.toDate
                    ? formatDate(item.requestedAt.toDate(), t)
                    : 'Pending...'}
                </Text>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                {processing === item.uid ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprove(item)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark" size={16} color={colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleReject(item)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function formatDate(date, t) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000 / 60);
  if (diff < 1) return t('requests.justNow');
  if (diff < 60) return t('requests.mAgo', { diff });
  if (diff < 1440) return t('requests.hAgo', { diff: Math.floor(diff / 60) });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dark.bg0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  eyebrow: {
    fontFamily: 'Sora-SemiBold', fontSize: 10.5, letterSpacing: 1.89,
    textTransform: 'uppercase', color: colors.textMuted,
  },

  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  headerTitle: { fontFamily: 'Sora-Bold', fontSize: 28, color: colors.textPrimary },
  badge: {
    backgroundColor: colors.error, borderRadius: 12,
    minWidth: 24, height: 24, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 7,
  },
  badgeText: { fontFamily: 'Sora-Bold', fontSize: 11, color: '#fff' },

  list: { padding: 20, gap: 12 },

  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: dark.bg2, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontFamily: 'Sora-SemiBold', fontSize: 15, color: colors.textSecondary },
  emptySub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  requestCard: {
    backgroundColor: dark.bg1, borderRadius: 18,
    borderWidth: 1, borderColor: dark.lineSoft,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Sora-Bold', fontSize: 18, color: colors.accent },
  info: { flex: 1, gap: 3 },
  name: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary },
  email: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textSecondary },
  time: { fontFamily: 'Sora-Regular', fontSize: 11, color: colors.textMuted },

  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  approveBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(75,200,120,0.12)', borderWidth: 1,
    borderColor: 'rgba(75,200,120,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(239,83,80,0.12)', borderWidth: 1,
    borderColor: 'rgba(239,83,80,0.3)', alignItems: 'center', justifyContent: 'center',
  },
});
