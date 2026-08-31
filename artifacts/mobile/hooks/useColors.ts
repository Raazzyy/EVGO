import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';

/**
 * Returns the design tokens for the current color scheme.
 *
 * Набор ключей у светлой и тёмной палитр одинаков, поэтому экраны просто
 * читают `colors.background`, `colors.card`, `colors.text` и т.д. — а хук
 * подставляет нужную палитру по системной теме. `radius` не зависит от темы.
 */
export function useColors() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
