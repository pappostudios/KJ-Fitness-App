import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
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
  addDoc,
  setDoc,
  getDoc,
  doc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { sendPushNotification } from '../../utils/sendPushNotification';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function CoachChatScreen({ route, navigation }) {
  const { clientId, clientName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // ── Live messages + reset unread count for coach ──────────────────────────
  useEffect(() => {
    // Mark as read by coach when screen opens
    setDoc(doc(db, 'conversations', clientId), { unreadByCoach: 0 }, { merge: true }).catch(() => {});

    const q = query(
      collection(db, 'conversations', clientId, 'messages'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [clientId]);

  // ── Send a message as coach ───────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const txt = text.trim();
    if (!txt || sending) return;
    setText('');
    setSending(true);
    try {
      await addDoc(collection(db, 'conversations', clientId, 'messages'), {
        senderId: user.uid,
        senderName: 'Kirsten',
        senderRole: 'coach',
        text: txt,
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, 'conversations', clientId),
        {
          lastMessage: txt,
          lastMessageAt: serverTimestamp(),
          unreadByClient: increment(1),
          unreadByCoach: 0,
        },
        { merge: true }
      );

      // Notify client
      try {
        const clientSnap = await getDoc(doc(db, 'users', clientId));
        const clientToken = clientSnap.data()?.pushToken;
        await sendPushNotification(
          clientToken,
          '💬 הודעה מ-Kirsten',
          txt,
          { screen: 'Messages' }
        );
      } catch (_) { /* push errors are non-fatal */ }
    } catch {
      setText(txt);
    } finally {
      setSending(false);
    }
  }, [text, sending, user, clientId]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header with back button */}
      <LinearGradient colors={gradients.hero} style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.clientAvatar}>
          <Text style={styles.clientAvatarText}>{getInitials(clientName)}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerName}>{clientName}</Text>
          <Text style={styles.headerSub}>לקוח/ה</Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isMe={item.senderRole === 'coach'}
                clientName={clientName}
              />
            )}
            inverted
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyChat clientName={clientName} />}
            keyboardDismissMode="interactive"
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="הקלד הודעה..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            textAlign="right"
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={text.trim() ? gradients.primary : [colors.card, colors.cardElevated]}
              style={styles.sendBtnInner}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={17} color={text.trim() ? '#fff' : colors.textMuted} />
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MessageBubble({ message, isMe, clientName }) {
  const time = message.createdAt?.toDate
    ? message.createdAt.toDate().toLocaleTimeString('he-IL', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
      {!isMe && (
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarSmallText}>{getInitials(clientName)}</Text>
        </View>
      )}
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
          {message.text}
        </Text>
        <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
          {time}
        </Text>
      </View>
    </View>
  );
}

function EmptyChat({ clientName }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyIcon}>✉️</Text>
      <Text style={styles.emptyTitle}>התחל שיחה</Text>
      <Text style={styles.emptySub}>שלח הודעה ראשונה ל{clientName}</Text>
    </View>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function getInitials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryGlow,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: { ...typography.label, color: colors.primary },
  headerText: { flex: 1, gap: 1 },
  headerName: { ...typography.h4, color: colors.textPrimary },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary },

  // List
  list: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 6,
    flexGrow: 1,
  },

  // Bubbles
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginVertical: 2,
  },
  bubbleRowMe: { justifyContent: 'flex-end' },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryGlow,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  avatarSmallText: { fontSize: 9, fontWeight: '800', color: colors.primary },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 7,
  },
  bubbleThem: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleText: { ...typography.body, color: colors.textPrimary, lineHeight: 21 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 3,
    textAlign: 'left',
  },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },

  // Empty (inverted FlatList, so we flip it back)
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
    transform: [{ scaleY: -1 }],
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...typography.h4, color: colors.textSecondary },
  emptySub: { ...typography.bodySmall, color: colors.textMuted },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    backgroundColor: colors.card,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...typography.body,
    color: colors.textPrimary,
    textAlignVertical: 'center',
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden' },
  sendBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
