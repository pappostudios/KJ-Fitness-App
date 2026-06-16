// BookScreen.js — repurposed as the Video / Form Check screen
// (matches client-screens-b.jsx VideoScreen from the prototype)
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients, dark } from '../../theme/colors';
import { typography } from '../../theme/typography';

function Avatar({ initials, size = 28 }) {
  return (
    <LinearGradient
      colors={gradients.avatar}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </LinearGradient>
  );
}

function Eyebrow({ children, accent, style }) {
  return (
    <Text style={[styles.eyebrow, accent && { color: colors.accent }, style]}>
      {children}
    </Text>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <View style={[styles.miniStat, accent && styles.miniStatAccent]}>
      <Eyebrow accent={accent}>{label}</Eyebrow>
      <Text style={[styles.miniStatValue, accent && { color: colors.accent }]}>
        {value}
      </Text>
    </View>
  );
}

export default function BookScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'videos'),
      where('clientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setVideos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user]);

  const pending = videos.filter((v) => v.status === 'pending').length;
  const reviewed = videos.filter((v) => v.status === 'reviewed').length;

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="videocam-outline" size={28} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{t('video.noVideos')}</Text>
      <Text style={styles.emptyBody}>{t('video.noVideosSub')}</Text>
    </View>
  );

  const renderVideo = ({ item, index }) => {
    const isReviewed = item.status === 'reviewed';
    const isGreen = item.rating === 'green';

    return (
      <TouchableOpacity style={styles.videoCard} activeOpacity={0.8}>
        <View style={styles.videoCardInner}>
          {/* Thumbnail */}
          <View style={styles.videoThumb}>
            <Ionicons name="play-circle-outline" size={22} color={colors.textMuted} />
            {item.length && (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{item.length}</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={{ flex: 1 }}>
            <View style={styles.videoTitleRow}>
              <Text style={styles.videoTitle}>{item.exercise ?? t('video.untitled')}</Text>
              {item.status === 'pending' ? (
                <View style={styles.chipWarn}>
                  <Text style={styles.chipWarnText}>{t('video.pendingBadge')}</Text>
                </View>
              ) : isGreen ? (
                <View style={styles.chipOk}>
                  <Text style={styles.chipOkText}>{t('video.prWorthy')}</Text>
                </View>
              ) : (
                <View style={styles.chipAccent}>
                  <Text style={styles.chipAccentText}>{t('video.formCue')}</Text>
                </View>
              )}
            </View>
            <Text style={styles.videoDate}>{item.date ?? '—'}</Text>

            {/* KJ reply */}
            {item.kjReply && (
              <View style={styles.kjReply}>
                <Avatar initials="KJ" size={20} />
                <Text style={styles.kjReplyText} numberOfLines={3}>
                  {item.kjReply}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={dark.bg0} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.screenHeader}>
          <Eyebrow>{t('video.eyebrow')}</Eyebrow>
          <Text style={styles.screenTitle}>{t('video.title')}</Text>
        </View>

        {/* Upload CTA card */}
        <View style={styles.sectionPad}>
          <View style={styles.ctaCard}>
            <View style={styles.ctaCardTop}>
              <LinearGradient colors={gradients.primary} style={styles.ctaIcon}>
                <Ionicons name="videocam" size={24} color={colors.accentInk} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>{t('video.subtitle')}</Text>
                <Text style={styles.ctaSub}>{t('video.constraint')}</Text>
              </View>
            </View>
            <View style={styles.ctaCardDivider} />
            <View style={styles.ctaBtnRow}>
              <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.75}>
                <Ionicons name="radio-button-on" size={16} color={colors.textPrimary} />
                <Text style={styles.ctaBtnText}>{t('video.record')}</Text>
              </TouchableOpacity>
              <View style={styles.ctaBtnDivider} />
              <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.75}>
                <Ionicons name="cloud-upload-outline" size={16} color={colors.textPrimary} />
                <Text style={styles.ctaBtnText}>{t('video.upload')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <MiniStat label={t('video.sent')} value={videos.length} />
          <MiniStat label={t('video.pending')} value={pending} accent={pending > 0} />
          <MiniStat label={t('video.reviewed')} value={reviewed} />
        </View>

        {/* Video list */}
        <View style={styles.sectionPad}>
          <Eyebrow style={{ marginBottom: 12 }}>{t('video.yourVideos')}</Eyebrow>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : videos.length === 0 ? (
            <EmptyState />
          ) : (
            videos.map((v, i) => renderVideo({ item: v, index: i }))
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dark.bg0 },
  content: { paddingBottom: 24 },

  eyebrow: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 10.5, letterSpacing: 1.89, textTransform: 'uppercase',
    color: colors.textMuted,
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: 'Sora-Bold' },

  // Header
  screenHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  screenTitle: { ...typography.h1, color: colors.textPrimary, marginTop: 4 },

  sectionPad: { paddingHorizontal: 20, paddingTop: 18 },

  // Upload CTA
  ctaCard: {
    backgroundColor: dark.bg1,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.35)',
    overflow: 'hidden',
  },
  ctaCardTop: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  ctaIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaTitle: { fontFamily: 'Sora-Bold', fontSize: 15, color: colors.textPrimary },
  ctaSub: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  ctaCardDivider: { height: 1, backgroundColor: dark.lineSoft },
  ctaBtnRow: { flexDirection: 'row' },
  ctaBtn: {
    flex: 1, height: 48,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ctaBtnDivider: { width: 1, backgroundColor: dark.lineSoft },
  ctaBtnText: { fontFamily: 'Sora-SemiBold', fontSize: 13, color: colors.textPrimary },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  miniStat: {
    flex: 1, padding: 14, borderRadius: 14,
    backgroundColor: dark.bg1, borderWidth: 1, borderColor: dark.lineSoft,
  },
  miniStatAccent: {
    backgroundColor: 'rgba(229,57,53,0.08)',
    borderColor: 'rgba(229,57,53,0.3)',
  },
  miniStatValue: {
    fontFamily: 'JetBrainsMono-Medium', fontSize: 22, fontWeight: '700',
    color: colors.textPrimary, marginTop: 4,
  },

  // Loading / empty
  loadingRow: { height: 80, alignItems: 'center', justifyContent: 'center' },
  emptyState: {
    padding: 36, alignItems: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderColor: dark.line, borderRadius: 16,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: dark.bg2, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { ...typography.h4, color: colors.textPrimary, textAlign: 'center' },
  emptyBody: {
    fontFamily: 'Sora-Regular', fontSize: 12.5, color: colors.textMuted,
    textAlign: 'center', lineHeight: 18, marginTop: 8, maxWidth: 280,
  },

  // Video cards
  videoCard: {
    backgroundColor: dark.bg1,
    borderRadius: 16, borderWidth: 1, borderColor: dark.lineSoft,
    overflow: 'hidden', marginBottom: 12,
  },
  videoCardInner: { flexDirection: 'row', gap: 12, padding: 14 },
  videoThumb: {
    width: 72, height: 92, borderRadius: 10,
    backgroundColor: dark.bg2, borderWidth: 1, borderColor: dark.lineSoft,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  durationBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  durationText: { fontFamily: 'JetBrainsMono-Regular', fontSize: 9, color: '#fff' },
  videoTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  videoTitle: { fontFamily: 'Sora-SemiBold', fontSize: 14, color: colors.textPrimary, flex: 1 },
  videoDate: { fontFamily: 'Sora-Regular', fontSize: 11, color: colors.textMuted, marginTop: 2 },

  kjReply: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginTop: 10, backgroundColor: dark.bg2,
    borderRadius: 10, padding: 10,
  },
  kjReplyText: { fontFamily: 'Sora-Regular', fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 17 },

  // Chips
  chipAccent: { backgroundColor: 'rgba(229,57,53,0.16)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipAccentText: { fontFamily: 'Sora-SemiBold', fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.accent },
  chipOk: { backgroundColor: 'rgba(75,200,120,0.16)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipOkText: { fontFamily: 'Sora-SemiBold', fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.success },
  chipWarn: { backgroundColor: 'rgba(203,176,42,0.16)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipWarnText: { fontFamily: 'Sora-SemiBold', fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.warning },
});
