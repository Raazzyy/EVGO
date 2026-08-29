import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

/**
 * Пустой экран.
 *
 * Пустота — не ошибка и не повод для извинений: это приглашение к действию.
 * Поэтому у состояния всегда есть внятная причина («рядом нет станций»,
 * а не «ничего не найдено») и, где возможно, кнопка, которая эту причину
 * снимает — сменить фильтры, повторить запрос, добавить машину.
 */

interface EmptyStateProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  /** Что произошло и что с этим делать. Без «упс» и извинений. */
  description?: string;
  action?: { label: string; onPress: () => void };
  /** Приглушённый вид: для блоков внутри экрана, а не на весь экран. */
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  const colors = useColors();

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View
        style={[
          styles.iconWrap,
          compact && styles.iconWrapCompact,
          { backgroundColor: colors.muted },
        ]}
      >
        <Feather
          name={icon}
          size={compact ? 20 : 26}
          color={colors.mutedForeground}
        />
      </View>

      <Text
        style={[
          styles.title,
          compact && styles.titleCompact,
          { color: colors.text },
        ]}
      >
        {title}
      </Text>

      {description ? (
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          {description}
        </Text>
      ) : null}

      {action ? (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.action,
            { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
          // 44 пункта — минимальная комфортная цель для пальца.
          hitSlop={8}
        >
          <Text style={[styles.actionLabel, { color: colors.primary }]}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  wrapCompact: { paddingVertical: 28, paddingHorizontal: 20 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconWrapCompact: { width: 44, height: 44, borderRadius: 14, marginBottom: 12 },
  title: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  titleCompact: { fontSize: 15 },
  description: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
  },
  action: {
    marginTop: 20,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 14,
  },
  actionLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
});

/** Нет связи — отдельный случай: причина внешняя, действие всегда одно. */
export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon="wifi-off"
      title="Нет связи"
      description="Проверьте интернет — без него не получится загрузить станции."
      action={onRetry ? { label: 'Повторить', onPress: onRetry } : undefined}
    />
  );
}
