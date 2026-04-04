import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { LinearGradient } from 'expo-linear-gradient';

export default function ClientRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null); // uid being processed

  useEffect(() => {
    const q = query(
      collection(db, 'pendingRequests'),
      orderBy('requestedAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleApprove = async (request) => {
    setProcessing(request.uid);
    try {
      // Update user status to approved
      await updateDoc(doc(db, 'users', request.uid), {
        status: 'approved',
        approvedAt: serverTimestamp(),
      });
      // Remove from pending requests
      await deleteDoc(doc(db, 'pendingRequests', request.uid));
    } catch (e) {
      Alert.alert('שגיאה', 'לא ניתן לאשר. נסה שוב.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = (request) => {
    Alert.alert(
      'דחיית בקשה',
      `האם לדחות את הבקשה של ${request.name}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'דחייה',
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
              Alert.alert('שגיאה', 'לא ניתן לדחות. נסה שוב.');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#141428', '#0A0A1A']} style={styles.header}>
        <Text style={styles.headerTitle}>בקשות הצטרפות</Text>
        {requests.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{requests.length}</Text>
          </View>
        )}
      </LinearGradient>

      {requests.length === 0 ? (
        // Empty state
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>אין בקשות ממתינות</Text>
          <Text style={styles.emptyText}>כשלקוח חדש יירשם, הבקשה תופיע כאן.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.requestCard}>
              {/* Avatar */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.name?.charAt(0)?.toUpperCase() ?? '?'}
                </Text>
              </View>

              {/* Info */}
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.email}>{item.email}</Text>
                <Text style={styles.time}>
                  {item.requestedAt?.toDate
                    ? formatDate(item.requestedAt.toDate())
                    : 'ממתין...'}
                </Text>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                {processing === item.uid ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprove(item)}
                    >
                      <Text style={styles.approveBtnText}>✓ אשר</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleReject(item)}
                    >
                      <Text style={styles.rejectBtnText}>✕</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function formatDate(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000 / 60); // minutes
  if (diff < 1) return 'עכשיו';
  if (diff < 60) return `לפני ${diff} דקות`;
  if (diff < 1440) return `לפני ${Math.floor(diff / 60)} שעות`;
  return date.toLocaleDateString('he-IL');
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  badge: {
    backgroundColor: colors.error,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  badgeText: { ...typography.caption, color: '#fff', fontWeight: '700' },

  list: { padding: 16, gap: 12 },

  requestCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryGlow,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.h3, color: colors.primary },
  info: { flex: 1, gap: 3 },
  name: { ...typography.h4, color: colors.textPrimary },
  email: { ...typography.bodySmall, color: colors.textSecondary },
  time: { ...typography.caption, color: colors.textMuted },

  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  approveBtn: {
    backgroundColor: 'rgba(76,175,80,0.15)',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  approveBtnText: { ...typography.buttonSmall, color: colors.success },
  rejectBtn: {
    backgroundColor: 'rgba(244,67,54,0.1)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rejectBtnText: { ...typography.buttonSmall, color: colors.error },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 40,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { ...typography.h3, color: colors.textPrimary },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
