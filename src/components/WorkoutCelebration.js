import React, { useEffect, useMemo } from 'react';
import { View, Text, Modal, StyleSheet, Dimensions, Pressable } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle,
  withTiming, withDelay, withSpring, withSequence, withRepeat, Easing,
  FadeInDown, FadeIn,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const STD = Easing.bezier(0.2, 0.8, 0.2, 1);

// ── Ring + checkmark (shared by both variants) ────────────────────────────────
function CheckRing({ size = 150, targetFraction = 1, ringColor = colors.accent, trackColor = '#E6FAFB', checkColor = colors.accentDark }) {
  const r = size * 0.44;
  const circ = 2 * Math.PI * r;
  const progress = useSharedValue(0);
  const draw = useSharedValue(1); // 1 = hidden, 0 = fully drawn
  const CHECK_LEN = 44;

  useEffect(() => {
    progress.value = withTiming(Math.min(Math.max(targetFraction, 0), 1), { duration: 620, easing: STD });
    draw.value = withDelay(340, withTiming(0, { duration: 340, easing: STD }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - progress.value) }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * draw.value }));
  const cx = size / 2;

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cx} r={r} fill="none" stroke={trackColor} strokeWidth={10} />
      <AnimatedCircle
        cx={cx} cy={cx} r={r} fill="none" stroke={ringColor} strokeWidth={10}
        strokeLinecap="round" strokeDasharray={circ} animatedProps={ringProps}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <AnimatedPath
        d={`M${size * 0.34} ${size * 0.5} L${size * 0.45} ${size * 0.62} L${size * 0.66} ${size * 0.38}`}
        fill="none" stroke={checkColor} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={CHECK_LEN} animatedProps={checkProps}
      />
    </Svg>
  );
}

