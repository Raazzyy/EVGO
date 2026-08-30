import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Тактильная отдача на ключевых действиях.
 *
 * Отдельный модуль, чтобы не дублировать проверку платформы в каждом экране:
 * на вебе Haptics нет вообще, и прямой вызов там падает. Ошибку глотаем —
 * вибрация никогда не должна ломать действие, ради которого её вызвали.
 *
 * Три уровня по смыслу, а не по силе:
 *   tap     — подтверждение выбора: чип, переключатель, вкладка
 *   success — действие завершилось: сессия начата, бронь оформлена
 *   warning — что-то пошло не так: недостаток средств, ошибка
 */

function safe(fn: () => Promise<void>): void {
  if (Platform.OS === 'web') return;
  void fn().catch(() => {});
}

export const haptics = {
  tap(): void {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  medium(): void {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  success(): void {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning(): void {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  error(): void {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
};
