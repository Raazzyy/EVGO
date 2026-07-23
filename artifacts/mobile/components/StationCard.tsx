import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';

interface Connector {
  type: string;
  power_kw: number;
  total: number;
  available: number;
}

interface StationCardProps {
  station: {
    id: number;
    name: string;
    address: string;
    power_kw: number;
    price_per_kwh: number;
    status: 'free' | 'occupied' | 'offline';
    connectors?: Connector[] | null;
    distance_km?: number | null;
    operator?: { name: string } | null;
    rating?: number | null;
    source?: string | null;
  };
  onPress: () => void;
  compact?: boolean;
  discount_pct?: number;
  is_promoted?: boolean;
  amenities?: string[] | null;
  onRoute?: () => void;
}

// ── Operator avatar colours ───────────────────────────────────────────────
const OPERATOR_COLORS: Record<string, [string, string]> = {
  I: ['#0EA5E9', '#0284C7'],
  K: ['#F59E0B', '#D97706'],
  C: ['#10B981', '#059669'],
  T: ['#8B5CF6', '#7C3AED'],
  U: ['#EF4444', '#DC2626'],
  B: ['#EC4899', '#DB2777'],
  G: ['#14B8A6', '#0D9488'],
};
function operatorColors(name?: string | null): [string, string] {
  return OPERATOR_COLORS[name?.charAt(0).toUpperCase() ?? ''] ?? ['#6366F1', '#4F46E5'];
}

function chargeType(connectors: Connector[]): 'DC' | 'AC' {
  const DC = ['CCS2', 'CHAdeMO', 'GB/T', 'Tesla'];
  return connectors.some(c => DC.includes(c.type)) ? 'DC' : 'AC';
}

