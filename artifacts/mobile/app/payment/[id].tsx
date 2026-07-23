import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useGetSession } from '@workspace/api-client-react';
import { LinearGradient } from 'expo-linear-gradient';

export default function PaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const sessionId = id ? Number(id) : 1;
  const { data: session, isLoading } = useGetSession(sessionId);

  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  if (isLoading || !session) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: '#F7F8FA' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const energyKwh = session.energy_kwh ?? 22.1;
  const cost = session.cost ?? 54145;
  const tariff = 2450; // Mock tariff
  const fee = 0;

  return (
    <View style={[styles.container, { backgroundColor: '#F7F8FA' }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: '#FFFFFF' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Оплата</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 100 }]} showsVerticalScrollIndicator={false}>
        
        <View style={[styles.amountCard, { backgroundColor: '#FFFFFF' }]}>
          <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>Сумма</Text>
          <Text style={[styles.amountValue, { color: colors.text }]}>
            {Math.round(cost).toLocaleString('ru-RU')} сум
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Способ оплаты</Text>
        <View style={[styles.paymentMethodCard, { backgroundColor: '#FFFFFF' }]}>
          <View style={styles.cardRow}>
            <View style={styles.uzcardLogo}>
              <Text style={styles.uzcardText}>U</Text>
            </View>
            <Text style={[styles.cardNumber, { color: colors.text }]}>•••• 1234</Text>
          </View>
          <TouchableOpacity>
            <Text style={[styles.changeLink, { color: colors.primary }]}>Изменить</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.detailsCard, { backgroundColor: '#FFFFFF' }]}>
          <Text style={[styles.detailsTitle, { color: colors.text }]}>Детали</Text>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.text }]}>Энергия</Text>
            <View style={styles.detailRight}>
              <Text style={[styles.detailSubValue, { color: colors.mutedForeground }]}>
                {energyKwh.toLocaleString('ru-RU')} кВт·ч
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {Math.round(cost).toLocaleString('ru-RU')} сум
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.text }]}>Тариф</Text>
            <Text style={[styles.detailSubValue, { color: colors.mutedForeground }]}>
              {tariff.toLocaleString('ru-RU')} сум/кВт·ч
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.text }]}>Комиссия</Text>
            <Text style={[styles.detailSubValue, { color: colors.mutedForeground }]}>
              {fee} сум
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.detailRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Итого</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>
              {Math.round(cost).toLocaleString('ru-RU')} сум
            </Text>
          </View>
        </View>

      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPad + 16, backgroundColor: '#FFFFFF' }]}>
        <TouchableOpacity activeOpacity={0.8} style={styles.payButton} onPress={() => router.push('/')}>
          <LinearGradient
            colors={['#2563EB', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.payButtonGradient}
          >
            <Feather name="lock" size={18} color="#FFFFFF" />
            <Text style={styles.payButtonText}>Оплатить</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  amountCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 4,
    marginBottom: -8,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uzcardLogo: {
    width: 44,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uzcardText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  cardNumber: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  changeLink: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  detailsCard: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    gap: 16,
  },
  detailsTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  detailRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailSubValue: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  detailValue: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  totalValue: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  payButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
});
