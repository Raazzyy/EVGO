import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { formatAmount } from '@/lib/format';
import { haptics } from '@/lib/haptics';

interface WalletResp {
  balance: number; held: number; available: number;
}
interface WalletTxn {
  id: number; type: 'topup' | 'charge' | 'refund' | 'adjustment';
  amount: number; balance_after: number; comment: string | null; created_at: string;
}

const TOPUP_PRESETS = [20_000, 50_000, 100_000, 200_000];

const TXN_META: Record<WalletTxn['type'], { icon: string; label: string }> = {
  topup:      { icon: 'arrow-down-circle', label: 'Пополнение' },
  charge:     { icon: 'zap',               label: 'Зарядка' },
  refund:     { icon: 'rotate-ccw',        label: 'Возврат' },
  adjustment: { icon: 'edit-3',            label: 'Корректировка' },
};

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [amount, setAmount] = useState<number>(50_000);

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => customFetch<WalletResp>('/api/wallet'),
  });

  const { data: txns = [], isLoading: txnsLoading } = useQuery({
    queryKey: ['wallet', 'transactions'],
    queryFn: () => customFetch<WalletTxn[]>('/api/wallet/transactions'),
  });

  const topup = useMutation({
    mutationFn: (sum: number) =>
      customFetch<{ checkout_url: string }>('/api/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount: sum }),
      }),
    onSuccess: async (res) => {
      haptics.success();
      // Открываем страницу оплаты Payme во внешнем браузере.
      const can = await Linking.canOpenURL(res.checkout_url);
      if (can) Linking.openURL(res.checkout_url);
      else Alert.alert('Оплата', 'Не удалось открыть страницу оплаты');
      // Обновим баланс, когда человек вернётся (webhook зачислит асинхронно).
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: any) => {
      haptics.warning();
      const code = e?.data?.code;
      const msg = code === 'payme_not_configured'
        ? 'Оплата временно недоступна. Попробуйте позже.'
        : (e?.data?.error ?? 'Не удалось создать пополнение');
      Alert.alert('Пополнение', msg);
    },
  });

  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 20;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Кошелёк', headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="chevron-left" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Кошелёк</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Balance card */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Баланс</Text>
          {walletLoading ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} />
          ) : (
            <Text style={styles.balanceValue}>{formatAmount(wallet?.balance ?? 0)} сум</Text>
          )}
          {(wallet?.held ?? 0) > 0 && (
            <Text style={styles.balanceHeld}>
              Заморожено: {formatAmount(wallet?.held ?? 0)} · Доступно: {formatAmount(wallet?.available ?? 0)}
            </Text>
          )}
        </LinearGradient>

        {/* Top-up */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Пополнить</Text>
        <View style={styles.presetRow}>
          {TOPUP_PRESETS.map((p) => {
            const active = amount === p;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => { haptics.tap(); setAmount(p); }}
                style={[
                  styles.preset,
                  { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border },
                ]}
              >
                <Text style={[styles.presetText, { color: active ? '#fff' : colors.text }]}>
                  {formatAmount(p)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() => topup.mutate(amount)}
          disabled={topup.isPending}
          activeOpacity={0.85}
          style={styles.topupBtnWrap}
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.topupBtn}
          >
            {topup.isPending
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Feather name="plus-circle" size={18} color="#fff" />
                  <Text style={styles.topupBtnText}>Пополнить на {formatAmount(amount)} сум</Text>
                </>
            }
          </LinearGradient>
        </TouchableOpacity>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Оплата через Payme. Баланс пополнится после подтверждения платежа.
        </Text>

        {/* History */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 28 }]}>История</Text>
        {txnsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : txns.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Операций пока нет</Text>
          </View>
        ) : (
          txns.map((t) => {
            const meta = TXN_META[t.type];
            const positive = t.amount > 0;
            return (
              <View key={t.id} style={[styles.txnRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.txnIcon, { backgroundColor: colors.muted }]}>
                  <Feather name={meta.icon as any} size={16} color={positive ? colors.free : colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.txnLabel, { color: colors.text }]}>{meta.label}</Text>
                  <Text style={[styles.txnDate, { color: colors.mutedForeground }]}>
                    {new Date(t.created_at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={[styles.txnAmount, { color: positive ? colors.free : colors.text }]}>
                  {positive ? '+' : ''}{formatAmount(t.amount)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  backBtn: { width: 26, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  balanceCard: { borderRadius: 20, padding: 22, marginBottom: 8 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Inter_500Medium' },
  balanceValue: { color: '#fff', fontSize: 34, fontFamily: 'Inter_700Bold', marginTop: 6, letterSpacing: -0.5 },
  balanceHeld: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 20, marginBottom: 12 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  preset: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  presetText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  topupBtnWrap: { borderRadius: 14, overflow: 'hidden' },
  topupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  topupBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 10, lineHeight: 17 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  txnIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txnLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  txnDate: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  txnAmount: { fontSize: 15, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
});
