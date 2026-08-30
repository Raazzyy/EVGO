import React, { useState, useCallback } from 'react';
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
  Share,
  useWindowDimensions,
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
import { ConnectorIcon } from '@/components/ConnectorBadge';
import { GradientButton } from '@/components/GradientButton';
import { PromoCountdown } from '@/components/PromoCountdown';
import { CircularProgress } from '@/components/CircularProgress';
import { ReportStationSheet } from '@/components/ReportStationSheet';
import { haptics } from '@/lib/haptics';
import { useTranslation } from 'react-i18next';
import { formatAmount, formatMoney } from '@/lib/format';

const API = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : '/api';

interface Connector {
  type: string;
  power_kw: number;
  total: number;
  available: number;
}

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

// ── Amenity maps ─────────────────────────────────────────────────────────────
/**
 * Удобства станции: иконка и ключ перевода.
 *
 * Названия переводятся, а не хранятся строкой: в узбекском интерфейсе
 * «Кафе» смотрелось бы русским вкраплением среди переведённого экрана.
 */
const AMENITY_MAP: Record<string, { icon: string; key: string }> = {
  'cafe':    { icon: 'coffee',       key: 'amenity.cafe' },
  'toilet':  { icon: 'home',         key: 'amenity.toilet' },
  'shop':    { icon: 'shopping-bag', key: 'amenity.shop' },
  'wifi':    { icon: 'wifi',         key: 'amenity.wifi' },
  'lounge':  { icon: 'star',         key: 'amenity.lounge' },
  'parking': { icon: 'map-pin',      key: 'amenity.parking' },
  '24/7':    { icon: 'clock',        key: 'amenity.around' },
};

// ── Compact connector card (3-col, 7+ connectors) ────────────────────────────
function CompactConnectorCard({
  c,
  onPress,
}: {
  c: ConnectorDetail;
  onPress: () => void;
}) {
  const colors = useColors();
  const isFree = c.status === 'free';
  const isOcc  = c.status === 'occupied';
  const dotColor = isFree ? '#10B981' : isOcc ? '#F59E0B' : '#94A3B8';
  const borderColor = isFree ? '#10B98133' : isOcc ? '#F59E0B33' : colors.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        stylesC.compactCard,
        { backgroundColor: colors.card, borderColor },
      ]}
    >
      {/* Letter badge */}
      <View style={[stylesC.letterBadge, { backgroundColor: colors.muted }]}>
        <Text style={[stylesC.letterBadgeText, { color: colors.text }]}>{c.label}</Text>
      </View>
      {/* Icon */}
      <View style={[stylesC.compactIconWrap, { backgroundColor: `${dotColor}18` }]}>
        <ConnectorIcon type={c.type} size={18} color={dotColor} />
      </View>
      {/* Type + power */}
      <Text style={[stylesC.compactType, { color: colors.text }]} numberOfLines={1}>{c.type}</Text>
      <Text style={[stylesC.compactPow, { color: colors.mutedForeground }]}>{c.power_kw} кВт</Text>
      {/* Status dot */}
      <View style={[stylesC.compactDot, { backgroundColor: dotColor }]} />
    </TouchableOpacity>
  );
}

