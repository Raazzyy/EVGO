import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { requestCode, verifyCode, AuthApiError } from '@/lib/authApi';
import { useTranslation } from 'react-i18next';
import { authErrorMessage } from '@/lib/authErrors';

const CODE_LENGTH = 6;

/** 998901234567 → +998 90 123 45 67 */
function prettyPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length !== 12) return phone;
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
}

export default function CodeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(60);

  // Отсчёт до повторной отправки. Сервер всё равно не даст чаще раза в минуту,
  // поэтому кнопку показываем неактивной, а не отправляем запрос впустую.
  useEffect(() => {
    if (resendIn <= 0) return;
    // Не `t`: это имя занято функцией перевода из useTranslation.
    const timer = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== CODE_LENGTH || pending || !phone) return;

      setPending(true);
      setError(null);

      try {
        const result = await verifyCode(
          phone,
          value,
          `${Platform.OS} ${Platform.Version}`,
        );

        await signIn(
          { accessToken: result.access_token, refreshToken: result.refresh_token },
          result.user,
        );

        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        // Пользователя сразу переводим в профиль
        if (result.is_new_user) router.replace('/(auth)/profile');
        else router.replace('/(tabs)/profile');
      } catch (err) {
        const e = err as AuthApiError;
        setError(authErrorMessage(e, t));
        setCode('');

        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        // Код истёк — возвращаем на ввод номера, здесь делать нечего.
        if (e.code === 'code_expired') {
          setTimeout(() => router.back(), 1200);
        }
      } finally {
        setPending(false);
      }
    },
    [pending, phone, router, signIn, t],
  );

  const onChange = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
      setCode(digits);
      setError(null);
      // Отправляем сами, как только набраны все цифры — лишнее нажатие не нужно.
      if (digits.length === CODE_LENGTH) void submit(digits);
    },
    [submit],
  );

  const resend = useCallback(async () => {
    if (resendIn > 0 || !phone) return;
    setError(null);
    try {
      const res = await requestCode(phone);
      setResendIn(res.resend_after_seconds);
      setCode('');
      inputRef.current?.focus();
    } catch (err) {
      const e = err as AuthApiError;
      setError(authErrorMessage(e, t));
      if (e.retryAfterSeconds) setResendIn(e.retryAfterSeconds);
    }
  }, [phone, resendIn]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>

        <Text style={[styles.title, { color: colors.foreground }]}>{t('auth.codeTitle')}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {t('auth.codeSubtitle', { phone: prettyPhone(phone ?? '') })}
        </Text>

        {/* Одно скрытое поле под шестью ячейками: так работает автоподстановка
            кода из SMS, которой не было бы у шести отдельных инпутов. */}
        <Pressable onPress={() => inputRef.current?.focus()} style={styles.cells}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => {
            const filled = i < code.length;
            const active = i === code.length;
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  {
                    backgroundColor: colors.card,
                    borderColor: error
                      ? colors.destructive
                      : active
                        ? colors.primary
                        : colors.border,
                    borderWidth: active || error ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.cellText, { color: colors.foreground }]}>
                  {filled ? code[i] : ''}
                </Text>
              </View>
            );
          })}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxLength={CODE_LENGTH}
          style={styles.hiddenInput}
          caretHidden
        />

        <View style={styles.status}>
          {pending ? (
            <ActivityIndicator color={colors.primary} />
          ) : error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
          ) : null}
        </View>

        <Pressable onPress={resend} disabled={resendIn > 0} hitSlop={12} style={styles.resend}>
          <Text
            style={[
              styles.resendLabel,
              { color: resendIn > 0 ? colors.mutedForeground : colors.primary },
            ]}
          >
            {resendIn > 0 ? t('auth.resendIn', { seconds: resendIn }) : t('auth.resendNow')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setCode('246810');
            void submit('246810');
          }}
          style={styles.testCodeChip}
          hitSlop={8}
        >
          <Text style={[styles.testCodeText, { color: colors.primary }]}>
            Тестовый код: 246810 (нажмите для входа)
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  back: {
    position: 'absolute',
    top: 8,
    left: 16,
    padding: 8,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
  },
  cells: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cell: {
    flex: 1,
    height: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  status: {
    minHeight: 40,
    justifyContent: 'center',
    marginTop: 16,
  },
  error: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  resend: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  resendLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  testCodeChip: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.25)',
    marginTop: 12,
  },
  testCodeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
});
