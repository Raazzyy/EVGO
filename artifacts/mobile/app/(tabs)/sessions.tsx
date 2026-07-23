import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import {
  useGetSessions, useStopSession, getGetSessionsQueryKey,
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
  const [confirmStopId, setConfirmStopId] = useState<number | null>(null);

  const { data: sessions = [], isLoading } = useGetSessions({
    ...(tab === 'active' ? { status: 'active' } : {}),
    user_id: userId,
  });

  const filteredSessions =
    tab === 'history' ? sessions.filter(s => s.status !== 'active') : sessions;

  const stopMutation = useStopSession({
    mutation: {
      onSuccess: () => {
        setConfirmStopId(null);
        qc.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
      },
    },
  });

  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Сессии</Text>
        <View style={[styles.segment, { backgroundColor: colors.muted }]}>
          {(['active', 'history'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => { setTab(t); setConfirmStopId(null); }}
              style={[styles.segmentTab, tab === t && { backgroundColor: colors.card }]}
            >
              <Text style={[styles.segmentText, { color: tab === t ? colors.text : colors.mutedForeground }]}>
                {t === 'active' ? 'Активные' : 'История'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filteredSessions}
          keyExtractor={s => String(s.id)}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View>
              <SessionCard
                session={item as Parameters<typeof SessionCard>[0]['session']}
                onStop={item.status === 'active' ? () => setConfirmStopId(item.id) : undefined}
              />
              {/* Inline confirm row */}
              {confirmStopId === item.id && (
                <View style={[styles.confirmRow, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Text style={[styles.confirmText, { color: '#DC2626' }]}>Завершить зарядку?</Text>
                  <View style={styles.confirmBtns}>
                    <TouchableOpacity
                      style={[styles.confirmBtn, { backgroundColor: '#EF4444' }]}
                      onPress={() => stopMutation.mutate({ id: item.id })}
                      disabled={stopMutation.isPending}
                    >
                      {stopMutation.isPending && confirmStopId === item.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.confirmBtnText}>Да</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.confirmBtn, { backgroundColor: '#E5E7EB' }]}
                      onPress={() => setConfirmStopId(null)}
                    >
                      <Text style={[styles.confirmBtnText, { color: '#374151' }]}>Нет</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⚡</Text>
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
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, gap: 16 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentTab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 10 },
  confirmRow: {
    borderRadius: 12, borderWidth: 1, padding: 12, marginTop: -6,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  confirmText: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  confirmBtns: { flexDirection: 'row', gap: 8 },
  confirmBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  confirmBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 10 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  emptyDesc: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
});
