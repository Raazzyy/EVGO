import React from 'react';
import { Pressable, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { haptics } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Нажимаемая обёртка с мгновенным откликом.
 *
 * Принцип Apple №1 — реакция на само касание, а не на отпускание: элемент
 * поджимается пружиной в момент нажатия и возвращается на отпускании.
 * Критически задемпфированная пружина (без «отскока»): для тапа перелёт
 * ощущается неправильно, отскок оставляем только для инерционных жестов.
 *
 * `haptic` — лёгкая тактильная отдача на нажатии (на вебе и Android без
 * мотора — тихий no-op).
 */

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Насколько поджимать. По умолчанию 0.97 — заметно, но не резко. */
  activeScale?: number;
  /** Тактильная отдача на нажатии. */
  haptic?: boolean;
}

export function PressableScale({
  children, style, activeScale = 0.97, haptic = false, onPressIn, onPressOut, ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(activeScale, { dampingRatio: 1, duration: 180 });
        if (haptic) haptics.tap();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { dampingRatio: 1, duration: 260 });
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
