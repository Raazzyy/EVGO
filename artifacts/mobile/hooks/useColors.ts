import colors from '@/constants/colors';
import { useThemeScheme } from '@/contexts/ThemeContext';

/**
 * Returns the design tokens for the current color scheme.
 *
 * Набор ключей у светлой и тёмной палитр одинаков, поэтому экраны просто
 * читают `colors.background`, `colors.card`, `colors.text` и т.д. — а хук
 * подставляет нужную палитру по ИТОГОВОЙ теме (выбор пользователя или
 * системная). `radius` не зависит от темы.
 */
export function useColors() {
  const scheme = useThemeScheme();
  const palette = scheme === 'dark' ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
