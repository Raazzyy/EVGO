/**
 * StationQuickView — bottom-card modal shown on first pin tap.
 * Single component for both native and web (no Callout / Leaflet tooltip).
 */
import React, { useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { ConnectorBadge } from '@/components/ConnectorBadge';

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
  userLocation?: { lat: number; lng: number } | null;
  onClose: () => void;
  onOpenFull: () => void;   // header tap or hint tap → /station/:id
  onNavigate: () => void;   // "Маршрут" → /route/new
  onCharge: () => void;     // "Зарядиться" → /station/:id
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
  I: ['#0EA5E9', '#0284C7'],
  K: ['#F59E0B', '#D97706'],
  C: ['#10B981', '#059669'],
  T: ['#8B5CF6', '#7C3AED'],
  M: ['#2563EB', '#1D4ED8'],
  U: ['#EF4444', '#DC2626'],
  B: ['#EC4899', '#DB2777'],
  G: ['#14B8A6', '#0D9488'],
  S: ['#64748B', '#475569'],
};

function getOpColors(name?: string | null): [string, string] {
  const init = name?.charAt(0).toUpperCase() ?? 'i';
  return OPERATOR_COLORS[init] ?? ['#6366F1', '#4F46E5'];
}

// ── Component ─────────────────────────────────────────────────────────────

