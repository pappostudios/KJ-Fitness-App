import React, { useState, useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Staggered entrance wrapper. Fades in + rises the first ~6 items on a screen,
 * 45ms apart; anything past 6 arrives instantly (avoid a slow cascade).
 * Per the design spec: FadeInDown.duration(420).delay(i*45), standard easing.
 */
export function Enter({ index = 0, children, style, duration = 420, delay }) {
  const d = delay != null ? delay : Math.min(index, 6) * 45;
  return (
    <Animated.View entering={FadeInDown.duration(duration).delay(d)} style={style}>
      {children}
    </Animated.View>
  );
}

/**
 * Physical press feedback — a 97% scale-down on press-in, spring back on
 * release. Drop-in replacement for TouchableOpacity (onPress / style / disabled
 * / hitSlop / activeOpacity is ignored). Feels tactile where opacity-dim feels dated.
 */
export function PressScale({
  children, style, onPress, onLongPress, disabled, hitSlop, scaleTo = 0.97, ...rest
}) {
  const s = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => { s.value = withTiming(scaleTo, { duration: 100 }); }}
      onPressOut={() => { s.value = withSpring(1, { damping: 18, stiffness: 220 }); }}
      style={[style, aStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * Count-up number. Eases 0 → value over `duration`ms. Pure JS rAF (reliable,
 * no worklet text bridge). `format` lets callers add units / decimals.
 */
export function CountUp({ value = 0, duration = 480, style, format = (n) => String(n), allowFontScaling }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const to = Number(value) || 0;
    if (to === 0) { setDisplay(0); return undefined; }
    let raf;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(to * ease(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <Text style={style} allowFontScaling={allowFontScaling}>{format(display)}</Text>;
}

/** Slowly-pulsing flame icon — for the streak tile. */
export function Flame({ color, size = 14, active = true }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (!active) return undefined;
    s.value = withRepeat(withSequence(
      withTiming(1.18, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
    ), -1);
    return () => { s.value = 1; };
  }, [active]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={st}><Ionicons name="flame" size={size} color={color} /></Animated.View>;
}
