/**
 * StationQuickView — popup anchored above (or below) the tapped map marker.
 * Rendered as an absolutely-positioned overlay inside the map container.
 * No Modal / bottom sheet — touches outside the card pass through to the map.
 */
import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { ConnectorBadge } from '@/components/ConnectorBadge';
import { formatAmount } from '@/lib/format';
import { haptics } from '@/lib/haptics';

// ── Layout constants ──────────────────────────────────────────────────────
const CARD_W     = 300;
const TAIL_HALF  = 10;   // half of tail base width
const TAIL_H     = 10;   // tail height
const MARGIN     = 12;   // min distance from screen edge
const PIN_GAP    = 20;   // gap between marker centre and tail tip (≈ marker radius + a bit)
const TOP_SAFE   = 130;  // approx height of top bar + filter chips — don't go above this

// ── Types ─────────────────────────────────────────────────────────────────

interface Connector {
  type: string;
  power_kw: number;
  available: number;
  total: number;
}

export interface QuickViewStation {
  id: number;
  name: string;
  lat: number;
  lng: number;
  status: string;
  power_kw: number;
  price_per_kwh: number;
  connectors?: Connector[] | null;
  operator?: { name: string } | null;
  rating?: number | null;
  is_promoted?: boolean;
  discount_pct?: number;
  address?: string;
}

interface StationQuickViewProps {
  station: QuickViewStation | null;
  /** Pixel coords of the marker centre in the parent container's coordinate space. */
  position: { x: number; y: number } | null;
  userLocation?: { lat: number; lng: number } | null;
  onClose: () => void;
  onOpenFull: () => void;
  onNavigate: () => void;
  onCharge: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function haversineKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371;
  const dLat = (la2 - la1) * (Math.PI / 180);
  const dLon = (lo2 - lo1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const OPERATOR_COLORS: Record<string, [string, string]> = {
  I: ['#0EA5E9', '#0284C7'], K: ['#F59E0B', '#D97706'], C: ['#10B981', '#059669'],
  T: ['#8B5CF6', '#7C3AED'], M: ['#2563EB', '#1D4ED8'], U: ['#EF4444', '#DC2626'],
  B: ['#EC4899', '#DB2777'], G: ['#14B8A6', '#0D9488'], S: ['#64748B', '#475569'],
};

function getOpColors(name?: string | null): [string, string] {
  return OPERATOR_COLORS[name?.charAt(0).toUpperCase() ?? ''] ?? ['#6366F1', '#4F46E5'];
}

// ── Component ─────────────────────────────────────────────────────────────

export function StationQuickView({
  station,
  position,
  userLocation,
  onClose,
  onOpenFull,
  onNavigate,
  onCharge,
}: StationQuickViewProps) {
  const colors = useColors();
  const popScale      = useSharedValue(0.88);
  const popOpacity    = useSharedValue(0);
  const panY          = useSharedValue(0);
  const cardHeightRef = useRef(280);

  // Pop-in when station or position appears
  useEffect(() => {
    if (station && position) {
      popScale.value   = 0.88;
      popOpacity.value = 0;
      panY.value       = 0;
      popScale.value   = withSpring(1, { damping: 12, stiffness: 150 });
      popOpacity.value = withTiming(1, { duration: 130 });
    }
  }, [station?.id]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity:   popOpacity.value,
    transform: [{ scale: popScale.value }, { translateY: panY.value }],
  }));

