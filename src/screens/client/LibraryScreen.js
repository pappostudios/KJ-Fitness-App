import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all',         label: 'הכל',       emoji: '✨' },
  { key: 'workout',     label: 'אימונים',   emoji: '💪' },
  { key: 'nutrition',   label: 'תזונה',     emoji: '🥗' },
  { key: 'motivation',  label: 'מוטיבציה',  emoji: '🔥' },
  { key: 'technique',   label: 'טכניקה',    emoji: '🎯' },
  { key: 'general',     label: 'כללי',      emoji: '📌' },
];

const TYPE_META = {
  video:   { icon: 'play-circle',    label: 'וידאו',  color: '#E91E63' },
  article: { icon: 'document-text',  label: 'מאמר',   color: '#FF9800' },
  image:   { icon: 'image',          label: 'תמונה',  color: '#9C27B0' },
};

// ── YouTube helpers ────────────────────────────────────────────────────────────

function extractYouTubeId(url) {
  if (!url) return null;
  // Standard: youtube.com/watch?v=ID
  let m = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  // Short: youtu.be/ID
  m = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  // Embed: youtube.com/embed/ID
  m = url.match(/embed\/([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return null;
}

function getYouTubeThumbnail(url) {
  const id = extractYouTubeId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

function isYouTubeUrl(url) {
  return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);

  // ── Live: published library items ─────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'library'),
      where('isPublished', '==', true),
      orderBy('publishedAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = activeCategory === 'all'
    ? items
    : items.filter((i) => i.category === activeCategory);

  // ── Open a content item ───────────────────────────────────────────────────
  const openItem = (item) => {
    if (item.type === 'article') {
      setSelectedArticle(item);
    } else if (item.type === 'video' && item.url) {
      setSelectedVideo(item);
    } else if (item.url) {
      Linking.openURL(item.url).catch(() => {});
    }
  };

  // ── Play video in in-app browser ─────────────────────────────────────────
  const playVideo = async (item) => {
    if (!item.url) return;
    try {
      await WebBrowser.openBrowserAsync(item.url, {
        toolbarColor: colors.background,
        controlsColor: colors.primary,
        showInRecents: false,
      });
    } catch {
      Linking.openURL(item.url).catch(() => {});
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <LinearGradient colors={gradients.hero} style={styles.header}>
        <Text style={styles.headerTitle}>ספריית תוכן</Text>
        <Text style={styles.headerSub}>{items.length} פריטים זמינים</Text>
      </LinearGradient>

      {/* Category filter */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {CATEGORIES.map((cat) => {
            const count = cat.key === 'all' ? items.length : items.filter((i) => i.category === cat.key).length;
            const active = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveCategory(cat.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.filterEmoji}>{cat.emoji}</Text>
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                  {cat.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterCount, active && styles.filterCountActive]}>
                    <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyTitle}>
            {activeCategory === 'all' ? 'ספריית התוכן ריקה' : 'אין תוכן בקטגוריה זו'}
          </Text>
          <Text style={styles.emptySub}>Kirsten תוסיף תוכן בקרוב</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {filtered.map((item) => (
              <ContentCard key={item.id} item={item} onPress={() => openItem(item)} />
            ))}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ── Video preview modal ── */}
      <Modal
        visible={!!selectedVideo}
        animationType="slide"
        onRequestClose={() => setSelectedVideo(null)}
      >
        <SafeAreaView style={styles.videoModalSafe} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.videoModalHeader}>
            <TouchableOpacity onPress={() => setSelectedVideo(null)} style={styles.videoCloseBtn}>
              <Ionicons name="chevron-down" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.videoTypeBadge}>
              <Ionicons name="play-circle" size={14} color={TYPE_META.video.color} />
              <Text style={styles.videoTypeBadgeText}>וידאו</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {selectedVideo && (
            <ScrollView contentContainerStyle={styles.videoModalContent}>
              {/* Thumbnail */}
              <TouchableOpacity
                style={styles.thumbnailWrap}
                onPress={() => {
                  setSelectedVideo(null);
                  playVideo(selectedVideo);
                }}
                activeOpacity={0.9}
              >
                {isYouTubeUrl(selectedVideo.url) && getYouTubeThumbnail(selectedVideo.url) ? (
                  <Image
                    source={{ uri: getYouTubeThumbnail(selectedVideo.url) }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.thumbnailPlaceholder}>
                    <Ionicons name="videocam" size={48} color={colors.textMuted} />
                  </View>
                )}
                {/* Play button overlay */}
                <View style={styles.playOverlay}>
                  <LinearGradient
                    colors={['rgba(233,30,99,0.85)', 'rgba(200,10,70,0.85)']}
                    style={styles.playBtn}
                  >
                    <Ionicons name="play" size={28} color="#fff" />
                  </LinearGradient>
                </View>
              </TouchableOpacity>

              {/* Info */}
              <View style={styles.videoInfo}>
                <Text style={styles.videoTitle}>{selectedVideo.title}</Text>
                {selectedVideo.description ? (
                  <Text style={styles.videoDesc}>{selectedVideo.description}</Text>
                ) : null}

                {/* Category chip */}
                <View style={styles.videoCatRow}>
                  {(() => {
                    const cat = CATEGORIES.find((c) => c.key === selectedVideo.category) ?? CATEGORIES[CATEGORIES.length - 1];
                    return (
                      <View style={styles.videoCatChip}>
                        <Text style={styles.videoCatEmoji}>{cat.emoji}</Text>
                        <Text style={styles.videoCatLabel}>{cat.label}</Text>
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Watch button */}
              <TouchableOpacity
                style={styles.watchBtn}
                activeOpacity={0.85}
                onPress={() => {
                  setSelectedVideo(null);
                  playVideo(selectedVideo);
                }}
              >
                <LinearGradient
                  colors={['#E91E63', '#C2185B']}
                  style={styles.watchBtnGradient}
                >
                  <Ionicons name="play-circle" size={22} color="#fff" />
                  <Text style={styles.watchBtnText}>צפה בוידאו</Text>
                </LinearGradient>
              </TouchableOpacity>

              {isYouTubeUrl(selectedVideo.url) && (
                <Text style={styles.watchNote}>הוידאו יפתח בדפדפן המובנה</Text>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Article viewer modal ── */}
      <Modal
        visible={!!selectedArticle}
        animationType="slide"
        onRequestClose={() => setSelectedArticle(null)}
      >
        <SafeAreaView style={styles.articleSafe} edges={['top', 'bottom']}>
          <View style={styles.articleHeader}>
            <TouchableOpacity onPress={() => setSelectedArticle(null)} style={styles.articleCloseBtn}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            {selectedArticle && (
              <View style={styles.articleHeaderText}>
                <Text style={styles.articleCategoryBadge}>
                  {CATEGORIES.find((c) => c.key === selectedArticle.category)?.label ?? 'כללי'}
                </Text>
              </View>
            )}
          </View>
          {selectedArticle && (
            <ScrollView style={styles.articleScroll} contentContainerStyle={styles.articleContent}>
              <Text style={styles.articleTitle}>{selectedArticle.title}</Text>
              {selectedArticle.description ? (
                <Text style={styles.articleDescription}>{selectedArticle.description}</Text>
              ) : null}
              <View style={styles.articleDivider} />
              <Text style={styles.articleBody}>{selectedArticle.body}</Text>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ContentCard({ item, onPress }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.article;
  const catInfo = CATEGORIES.find((c) => c.key === item.category) ?? CATEGORIES[CATEGORIES.length - 1];
  const isVideo = item.type === 'video';
  const thumbUri = isVideo ? getYouTubeThumbnail(item.url) : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Thumbnail (videos) or icon badge */}
      {isVideo && thumbUri ? (
        <View style={styles.cardThumbWrap}>
          <Image source={{ uri: thumbUri }} style={styles.cardThumb} resizeMode="cover" />
          <View style={styles.cardThumbPlay}>
            <Ionicons name="play-circle" size={26} color="#fff" />
          </View>
        </View>
      ) : (
        <View style={[styles.cardTypeBadge, { backgroundColor: meta.color + '22' }]}>
          <Ionicons name={meta.icon} size={28} color={meta.color} />
        </View>
      )}

      {/* Info */}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={styles.cardCat}>{catInfo.emoji} {catInfo.label}</Text>
          <View style={[styles.cardTypeTag, { borderColor: meta.color + '66' }]}>
            <Text style={[styles.cardTypeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
      </View>

      {/* Arrow for non-video external items */}
      {!isVideo && item.type !== 'article' && (
        <View style={styles.cardArrow}>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  // Header
  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },

  // Category filter
  filterBar: { borderBottomWidth: 1, borderBottomColor: colors.border },
  filterScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterChipActive: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  filterEmoji: { fontSize: 14 },
  filterLabel: { ...typography.buttonSmall, color: colors.textSecondary },
  filterLabelActive: { color: colors.primary },
  filterCount: {
    backgroundColor: colors.cardBorder,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountActive: { backgroundColor: colors.primary },
  filterCountText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  filterCountTextActive: { color: '#fff' },

  // Empty
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...typography.h3, color: colors.textSecondary },
  emptySub: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },

  // Grid
  grid: { padding: 12, gap: 10 },

  // Content card
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTypeBadge: {
    width: 64,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Video thumbnail on card
  cardThumbWrap: {
    width: 88,
    height: 68,
    position: 'relative',
    overflow: 'hidden',
  },
  cardThumb: { width: '100%', height: '100%' },
  cardThumbPlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardBody: { flex: 1, padding: 14, gap: 6 },
  cardTitle: { ...typography.h4, color: colors.textPrimary, lineHeight: 20 },
  cardDesc: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 17 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardCat: { ...typography.caption, color: colors.textMuted },
  cardTypeTag: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  cardTypeText: { fontSize: 10, fontWeight: '700' },
  cardArrow: { paddingRight: 14 },

  // ── Video preview modal ──
  videoModalSafe: { flex: 1, backgroundColor: colors.background },
  videoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  videoCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: TYPE_META.video.color + '22',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  videoTypeBadgeText: { ...typography.caption, color: TYPE_META.video.color, fontWeight: '700' },
  videoModalContent: { padding: 20, gap: 20, paddingBottom: 40 },

  // Thumbnail
  thumbnailWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    aspectRatio: 16 / 9,
    backgroundColor: colors.card,
    position: 'relative',
  },
  thumbnailImage: { width: '100%', height: '100%' },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardElevated,
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  playBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },

  // Video info
  videoInfo: { gap: 10 },
  videoTitle: { ...typography.h2, color: colors.textPrimary, lineHeight: 30 },
  videoDesc: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  videoCatRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  videoCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  videoCatEmoji: { fontSize: 14 },
  videoCatLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },

  // Watch button
  watchBtn: { borderRadius: 16, overflow: 'hidden' },
  watchBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  watchBtnText: { ...typography.button, color: '#fff', fontSize: 17 },
  watchNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -8,
  },

  // ── Article modal ──
  articleSafe: { flex: 1, backgroundColor: colors.background },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  articleCloseBtn: { padding: 4 },
  articleHeaderText: { flex: 1 },
  articleCategoryBadge: {
    ...typography.label,
    color: colors.primary,
  },
  articleScroll: { flex: 1 },
  articleContent: { padding: 24, gap: 12 },
  articleTitle: { ...typography.h2, color: colors.textPrimary, lineHeight: 32 },
  articleDescription: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  articleDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  articleBody: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 26,
  },
});
