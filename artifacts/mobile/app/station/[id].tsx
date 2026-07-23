import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, Easing } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useGetStation,
  useStartSession,
  getGetSessionsQueryKey,
  getGetStationsQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { ConnectorBadge, ConnectorIcon } from '@/components/ConnectorBadge';
import { GradientButton } from '@/components/GradientButton';

interface Connector {
  type: string;
  power_kw: number;
  total: number;
  available: number;
}

export default function StationDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { userId, setActiveSessionId } = useApp();
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState('Uzcard');

  const stationId = id ? Number(id) : NaN;
  const { data: station, isLoading } = useGetStation(stationId, {
    query: { enabled: !isNaN(stationId) && stationId > 0 },
  });

  const startMutation = useStartSession({
    mutation: {
      onSuccess: (session) => {
        setActiveSessionId(session.id);
        qc.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetStationsQueryKey() });
        router.push('/charge');
      },
      onError: () => Alert.alert('Ошибка', 'Не удалось начать сессию. Попробуйте еще раз.'),
    },
  });

  const connectors: Connector[] = (station?.connectors as Connector[] | null) ?? [];
  const amenities: string[] = (station?.amenities as string[] | null) ?? [];

  function handleCharge() {
    if (!station) return;
    if (station.status === 'offline') {
      Alert.alert('Станция недоступна', 'Эта станция сейчас не в сети.');
      return;
    }
    // Open card selection modal first
    setCardModalVisible(true);
  }

  function confirmCharge() {
    if (!station) return;
    setCardModalVisible(false);
    startMutation.mutate({
      data: {
        station_id: station.id,
        user_id: userId,
        connector_type: selectedConnector ?? connectors[0]?.type ?? 'CCS2',
      },
    });
  }

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!station) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Станция не найдена</Text>
      </View>
    );
  }

  const operatorName = station.operator ? (station.operator as { name: string }).name : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero section */}
        <LinearGradient
          colors={['#1A1A2E', '#2563EB']}
          style={[styles.heroSection, { paddingTop: Math.max(topPad, 16) }]}
        >
          <View style={styles.heroHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsFavorite(!isFavorite)} style={styles.iconBtn}>
              <Feather name="heart" size={24} color={isFavorite ? '#EF4444' : '#fff'} fill={isFavorite ? '#EF4444' : 'transparent'} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.heroBottom}>
            <Text style={styles.heroStationName}>{station.name}</Text>
            
            <View style={styles.ratingRow}>
              <Feather name="star" size={14} color="#FBBF24" fill="#FBBF24" />
              <Text style={styles.ratingText}>4.8</Text>
              <View style={styles.ratingDot} />
              <Text style={styles.ratingText}>0,3 км</Text>
            </View>

            <View style={styles.pillsRow}>
              {operatorName ? (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{operatorName}</Text>
                </View>
              ) : null}
              <View style={styles.pill}>
                <Text style={styles.pillText}>Быстрая зарядка</Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>DC</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Quick stats row */}
          <View style={[styles.card, { backgroundColor: colors.card, shadowColor: '#000' }]}>
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={[styles.statValue, { color: colors.text }]}>{station.power_kw} кВт</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>мощность</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                <Text style={[
                  styles.statValue, 
                  { color: connectors.reduce((a, c) => a + c.available, 0) > 0 ? '#10B981' : colors.text }
                ]}>
                  {connectors.reduce((a, c) => a + c.available, 0)}/{connectors.reduce((a, c) => a + c.total, 0)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>доступно</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                {(station as any).discount_pct > 0 ? (
                  <View style={styles.priceRow}>
                    <Text style={[styles.statValueStrike, { color: colors.mutedForeground }]}>
                      {station.price_per_kwh.toLocaleString('ru-RU')}
                    </Text>
                    <Text style={[styles.statValue, { color: '#10B981' }]}>
                      {Math.round(station.price_per_kwh * (1 - (station as any).discount_pct / 100)).toLocaleString('ru-RU')}
                    </Text>
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>-{(station as any).discount_pct}%</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {station.price_per_kwh.toLocaleString('ru-RU')}
                  </Text>
                )}
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>сум/кВт·ч</Text>
              </View>
            </View>
          </View>

          {/* Address row */}
          <View style={[styles.card, styles.addressCard, { backgroundColor: colors.card, shadowColor: '#000' }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.muted }]}>
              <Feather name="map-pin" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.addressText, { color: colors.text }]}>
              {station.address}
            </Text>
          </View>

          {/* Amenities row */}
          {amenities.length > 0 && (
            <View style={[styles.card, styles.amenitiesCard, { backgroundColor: colors.card, shadowColor: '#000' }]}>
              {amenities.map((a) => {
                let iconName: any = 'check';
                let label = a;
                if (a === 'cafe') { iconName = 'coffee'; label = 'Кафе'; }
                else if (a === 'toilet') { iconName = 'home'; label = 'Туалет'; }
                else if (a === 'shop') { iconName = 'shopping-bag'; label = 'Магазин'; }
                else if (a === 'wifi') { iconName = 'wifi'; label = 'Wi-Fi'; }
                else if (a === 'lounge') { iconName = 'star'; label = 'Зона отдыха'; }
                else if (a === 'parking') { iconName = 'map-pin'; label = 'Парковка'; }
                else if (a === '24/7') { iconName = 'clock'; label = '24/7'; }

                return (
                  <View key={a} style={styles.amenityCol}>
                    <View style={[styles.amenityIcon, { backgroundColor: colors.muted }]}>
                      <Feather name={iconName} size={20} color={colors.text} />
                    </View>
                    <Text style={[styles.amenityLabel, { color: colors.text }]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Connectors section */}
          {connectors.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, shadowColor: '#000' }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Коннекторы</Text>
                <TouchableOpacity>
                  <Text style={[styles.linkText, { color: colors.primary }]}>Подробнее</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.connectorsList}>
                {connectors.map((c, i) => {
                  const isSelected = selectedConnector === c.type || (!selectedConnector && i === 0);
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setSelectedConnector(c.type)}
                      style={[
                        styles.connectorRow,
                        {
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? colors.primary + '0D' : 'transparent',
                        },
                      ]}
                    >
                      <View style={styles.connectorInfoLeft}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ConnectorIcon
                            type={c.type}
                            size={17}
                            color={isSelected ? colors.primary : colors.text}
                          />
                          <Text style={[styles.connectorTypeName, { color: colors.text }]}>{c.type}</Text>
                        </View>
                        <Text style={[styles.connectorAvailText, { color: '#10B981' }]}>
                          {c.available}/{c.total}
                        </Text>
                      </View>
                      <Text style={[styles.connectorPowerKw, { color: colors.mutedForeground }]}>
                        {c.power_kw} кВт
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Cost estimate table */}
          <View style={[styles.card, { backgroundColor: colors.card, shadowColor: '#000' }]}>
            <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 12 }]}>Стоимость</Text>
            {[10, 30, 60].map((mins) => {
              const energyKwh = (station.power_kw * mins) / 60;
              const cost = energyKwh * station.price_per_kwh;
              return (
                <View key={mins} style={[styles.costRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.costMins, { color: colors.text }]}>{mins} мин</Text>
                  <Text style={[styles.costKwh, { color: colors.mutedForeground }]}>~{energyKwh.toFixed(1)} кВт·ч</Text>
                  <Text style={[styles.costTotal, { color: colors.text }]}>{Math.round(cost).toLocaleString('ru-RU')} сум</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: bottomPad + 12,
          },
        ]}
      >
        <GradientButton
          label={
            station.status === 'offline'
              ? 'Станция недоступна'
              : station.status === 'occupied'
              ? 'Станция занята'
              : 'Зарядиться'
          }
          onPress={handleCharge}
          loading={startMutation.isPending}
          disabled={station.status !== 'free'}
        />
        <TouchableOpacity
          style={[styles.outlineBtn, { borderColor: colors.border }]}
          onPress={() => router.push(
            `/route/new?stationId=${station.id}&stationName=${encodeURIComponent(station.name)}&lat=${station.lat}&lng=${station.lng}` as any
          )}
        >
          <Text style={[styles.outlineBtnText, { color: colors.text }]}>Маршрут</Text>
        </TouchableOpacity>
      </View>

      {/* Card Selection Modal */}
      <Modal
        visible={cardModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCardModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInDown.duration(300).easing(Easing.bezier(0.25, 0.46, 0.45, 0.94))} style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            {/* Handle */}
            <View style={[styles.modalHandle, { backgroundColor: colors.mutedForeground, opacity: 0.25 }]} />

            <Text style={[styles.modalTitle, { color: colors.text }]}>Выберите карту</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Оплата спишется после завершения зарядки
            </Text>

            {[
              { id: 'Uzcard', label: 'Uzcard', emoji: '🟦', suffix: '•••• 4521' },
              { id: 'Humo', label: 'Humo', emoji: '🟩', suffix: '•••• 8934' },
              { id: 'Visa', label: 'Visa', emoji: '💳', suffix: '•••• 1177' },
              { id: 'Mastercard', label: 'Mastercard', emoji: '🔴', suffix: '•••• 6623' },
            ].map(card => (
              <TouchableOpacity
                key={card.id}
                onPress={() => setSelectedCard(card.id)}
                style={[
                  styles.cardOption,
                  {
                    borderColor: selectedCard === card.id ? colors.primary : colors.border,
                    backgroundColor: selectedCard === card.id ? `${colors.primary}10` : colors.background,
                  },
                ]}
              >
                <Text style={styles.cardEmoji}>{card.emoji}</Text>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardLabel, { color: colors.text }]}>{card.label}</Text>
                  <Text style={[styles.cardSuffix, { color: colors.mutedForeground }]}>{card.suffix}</Text>
                </View>
                {selectedCard === card.id && (
                  <View style={[styles.cardCheck, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: colors.muted }]}
                onPress={() => setCardModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { overflow: 'hidden', flex: 1, borderRadius: 14 }]}
                onPress={confirmCharge}
                disabled={startMutation.isPending}
              >
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.modalConfirmGradient}
                >
                  {startMutation.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.modalConfirmText}>Зарядиться</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroSection: {
    height: 240,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottom: { gap: 8 },
  heroStationName: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: '#ffffff',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#ffffff',
  },
  ratingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#ffffff',
  },
  content: {
    padding: 16,
    gap: 16,
    marginTop: -20,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  statValueStrike: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textDecorationLine: 'line-through',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discountBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#ffffff',
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    lineHeight: 20,
  },
  amenitiesCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
  amenityCol: {
    alignItems: 'center',
    gap: 8,
    width: 60,
  },
  amenityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  linkText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  connectorsList: {
    gap: 8,
  },
  connectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  connectorInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectorTypeName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  connectorAvailText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  connectorPowerKw: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  costMins: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  costKwh: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  costTotal: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  outlineBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  // Card selection modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    gap: 14,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  modalSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: -6,
  },
  cardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  cardEmoji: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cardSuffix: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  cardCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  modalConfirmBtn: {},
  modalConfirmGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  modalConfirmText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
