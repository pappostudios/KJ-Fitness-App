import React, { useState, useEffect, useRef } from 'react';
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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, serverTimestamp,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';

// Coach email — messages from this address show as KJ
const COACH_EMAIL = 'kjfitness.info@gmail.com';

function Avatar({ initials, size = 32 }) {
  return (
    <LinearGradient
      colors={gradients.avatar}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </LinearGradient>
  );
}

function formatTime(ts) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessagesScreen() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);

  const threadId = user?.uid ? `thread_${user.uid}` : null;

  useEffect(() => {
    if (!threadId) return;
    const q = query(
      collection(db, 'threads', threadId, 'messages'),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [threadId]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !threadId) return;
    setText('');
    setSending(true);
    try {
      await addDoc(collection(db, 'threads', threadId, 'messages'), {
        text: trimmed,
        senderId: user.uid,
        senderEmail: user.email,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Send error', e);
    } finally {
      setSending(false);
    }
  };

  const isCoachMsg = (msg) =>
    msg.senderEmail === COACH_EMAIL || msg.senderId === 'coach';

  const displayName = profile?.name || user?.displayName || '';
  const clientInitials = displayName
    ? (displayName.split(' ').length >= 2
        ? displayName.split(' ')[0][0] + displayName.split(' ')[1][0]
        : displayName[0]
      ).toUpperCase()
    : '?';

  const renderMessage = ({ item, index }) => {
    const fromCoach = isCoachMsg(item);
    const prevMsg = messages[index - 1];
    const showAvatar = fromCoach && (!prevMsg || !isCoachMsg(prevMsg));
    const isLast = index === messages.length - 1;

    return (
      <View
        style={[
          styles.msgRow,
          fromCoach ? styles.msgRowLeft : styles.msgRowRight,
          { marginBottom: isLast ? 16 : 4 },
        ]}
      >
        {fromCoach && (
          <View style={styles.msgAvatarSlot}>
            {showAvatar ? <Avatar initials="KJ" size={28} /> : null}
          </View>
        )}
        <View
          style={[
            styles.bubble,
            fromCoach ? styles.bubbleCoach : styles.bubbleClient,
          ]}
        >
          <Text style={[styles.bubbleText, fromCoach && styles.bubbleTextCoach]}>
            {item.text}
          </Text>
          <Text style={[styles.bubbleTime, fromCoach && styles.bubbleTimeCoach]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />

      {/* Header */}
      <View style={styles.header}>
        <Avatar initials="KJ" size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>Kirsten</Text>
          <Text style={styles.headerSub}>Your coach · KJ Fitness</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
      </View>
      <View style={styles.headerDivider} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyBody}>
              Say hi to Kirsten — ask a question, share how today's session felt, or send a video.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="Message Kirsten…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color={colors.accentInk} />
              : <Ionicons name="arrow-up" size={18} color={colors.accentInk} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dark.bg0 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerDivider: { height: 1, backgroundColor: dark.lineSoft },
  headerName: { ...typography.h4, color: colors.textPrimary },
  headerSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textMuted, marginTop: 1 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: 'Sora-Bold' },

  // Loading / empty
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: dark.bg2, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },
  emptyBody: {
    fontFamily: 'Sora-Regular', fontSize: 13, color: colors.textMuted,
    textAlign: 'center', lineHeight: 19, marginTop: 8, maxWidth: 280,
  },

  // List
  listContent: { paddingTop: 16, paddingHorizontal: 16 },

  // Message row
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  msgRowLeft: { justifyContent: 'flex-start', gap: 8 },
  msgRowRight: { justifyContent: 'flex-end' },
  msgAvatarSlot: { width: 28 },

  // Bubbles
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleCoach: {
    backgroundColor: dark.bg2,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: dark.lineSoft,
  },
  bubbleClient: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontFamily: 'Sora-Regular', fontSize: 14,
    color: colors.textPrimary, lineHeight: 20,
  },
  bubbleTextCoach: { color: colors.textPrimary },
  bubbleTime: {
    fontFamily: 'Sora-Regular', fontSize: 10,
    color: 'rgba(255,255,255,0.6)', marginTop: 4, alignSelf: 'flex-end',
  },
  bubbleTimeCoach: { color: colors.textMuted },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: dark.bg0,
    borderTopWidth: 1, borderTopColor: dark.lineSoft,
  },
  textInput: {
    flex: 1,
    backgroundColor: dark.bg1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: dark.line,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontFamily: 'Sora-Regular',
    fontSize: 14,
    color: colors.textPrimary,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: dark.bg2 },
});
