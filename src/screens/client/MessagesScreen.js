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
  addDoc, setDoc, doc, getDoc, serverTimestamp, increment,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { sendPushNotification } from '../../utils/sendPushNotification';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';

// Coach email — messages from this address show as KJ
const COACH_EMAIL = 'kjfitness.info@gmail.com';
// Coach Firebase uid — used to fetch the coach's push token
const COACH_EMAIL_PRIMARY = 'pappostudios@gmail.com';

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

export default function MessagesScreen({ navigation }) {
  const { user, profile } = useAuth();
  const { t, isRTL } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [inputKey, setInputKey] = useState(0); // increment to force-reset Android TextInput
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);
  const coachPushToken = useRef(null);

  // Use the client's uid directly — same path the coach reads from
  const conversationId = user?.uid ?? null;

  useEffect(() => {
    if (!conversationId) return;
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
      // Scroll to bottom after state update renders
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
  }, [conversationId]);

  // Fetch coach push token once so we can notify her when client sends a message
  useEffect(() => {
    getDoc(doc(db, 'settings', 'coachToken'))
      .then((snap) => { coachPushToken.current = snap.data()?.pushToken ?? null; })
      .catch(() => {});
  }, []);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !conversationId) return;
    setText('');
    setInputKey((k) => k + 1); // force Android TextInput to fully clear
    setSending(true);
    try {
      // 1. Add message to the shared conversation path
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        text: trimmed,
        senderId: user.uid,
        senderEmail: user.email,
        senderRole: 'client',
        createdAt: serverTimestamp(),
      });

      // 2. Update conversation doc so it shows up in coach's list
      const clientName = profile?.name || user?.displayName || user?.email || 'Client';
      await setDoc(
        doc(db, 'conversations', conversationId),
        {
          clientId: user.uid,
          clientName,
          lastMessage: trimmed,
          lastMessageAt: serverTimestamp(),
          unreadByCoach: increment(1),
        },
        { merge: true },
      );

      // 3. Notify coach
      if (coachPushToken.current) {
        sendPushNotification(
          coachPushToken.current,
          `💬 ${clientName}`,
          trimmed,
          { screen: 'Conversations' },
        ).catch(() => {});
      }
    } catch (e) {
      console.warn('Send error', e);
      setText(trimmed); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const isCoachMsg = (msg) =>
    msg.senderRole === 'coach' || msg.senderEmail === COACH_EMAIL;

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

    // Session-invite messages are tappable → open the session on the Schedule tab
    if (item.type === 'session_invite' && item.bookingId) {
      return (
        <View style={[styles.msgRow, styles.msgRowLeft, { marginBottom: isLast ? 16 : 4 }]}>
          <View style={styles.msgAvatarSlot}>
            {showAvatar ? <Avatar initials="KJ" size={28} /> : null}
          </View>
          <TouchableOpacity
            style={styles.inviteCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Schedule', { openBookingId: item.bookingId })}
          >
            <View style={styles.inviteIcon}>
              <Ionicons name="calendar" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inviteText}>{item.text}</Text>
              <View style={styles.inviteCta}>
                <Text style={styles.inviteCtaText}>{t('chat.viewSession')}</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.accent} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

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
          <Text style={styles.headerSub}>{t('chat.coachTitle')}</Text>
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
            <Text style={styles.emptyTitle}>{t('chat.noMessages')}</Text>
            <Text style={styles.emptyBody}>{t('chat.noMessagesSub')}</Text>
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
            key={inputKey}
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            returnKeyType="default"
            textAlign={isRTL ? 'right' : 'left'}
            autoCorrect={false}
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

  // Session invite card
  inviteCard: {
    maxWidth: '78%', flexDirection: 'row', gap: 10,
    backgroundColor: colors.accent + '12', borderRadius: 16,
    borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.accent + '44',
    paddingHorizontal: 12, paddingVertical: 11,
  },
  inviteIcon: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: colors.accent + '22', alignItems: 'center', justifyContent: 'center',
  },
  inviteText: { fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  inviteCta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  inviteCtaText: { fontFamily: 'Sora-SemiBold', fontSize: 12.5, color: colors.accent },

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
