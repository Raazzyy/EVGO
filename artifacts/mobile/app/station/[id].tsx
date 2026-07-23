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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { PromoCountdown } from '@/components/PromoCountdown';
import { CircularProgress } from '@/components/CircularProgress';

const API = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : '/api';

interface Connector {
  type: string;
  power_kw: number;
  total: number;
  available: number;
}

// Individual connector row (from connectors_detail in GET /stations/:id)
interface ConnectorDetail {
  id: number;
  station_id: number;
  label: string;
  type: string;
  power_kw: number;
  status: 'free' | 'occupied' | 'offline' | 'reserved';
  current_session_id?: number | null;
  reserved_by_user_id?: string | null;
  reserved_until?: string | null;
  session?: {
    is_mine: boolean;
    progress_pct?: number;
    energy_kwh?: number;
    mins_to_80?: number;
    free_at?: string;
  };
}

export default function StationDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { userId, setActiveSessionId } = useApp();
  const [selectedConnectorId, setSelectedConnectorId] = useState<number | null>(null);
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState('Uzcard');
  const [watchedConnectors, setWatchedConnectors] = useState<Set<number>>(new Set());

  const stationIdNum = id ? Number(id) : NaN;

  // ── Favorites (backend-backed) ────────────────────────────────────────
  const { data: favData } = useQuery({
    queryKey: ['favorites', userId],
    queryFn: async () => {
      const r = await fetch(`${API}/favorites?user_id=${encodeURIComponent(userId ?? '')}`);
      if (!r.ok) return [] as any[];
      return r.json() as Promise<any[]>;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  const isFavorite = Array.isArray(favData) && favData.some((f: any) => f.id === stationIdNum);

  const favMutation = useMutation({
    mutationFn: async (add: boolean) => {
      if (add) {
        await fetch(`${API}/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, station_id: stationIdNum }),
        });
      } else {
        await fetch(`${API}/favorites/${stationIdNum}?user_id=${encodeURIComponent(userId ?? '')}`, {
          method: 'DELETE',
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites', userId] }),
  });

  function toggleFavorite() {
    if (!userId) return;
    favMutation.mutate(!isFavorite);
  }

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
  const connectorsDetail: ConnectorDetail[] = (station as any)?.connectors_detail ?? [];
  const amenities: string[] = (station?.amenities as string[] | null) ?? [];
  const supportsReservation: boolean = (station as any)?.supports_reservation ?? false;

  // Count live free/occupied from detail
  const freeCount = connectorsDetail.filter(c => c.status === 'free').length;
  const occupiedCount = connectorsDetail.filter(c => c.status === 'occupied').length;

  function handleCharge(connectorId?: number) {
    if (!station) return;
    if (station.status === 'offline') {
      Alert.alert('Станция недоступна', 'Эта станция сейчас не в сети.');
      return;
    }
    if (connectorId) setSelectedConnectorId(connectorId);
    setCardModalVisible(true);
  }

  function confirmCharge() {
    if (!station) return;
    setCardModalVisible(false);
    const detail = connectorsDetail.find(c => c.id === selectedConnectorId);
    startMutation.mutate({
      data: {
        station_id: station.id,
        user_id: userId,
        connector_type: detail?.type ?? connectors[0]?.type ?? 'CCS2',
        connector_id: selectedConnectorId ?? undefined,
      } as any,
    });
  }

  async function toggleWatcher(connectorId: number) {
    const isWatching = watchedConnectors.has(connectorId);
    if (isWatching) {
      await fetch(`${API}/connector-watchers?user_id=${encodeURIComponent(userId ?? '')}&connector_id=${connectorId}`, { method: 'DELETE' });
      setWatchedConnectors(prev => { const s = new Set(prev); s.delete(connectorId); return s; });
    } else {
      await fetch(`${API}/connector-watchers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, connector_id: connectorId }),
      });
      setWatchedConnectors(prev => new Set(prev).add(connectorId));
    }
  }

  async function handleReserve(connector: ConnectorDetail) {
    if (!userId) return;
    try {
      const r = await fetch(`${API}/connectors/${connector.id}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!r.ok) { const e = await r.json(); Alert.alert('Ошибка', e.error ?? 'Не удалось забронировать'); return; }
      const data = await r.json();
      // TODO: navigate to payment screen with reservation data
      Alert.alert(
        'Бронь подтверждена',
        `Коннектор ${connector.label} забронирован на 15 минут.\nСтоимость брони: ${(data.reservation_cost ?? 5000).toLocaleString('ru-RU')} сум`,
        [{ text: 'OK', onPress: () => {} }]
      );
    } catch {
      Alert.alert('Ошибка', 'Нет соединения с сервером');
    }
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
            <TouchableOpacity onPress={toggleFavorite} style={styles.iconBtn}>
              <Feather name="heart" size={24} color={isFavorite ? '#EF4444' : '#fff'} />
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
          {/* ── Promo banner (promoted stations only) ──────────────────── */}
          {(station as any).is_promoted === 1 && (station as any).discount_pct > 0 && (() => {
            const disc = (station as any).discount_pct as number;
            const origPrice = Math.round(station.price_per_kwh / (1 - disc / 100));
            const newPrice  = Math.round(station.price_per_kwh);
            const savings   = origPrice - newPrice;
            const promoEndsAt = (station as any).promo_ends_at as string | null;
            return (
              <Animated.View entering={FadeInDown.delay(30).springify()}>
                <LinearGradient
                  colors={['#1E1B4B', '#2563EB', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.promoCard}
                >
                  {/* Badges */}
                  <View style={styles.promoBadgesRow}>
                    <View style={styles.promoTopBadge}>
                      <Feather name="award" size={11} color="#1E1B4B" />
                      <Text style={styles.promoTopBadgeText}>ТОП СТАНЦИЯ</Text>
                    </View>
                    <View style={styles.promoDiscBadge}>
                      <Text style={styles.promoDiscText}>-{disc}% СУПЕР СКИДКА</Text>
                    </View>
                  </View>
                  {/* Price comparison */}
                  <View style={styles.promoPriceRow}>
                    <View>
                      <Text style={styles.promoPriceLabelSmall}>СТАРАЯ ЦЕНА</Text>
                      <Text style={styles.promoOldPrice}>{origPrice.toLocaleString('ru-RU')}</Text>
                    </View>
                    <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.4)" />
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.promoPriceLabelSmall}>НОВАЯ ЦЕНА</Text>
                      <Text style={styles.promoNewPrice}>{newPrice.toLocaleString('ru-RU')}</Text>
                    </View>
                  </View>
                  <Text style={styles.promoUnit}>сум/кВт·ч</Text>
                  {/* Savings badge */}
                  <View style={styles.promoSavingsBadge}>
                    <Feather name="trending-down" size={13} color="#92400E" />
                    <Text style={styles.promoSavingsText}>
                      Вы экономите {savings.toLocaleString('ru-RU')} сум с кВт·ч
                    </Text>
                  </View>
                  {/* Countdown */}
                  {promoEndsAt && (
                    <View style={styles.promoCountdownRow}>
                      <Text style={styles.promoCountdownLabel}>АКЦИЯ ДЕЙСТВУЕТ</Text>
                      <PromoCountdown endsAt={promoEndsAt} />
                      <Text style={styles.promoCountdownLabel}>до конца</Text>
                    </View>
                  )}
                </LinearGradient>
              </Animated.View>
            );
          })()}

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

          {/* Connectors section — individual cards */}
          {(connectorsDetail.length > 0 || connectors.length > 0) && (
            <View>
              {/* Header */}
              <View style={[styles.cardHeader, { marginBottom: 10, paddingHorizontal: 2 }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Коннекторы</Text>
                {connectorsDetail.length > 0 && (
                  <Text style={[styles.linkText, { color: colors.mutedForeground, fontSize: 13 }]}>
                    {freeCount > 0 && <Text style={{ color: '#10B981' }}>{freeCount} свободен</Text>}
                    {freeCount > 0 && occupiedCount > 0 && '  '}
                    {occupiedCount > 0 && <Text style={{ color: '#F59E0B' }}>{occupiedCount} занят</Text>}
                  </Text>
                )}
              </View>

              {/* Individual connector cards (from connectors_detail) */}
              {connectorsDetail.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {connectorsDetail.map((c) => {
                    const isMine = c.session?.is_mine === true;
                    const isOccupied = c.status === 'occupied';
                    const isFree = c.status === 'free';
                    const isOffline = c.status === 'offline';
                    const isReserved = c.status === 'reserved';
                    const watching = watchedConnectors.has(c.id);

                    const statusBg = isFree ? '#DCFCE7' : isOccupied ? '#FEF3C7' : isReserved ? '#EEF2FF' : '#F1F5F9';
                    const statusTxt = isFree ? '#15803D' : isOccupied ? '#92400E' : isReserved ? '#3730A3' : '#475569';
                    const statusLabel = isFree ? 'Свободно' : isOccupied ? 'Занят' : isReserved ? 'Забронирован' : 'Не в сети';

                    return (
                      <View
                        key={c.id}
                        style={[
                          styles.card,
                          {
                            backgroundColor: colors.card,
                            borderWidth: isFree ? 1.5 : 1,
                            borderColor: isFree ? '#10B981' + '44' : isOccupied && isMine ? '#F59E0B' + '55' : colors.border,
                            padding: 14, shadowColor: '#000',
                          },
                        ]}
                      >
                        {/* Label badge */}
                        <View style={[styles.labelBadge, { backgroundColor: colors.muted }]}>
                          <Text style={[styles.labelBadgeText, { color: colors.text }]}>{c.label}</Text>
                        </View>

                        {/* Top row: icon + type + power + status */}
                        <View style={styles.connectorCardTop}>
                          <View style={[styles.connIconWrap, { backgroundColor: isOccupied ? '#FEF3C7' : isFree ? '#DCFCE7' : colors.muted }]}>
                            <ConnectorIcon type={c.type} size={22} color={isOccupied ? '#F59E0B' : isFree ? '#10B981' : colors.mutedForeground} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.connectorTypeName, { color: colors.text }]}>{c.type}</Text>
                            <Text style={[styles.connectorPowerKw, { color: colors.mutedForeground, marginTop: 1 }]}>{c.power_kw} кВт</Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                            <Text style={[styles.statusBadgeTxt, { color: statusTxt }]}>{statusLabel}</Text>
                          </View>
                        </View>

                        {/* Occupied by MY session — progress */}
                        {isOccupied && isMine && c.session && (
                          <View style={styles.sessionRow}>
                            <View style={{ flex: 1, gap: 4 }}>
                              <Text style={[styles.sessionLabel, { color: colors.mutedForeground }]}>Заряжается</Text>
                              <Text style={[styles.sessionValue, { color: colors.text }]}>
                                {c.session.energy_kwh?.toFixed(1)} кВт·ч получено
                              </Text>
                              {c.session.mins_to_80 != null && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Feather name="clock" size={12} color={colors.mutedForeground} />
                                  <Text style={[styles.sessionSub, { color: colors.mutedForeground }]}>
                                    ещё {c.session.mins_to_80} мин до 80%
                                  </Text>
                                </View>
                              )}
                              {c.session.free_at && (
                                <Text style={[styles.sessionSub, { color: colors.mutedForeground }]}>
                                  освободится в {c.session.free_at}
                                </Text>
                              )}
                            </View>
                            <CircularProgress pct={c.session.progress_pct ?? 0} size={62} />
                          </View>
                        )}

                        {/* Occupied by someone else */}
                        {isOccupied && !isMine && (
                          <Text style={[styles.sessionSub, { color: colors.mutedForeground, marginTop: 8, fontStyle: 'italic' }]}>
                            Занято другим пользователем · точное время недоступно
                          </Text>
                        )}

                        {/* Free — CTA */}
                        {isFree && (
                          <View style={{ marginTop: 10 }}>
                            <Text style={[styles.sessionSub, { color: '#10B981', marginBottom: 8 }]}>
                              Начните зарядку — прямо сейчас
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              {supportsReservation && (
                                <TouchableOpacity
                                  onPress={() => handleReserve(c)}
                                  activeOpacity={0.8}
                                  style={[styles.connActionBtn, { borderColor: colors.primary, backgroundColor: '#EEF2FF', flex: 1 }]}
                                >
                                  <Feather name="calendar" size={13} color={colors.primary} />
                                  <Text style={[styles.connActionTxt, { color: colors.primary }]}>Забронировать</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                onPress={() => handleCharge(c.id)}
                                activeOpacity={0.85}
                                style={[styles.connActionBtn, { backgroundColor: '#10B981', borderColor: '#10B981', flex: supportsReservation ? 1 : 2 }]}
                              >
                                <Feather name="zap" size={13} color="#fff" />
                                <Text style={[styles.connActionTxt, { color: '#fff' }]}>Зарядиться</Text>
                              </TouchableOpacity>
                            </View>
                            {supportsReservation && (
                              <Text style={[styles.sessionSub, { color: colors.mutedForeground, textAlign: 'center', marginTop: 6 }]}>
                                🔒 Бронь → оплата · 5 000 сум · 15 мин
                              </Text>
                            )}
                          </View>
                        )}

                        {/* Notify button for occupied/offline */}
                        {(isOccupied && !isMine) && (
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                            <TouchableOpacity
                              onPress={() => toggleWatcher(c.id)}
                              activeOpacity={0.8}
                              style={[
                                styles.connActionBtn,
                                {
                                  flex: 1,
                                  borderColor: watching ? '#3B82F6' : colors.border,
                                  backgroundColor: watching ? '#EFF6FF' : colors.muted,
                                },
                              ]}
                            >
                              <Feather name="bell" size={13} color={watching ? '#2563EB' : colors.mutedForeground} />
                              <Text style={[styles.connActionTxt, { color: watching ? '#2563EB' : colors.mutedForeground }]}>
                                {watching ? 'Вы получите уведомление' : 'Уведомить'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                /* Fallback: old jsonb connector list */
                <View style={[styles.card, { backgroundColor: colors.card, shadowColor: '#000' }]}>
                  <View style={styles.connectorsList}>
                    {connectors.map((c, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setSelectedConnectorId(i)}
                        style={[styles.connectorRow, {
                          borderColor: selectedConnectorId === i ? colors.primary : colors.border,
                          backgroundColor: selectedConnectorId === i ? colors.primary + '0D' : 'transparent',
                        }]}
                      >
                        <View style={styles.connectorInfoLeft}>
                          <ConnectorIcon type={c.type} size={17} color={colors.text} />
                          <Text style={[styles.connectorTypeName, { color: colors.text }]}>{c.type}</Text>
                          <Text style={[styles.connectorAvailText, { color: '#10B981' }]}>{c.available}/{c.total}</Text>
                        </View>
                        <Text style={[styles.connectorPowerKw, { color: colors.mutedForeground }]}>{c.power_kw} кВт</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
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
              : 'Зарядиться'
          }
          onPress={() => handleCharge()}
          loading={startMutation.isPending}
          disabled={station.status === 'offline'}
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
  connectorsList: { gap: 8 },
  connectorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 12, borderWidth: 1.5,
  },
  connectorInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connectorTypeName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  connectorAvailText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  connectorPowerKw: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  // Individual connector card elements
  labelBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  labelBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  connectorCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  connIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  sessionLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  sessionValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sessionSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  connActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
  },
  connActionTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
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
  // ── Promo card ──────────────────────────────────────────────────────────
  promoCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 2,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  promoBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  promoTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FBBF24',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  promoTopBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: '#1E1B4B',
  },
  promoDiscBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  promoDiscText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: '#fff',
  },
  promoPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  promoPriceLabelSmall: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  promoOldPrice: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'line-through',
  },
  promoNewPrice: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: '#fff',
    lineHeight: 38,
  },
  promoUnit: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 14,
  },
  promoSavingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  promoSavingsText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#92400E',
  },
  promoCountdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  promoCountdownLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
});