export function StationQuickView({
  station,
  userLocation,
  onClose,
  onOpenFull,
  onNavigate,
  onCharge,
}: StationQuickViewProps) {
  const colors = useColors();
  const slideAnim = useRef(new Animated.Value(320)).current;

  // Slide up when station appears, snap back instantly on close
  useEffect(() => {
    if (station) {
      slideAnim.setValue(320);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 11,
      }).start();
    }
  }, [station?.id]);

  const connectors: Connector[] = (station?.connectors as Connector[] | null) ?? [];
  const totalAvail  = connectors.reduce((s, c) => s + c.available, 0);
  const totalConns  = connectors.reduce((s, c) => s + c.total, 0);

  const hasDC = connectors.some(c => ['CCS2', 'CHAdeMO', 'GB-T'].includes(c.type));
  const chargeType = hasDC ? 'DC' : 'AC';
  const firstType  = connectors[0]?.type ?? 'CCS2';

  const operatorName = station?.operator?.name ?? null;
  const [gradStart, gradEnd] = getOpColors(operatorName);
  const initial = operatorName?.charAt(0).toUpperCase() ?? 'i';

  const rating = station?.rating ?? (station?.is_promoted ? 4.8 : null);

  const discountPct = station?.discount_pct ?? 0;
  const originalPrice = discountPct > 0 && station
    ? Math.round(station.price_per_kwh / (1 - discountPct / 100))
    : null;

  const distKm = useMemo(() => {
    if (!userLocation || !station) return null;
    return haversineKm(userLocation.lat, userLocation.lng, station.lat, station.lng);
  }, [userLocation, station?.id]);

  const distMins = distKm != null ? Math.max(1, Math.round((distKm / 30) * 60)) : null;

  const statusColor =
    station?.status === 'free'     ? '#10B981' :
    station?.status === 'occupied' ? '#F59E0B' : '#94A3B8';

  const statusText =
    station?.status === 'free'     ? 'Можно начать зарядку' :
    station?.status === 'occupied' ? 'Станция занята' : 'Станция недоступна';

  const statusIcon =
    station?.status === 'free'     ? 'check-circle' :
    station?.status === 'occupied' ? 'clock' : 'wifi-off';

  if (!station) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop — tap to close */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

      {/* Card */}
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: colors.card },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* ── Header: avatar + name + rating ────────────────────────── */}
        <TouchableOpacity
          onPress={onOpenFull}
          activeOpacity={0.75}
          style={styles.header}
        >
          <LinearGradient
            colors={[gradStart, gradEnd]}
            style={styles.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>

          <View style={styles.headerInfo}>
            <Text style={[styles.stationName, { color: colors.text }]} numberOfLines={1}>
              {station.name}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {chargeType === 'DC' ? 'Быстрая зарядка' : 'Медленная зарядка'} · {chargeType} · {firstType}
            </Text>
          </View>

          {rating != null && (
            <View style={styles.ratingBadge}>
              <Feather name="star" size={13} color="#F59E0B" />
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

        {/* ── Power + Availability ─────────────────────────────────────── */}
        <View style={styles.infoRow}>
          <View style={[styles.powerBadge, { backgroundColor: '#EFF6FF' }]}>
            <Feather name="zap" size={11} color="#2563EB" />
            <Text style={styles.powerText}>{station.power_kw} кВт</Text>
          </View>

          <View style={styles.availRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.availText, { color: statusColor }]}>
              {totalAvail}/{totalConns} доступно
            </Text>
          </View>
        </View>

        {/* ── Price + Distance ─────────────────────────────────────────── */}
        <View style={styles.priceRow}>
          <View style={styles.priceLeft}>
            {originalPrice != null && (
              <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
                {originalPrice.toLocaleString('ru-RU')}
              </Text>
            )}
            <Text style={[styles.priceMain, { color: colors.text }]}>
              {station.price_per_kwh.toLocaleString('ru-RU')}
              <Text style={[styles.priceUnit, { color: colors.mutedForeground }]}> сум/кВт·ч</Text>
            </Text>
            {discountPct > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>−{discountPct}%</Text>
              </View>
            )}
          </View>

          {distKm != null && (
            <TouchableOpacity onPress={onOpenFull} style={styles.distanceRight}>
              <Feather name="navigation" size={12} color={colors.primary} />
              <Text style={[styles.distanceText, { color: colors.primary }]}>
                {distKm < 1
                  ? `${Math.round(distKm * 1000)} м`
                  : `${distKm.toFixed(1)} км`}
                {distMins != null ? ` · ${distMins} мин` : ''}
              </Text>
              <Feather name="chevron-right" size={12} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Status line ─────────────────────────────────────────────── */}
        <View style={styles.statusRow}>
          <Feather name={statusIcon as any} size={15} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>

        {/* ── CTA buttons ─────────────────────────────────────────────── */}
        <View style={styles.ctaRow}>
          {/* Маршрут — outline */}
          <TouchableOpacity
            onPress={onNavigate}
            activeOpacity={0.8}
            style={[styles.routeBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Feather name="navigation" size={15} color={colors.text} />
            <Text style={[styles.routeBtnText, { color: colors.text }]}>Маршрут</Text>
          </TouchableOpacity>

          {/* Зарядиться — gradient */}
          <TouchableOpacity
            onPress={onCharge}
            activeOpacity={0.85}
            style={styles.chargeBtnWrap}
            disabled={station.status === 'offline'}
          >
            <LinearGradient
              colors={station.status === 'offline' ? ['#94A3B8', '#94A3B8'] : ['#2563EB', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.chargeBtn}
            >
              <Feather name="zap" size={15} color="#fff" />
              <Text style={styles.chargeBtnText}>Зарядиться</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Hint ────────────────────────────────────────────────────── */}
        <TouchableOpacity onPress={onOpenFull} activeOpacity={0.6}>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Повторное нажатие — открыть станцию
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const CARD_MAX_W = 480; // cap width on wide web screens

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 90 : 100,  // sit above tab bar
    left: Platform.OS === 'web' ? undefined : 12,
    right: Platform.OS === 'web' ? undefined : 12,
    alignSelf: Platform.OS === 'web' ? 'center' : undefined,
    width: Platform.OS === 'web' ? Math.min(CARD_MAX_W, 420) : undefined,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 24,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  stationName: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    flexShrink: 0,
  },
  ratingText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#92400E',
  },
  // Connectors
  connectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  // Power + availability
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  powerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  powerText: {
    color: '#2563EB',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  availText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  // Price row
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  oldPrice: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textDecorationLine: 'line-through',
  },
  priceMain: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  priceUnit: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  discountBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountText: {
    color: '#EF4444',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  distanceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  // Status line
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  statusText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  // CTAs
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  routeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  routeBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  chargeBtnWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  chargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
  },
  chargeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  // Hint
  hint: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
