import { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

/**
 * Заглушки на время загрузки.
 *
 * Вместо крутящегося индикатора показываем форму того, что сейчас появится:
 * человек видит, сколько будет карточек и как они устроены, и экран не
 * дёргается при подстановке данных. Спиннер по центру пустого экрана этого
 * не даёт и вдобавок ощущается медленнее при той же скорости загрузки.
 */

function useShimmer() {
  const progress = useSharedValue(0.4);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    // Анимацию нужно гасить вручную: без этого она продолжает крутиться
    // после размонтирования и держит кадры.
    return () => cancelAnimation(progress);
  }, [progress]);

  return useAnimatedStyle(() => ({ opacity: progress.value }));
}

export function SkeletonBlock({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const colors = useColors();
  const shimmer = useShimmer();

  return (
    <Animated.View
      style={[{ backgroundColor: colors.muted, borderRadius: 8 }, style, shimmer]}
    />
  );
}

/** Карточка станции: повторяет раскладку StationCard. */
export function StationCardSkeleton() {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <SkeletonBlock style={styles.avatar} />
        <View style={styles.grow}>
          <SkeletonBlock style={{ height: 15, width: '72%', borderRadius: 6 }} />
          <SkeletonBlock style={{ height: 12, width: '48%', marginTop: 8, borderRadius: 6 }} />
        </View>
      </View>
      <View style={styles.chips}>
        <SkeletonBlock style={styles.chip} />
        <SkeletonBlock style={styles.chip} />
        <SkeletonBlock style={[styles.chip, { width: 52 }]} />
      </View>
    </View>
  );
}

/** Список карточек станций. */
export function StationListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <StationCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** Строка сессии в истории. */
export function SessionListSkeleton({ count = 3 }: { count?: number }) {
  const colors = useColors();

  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.row}>
            <SkeletonBlock style={styles.avatar} />
            <View style={styles.grow}>
              <SkeletonBlock style={{ height: 14, width: '60%', borderRadius: 6 }} />
              <SkeletonBlock style={{ height: 11, width: '35%', marginTop: 8, borderRadius: 6 }} />
            </View>
            <SkeletonBlock style={{ height: 18, width: 64, borderRadius: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 12 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { width: 64, height: 24, borderRadius: 12 },
});