// ── Confetti (teal-family only) ───────────────────────────────────────────────
function ConfettiPiece({ left, delay, dur, color, w, h, round }) {
  const y = useSharedValue(-16);
  const rot = useSharedValue(0);
  const op = useSharedValue(0);
  useEffect(() => {
    op.value = withDelay(delay, withSequence(withTiming(1, { duration: 120 }), withDelay(dur - 400, withTiming(0, { duration: 280 }))));
    y.value = withDelay(delay, withTiming(SCREEN_H * 0.7, { duration: dur, easing: Easing.bezier(0.35, 0.55, 0.55, 1) }));
    rot.value = withDelay(delay, withTiming(560, { duration: dur, easing: Easing.linear }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${rot.value}deg` }],
    opacity: op.value,
  }));
  return (
    <Animated.View
      style={[{ position: 'absolute', top: 0, left, width: w, height: h, borderRadius: round ? 99 : 2, backgroundColor: color }, st]}
    />
  );
}

function Confetti({ palette }) {
  const pieces = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 18; i++) {
      const round = i % 3 === 0;
      arr.push({
        key: i,
        left: (SCREEN_W * (0.05 + (i * 0.052) % 0.9)),
        delay: (i % 6) * 70 + Math.random() * 120,
        dur: 1400 + Math.random() * 500,
        color: palette[i % palette.length],
        w: round ? 8 : 7,
        h: round ? 8 : 12 + (i % 3) * 3,
        round,
      });
    }
    return arr;
  }, [palette]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => <ConfettiPiece {...p} />)}
    </View>
  );
}

// ── Pulsing flame ─────────────────────────────────────────────────────────────
function PulseFlame({ color = colors.accentInk, size = 15 }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withSequence(
      withTiming(1.18, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
    ), -1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={st}><Ionicons name="flame" size={size} color={color} /></Animated.View>;
}

/**
 * A + C celebration. `variant='restrained'` fires on every workout log (ring
 * sweeps to the weekly target, check draws, dots) and auto-dismisses. `variant
 * ='takeover'` is milestones only (first log, streak record, new max): full-bleed
 * teal wash, giant number, confetti, success haptic.
 */
export default function WorkoutCelebration({
  visible, variant = 'restrained',
  title, subtitle,
  weekDone = 0, weekTarget = 0,
  bigNumber, bigLabel, milestoneNote, milestoneLabel,
  ctaLabel, onDone,
}) {
  useEffect(() => {
    if (!visible) return undefined;
    if (variant === 'takeover') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    // Auto-dismiss the restrained variant; takeover waits for the button.
    if (variant === 'restrained') {
      const t = setTimeout(() => onDone?.(), 1700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [visible, variant]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  // ── Takeover (milestone) ──
  if (variant === 'takeover') {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onDone}>
        <LinearGradient colors={['#1AC8D1', '#0B7F86']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.takeover}>
          <Confetti palette={['#04282B', '#FFFFFF', '#04282B', '#7FE0E5', '#FFFFFF']} />

          <Animated.Text entering={FadeInDown.duration(340).delay(200)} style={styles.mLabel}>
            {milestoneLabel || 'Milestone'}
          </Animated.Text>
          <BigPop value={bigNumber} />
          <Animated.Text entering={FadeInDown.duration(340).delay(500)} style={styles.mBig}>{bigLabel}</Animated.Text>
          {milestoneNote ? (
            <Animated.Text entering={FadeInDown.duration(340).delay(580)} style={styles.mNote}>{milestoneNote}</Animated.Text>
          ) : null}

          <Animated.View entering={FadeInDown.duration(340).delay(680)} style={styles.mFlameChip}>
            <PulseFlame color={colors.accentInk} />
            <Text style={styles.mFlameText}>{subtitle}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(340).delay(780)} style={styles.mBtnWrap}>
            <Pressable style={styles.mBtn} onPress={onDone}>
              <Text style={styles.mBtnText}>{ctaLabel || 'Keep it rolling'}</Text>
            </Pressable>
          </Animated.View>
        </LinearGradient>
      </Modal>
    );
  }

  // ── Restrained (every log) ──
  const frac = weekTarget > 0 ? Math.min(weekDone / weekTarget, 1) : 1;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      <Pressable style={styles.rOverlay} onPress={onDone}>
        <Animated.View entering={FadeIn.duration(200)} style={styles.rCard}>
          <View style={styles.rRingWrap}>
            <CheckRing targetFraction={frac} />
          </View>
          <Animated.Text entering={FadeInDown.duration(300).delay(450)} style={styles.rTitle}>{title}</Animated.Text>
          {subtitle ? (
            <Animated.Text entering={FadeInDown.duration(300).delay(500)} style={styles.rSub}>{subtitle}</Animated.Text>
          ) : null}
          {weekTarget > 0 && (
            <View style={styles.rDots}>
              {Array.from({ length: weekTarget }).map((_, i) => (
                <Dot key={i} filled={i < weekDone} last={i === weekDone - 1} />
              ))}
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function BigPop({ value }) {
  const s = useSharedValue(0.72);
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(300, withTiming(1, { duration: 200 }));
    s.value = withDelay(300, withSpring(1, { damping: 8, stiffness: 140 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return <Animated.Text style={[styles.mNumber, st]}>{value}</Animated.Text>;
}

function Dot({ filled, last }) {
  const s = useSharedValue(last ? 0.5 : 1);
  useEffect(() => {
    if (last) s.value = withDelay(560, withSpring(1, { damping: 10, stiffness: 180 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty, st]} />;
}

const styles = StyleSheet.create({
  // Restrained
  rOverlay: { flex: 1, backgroundColor: 'rgba(4,40,43,0.35)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  rCard: {
    width: '100%', maxWidth: 340, backgroundColor: '#F7FCFC', borderRadius: 28,
    alignItems: 'center', paddingVertical: 40, paddingHorizontal: 28,
    shadowColor: '#0A3B3E', shadowOpacity: 0.16, shadowRadius: 48, shadowOffset: { width: 0, height: 24 }, elevation: 16,
  },
  rRingWrap: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  rTitle: { fontFamily: 'Sora-ExtraBold', fontSize: 23, letterSpacing: -0.5, color: '#0A3B3E', marginTop: 26, textAlign: 'center' },
  rSub: { fontFamily: 'Sora-Regular', fontSize: 13.5, color: '#4A6A6D', marginTop: 7, textAlign: 'center' },
  rDots: { flexDirection: 'row', gap: 7, marginTop: 18 },
  dot: { width: 11, height: 11, borderRadius: 99 },
  dotFilled: { backgroundColor: colors.accent },
  dotEmpty: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#C7F2F4' },

  // Takeover
  takeover: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  mLabel: { fontFamily: 'Sora-SemiBold', fontSize: 11, letterSpacing: 2.9, textTransform: 'uppercase', color: 'rgba(4,40,43,0.7)' },
  mNumber: { fontFamily: 'JetBrainsMono-Medium', fontSize: 96, lineHeight: 100, letterSpacing: -6, color: '#04282B', marginTop: 12 },
  mBig: { fontFamily: 'Sora-ExtraBold', fontSize: 28, letterSpacing: -0.6, color: '#04282B', marginTop: 6 },
  mNote: { fontFamily: 'Sora-Medium', fontSize: 14, lineHeight: 21, color: 'rgba(4,40,43,0.78)', marginTop: 14, textAlign: 'center', maxWidth: 250 },
  mFlameChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(4,40,43,0.14)', borderRadius: 99, paddingHorizontal: 15, paddingVertical: 8, marginTop: 22 },
  mFlameText: { fontFamily: 'Sora-Bold', fontSize: 12.5, color: '#04282B' },
  mBtnWrap: { position: 'absolute', bottom: 48, left: 32, right: 32 },
  mBtn: { height: 54, borderRadius: 16, backgroundColor: '#04282B', alignItems: 'center', justifyContent: 'center' },
  mBtnText: { fontFamily: 'Sora-Bold', fontSize: 15, color: '#7FE0E5' },
});
