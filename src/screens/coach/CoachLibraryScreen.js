import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Switch,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../config/firebase';
import { useLanguage } from '../../context/LanguageContext';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';

const TYPE_COLOR = { video: '#E91E63', article: '#FF9800', image: '#9C27B0' };

// ── Main Component ────────────────────────────────────────────────────────────

export default function CoachLibraryScreen({ navigation }) {
  const { t, isRTL } = useLanguage();

  const TYPES = [
    { key: 'video',   label: t('library.video'),   emoji: '📹', hint: t('library.pasteYoutube') },
    { key: 'article', label: t('library.article'),  emoji: '📝', hint: t('library.writeContent') },
    { key: 'image',   label: t('library.image'),    emoji: '🖼', hint: t('library.pasteImage') },
  ];

  const CATEGORIES = [
    { key: 'workout',    label: t('library.workouts'),   emoji: '💪' },
    { key: 'nutrition',  label: t('library.nutrition'),  emoji: '🥗' },
    { key: 'motivation', label: t('library.motivation'), emoji: '🔥' },
    { key: 'technique',  label: t('library.technique'),  emoji: '🎯' },
    { key: 'general',    label: t('library.general'),    emoji: '📌' },
  ];

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('video');
  const [category, setCategory] = useState('workout');
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  // ── Live: all library items ───────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'library'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Open add modal (reset form) ───────────────────────────────────────────
  const openModal = useCallback(() => {
    setTitle('');
    setDescription('');
    setType('video');
    setCategory('workout');
    setUrl('');
    setBody('');
    setIsPublished(true);
    setShowModal(true);
  }, []);

  // ── Save new item ─────────────────────────────────────────────────────────
  const saveItem = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert(t('library.titleRequired'), t('library.titleRequiredMsg'));
      return;
    }
    if (type !== 'article' && !url.trim()) {
      Alert.alert(t('library.linkRequired'), t('library.linkRequiredMsg'));
      return;
    }
    if (type === 'article' && !body.trim()) {
      Alert.alert(t('library.contentRequired'), t('library.contentRequiredMsg'));
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'library'), {
        title: title.trim(),
        description: description.trim(),
        type,
        category,
        url: type !== 'article' ? url.trim() : '',
        body: type === 'article' ? body.trim() : '',
        isPublished,
        publishedAt: isPublished ? serverTimestamp() : null,
        createdAt: serverTimestamp(),
      });
      setShowModal(false);
    } catch {
      Alert.alert(t('library.error'), t('library.errorMsg'));
    } finally {
      setSaving(false);
    }
  }, [title, description, type, category, url, body, isPublished, t]);

  // ── Toggle published ──────────────────────────────────────────────────────
  const togglePublished = useCallback(async (item) => {
    const next = !item.isPublished;
    try {
      await updateDoc(doc(db, 'library', item.id), {
        isPublished: next,
        publishedAt: next ? serverTimestamp() : null,
      });
    } catch {
      Alert.alert(t('library.error'), t('library.errorMsg'));
    }
  }, [t]);

  // ── Delete item ───────────────────────────────────────────────────────────
  const deleteItem = useCallback((item) => {
    Alert.alert(t('library.delete'), `${t('library.deleteConfirm') ? '' : ''}${item.title}?`, [
      { text: t('library.cancel'), style: 'cancel' },
      {
        text: t('library.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'library', item.id));
          } catch {
            Alert.alert(t('library.error'), t('library.deleteError'));
          }
        },
      },
    ]);
  }, [t]);

  const published = items.filter((i) => i.isPublished).length;
  const drafts = items.filter((i) => !i.isPublished).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <LinearGradient colors={gradients.hero} style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerMain}>
          <View>
            <Text style={styles.headerEyebrow}>{t('library.eyebrow')}</Text>
            <Text style={styles.headerTitle}>{t('library.title')}</Text>
            <Text style={styles.headerSub}>
              {t('library.published')} {published} · {t('library.drafts')} {drafts}
            </Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openModal} activeOpacity={0.85}>
            <LinearGradient colors={gradients.primary} style={styles.addBtnGradient}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>{t('library.add')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyTitle}>{t('library.empty')}</Text>
          <Text style={styles.emptySub}>{t('library.emptyAddHint')}</Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={openModal}>
            <LinearGradient colors={gradients.primary} style={styles.emptyAddGradient}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyAddText}>{t('library.newItem')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.list}>
            {items.map((item) => (
              <LibraryItemRow
                key={item.id}
                item={item}
                onToggle={() => togglePublished(item)}
                onDelete={() => deleteItem(item)}
                categories={CATEGORIES}
                types={TYPES}
                t={t}
              />
            ))}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Add Item Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        onRequestClose={() => !saving && setShowModal(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)} disabled={saving}>
              <Text style={styles.modalCancel}>{t('library.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('library.newItem')}</Text>
            <TouchableOpacity onPress={saveItem} disabled={saving}>
              {saving
                ? <ActivityIndicator color={colors.primary} size="small" />
                : <Text style={styles.modalSave}>{t('library.save')}</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

            {/* Type selector */}
            <FormLabel>{t('library.contentType')}</FormLabel>
            <View style={styles.typeRow}>
              {TYPES.map((tp) => (
                <TouchableOpacity
                  key={tp.key}
                  style={[styles.typeChip, type === tp.key && styles.typeChipSelected]}
                  onPress={() => setType(tp.key)}
                >
                  <Text style={styles.typeEmoji}>{tp.emoji}</Text>
                  <Text style={[styles.typeLabel, type === tp.key && styles.typeLabelSelected]}>
                    {tp.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Category selector */}
            <FormLabel>{t('library.category')}</FormLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catChip, category === c.key && styles.catChipSelected]}
                  onPress={() => setCategory(c.key)}
                >
                  <Text style={styles.catEmoji}>{c.emoji}</Text>
                  <Text style={[styles.catLabel, category === c.key && styles.catLabelSelected]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Title */}
            <FormLabel>{t('library.titleLabel')}</FormLabel>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder={t('library.titlePlaceholder') || 'Title'}
              placeholderTextColor={colors.textMuted}
              maxLength={100}
              textAlign={isRTL ? 'right' : 'left'}
            />

            {/* Description */}
            <FormLabel>{t('library.descriptionOptional')}</FormLabel>
            <TextInput
              style={[styles.textInput, styles.textInputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('library.descriptionOptional')}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={200}
              textAlign={isRTL ? 'right' : 'left'}
              textAlignVertical="top"
            />

            {/* URL or body */}
            {type === 'article' ? (
              <>
                <FormLabel>{t('library.articleContent')}</FormLabel>
                <TextInput
                  style={[styles.textInput, styles.textInputArticle]}
                  value={body}
                  onChangeText={setBody}
                  placeholder={t('library.articleContentPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={5000}
                  textAlign={isRTL ? 'right' : 'left'}
                  textAlignVertical="top"
                />
              </>
            ) : (
              <>
                <FormLabel>
                  {TYPES.find((tp) => tp.key === type)?.hint ?? t('library.urlLabel')}
                  {' *'}
                </FormLabel>
                <TextInput
                  style={styles.textInput}
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://..."
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="url"
                  textAlign="left"
                />
              </>
            )}

            {/* Publish toggle */}
            <View style={styles.publishRow}>
              <View>
                <Text style={styles.publishLabel}>{t('library.publishNow')}</Text>
                <Text style={styles.publishSub}>
                  {isPublished ? t('library.visibleToClients') : t('library.saveDraftSub')}
                </Text>
              </View>
              <Switch
                value={isPublished}
                onValueChange={setIsPublished}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LibraryItemRow({ item, onToggle, onDelete, categories, types, t }) {
  const color = TYPE_COLOR[item.type] ?? '#888';
  const catInfo = categories.find((c) => c.key === item.category) ?? categories[categories.length - 1];

  return (
    <View style={styles.itemRow}>
      <View style={[styles.itemIconWrap, { backgroundColor: color + '22' }]}>
        <Text style={styles.itemTypeEmoji}>
          {types.find((tp) => tp.key === item.type)?.emoji ?? '📄'}
        </Text>
      </View>

      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.itemMeta}>
          {catInfo.emoji} {catInfo.label}
          {item.description ? ` · ${item.description.slice(0, 40)}...` : ''}
        </Text>
      </View>

      <View style={styles.itemActions}>
        {/* Published toggle */}
        <TouchableOpacity
          style={[styles.publishToggle, item.isPublished && styles.publishToggleActive]}
          onPress={onToggle}
        >
          <Text style={[styles.publishToggleText, item.isPublished && styles.publishToggleTextActive]}>
            {item.isPublished ? t('library.published') : t('library.drafts')}
          </Text>
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={17} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FormLabel({ children }) {
  return <Text style={styles.formLabel}>{children}</Text>;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  // Header
  header: { paddingTop: 16, paddingBottom: 20, paddingHorizontal: 16 },
  backBtn: { marginBottom: 12 },
  headerEyebrow: { ...typography.caption, color: colors.textSecondary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  headerMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },
  addBtn: { borderRadius: 14, overflow: 'hidden' },
  addBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  addBtnText: { ...typography.button, color: '#fff' },

  // Empty
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...typography.h3, color: colors.textSecondary },
  emptySub: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },
  emptyAddBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  emptyAddGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
  },
  emptyAddText: { ...typography.button, color: '#fff' },

  // List
  list: { padding: 12, gap: 10 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    gap: 12,
  },
  itemIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTypeEmoji: { fontSize: 22 },
  itemContent: { flex: 1, gap: 3 },
  itemTitle: { ...typography.h4, color: colors.textPrimary },
  itemMeta: { ...typography.bodySmall, color: colors.textSecondary },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  publishToggle: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  publishToggleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryGlow,
  },
  publishToggleText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  publishToggleTextActive: { color: colors.primary },

  // Modal
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCancel: { ...typography.button, color: colors.textSecondary },
  modalTitle: { ...typography.h4, color: colors.textPrimary },
  modalSave: { ...typography.button, color: colors.primary },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, gap: 12 },

  // Form
  formLabel: { ...typography.label, color: colors.textSecondary, marginTop: 4 },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...typography.body,
    color: colors.textPrimary,
  },
  textInputMulti: { minHeight: 70, textAlignVertical: 'top', paddingTop: 12 },
  textInputArticle: { minHeight: 160, textAlignVertical: 'top', paddingTop: 12 },

  // Type chips
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 4,
  },
  typeChipSelected: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  typeEmoji: { fontSize: 22 },
  typeLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  typeLabelSelected: { color: colors.primary },

  // Category chips
  catRow: { gap: 8, paddingVertical: 2 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  catChipSelected: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  catEmoji: { fontSize: 14 },
  catLabel: { ...typography.buttonSmall, color: colors.textSecondary },
  catLabelSelected: { color: colors.primary },

  // Publish row
  publishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginTop: 4,
  },
  publishLabel: { ...typography.h4, color: colors.textPrimary },
  publishSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
});
