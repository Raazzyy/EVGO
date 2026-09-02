import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setBaseUrl } from '@workspace/api-client-react';
import { AppProvider } from '@/contexts/AppContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
// Побочный импорт: инициализирует i18next до первого рендера.
import { restoreLanguage } from '@/lib/i18n';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { apiOrigin } from '@/lib/apiBase';

// Set API base URL from env (http для локалки/LAN, https для боевого домена).
const _apiOrigin = apiOrigin();
if (_apiOrigin) {
  setBaseUrl(_apiOrigin);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/**
 * Пускает в приложение только после входа и, наоборот, не даёт вошедшему
 * зависнуть на экранах авторизации.
 *
 * Редирект делается в эффекте, а не через <Redirect>: навигатор должен успеть
 * смонтироваться, иначе expo-router ругается на переход до готовности корня.
 */
/**
 * Экраны, которым обязательно нужен вход.
 *
 * Всё остальное — карта, список станций, детали станции, маршруты — работает
 * без аккаунта: человек должен увидеть, есть ли рядом зарядки, до того как
 * отдаст номер телефона. Требовать регистрацию до первой пользы — верный
 * способ потерять его на первом экране.
 */
// route/navigate требуют авторизации (POST /routes — requireAuth): без них
// при мёртвой сессии пользователь застревал на экране маршрута с вечными 401.
const PROTECTED_ROUTES = ['charge', 'sessions', 'profile', 'cars', 'favorites', 'settings', 'payment', 'route', 'navigate'];

function isProtected(segments: string[]): boolean {
  // Вкладки лежат в группе (tabs), поэтому смотрим и первый сегмент, и второй.
  return segments.some((seg) => PROTECTED_ROUTES.includes(seg));
}

function useAuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    // Вошедшего не держим на экранах входа.
    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
      return;
    }

    // Гостя отправляем на вход, только если он открыл экран, которому
    // действительно нужен аккаунт.
    if (!isAuthenticated && !inAuthGroup && isProtected(segments)) {
      router.replace('/(auth)/phone');
    }
  }, [isAuthenticated, isLoading, router, segments]);

  return isLoading;
}

function RootLayoutNav() {
  const isLoading = useAuthGate();

  // Пока читаем токены из хранилища, показываем нейтральный экран: иначе
  // на долю секунды мелькнёт форма входа у уже вошедшего пользователя.
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="station/[id]"
        // Экран станции открывается с карты/карточки — поднимаем его снизу
        // с лёгким затуханием (iOS-подобный «материал всплывает»), а не
        // стандартным горизонтальным пушем. Настоящий shared-element (пин →
        // hero) требует Reanimated shared transitions и проверки на устройстве
        // — вынесено отдельно.
        options={{ headerShown: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="route/new"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="cars" options={{ headerShown: false }} />
      <Stack.Screen name="navigate" options={{ headerShown: false }} />
      <Stack.Screen name="payment/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="payment/receipt" options={{ headerShown: false }} />
      <Stack.Screen name="favorites" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="support" options={{ headerShown: false }} />
      <Stack.Screen name="about" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [languageReady, setLanguageReady] = useState(false);

  // Сохранённый язык применяем до первого кадра: иначе интерфейс мигнёт
  // языком системы и только потом переключится на выбранный.
  useEffect(() => {
    restoreLanguage().finally(() => setLanguageReady(true));
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && languageReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, languageReady]);

  if ((!fontsLoaded && !fontError) || !languageReady) return null;

  // Ограничиваем масштаб текста, но не запрещаем его: при системном шрифте
  // максимального размера вёрстка ломается и кнопки перестают помещаться,
  // а полный запрет масштабирования делает приложение непригодным для тех,
  // кому крупный шрифт нужен.
  const TextAny = Text as unknown as { defaultProps?: Record<string, unknown> };
  TextAny.defaultProps = { ...TextAny.defaultProps, maxFontSizeMultiplier: 1.4 };

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppProvider>
                <GestureHandlerRootView>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </AppProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
