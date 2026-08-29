import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { GradientButton } from '@/components/GradientButton';

/**
 * Сообщение о неточности в данных станции.
 *
 * Объехать все станции страны нереально, а человек стоит перед станцией
 * прямо сейчас и видит, что не так. Это самый дешёвый способ поддерживать
 * базу в актуальном состоянии — данные приходят из OpenChargeMap, где
 * часть записей устарела.
 */

const REASONS = [
  { value: 'not_working', label: 'Станция не работает', icon: 'x-octagon' },
  { value: 'wrong_price', label: 'Цена не совпадает', icon: 'dollar-sign' },
  { value: 'wrong_location', label: 'Неверное место на карте', icon: 'map-pin' },
  { value: 'wrong_connectors', label: 'Не те разъёмы', icon: 'zap' },
  { value: 'permanently_closed', label: 'Станции больше нет', icon: 'slash' },
  { value: 'other', label: 'Другое', icon: 'more-horizontal' },
] as const;

type Reason = (typeof REASONS)[number]['value'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: Reason, comment?: string) => Promise<void>;
}

export function ReportStationSheet({ visible, onClose, onSubmit }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [reason, setReason] = useState<Reason | null>(null);
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setReason(null);
    setComment('');
    setPending(false);
    setSent(false);
    setError(null);
  }, []);

  const close = useCallback(() => {
    onClose();
    // Сбрасываем после закрытия, чтобы форма не мигала на анимации.
    setTimeout(reset, 300);
  }, [onClose, reset]);

  const submit = useCallback(async () => {
    if (!reason || pending) return;

    setPending(true);
    setError(null);

    try {
      await onSubmit(reason, comment.trim() || undefined);
      setSent(true);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Показываем благодарность и закрываем сами — лишнее нажатие не нужно.
      setTimeout(close, 1600);
    } catch {
      setError('Не удалось отправить. Попробуйте позже');
      setPending(false);
    }
  }, [close, comment, onSubmit, pending, reason]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        {/* Перехватываем нажатие внутри листа, чтобы он не закрывался. */}
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          {sent ? (
            <View style={styles.done}>
              <View style={[styles.doneIcon, { backgroundColor: colors.muted }]}>
                <Feather name="check" size={28} color="#10B981" />
              </View>
              <Text style={[styles.doneTitle, { color: colors.text }]}>Спасибо</Text>
              <Text style={[styles.doneText, { color: colors.mutedForeground }]}>
                Проверим данные и исправим
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Что не так?</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Данные о станциях приходят из открытых источников и иногда
                устаревают
              </Text>

              <View style={styles.reasons}>
                {REASONS.map((r) => {
                  const selected = reason === r.value;
                  return (
                    <Pressable
                      key={r.value}
                      onPress={() => setReason(r.value)}
                      style={[
                        styles.reason,
                        {
                          backgroundColor: selected ? colors.primary : colors.muted,
                          borderColor: selected ? colors.primary : 'transparent',
                        },
                      ]}
                    >
                      <Feather
                        name={r.icon as any}
                        size={15}
                        color={selected ? colors.primaryForeground : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.reasonText,
                          { color: selected ? colors.primaryForeground : colors.text },
                        ]}
                      >
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Подробности — необязательно"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={1000}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.muted,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
              />

              {error ? (
                <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
              ) : null}

              {pending ? (
                <View style={styles.pending}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <GradientButton
                  label="Отправить"
                  onPress={submit}
                  disabled={!reason}
                  style={styles.submit}
                />
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginBottom: 18,
  },
  reasons: {
    gap: 8,
    marginBottom: 16,
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    // 48 пунктов — комфортная цель для касания.
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  reasonText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 72,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 10,
  },
  submit: { marginTop: 16 },
  pending: {
    height: 52,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  doneIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  doneTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  doneText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