  // Swipe-down to close
  const handleClose = useCallback(onClose, [onClose]);
  const swipeGesture = useMemo(() => Gesture.Pan()
    .activeOffsetY([0, 8])
    .failOffsetX([-25, 25])
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) panY.value = e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 60 || e.velocityY > 600) {
        panY.value = withTiming(300, { duration: 180 });
        runOnJS(handleClose)();
      } else {
        panY.value = withSpring(0, { damping: 15, stiffness: 120 });
      }
    })
  , [handleClose]);

  // ── Derived data ──────────────────────────────────────────────────────
  const connectors: Connector[] = (station?.connectors as Connector[] | null) ?? [];
  // Use connectors_detail if available (from GET /stations/:id)
  const connectorsDetail: any[] = (station as any)?.connectors_detail ?? [];
  const hasDC      = connectors.some(c => ['CCS2', 'CHAdeMO', 'GB-T'].includes(c.type));
  const chargeType = hasDC ? 'DC' : 'AC';
  const firstType  = connectors[0]?.type ?? 'CCS2';
  // Live counts from detail if available, else from jsonb
  const freeCount = connectorsDetail.length > 0
    ? connectorsDetail.filter((c: any) => c.status === 'free').length
    : connectors.reduce((s, c) => s + c.available, 0);
  const occupiedCount = connectorsDetail.length > 0
    ? connectorsDetail.filter((c: any) => c.status === 'occupied').length
    : connectors.reduce((s, c) => s + (c.total - c.available), 0);
  const totalConns = connectorsDetail.length > 0
    ? connectorsDetail.length
    : connectors.reduce((s, c) => s + c.total, 0);

  const operatorName   = station?.operator?.name ?? null;
  const [gradStart, gradEnd] = getOpColors(operatorName);
  const initial        = operatorName?.charAt(0).toUpperCase() ?? 'i';
  const rating         = station?.rating ?? (station?.is_promoted ? 4.8 : null);
  const discountPct    = station?.discount_pct ?? 0;
  const originalPrice  = discountPct > 0 && station
    ? Math.round(station.price_per_kwh / (1 - discountPct / 100)) : null;

  const distKm = useMemo(() => {
    if (!userLocation || !station) return null;
    return haversineKm(userLocation.lat, userLocation.lng, station.lat, station.lng);
  }, [userLocation, station?.id]);
  const distMins = distKm != null ? Math.max(1, Math.round((distKm / 30) * 60)) : null;

  const statusColor =
    station?.status === 'free'     ? '#10B981' :
    station?.status === 'occupied' ? '#F59E0B' : '#94A3B8';
  const statusText  =
    station?.status === 'free'     ? 'Можно зарядить' :
    station?.status === 'occupied' ? 'Занята' : 'Оффлайн';

  if (!station || !position) return null;

  // ── Layout computation ────────────────────────────────────────────────
  const { width: screenW } = Dimensions.get('window');

  // Clamp card horizontally so it stays inside the screen
  const cardLeft = Math.max(
    MARGIN,
    Math.min(screenW - CARD_W - MARGIN, position.x - CARD_W / 2),
  );

  // Show card above pin if there's enough room
  const cardH       = cardHeightRef.current;
  const aboveTop    = position.y - cardH - TAIL_H - PIN_GAP;
  const showAbove   = aboveTop >= TOP_SAFE;
  const cardTop     = showAbove
    ? aboveTop
    : position.y + PIN_GAP;

  // Tail horizontal position relative to card left — keep tail within card bounds
  const tailRaw    = position.x - cardLeft - TAIL_HALF;
  const tailLeft   = Math.max(TAIL_HALF * 2, Math.min(CARD_W - TAIL_HALF * 4, tailRaw));

  // ── Render ────────────────────────────────────────────────────────────
  return (
    // Wrapper: fills the container, passes touches through in empty areas
    <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'box-none' }]}>
      <GestureDetector gesture={swipeGesture}>
        <Animated.View
        onLayout={(e) => { cardHeightRef.current = e.nativeEvent.layout.height; }}
        style={[
          styles.card,
          { backgroundColor: colors.card, left: cardLeft, top: cardTop, width: CARD_W },
          cardAnimStyle,
          { pointerEvents: 'auto' },
        ]}
      >
        {/* Upward tail (when card is below the pin) */}
        {!showAbove && (
          <View style={[styles.tailUp, { left: tailLeft, borderBottomColor: colors.card }]} />
        )}

        {/* ── Header ──────────────────────────────────────────────────── */}
        <TouchableOpacity onPress={onOpenFull} activeOpacity={0.75} style={styles.header}>
          <LinearGradient colors={[gradStart, gradEnd]} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stationName, { color: colors.text }]} numberOfLines={1}>
              {station.name}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {chargeType} · {firstType}
            </Text>
          </View>
          {rating != null && (
            <View style={styles.ratingBadge}>
              <Feather name="star" size={11} color="#F59E0B" />
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Connector badges ─────────────────────────────────────────── */}
        {connectors.length > 0 && (
          <View style={styles.connectorRow}>
            {connectors.map((c, i) => (
              <ConnectorBadge key={i} type={c.type} powerKw={c.power_kw} />
            ))}
          </View>
        )}

        {/* ── Stats row: power · available · distance ─────────────────── */}
        <View style={styles.statsRow}>
          <View style={[styles.badge, { backgroundColor: '#EFF6FF' }]}>
            <Feather name="zap" size={10} color="#2563EB" />
            <Text style={[styles.badgeText, { color: '#2563EB' }]}>{station.power_kw} кВт</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor + '18' }]}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {freeCount}/{totalConns} · {statusText}
            </Text>
          </View>
          {distKm != null && (
            <Text style={[styles.distText, { color: colors.mutedForeground }]}>
              {distKm < 1 ? `${Math.round(distKm * 1000)} м` : `${distKm.toFixed(1)} км`}
              {distMins ? ` · ${distMins} мин` : ''}
            </Text>
          )}
        </View>

        {/* ── Price ───────────────────────────────────────────────────── */}
        <View style={styles.priceRow}>
          {originalPrice != null && (
            <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
              {formatAmount(originalPrice)}
            </Text>
          )}
          <Text style={[styles.price, { color: colors.text }]}>
            {formatAmount(station.price_per_kwh)}
            <Text style={[styles.priceUnit, { color: colors.mutedForeground }]}> сум/кВт·ч</Text>
          </Text>
          {discountPct > 0 && (
            <View style={styles.discBadge}>
              <Text style={styles.discText}>−{discountPct}%</Text>
            </View>
          )}
        </View>

        {/* ── CTA buttons ─────────────────────────────────────────────── */}
        <View style={styles.ctaRow}>
          <TouchableOpacity
            onPress={() => { haptics.tap(); onNavigate(); }}
            activeOpacity={0.8}
            style={[styles.routeBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
          >
            <Feather name="navigation" size={13} color={colors.text} />
            <Text style={[styles.routeBtnText, { color: colors.text }]}>Маршрут</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { haptics.medium(); onCharge(); }}
            activeOpacity={0.85}
            disabled={station.status === 'offline'}
            style={styles.chargeBtnWrap}
          >
            <LinearGradient
              colors={station.status === 'offline' ? ['#94A3B8', '#94A3B8'] : ['#2563EB', '#7C3AED']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.chargeBtn}
            >
              <Feather name="zap" size={13} color="#fff" />
              <Text style={styles.chargeBtnText}>Зарядиться</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Hint ────────────────────────────────────────────────────── */}
        <TouchableOpacity onPress={onOpenFull} activeOpacity={0.6}>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Нажмите снова — открыть станцию
          </Text>
        </TouchableOpacity>

        {/* Downward tail (when card is above the pin) */}
        {showAbove && (
          <View style={[styles.tailDown, { left: tailLeft, borderTopColor: colors.card }]} />
        )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 24,
  },
  // Tail pointing downward (card above pin)
  tailDown: {
    position: 'absolute',
    bottom: -TAIL_H,
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_HALF,
    borderRightWidth: TAIL_HALF,
    borderTopWidth: TAIL_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    // borderTopColor set dynamically
  },
  // Tail pointing upward (card below pin)
  tailUp: {
    position: 'absolute',
    top: -TAIL_H,
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_HALF,
    borderRightWidth: TAIL_HALF,
    borderBottomWidth: TAIL_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    // borderBottomColor set dynamically
  },
  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  stationName: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#FEF9C3', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, flexShrink: 0,
  },
  ratingText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#92400E' },
  // Connectors
  connectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  // Stats
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  distText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  // Price
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10, flexWrap: 'wrap' },
  oldPrice: { fontSize: 12, fontFamily: 'Inter_400Regular', textDecorationLine: 'line-through' },
  price: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  priceUnit: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  discBadge: { backgroundColor: '#FEF2F2', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  discText: { color: '#EF4444', fontSize: 10, fontFamily: 'Inter_700Bold' },
  // CTAs
  ctaRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  routeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  routeBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  chargeBtnWrap: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  chargeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10,
  },
  chargeBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  // Hint
  hint: { textAlign: 'center', fontSize: 11, fontFamily: 'Inter_400Regular' },
});
