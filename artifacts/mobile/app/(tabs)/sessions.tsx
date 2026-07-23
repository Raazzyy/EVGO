import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useGetSessions,
  useStopSession,
  getGetSessionsQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { SessionCard } from '@/components/SessionCard';

type Tab = 'active' | 'history';

export default function SessionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { userId } = useApp();
  const [tab, setTab] = useState<Tab>('active');

  const { data: sessions = [], isLoading } = useGetSessions({
    ...(tab === 'active' ? { status: 'active' } : {}),
    user_id: userId,
  });

  const filteredSessions =
    tab === 'history'
      ? sessions.filter((s) => s.status !== 'active')
      : sessions;

  const stopMutation = useStopSession({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetSessionsQueryKey() }),
    },
  });

  function handleStop(id: number) {
    if (Platform.OS === 'web') {
      if (window.confirm('Завершить зарядку сейчас?')) stopMutation.mutate({ id });
      return;
    }
    Alert.alert('Остановить сессию', 'Завершить зарядку сейчас?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Остановить', style: 'destructive', onPress: () => stopMutation.mutate({ id }) },
    ]);
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Сессии</Text>

        {/* Segment */}
        <View style={[styles.segment, { backgroundColor: colors.muted }]}>
          {(['active', 'history'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.segmentTab, tab === t && { backgroundColor: colors.card }]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: tab === t ? colors.text : colors.mutedForeground },
                ]}
              >
                {t === 'active' ? 'Активные' : 'История'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredSessions}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <SessionCard
              session={item as Parameters<typeof SessionCard>[0]['session']}
              onStop={item.status === 'active' ? () => handleStop(item.id) : undefined}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyIcon]}>⚡</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {tab === 'active' ? 'Нет активных сессий' : 'История пуста'}
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                {tab === 'active'
                  ? 'Начните сессию на любой станции.'
                  : 'Здесь будут отображаться ваши завершенные сессии.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  segment: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 10 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  emptyDesc: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
});
