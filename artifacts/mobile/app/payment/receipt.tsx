import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, Easing } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetSession } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';

const IOS_EASE = Easing.bezier(0.25, 0.46, 0.45, 0.94);

function formatDuration(startIso: string) {
  const start = new Date(startIso).getTime();
  const diffMs = Date.now() - start;
  const totalMin = Math.max(0, Math.floor(diffMs / 60_000));
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

export default function ReceiptScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, card } = useLocalSearchParams<{ id: string; card?: string }>();

  const sessionId = id ? Number(id) : 0;
  // staleTime: 0 + refetchOnMount: 'always' — всегда читаем свежие данные,
  // но если charge.tsx уже положил ответ PATCH /stop через setQueryData,
  // первый рендер получит актуальные energy_kwh и cost без лишнего запроса.
  const { data: session } = useGetSession(sessionId, {
    query: {
      enabled: sessionId > 0,
      staleTime: 0,
      refetchOnMount: 'always',
    },
  });

  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const stationName  = (session as any)?.station?.name ?? 'Зарядная станция';
  const rawEnergy    = parseFloat(String((session as any)?.energy_kwh ?? 0));
  const energyKwh    = parseFloat(rawEnergy.toFixed(2));
  const pricePerKwh  = (session as any)?.station?.price_per_kwh ?? 2000;
  // Используем cost из БД (посчитан бэкендом при PATCH /stop), а не пересчитываем.
  // Пересчёт расходился с БД и ломался, если station не присоединена к ответу.
  const totalCost    = Math.round((session as any)?.cost ?? rawEnergy * pricePerKwh);
  const duration     = (session as any)?.started_at
    ? formatDuration((session as any).started_at as string)
    : '—';
  const payCard = card ? decodeURIComponent(card) : 'Uzcard';

  // Защита от нуля: сессия остановлена через несколько секунд после старта
  const isNearZero   = energyKwh < 0.05;
  const energyLabel  = isNearZero ? 'менее 0,1 кВт·ч' : `${energyKwh} кВт·ч`;
  const costLabel    = isNearZero && totalCost === 0
    ? `мин. ${pricePerKwh.toLocaleString('ru-RU')} сум`
    : `${totalCost.toLocaleString('ru-RU')} сум`;

  // Временное логирование для диагностики нулей (только DEV)
  if (__DEV__) {
    console.log('[Receipt] session data:', JSON.stringify({
      id: (session as any)?.id,
      energy_kwh: (session as any)?.energy_kwh,
      cost: (session as any)?.cost,
      station_price_per_kwh: (session as any)?.station?.price_per_kwh,
    }));
  }

  const items = [
    { label: 'Станция',       value: stationName },
    { label: 'Энергия',       value: energyLabel },
    { label: 'Тариф',         value: `${pricePerKwh.toLocaleString('ru-RU')} сум/кВт·ч` },
    { label: 'Время зарядки', value: duration },
    { label: 'Способ оплаты', value: payCard },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.iconBtn}>
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Чек</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]} showsVerticalScrollIndicator={false}>
        {/* Success badge */}
        <Animated.View entering={FadeInDown.duration(340).easing(IOS_EASE)} style={styles.successSection}>
          <LinearGradient colors={['#10B981', '#059669']} style={styles.successCircle}>
            <Feather name="check" size={40} color="#fff" />
          </LinearGradient>
          <Text style={[styles.successTitle, { color: colors.text }]}>Зарядка завершена</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            Спасибо за использование iON
          </Text>
        </Animated.View>

        {/* Total cost */}
        <Animated.View entering={FadeInDown.delay(60).duration(300).easing(IOS_EASE)} style={[styles.totalCard, { backgroundColor: colors.card }]}>
          <LinearGradient colors={['#2563EB', '#7C3AED']} style={styles.totalGradient}>
            <Text style={styles.totalLabel}>Итого</Text>
            <Text style={styles.totalAmount}>{costLabel}</Text>
          </LinearGradient>
        </Animated.View>

        {/* Line items */}
        <Animated.View entering={FadeInDown.delay(120).duration(280).easing(IOS_EASE)} style={[styles.itemsCard, { backgroundColor: colors.card }]}>
          {items.map((item, i) => (
            <React.Fragment key={i}>
              <View style={styles.itemRow}>
                <Text style={[styles.itemLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                <Text style={[styles.itemValue, { color: colors.text }]}>{item.value}</Text>
              </View>
              {i < items.length - 1 && <View style={[styles.itemDivider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </Animated.View>

        {/* Session ID */}
        <Animated.View entering={FadeInDown.delay(180).duration(260).easing(IOS_EASE)}>
          <Text style={[styles.sessionId, { color: colors.mutedForeground }]}>
            Сессия #{sessionId} · {new Date().toLocaleDateString('ru-RU')}
          </Text>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInUp.delay(220).duration(280).easing(IOS_EASE)} style={styles.actions}>
          <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.muted }]}>
            <Feather name="share-2" size={18} color={colors.primary} />
            <Text style={[styles.shareBtnText, { color: colors.primary }]}>Поделиться</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.homeBtn, { overflow: 'hidden', borderRadius: 16 }]} onPress={() => router.replace('/')}>
            <LinearGradient colors={['#2563EB', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.homeBtnGradient}>
              <Text style={styles.homeBtnText}>На главную</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, gap: 16, alignItems: 'center' },
  successSection: { alignItems: 'center', gap: 12, marginVertical: 12 },
  successCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successTitle: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  successSub: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  totalCard: { width: '100%', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  totalGradient: { padding: 24, alignItems: 'center', gap: 4 },
  totalLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontFamily: 'Inter_500Medium' },
  totalAmount: { color: '#fff', fontSize: 36, fontFamily: 'Inter_700Bold' },
  itemsCard: { width: '100%', borderRadius: 20, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  itemLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  itemValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'right', flex: 1, marginLeft: 16 },
  itemDivider: { height: 1, marginHorizontal: 16 },
  sessionId: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  actions: { width: '100%', gap: 10 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 },
  shareBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  homeBtn: { width: '100%' },
  homeBtnGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  homeBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
