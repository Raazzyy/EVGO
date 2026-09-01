import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiUrl } from '@/lib/apiBase';

/**
 * Регистрация устройства для push-уведомлений.
 *
 * Главное, ради чего это нужно: человек ставит машину на зарядку и уходит.
 * Без push он узнает о завершении, только если сам откроет приложение — то
 * есть основной сценарий работает наполовину.
 *
 * Разрешение спрашиваем не при первом запуске, а после входа: в этот момент
 * понятно, зачем оно, и человек соглашается охотнее. Отказ не ломает ничего —
 * уведомления остаются в приложении, на экране «Уведомления».
 */


/** Показывать уведомление, даже когда приложение открыто. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** id проекта Expo — без него Expo не выдаёт токен в сборке. */
function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/**
 * Запрашивает разрешение и отправляет токен на сервер.
 * Возвращает false, если push недоступны — это нормальная ситуация,
 * а не ошибка.
 */
export async function registerForPush(accessToken: string): Promise<boolean> {
  // На эмуляторе push не работают: Expo не выдаёт токен без реального
  // устройства. Проверяем заранее, чтобы не пугать разработчика ошибкой.
  if (!Device.isDevice) return false;

  // На вебе нужен Web Push с VAPID-ключами — отдельная задача.
  if (Platform.OS === 'web') return false;

  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }

    if (status !== 'granted') return false;

    // Android требует канал, иначе уведомления приходят без звука и не
    // всплывают поверх экрана.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Уведомления',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: projectId(),
    });

    const res = await fetch(apiUrl('/api/push-tokens'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ platform: Platform.OS, token }),
    });

    return res.ok;
  } catch {
    // Нет сети, нет projectId, отозванное разрешение — приложение должно
    // работать в любом случае.
    return false;
  }
}
