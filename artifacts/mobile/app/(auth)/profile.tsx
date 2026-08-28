import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { GradientButton } from '@/components/GradientButton';

const LANGUAGES = [
  { code: 'uz', label: "O'zbekcha" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
] as const;

export default function ProfileSetupScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [language, setLanguage] = useState<string>(user?.language ?? 'ru');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(() => router.replace('/(tabs)'), [router]);

  const save = useCallback(async () => {
    setPending(true);
    setError(null);

    try {
      await updateProfile({ name: name.trim() || undefined, language });
      finish();
    } catch {
      // Профиль — не препятствие для входа: человек уже авторизован, имя
      // можно указать позже в настройках. Сообщаем, но не запираем на экране.
      setError('Не удалось сохранить. Можно заполнить позже в профиле');
    } finally {
      setPending(false);
    }
  }, [finish, language, name, updateProfile]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.foreground }]}>Почти готово</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Как к вам обращаться и на каком языке показывать приложение
        </Text>

        <Text style={[styles.label, { color: colors.mutedForeground }]}>ИМЯ</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Например, Акбар"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          autoComplete="name"
          maxLength={100}
          style={[
            styles.input,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
          ]}
        />

        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 24 }]}>ЯЗЫК</Text>
        <View style={styles.languages}>
          {LANGUAGES.map((l) => {
            const selected = l.code === language;
            return (
              <Pressable
                key={l.code}
                onPress={() => setLanguage(l.code)}
                style={[
                  styles.language,
                  {
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.languageLabel,
                    { color: selected ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {l.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        ) : null}

        <GradientButton
          label="Продолжить"
          onPress={save}
          loading={pending}
          style={styles.submit}
        />

        <Pressable onPress={finish} hitSlop={12} style={styles.skip}>
          <Text style={[styles.skipLabel, { color: colors.mutedForeground }]}>Пропустить</Text>
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
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    fontFamily: 'Inter_500Medium',
    fontSize: 17,
  },
  languages: {
    flexDirection: 'row',
    gap: 8,
  },
  language: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  error: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 16,
    marginLeft: 4,
  },
  submit: { marginTop: 32 },
  skip: {
    marginTop: 16,
    alignSelf: 'center',
    paddingVertical: 8,
  },
  skipLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
});