function formatDist(km?: number | null): string | null {
  if (km == null || km <= 0) return null;
  return km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1)} км`;
}

// ── Amenity icon map ──────────────────────────────────────────────────────
const AMENITY_ICONS: Record<string, { icon: string; label: string }> = {
  wifi:          { icon: 'wifi',        label: 'Wi-Fi' },
  '24/7':        { icon: 'clock',       label: '24/7' },
  coffee:        { icon: 'coffee',      label: 'Кофе' },
  toilet:        { icon: 'home',        label: 'Туалет' },
  parking:       { icon: 'map-pin',     label: 'Парковка' },
  shop:          { icon: 'shopping-bag',label: 'Магазин' },
  clean:         { icon: 'star',        label: 'Чистая зона' },
};

function amenityInfo(key: string) {
  return AMENITY_ICONS[key.toLowerCase()] ?? { icon: 'check-circle', label: key };
}

// ─────────────────────────────────────────────────────────────────────────
export function StationCard({
  station,
  onPress,
  compact = false,
  discount_pct = 0,
  is_promoted = false,
  amenities,
  onRoute,
}: StationCardProps) {
  const colors = useColors();
  const connectors: Connector[] = (station.connectors as Connector[] | null) ?? [];

  const totalSlots     = connectors.reduce((s, c) => s + (c.total ?? 1), 0) || 1;
  const availableSlots = connectors.reduce((s, c) => s + (c.available ?? 0), 0);
  const primaryType    = connectors[0]?.type ?? 'CCS2';
  const ct             = chargeType(connectors);

  const [grad1, grad2] = operatorColors(station.operator?.name);
  const initial        = station.operator?.name?.charAt(0).toUpperCase() ?? 'i';

  const originalPrice  = discount_pct > 0
    ? Math.round(station.price_per_kwh / (1 - discount_pct / 100))
    : null;
  const savingsPerKwh  = originalPrice ? originalPrice - station.price_per_kwh : 0;

  const statusColor    =
    station.status === 'free'     ? '#10B981'
    : station.status === 'occupied' ? '#F59E0B'
    : '#94A3B8';

  const distLabel = formatDist(station.distance_km);
  const rating    = station.rating ?? (is_promoted ? 4.8 : null);

  // Amenities list (max 4 shown)
  const amenityList: string[] = Array.isArray(amenities)
    ? (amenities as any[]).map(a => typeof a === 'string' ? a : String(a)).slice(0, 4)
    : [];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        styles.card,
        compact && styles.cardCompact,
        is_promoted && styles.cardPromoted,
      ]}
    >
      {/* ── TOP BADGE: ТОП СТАНЦИЯ ──────────────────────────────────── */}
      {!!is_promoted && (
        <View style={[styles.topBadgeWrap, { pointerEvents: 'none' }]}>
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.topBadge}
          >
            <Feather name="award" size={10} color="#fff" />
            <Text style={styles.topBadgeText}>ТОП СТАНЦИЯ</Text>
          </LinearGradient>
        </View>
      )}

      {/* ── DISCOUNT corner badge ─────────────────────────────────────── */}
      {discount_pct > 0 && (
        <View style={[styles.discCornerWrap, { pointerEvents: 'none' }]}>
          <View style={styles.discCorner}>
            <Text style={styles.discCornerText}>-{discount_pct}%</Text>
          </View>
        </View>
      )}

      {/* ── ROW 1: avatar + name + favourite ─────────────────────────── */}
      <View style={styles.row1}>
        <LinearGradient colors={[grad1, grad2]} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.avatarText}>{initial}</Text>
        </LinearGradient>

        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{station.name}</Text>
            {station.source === 'mock' && (
              <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>демо</Text></View>
            )}
          </View>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {ct === 'DC' ? 'Быстрая зарядка' : 'Медленная зарядка'} · {ct} · {primaryType}
          </Text>
        </View>

        {/* Favourite icon */}
        <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }} style={styles.favBtn}>
          <Feather name="heart" size={16} color={is_promoted ? '#F59E0B' : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* ── ROW 2: chip row ──────────────────────────────────────────── */}
      <View style={styles.chipRow}>
        {/* Power chip */}
        <View style={[styles.chip, { backgroundColor: '#EFF6FF' }]}>
          <Feather name="zap" size={11} color="#2563EB" />
          <Text style={[styles.chipText, { color: '#2563EB' }]}>{station.power_kw} кВт</Text>
        </View>

        {/* Availability chip */}
        <View style={[styles.chip, { backgroundColor: `${statusColor}18` }]}>
          <View style={[styles.chipDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.chipText, { color: statusColor }]}>
            {availableSlots}/{totalSlots} свободно
          </Text>
        </View>

        {/* Rating chip — only promoted */}
        {!!rating && (
          <View style={[styles.chip, { backgroundColor: '#FFFBEB' }]}>
            <Feather name="star" size={11} color="#F59E0B" />
            <Text style={[styles.chipText, { color: '#D97706' }]}>{rating}</Text>
          </View>
        )}
      </View>

      {/* ── PRICE BLOCK ──────────────────────────────────────────────── */}
      <View style={styles.priceBlock}>
        {originalPrice ? (
          <>
            <Text style={styles.oldPrice}>{originalPrice.toLocaleString('ru-RU')}</Text>
            <Text style={styles.newPrice}>{station.price_per_kwh.toLocaleString('ru-RU')}</Text>
            <Text style={styles.priceUnit}> сум/кВт·ч</Text>
          </>
        ) : (
          <>
            <Text style={[styles.price, { color: colors.text }]}>{station.price_per_kwh.toLocaleString('ru-RU')}</Text>
            <Text style={[styles.priceUnit, { color: colors.mutedForeground }]}> сум/кВт·ч</Text>
          </>
        )}
      </View>

      {/* Savings strip — only when discount */}
      {savingsPerKwh > 0 && (
        <View style={styles.savingsStrip}>
          <Feather name="tag" size={12} color="#92400E" />
          <Text style={styles.savingsText}>
            Экономия {savingsPerKwh.toLocaleString('ru-RU')} сум с кВт·ч
          </Text>
        </View>
      )}

      {/* ── CTA: full-width route button ─────────────────────────────── */}
      <TouchableOpacity onPress={onRoute ?? onPress} activeOpacity={0.85} style={styles.ctaWrap}>
        <LinearGradient
          colors={['#2563EB', '#7C3AED']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.ctaBtn}
        >
          <Feather name="navigation" size={14} color="#fff" />
          <Text style={styles.ctaText}>
            Маршрут{distLabel ? `  ·  ${distLabel}` : ''}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── AMENITY chips row — full card only ───────────────────────── */}
      {!compact && amenityList.length > 0 && (
        <View style={styles.amenityRow}>
          {amenityList.map((a) => {
            const { icon, label } = amenityInfo(a);
            return (
              <View key={a} style={[styles.amenityChip, { backgroundColor: colors.muted }]}>
                <Feather name={icon as any} size={10} color={colors.mutedForeground} />
                <Text style={[styles.amenityText, { color: colors.mutedForeground }]}>{label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  cardCompact: {
    // Compact for horizontal promo slider — fixed width handled by parent
    marginBottom: 0,
  },
  cardPromoted: {
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },

  // TOP BADGE
  topBadgeWrap: {
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  topBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },

  // DISCOUNT CORNER
  discCornerWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },
  discCorner: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 18,
  },
  discCornerText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },

  // ROW 1
  row1: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
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
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  nameBlock: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  favBtn: {
    padding: 4,
    flexShrink: 0,
  },
  demoBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  demoBadgeText: {
    color: '#92400E',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },

  // CHIP ROW
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },

  // PRICE BLOCK
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  oldPrice: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  newPrice: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#10B981',
  },
  price: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  priceUnit: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#94A3B8',
  },

  // SAVINGS STRIP
  savingsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  savingsText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#92400E',
  },

  // CTA
  ctaWrap: {
    marginBottom: 10,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },

  // AMENITY ROW
  amenityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  amenityText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
});
