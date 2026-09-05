import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { GradientButton } from '@/components/GradientButton';
import { requestCode, AuthApiError } from '@/lib/authApi';
import { useTranslation } from 'react-i18next';
import { authErrorMessage } from '@/lib/authErrors';

/** Коды операторов Узбекистана — те же, что принимает сервер. */
const UZ_OPERATOR_CODES = ['33', '77', '88', '90', '91', '93', '94', '95', '97', '98', '99'];

/** Разбивает 9 цифр на группы: 90 123 45 67 */
function formatLocal(digits: string): string {
  const d = digits.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(' ');
}

export default function PhoneScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Назад: если есть история — назад, иначе на карту (вход часто открывается
  // как отдельный старт, и router.back() тогда некуда).
  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isComplete = digits.length === 9;
  const operatorOk = digits.length < 2 || UZ_OPERATOR_CODES.includes(digits.slice(0, 2));
  const canSubmit = isComplete && operatorOk && !pending;

  const hint = useMemo(() => {
    if (!operatorOk) return t('auth.phoneWrongOperator');
    return t('auth.phoneHint');
  }, [operatorOk, t]);

  const onChange = useCallback((text: string) => {
    setDigits(text.replace(/\D/g, '').slice(0, 9));
    setError(null);
  }, []);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setPending(true);
    setError(null);

    const phone = `998${digits}`;

    try {
      await requestCode(phone);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.push({ pathname: '/(auth)/code', params: { phone } });
    } catch (err) {
      const e = err as AuthApiError;

      // «Код уже отправлен» — не ошибка: он действительно ушёл раньше,
      // человека надо пустить на экран ввода, а не заставлять ждать впустую.
      if (e.code === 'too_soon') {
        router.push({ pathname: '/(auth)/code', params: { phone } });
        return;
      }

      setError(authErrorMessage(e, t));
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setPending(false);
    }
  }, [canSubmit, digits, router]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Кнопка «назад» — вход часто открывается принудительно с защищённого
          экрана, и без неё пользователь заперт на форме входа. */}
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Назад"
        style={({ pressed }) => [
          styles.backBtn,
          { top: insets.top + 8, backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Внутренняя колонка с ограничением ширины — чтобы на широком экране
            (ПК/монитор авто) поле ввода и кнопка не растягивались во всю ширину. */}
        <View style={styles.inner}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logo}
        >
          <Ionicons name="flash" size={32} color="#fff" />
        </LinearGradient>

        <Text style={[styles.title, { color: colors.foreground }]}>{t('auth.signInTitle')}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {t('auth.signInSubtitle')}
        </Text>

        <View
          style={[
            styles.field,
            {
              backgroundColor: colors.card,
              borderColor: error || !operatorOk ? colors.destructive : colors.border,
            },
          ]}
        >
          <Text style={[styles.prefix, { color: colors.mutedForeground }]}>+998</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TextInput
            value={formatLocal(digits)}
            onChangeText={onChange}
            placeholder={t('auth.phonePlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            autoFocus
            maxLength={13} // 9 цифр + 3 пробела, с запасом
            style={[styles.input, { color: colors.foreground }]}
            onSubmitEditing={onSubmit}
            returnKeyType="done"
          />
        </View>

        <Text
          style={[
            styles.hint,
            { color: error || !operatorOk ? colors.destructive : colors.mutedForeground },
          ]}
        >
          {error ?? hint}
        </Text>

        <GradientButton
          label={t('auth.getCode')}
          onPress={onSubmit}
          loading={pending}
          disabled={!canSubmit}
          style={styles.submit}
        />

        {/* Карта, станции и маршруты работают без аккаунта. Вход нужен
            только там, где появляются личные данные: зарядка, история,
            избранное. Требовать регистрацию до первой пользы — верный
            способ потерять человека на первом экране. */}
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={styles.guest}
          hitSlop={8}
        >
          <Text style={[styles.guestLabel, { color: colors.mutedForeground }]}>
            {t('auth.browseAsGuest')}
          </Text>
        </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backBtn: {
    position: 'absolute', left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  inner: {
    width: '100%',
    maxWidth: 460,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
  },
  prefix: {
    fontFamily: 'Inter_500Medium',
    fontSize: 17,
  },
  divider: {
    width: 1,
    height: 24,
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 17,
    letterSpacing: 0.5,
    // Высота на всё поле, чтобы касание попадало по инпуту, а не мимо.
    height: '100%',
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    marginLeft: 4,
  },
  submit: { marginTop: 28 },
  guest: {
    marginTop: 18,
    alignSelf: 'center',
    // 44 пункта — комфортная цель для касания.
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  guestLabel: { fontFamily: 'Inter_500Medium', fontSize: 14 },
});