// ── Full connector card (2-col, 1-6 connectors) ───────────────────────────────
function FullConnectorCard({
  c,
  supportsReservation,
  watching,
  onCharge,
  onToggleWatch,
  onReserve,
}: {
  c: ConnectorDetail;
  supportsReservation: boolean;
  watching: boolean;
  onCharge: () => void;
  onToggleWatch: () => void;
  onReserve: () => void;
}) {
  const colors = useColors();
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const isMine     = c.session?.is_mine === true;
  const isFree     = c.status === 'free';
  const isOccupied = c.status === 'occupied';
  const isOffline  = c.status === 'offline';
  const isReserved = c.status === 'reserved';

  // Status colour tokens
  const statusColor =
    isFree     ? '#10B981' :
    isOccupied ? '#F59E0B' :
    isReserved ? '#3B82F6' : '#94A3B8';

  const statusBg    = `${statusColor}1A`;
  const borderColor = isFree ? `${statusColor}44` : isOccupied && isMine ? `${statusColor}55` : colors.border;

  const statusLabel =
    isFree ? 'Свободно' :
    isOccupied ? (isMine ? `Заряжается ${c.session?.progress_pct ?? 0}%` : 'Занят') :
    isReserved ? 'Забронирован' : 'Не в сети';

  const statusIcon: any =
    isFree     ? 'check-circle' :
    isOccupied ? 'zap' :
    isReserved ? 'calendar' : 'slash';

  return (
    <View
      style={[
        stylesC.fullCard,
        { backgroundColor: colors.card, borderColor },
      ]}
    >
      {/* Letter badge — top right */}
      <View style={[stylesC.letterBadge, { backgroundColor: colors.muted, position: 'absolute', top: 10, right: 10 }]}>
        <Text style={[stylesC.letterBadgeText, { color: colors.text }]}>{c.label}</Text>
      </View>

      {/* Icon + type + power */}
      <View style={stylesC.fullTopRow}>
        <View style={[stylesC.fullIconWrap, { backgroundColor: `${statusColor}18` }]}>
          <ConnectorIcon type={c.type} size={22} color={statusColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[stylesC.fullType, { color: colors.text }]}>{c.type}</Text>
          <Text style={[stylesC.fullPow, { color: colors.mutedForeground }]}>{c.power_kw} кВт</Text>
        </View>
      </View>

      {/* Status strip */}
      <View style={[stylesC.statusStrip, { backgroundColor: statusBg }]}>
        <Feather name={statusIcon} size={12} color={statusColor} />
        <Text style={[stylesC.statusTxt, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      {/* ── MY session: energy + ring ────────────────────────────────────── */}
      {isOccupied && isMine && c.session && (
        <View style={stylesC.sessionBlock}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[stylesC.energyVal, { color: colors.text }]}>
              {c.session.energy_kwh?.toFixed(1)} кВт·ч
            </Text>
            <Text style={[stylesC.energyLabel, { color: colors.mutedForeground }]}>
              Получено энергии
            </Text>
            {c.session.mins_to_80 != null && (
              <TouchableOpacity
                onPress={() => setTooltipVisible(v => !v)}
                style={stylesC.eta80Row}
                activeOpacity={0.7}
              >
                <Text style={[stylesC.eta80Txt, { color: colors.text }]}>
                  ещё {c.session.mins_to_80} мин до 80%
                </Text>
                <View style={stylesC.infoCircle}>
                  <Text style={stylesC.infoCircleTxt}>i</Text>
                </View>
              </TouchableOpacity>
            )}
            {tooltipVisible && (
              <View style={[stylesC.tooltip, { backgroundColor: colors.muted }]}>
                <Text style={[stylesC.tooltipTxt, { color: colors.mutedForeground }]}>
                  Расчёт приблизительный, зависит от заряда и состояния АКБ
                </Text>
              </View>
            )}
            {c.session.free_at && (
              <Text style={[stylesC.freeAtTxt, { color: colors.mutedForeground }]}>
                освободится в {c.session.free_at}
              </Text>
            )}
          </View>
          <CircularProgress
            progress={c.session.progress_pct ?? 0}
            size={56}
            strokeWidth={6}
            color="#F59E0B"
            trackColor="#FDE68A"
          />
        </View>
      )}

      {/* ── Occupied by someone else ─────────────────────────────────────── */}
      {isOccupied && !isMine && (
        <Text style={[stylesC.occupiedNote, { color: colors.mutedForeground }]}>
          Время освобождения недоступно
        </Text>
      )}

      {/* ── Free: start CTA ──────────────────────────────────────────────── */}
      {isFree && (
        <View style={stylesC.freeCta}>
          <Text style={[stylesC.freeCtaTitle, { color: colors.text }]}>Начните зарядку</Text>
          <Text style={[stylesC.freeCtaSub, { color: colors.mutedForeground }]}>Прямо сейчас</Text>
        </View>
      )}

      {/* Spacer pushes buttons to bottom in all states */}
      <View style={{ flex: 1 }} />

      {/* ── Buttons ──────────────────────────────────────────────────────── */}
      {isFree && (
        <View style={{ gap: 8 }}>
          {/* Reserve + Charge row */}
          <View style={stylesC.btnRow}>
            {supportsReservation && (
              <TouchableOpacity
                onPress={onReserve}
                activeOpacity={0.8}
                style={[stylesC.outlineBtn, { borderColor: '#2563EB', flex: 1 }]}
              >
                <Feather name="calendar" size={13} color="#2563EB" />
                <Text style={[stylesC.outlineBtnTxt, { color: '#2563EB' }]}>Забронировать</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onCharge}
              activeOpacity={0.85}
              style={[stylesC.fillBtn, { backgroundColor: '#16A34A', flex: supportsReservation ? 1 : undefined, alignSelf: supportsReservation ? undefined : 'stretch' }]}
            >
              <Feather name="zap" size={13} color="#fff" />
              <Text style={stylesC.fillBtnTxt}>Зарядиться</Text>
            </TouchableOpacity>
          </View>
          {supportsReservation && (
            <Text style={[stylesC.lockNote, { color: colors.mutedForeground }]}>
              🔒 Бронь → оплата · 5 000 сум · 15 мин
            </Text>
          )}
        </View>
      )}

      {/* My session buttons: notify + reserve */}
      {isOccupied && isMine && (
        <View style={stylesC.btnRow}>
          <TouchableOpacity
            onPress={onToggleWatch}
            activeOpacity={0.8}
            style={[
              stylesC.outlineBtn,
              { borderColor: watching ? '#3B82F6' : colors.border, flex: 1,
                backgroundColor: watching ? '#EFF6FF' : colors.muted },
            ]}
          >
            <Feather name="bell" size={13} color={watching ? '#2563EB' : colors.mutedForeground} />
            <Text style={[stylesC.outlineBtnTxt, { color: watching ? '#2563EB' : colors.mutedForeground }]}>
              {watching ? 'Уведомят' : 'Уведомить'}
            </Text>
          </TouchableOpacity>
          {supportsReservation && (
            <TouchableOpacity
              onPress={onReserve}
              activeOpacity={0.8}
              style={[stylesC.fillBtn, { backgroundColor: '#2563EB', flex: 1 }]}
            >
              <Feather name="calendar" size={13} color="#fff" />
              <Text style={stylesC.fillBtnTxt}>Забронировать</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Occupied by other: notify only */}
      {isOccupied && !isMine && (
        <TouchableOpacity
          onPress={onToggleWatch}
          activeOpacity={0.8}
          style={[
            stylesC.outlineBtn,
            { borderColor: watching ? '#3B82F6' : colors.border,
              backgroundColor: watching ? '#EFF6FF' : colors.muted },
          ]}
        >
          <Feather name="bell" size={13} color={watching ? '#2563EB' : colors.mutedForeground} />
          <Text style={[stylesC.outlineBtnTxt, { color: watching ? '#2563EB' : colors.mutedForeground }]}>
            {watching ? 'Уведомят вас' : 'Уведомить'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Station info row ──────────────────────────────────────────────────────────
function InfoRow({
  icon,
  label,
  value,
  onPress,
  isLast,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
  isLast?: boolean;
  colors: any;
}) {
  const Inner = (
    <View
      style={[
        stylesC.infoRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={[stylesC.infoIconWrap, { backgroundColor: colors.muted }]}>
        <Feather name={icon as any} size={15} color={colors.primary} />
      </View>
      <Text style={[stylesC.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[stylesC.infoValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      {!!onPress && <Feather name="chevron-right" size={15} color={colors.mutedForeground} />}
    </View>
  );
  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{Inner}</TouchableOpacity>;
  }
  return Inner;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function StationDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { userId, setActiveSessionId } = useApp();
  const { width: screenW } = useWindowDimensions();

  const [selectedConnectorId, setSelectedConnectorId] = useState<number | null>(null);
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState('Uzcard');
  const [watchedConnectors, setWatchedConnectors] = useState<Set<number>>(new Set());
  const [expandedCompact, setExpandedCompact] = useState<number | null>(null);

  const stationIdNum = id ? Number(id) : NaN;

  // ── Favorites ─────────────────────────────────────────────────────────────
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
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, station_id: stationIdNum }),
        });
      } else {
        await fetch(`${API}/favorites/${stationIdNum}?user_id=${encodeURIComponent(userId ?? '')}`, { method: 'DELETE' });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites', userId] }),
  });

  const stationId = id ? Number(id) : NaN;
  const { data: station, isLoading } = useGetStation(stationId, {
    query: { enabled: !isNaN(stationId) && stationId > 0 },
  });

  const startMutation = useStartSession({
    mutation: {
      onSuccess: (session) => {
        // Зарядка пошла — заметная отдача: это главное действие экрана.
        haptics.success();
        setActiveSessionId(session.id);
        qc.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetStationsQueryKey() });
        router.push('/charge');
      },
      onError: () => {
        haptics.error();
        Alert.alert(
          'Зарядка не началась',
          'Коннектор мог занять кто-то другой. Обновите страницу станции и попробуйте снова.',
        );
      },
    },
  });

  const { t, i18n } = useTranslation();
  const [reportOpen, setReportOpen] = useState(false);

  // Отправка жалобы на неточность в данных станции. Токен подставляет
  // общий сетевой слой, поэтому обычный fetch здесь не подходит.
  const submitReport = useCallback(
    async (reason: string, comment?: string) => {
      const res = await fetch(`${API}/stations/${id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, comment }),
      });
      if (!res.ok) throw new Error(`report failed: ${res.status}`);
    },
    [id],
  );

  const connectors: Connector[] = (station?.connectors as Connector[] | null) ?? [];
  const connectorsDetail: ConnectorDetail[] = (station as any)?.connectors_detail ?? [];
  const amenities: string[] = (station?.amenities as string[] | null) ?? [];
  const supportsReservation: boolean = (station as any)?.supports_reservation ?? false;

  const freeCount     = connectorsDetail.filter(c => c.status === 'free').length;
  const occupiedCount = connectorsDetail.filter(c => c.status === 'occupied').length;

  // ── Grid layout config ────────────────────────────────────────────────────
  const totalConnectors = connectorsDetail.length || connectors.length;
  const cols     = totalConnectors <= 1 ? 1 : totalConnectors <= 6 ? 2 : 3;
  const isCompact = cols === 3;
  const gapSize  = 12;
  const padH     = 16;
  const cardW    = (screenW - padH * 2 - gapSize * (cols - 1)) / cols;

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, connector_id: connectorId }),
      });
      setWatchedConnectors(prev => new Set(prev).add(connectorId));
    }
  }

  async function handleReserve(connector: ConnectorDetail) {
    if (!userId) return;
    try {
      const r = await fetch(`${API}/connectors/${connector.id}/reserve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!r.ok) {
        const e = await r.json();
        // Текст с сервера точнее общего: он знает, занят коннектор или
        // бронь уже есть.
        Alert.alert('Бронь не оформлена', e.error ?? 'Коннектор уже занят. Выберите другой.');
        return;
      }
      const data = await r.json();
      Alert.alert(
        'Бронь подтверждена',
        `Коннектор ${connector.label} забронирован на 15 минут.\nСтоимость брони: ${formatMoney(data.reservation_cost ?? 5000)}`,
        [{ text: 'OK', onPress: () => {} }]
      );
    } catch {
      Alert.alert('Нет связи', 'Проверьте интернет и попробуйте забронировать снова.');
    }
  }

  async function handleShare() {
    try {
      await Share.share({ message: `${station?.name} — станция зарядки EV\n${station?.address}` });
    } catch {}
  }

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;

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
  const maxPow = connectors.reduce((m, c) => Math.max(m, c.power_kw), station.power_kw ?? 0);
  const primaryType = connectors[0]?.type ?? '—';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={['#1A1A2E', '#2563EB']}
          style={[styles.heroSection, { paddingTop: Math.max(topPad, 16) }]}
        >
          <View style={styles.heroHeader}>
            <TouchableOpacity onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Назад" style={styles.iconBtn}>
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
                <Feather name="share" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => favMutation.mutate(!isFavorite)} style={styles.iconBtn}>
                <Feather name="heart" size={20} color={isFavorite ? '#EF4444' : '#fff'} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroBottom}>
            <Text style={styles.heroStationName}>{station.name}</Text>
            <View style={styles.ratingRow}>
              <Feather name="star" size={14} color="#FBBF24" />
              <Text style={styles.ratingText}>4.8</Text>
              <View style={styles.ratingDot} />
              <Text style={styles.ratingText}>0,3 км</Text>
            </View>
            <View style={styles.pillsRow}>
              {operatorName ? <View style={styles.pill}><Text style={styles.pillText}>{operatorName}</Text></View> : null}
              <View style={styles.pill}><Text style={styles.pillText}>Быстрая зарядка</Text></View>
              <View style={styles.pill}><Text style={styles.pillText}>DC</Text></View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* ── Promo banner ──────────────────────────────────────────────── */}
          {!!(station as any).is_promoted && (station as any).discount_pct > 0 && (() => {
            const disc = (station as any).discount_pct as number;
            const origPrice = Math.round(station.price_per_kwh / (1 - disc / 100));
            const newPrice  = Math.round(station.price_per_kwh);
            const savings   = origPrice - newPrice;
            const promoEndsAt = (station as any).promo_ends_at as string | null;
            return (
              <Animated.View entering={FadeInDown.delay(30).springify()}>
                <LinearGradient colors={['#1E1B4B', '#2563EB', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.promoCard}>
                  <View style={styles.promoBadgesRow}>
                    <View style={styles.promoTopBadge}><Feather name="award" size={11} color="#1E1B4B" /><Text style={styles.promoTopBadgeText}>ТОП СТАНЦИЯ</Text></View>
                    <View style={styles.promoDiscBadge}><Text style={styles.promoDiscText}>-{disc}% СУПЕР СКИДКА</Text></View>
                  </View>
                  <View style={styles.promoPriceRow}>
                    <View>
                      <Text style={styles.promoPriceLabelSmall}>СТАРАЯ ЦЕНА</Text>
                      <Text style={styles.promoOldPrice}>{formatAmount(origPrice)}</Text>
                    </View>
                    <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.4)" />
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.promoPriceLabelSmall}>НОВАЯ ЦЕНА</Text>
                      <Text style={styles.promoNewPrice}>{formatAmount(newPrice)}</Text>
                    </View>
                  </View>
                  <Text style={styles.promoUnit}>сум/кВт·ч</Text>
                  <View style={styles.promoSavingsBadge}>
                    <Feather name="trending-down" size={13} color="#92400E" />
                    <Text style={styles.promoSavingsText}>Вы экономите {formatMoney(savings)} с кВт·ч</Text>
                  </View>
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

          {/* ── Quick stats ────────────────────────────────────────────────── */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={[styles.statValue, { color: colors.text }]}>{station.power_kw} кВт</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>мощность</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                <Text style={[styles.statValue, { color: connectors.reduce((a, c) => a + c.available, 0) > 0 ? '#10B981' : colors.text }]}>
                  {connectors.reduce((a, c) => a + c.available, 0)}/{connectors.reduce((a, c) => a + c.total, 0)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>доступно</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                {(station as any).discount_pct > 0 ? (
                  <View style={styles.priceRow}>
                    <Text style={[styles.statValueStrike, { color: colors.mutedForeground }]}>{formatAmount(station.price_per_kwh)}</Text>
                    <Text style={[styles.statValue, { color: '#10B981' }]}>{formatAmount(station.price_per_kwh * (1 - (station as any).discount_pct / 100))}</Text>
                    <View style={styles.discountBadge}><Text style={styles.discountText}>-{(station as any).discount_pct}%</Text></View>
                  </View>
                ) : (
                  <Text style={[styles.statValue, { color: colors.text }]}>{formatAmount(station.price_per_kwh)}</Text>
                )}
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>сум/кВт·ч</Text>
              </View>
            </View>
          </View>

          {/* ── Amenities — pill chips ────────────────────────────────────── */}
          {amenities.length > 0 && (
            <View style={styles.amenitiesWrap}>
              {amenities.map((a) => {
                const mapped = AMENITY_MAP[a];
                const icon = mapped?.icon ?? 'check';
                // Незнакомое удобство показываем как есть: лучше сырое
                // значение из базы, чем пустая плашка.
                const label = mapped ? t(mapped.key) : a;
                return (
                  <View key={a} style={[styles.amenityPill, { backgroundColor: colors.muted }]}>
                    <Feather name={icon as any} size={13} color={colors.mutedForeground} />
                    <Text style={[styles.amenityPillText, { color: colors.text }]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Connectors grid ───────────────────────────────────────────── */}
          {(connectorsDetail.length > 0 || connectors.length > 0) && (
            <View>
              {/* Section header */}
              <View style={[styles.cardHeader, { marginBottom: 12 }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Коннекторы</Text>
                {connectorsDetail.length > 0 && (
                  <Text>
                    {freeCount > 0 && <Text style={{ color: '#10B981', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{freeCount} свободно</Text>}
                    {freeCount > 0 && occupiedCount > 0 && <Text style={{ color: colors.mutedForeground, fontSize: 13 }}> · </Text>}
                    {occupiedCount > 0 && <Text style={{ color: '#F59E0B', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{occupiedCount} занят</Text>}
                  </Text>
                )}
              </View>

              {/* Compact toggle (7+ connectors) */}
              {isCompact && connectorsDetail.length > 0 && (
                <View style={styles.compactToggleRow}>
                  <Text style={[styles.compactToggleHint, { color: colors.mutedForeground }]}>
                    Нажмите на коннектор для действий
                  </Text>
                </View>
              )}

              {connectorsDetail.length > 0 ? (
                <View style={[styles.gridWrap, { gap: gapSize }]}>
                  {connectorsDetail.map((c) => {
                    if (isCompact) {
                      return (
                        <View key={c.id} style={{ width: cardW }}>
                          <CompactConnectorCard
                            c={c}
                            onPress={() => setExpandedCompact(expandedCompact === c.id ? null : c.id)}
                          />
                          {/* Inline expansion for compact mode */}
                          {expandedCompact === c.id && (
                            <Animated.View entering={FadeInDown.duration(200)} style={{ marginTop: 8 }}>
                              <FullConnectorCard
                                c={c}
                                supportsReservation={supportsReservation}
                                watching={watchedConnectors.has(c.id)}
                                onCharge={() => handleCharge(c.id)}
                                onToggleWatch={() => toggleWatcher(c.id)}
                                onReserve={() => handleReserve(c)}
                              />
                            </Animated.View>
                          )}
                        </View>
                      );
                    }
                    return (
                      <View key={c.id} style={{ width: cardW }}>
                        <FullConnectorCard
                          c={c}
                          supportsReservation={supportsReservation}
                          watching={watchedConnectors.has(c.id)}
                          onCharge={() => handleCharge(c.id)}
                          onToggleWatch={() => toggleWatcher(c.id)}
                          onReserve={() => handleReserve(c)}
                        />
                      </View>
                    );
                  })}
                </View>
              ) : (
                /* Fallback: old jsonb list */
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                  <View style={{ gap: 8 }}>
                    {connectors.map((c, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setSelectedConnectorId(i)}
                        style={[styles.connectorRow, {
                          borderColor: selectedConnectorId === i ? colors.primary : colors.border,
                          backgroundColor: selectedConnectorId === i ? `${colors.primary}0D` : 'transparent',
                        }]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <ConnectorIcon type={c.type} size={17} color={colors.text} />
                          <Text style={[styles.connectorTypeName, { color: colors.text }]}>{c.type}</Text>
                          <Text style={{ color: '#10B981', fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>{c.available}/{c.total}</Text>
                        </View>
                        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>{c.power_kw} кВт</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── Station info rows ─────────────────────────────────────────── */}
          <View style={[styles.card, { backgroundColor: colors.card, padding: 0, overflow: 'hidden' }]}>
            <Text style={[styles.cardTitle, { color: colors.text, margin: 16, marginBottom: 4 }]}>Информация о станции</Text>
            <InfoRow icon="map-pin"  label="Адрес"         value={station.address}      onPress={() => {}} colors={colors} />
            <InfoRow icon="clock"    label="Режим работы"  value="24/7"                  colors={colors} />
            <InfoRow icon="zap"      label="Макс. мощность" value={`${maxPow} кВт`}      colors={colors} />
            <InfoRow icon="cpu"      label="Коннектор"      value={primaryType}           isLast colors={colors} />
          </View>

          {/* ── Cost estimate ──────────────────────────────────────────────── */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 12 }]}>Стоимость</Text>
            {[10, 30, 60].map((mins) => {
              const energyKwh = (station.power_kw * mins) / 60;
              const cost = energyKwh * station.price_per_kwh;
              return (
                <View key={mins} style={[styles.costRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.costMins, { color: colors.text }]}>{mins} мин</Text>
                  <Text style={[styles.costKwh, { color: colors.mutedForeground }]}>~{energyKwh.toFixed(1)} кВт·ч</Text>
                  <Text style={[styles.costTotal, { color: colors.text }]}>{formatMoney(Math.round(cost))}</Text>
                </View>
              );
            })}
          </View>

          {/* ── Актуальность данных ────────────────────────────────────────
              Станции приходят из OpenChargeMap, где часть записей устарела.
              Человек должен видеть, когда данные проверяли, и иметь возможность
              сообщить об ошибке — объехать все станции страны нереально. */}
          <View style={styles.freshness}>
            <Text style={[styles.freshnessText, { color: colors.mutedForeground }]}>
              {(station as any).verified_at
                ? t('station.verifiedOn', {
                    date: new Date((station as any).verified_at).toLocaleDateString(i18n.language),
                  })
                : t('station.notVerified')}
            </Text>
            <TouchableOpacity
              onPress={() => setReportOpen(true)}
              style={styles.reportBtn}
              hitSlop={8}
            >
              <Feather name="flag" size={14} color={colors.mutedForeground} />
              <Text style={[styles.reportBtnText, { color: colors.mutedForeground }]}>
                {t('station.reportInaccuracy')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom: only Route button ─────────────────────────────────────── */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad + 12 }]}>
        <TouchableOpacity
          style={styles.routeBtn}
          onPress={() => router.push(
            `/route/new?stationId=${station.id}&stationName=${encodeURIComponent(station.name)}&lat=${station.lat}&lng=${station.lng}` as any
          )}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#2563EB', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.routeBtnGradient}>
            <Feather name="navigation" size={18} color="#fff" />
            <View>
              <Text style={styles.routeBtnText}>Построить маршрут</Text>
              <Text style={styles.routeBtnSub}>1,7 км · 6 мин</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Card modal ────────────────────────────────────────────────────── */}
      <Modal visible={cardModalVisible} transparent animationType="slide" onRequestClose={() => setCardModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInDown.duration(300).easing(Easing.bezier(0.25, 0.46, 0.45, 0.94))} style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.mutedForeground, opacity: 0.25 }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Выберите карту</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Оплата спишется после завершения зарядки</Text>
            {[
              { id: 'Uzcard',     label: 'Uzcard',     emoji: '🟦', suffix: '•••• 4521' },
              { id: 'Humo',       label: 'Humo',       emoji: '🟩', suffix: '•••• 8934' },
              { id: 'Visa',       label: 'Visa',       emoji: '💳', suffix: '•••• 1177' },
              { id: 'Mastercard', label: 'Mastercard', emoji: '🔴', suffix: '•••• 6623' },
            ].map(card => (
              <TouchableOpacity
                key={card.id}
                onPress={() => setSelectedCard(card.id)}
                style={[styles.cardOption, { borderColor: selectedCard === card.id ? colors.primary : colors.border, backgroundColor: selectedCard === card.id ? `${colors.primary}10` : colors.background }]}
              >
                <Text style={styles.cardEmoji}>{card.emoji}</Text>
                <View style={styles.cardInfo}><Text style={[styles.cardLabel, { color: colors.text }]}>{card.label}</Text><Text style={[styles.cardSuffix, { color: colors.mutedForeground }]}>{card.suffix}</Text></View>
                {selectedCard === card.id && <View style={[styles.cardCheck, { backgroundColor: colors.primary }]}><Feather name="check" size={12} color="#fff" /></View>}
              </TouchableOpacity>
            ))}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: colors.muted }]} onPress={() => setCardModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, borderRadius: 14, overflow: 'hidden' }} onPress={confirmCharge} disabled={startMutation.isPending}>
                <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modalConfirmGradient}>
                  {startMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Зарядиться</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <ReportStationSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={submitReport}
      />
    </View>
  );
}

// ── Connector card styles ─────────────────────────────────────────────────────
const stylesC = StyleSheet.create({
  // Compact card (3-col)
  compactCard: {
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  compactIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  compactType:    { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  compactPow:     { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  compactDot:     { width: 8, height: 8, borderRadius: 4, marginTop: 2 },

  // Full card (2-col)
  fullCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    gap: 10,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  fullTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 28 },
  fullIconWrap:{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fullType:    { fontSize: 15, fontFamily: 'Inter_700Bold' },
  fullPow:     { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 1 },

  statusStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  statusTxt:   { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  sessionBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  energyVal:    { fontSize: 17, fontFamily: 'Inter_700Bold' },
  energyLabel:  { fontSize: 11, fontFamily: 'Inter_400Regular' },
  eta80Row:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eta80Txt:     { fontSize: 13, fontFamily: 'Inter_500Medium' },
  infoCircle:   { width: 16, height: 16, borderRadius: 8, backgroundColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  infoCircleTxt:{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#475569' },
  tooltip:      { borderRadius: 10, padding: 10 },
  tooltipTxt:   { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  freeAtTxt:    { fontSize: 12, fontFamily: 'Inter_400Regular' },
  occupiedNote: { fontSize: 11, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },

  freeCta:      { gap: 2 },
  freeCtaTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  freeCtaSub:   { fontSize: 12, fontFamily: 'Inter_400Regular' },

  btnRow:       { flexDirection: 'row', gap: 8 },
  outlineBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  outlineBtnTxt:{ fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  fillBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  fillBtnTxt:   { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  lockNote:     { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  letterBadge:     { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  letterBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },

  // Info rows
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  infoIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoLabel:    { fontSize: 14, fontFamily: 'Inter_400Regular', width: 110 },
  infoValue:    { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'right' },
});

// ── Page styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1 },
  loading:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroSection:  { height: 240, justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 24 },
  heroHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  iconBtn:      { width: 44, height: 44, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroBottom:   { gap: 8 },
  heroStationName: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText:   { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#ffffff' },
  ratingDot:    { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  pillsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill:         { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillText:     { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#ffffff' },
  content:      { padding: 16, gap: 16, marginTop: -20 },
  card:         { borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  statsRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statCol:      { flex: 1, alignItems: 'center', gap: 4 },
  statDivider:  { width: 1, height: 40 },
  statValue:    { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel:    { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statValueStrike: { fontSize: 14, fontFamily: 'Inter_500Medium', textDecorationLine: 'line-through' },
  priceRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  discountBadge:{ backgroundColor: '#EF4444', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  discountText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#ffffff' },

  // Amenity pills
  amenitiesWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freshness:       { alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 4 },
  freshnessText:   { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  reportBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12 },
  reportBtnText:   { fontSize: 13, fontFamily: 'Inter_500Medium' },
  amenityPill:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, height: 32 },
  amenityPillText: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  // Connectors
  cardHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle:        { fontSize: 17, fontFamily: 'Inter_700Bold' },
  gridWrap:         { flexDirection: 'row', flexWrap: 'wrap' },
  compactToggleRow: { marginBottom: 8 },
  compactToggleHint:{ fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },

  // Fallback connector row
  connectorRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: 1.5 },
  connectorTypeName:{ fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  // Cost table
  costRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  costMins:  { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  costKwh:   { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  costTotal: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },

  // Route button (bottom)
  footer:           { padding: 16, borderTopWidth: 1 },
  routeBtn:         { borderRadius: 16, overflow: 'hidden' },
  routeBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16, borderRadius: 16 },
  routeBtnText:     { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  routeBtnSub:      { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.75)', textAlign: 'center' },

  // Promo card
  promoCard:            { borderRadius: 20, padding: 18, marginBottom: 2, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8, overflow: 'hidden' },
  promoBadgesRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  promoTopBadge:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FBBF24', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  promoTopBadgeText:    { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#1E1B4B' },
  promoDiscBadge:       { backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  promoDiscText:        { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#fff' },
  promoPriceRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  promoPriceLabelSmall: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, marginBottom: 2 },
  promoOldPrice:        { fontFamily: 'Inter_700Bold', fontSize: 20, color: 'rgba(255,255,255,0.5)', textDecorationLine: 'line-through' },
  promoNewPrice:        { fontFamily: 'Inter_700Bold', fontSize: 32, color: '#fff', lineHeight: 38 },
  promoUnit:            { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 14 },
  promoSavingsBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 14 },
  promoSavingsText:     { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#92400E' },
  promoCountdownRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  promoCountdownLabel:  { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 },

  // Modal
  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:          { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, gap: 14 },
  modalHandle:         { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modalTitle:          { fontSize: 20, fontFamily: 'Inter_700Bold' },
  modalSub:            { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: -6 },
  cardOption:          { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: 1.5 },
  cardEmoji:           { fontSize: 24 },
  cardInfo:            { flex: 1 },
  cardLabel:           { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cardSuffix:          { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  cardCheck:           { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  modalActions:        { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancelBtn:      { paddingHorizontal: 20, paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalCancelText:     { fontSize: 15, fontFamily: 'Inter_500Medium' },
  modalConfirmGradient:{ paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  modalConfirmText:    { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
