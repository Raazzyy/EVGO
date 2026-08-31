import React, {
  useRef, useState, useMemo, useEffect, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TextInput,
  TouchableOpacity, Pressable, Platform,
  Dimensions, Linking, ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
  FadeInDown, FadeInRight, Layout, interpolate, Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useGetStations, useGetUserVehicles } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { StationCard } from '@/components/StationCard';
import { MapViewWrapper, MapApi } from '@/components/MapViewWrapper';
import { FiltersSheet, FiltersState } from '@/components/FiltersSheet';
import { StationQuickView, type QuickViewStation } from '@/components/StationQuickView';
import { LinearGradient } from 'expo-linear-gradient';
import { Glass } from '@/components/Glass';
import { formatPricePerKwh } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { DEMO_STATIONS, DEMO_PROMOTED } from '@/lib/demoStations';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Snap system ─────────────────────────────────────────────────────────────
const SHEET_MIN = 190;
const IOS_EASE = Easing.bezier(0.25, 0.46, 0.45, 0.94);
const STATUS_ORDER: Record<string, number> = { free: 0, occupied: 1, offline: 2 };
const DC_TYPES = ['CCS2', 'CHAdeMO', 'GB/T', 'GB-T', 'DC'];
const AC_TYPES = ['Type2', 'Type 2', 'AC'];

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type FilterStatus = 'all' | 'my-cars' | 'ac' | 'dc' | 'free';

const DEFAULT_FILTERS: FiltersState = {
  connectorTypes: [], availability: 'all', amenities: [],
  minPowerKw: 3, maxPowerKw: 350, maxPriceSum: 5000, vehicleId: null,
};

// ── Banner system ─────────────────────────────────────────────────────────────
const BANNER_H        = Math.round(SCREEN_HEIGHT * 0.15);
const BANNER_INTERVAL = 5000;
const BANNER_RESUME   = 10000;

interface BannerItem {
  id:              string;
  badge:           string;
  badgeIcon:       'zap' | 'clock' | 'moon' | 'navigation' | 'percent' | 'star';
  title:           string;
  subtitle:        string;
  gradient:        [string, string, ...string[]];
  showCountdown:   boolean;
  countdownEndsAt?: Date | null;
  ctaText:         string;
  stationId?:      number;
}

// Фирменная палитра баннеров: тёмно-синий → индиго → фиолетовый.
// Раньше здесь были кричащие красно-оранжевые «MEGA SALE» градиенты —
// они конфликтовали с сине-фиолетовым брендом и читались как реклама
// маркетплейса, а не как утилита для зарядки. Скидка осталась, но подача
// теперь спокойная и премиальная.
const STATIC_BANNERS: BannerItem[] = [
  {
    id: 'static-1', badge: 'СКИДКА', badgeIcon: 'percent',
    title: 'Выгодно сегодня · −30%', subtitle: 'на быструю зарядку · весь день',
    gradient: ['#1E1B4B', '#4338CA', '#7C3AED'],
    showCountdown: false, ctaText: 'Маршрут',
  },
  {
    id: 'static-2', badge: 'ОГРАНИЧЕНО', badgeIcon: 'clock',
    title: 'Предложение дня · −20%', subtitle: 'ограниченное время · CCS2 / CHAdeMO',
    gradient: ['#0F172A', '#1E40AF', '#2563EB'],
    showCountdown: false, ctaText: 'Маршрут',
  },
  {
    id: 'static-3', badge: 'РЯДОМ С ВАМИ', badgeIcon: 'navigation',
    title: 'Ночной тариф 🌙', subtitle: 'DC до 150 кВт · выгодно ночью',
    gradient: ['#1E3A5F', '#2563EB', '#7C3AED'],
    showCountdown: false, ctaText: 'Маршрут',
  },
];

function makeBanners(stations: any[], userLocation: { lat: number; lng: number } | null): BannerItem[] {
  const result: BannerItem[] = [];

  // а) Максимальная скидка
  const maxDisc = [...stations.filter(s => s.discount_pct > 0)]
    .sort((a, b) => b.discount_pct - a.discount_pct)[0];
  if (maxDisc) {
    result.push({
      id: `mega-${maxDisc.id}`, badge: 'СКИДКА', badgeIcon: 'percent',
      title: `Выгодно · −${maxDisc.discount_pct}%`,
      subtitle: `${maxDisc.name} · ${maxDisc.address}`.slice(0, 46),
      gradient: ['#1E1B4B', '#4338CA', '#7C3AED'],
      showCountdown: !!maxDisc.promo_ends_at,
      countdownEndsAt: maxDisc.promo_ends_at ? new Date(maxDisc.promo_ends_at) : null,
      ctaText: 'Маршрут', stationId: maxDisc.id,
    });
  }

  // б) Ближайшая акция по времени окончания
  const soon = [...stations.filter(s => s.promo_ends_at && new Date(s.promo_ends_at) > new Date())]
    .sort((a, b) => new Date(a.promo_ends_at).getTime() - new Date(b.promo_ends_at).getTime())[0];
  if (soon && soon.id !== maxDisc?.id) {
    result.push({
      id: `flash-${soon.id}`, badge: 'ОГРАНИЧЕНО', badgeIcon: 'clock',
      title: `Предложение · −${soon.discount_pct}%`,
      subtitle: `${soon.name} · заканчивается скоро`,
      gradient: ['#0F172A', '#1E40AF', '#2563EB'],
      showCountdown: true, countdownEndsAt: new Date(soon.promo_ends_at),
      ctaText: 'Маршрут', stationId: soon.id,
    });
  }

  // в/г) Ближайшая промо-станция по расстоянию
  if (userLocation) {
    const nearby = [...stations.filter(s => s.is_promoted)]
      .map(s => ({ ...s, _d: haversine(userLocation.lat, userLocation.lng, s.lat, s.lng) }))
      .sort((a, b) => a._d - b._d)[0];
    if (nearby && nearby.id !== maxDisc?.id && nearby.id !== soon?.id) {
      result.push({
        id: `near-${nearby.id}`, badge: 'РЯДОМ С ВАМИ', badgeIcon: 'navigation',
        title: `Рядом · ${nearby.name}`.slice(0, 28),
        subtitle: `${(nearby._d * 1000).toFixed(0)} м · ${formatPricePerKwh(nearby.price_per_kwh)}`,
        gradient: ['#1E3A5F', '#2563EB', '#7C3AED'],
        showCountdown: false, ctaText: 'Маршрут', stationId: nearby.id,
      });
    }
  }

  return result.length > 0 ? result : STATIC_BANNERS;
}

// ── Countdown timer chip ───────────────────────────────────────────────────────
function Countdown({ endsAt }: { endsAt: Date }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = endsAt.getTime() - Date.now();
      if (diff <= 0) { setLabel('00:00:00'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setLabel(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!label) return null;
  return (
    <View style={bStyles.countdown}>
      <Feather name="clock" size={9} color="#FDE68A" />
      <Text style={bStyles.countdownText}>{label}</Text>
    </View>
  );
}

// ── Individual banner card ─────────────────────────────────────────────────────
function BannerCard({ banner, cardWidth, onPress }: { banner: BannerItem; cardWidth: number; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={{ width: cardWidth }}>
      <LinearGradient
        colors={banner.gradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[bStyles.card, { height: BANNER_H }]}
      >
        {/* Decorative circles */}
        <View style={bStyles.circle1} />
        <View style={bStyles.circle2} />
        {/* Big bg icon */}
        <Feather name="zap" size={BANNER_H * 0.75} color="rgba(255,255,255,0.07)"
          style={bStyles.bgIcon} />

        {/* Badge — top left */}
        <View style={bStyles.badge}>
          <Feather name={banner.badgeIcon} size={9} color="#1E293B" />
          <Text style={bStyles.badgeText}>{banner.badge}</Text>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Title + subtitle */}
        <Text style={bStyles.title} numberOfLines={1}>{banner.title}</Text>
        <Text style={bStyles.subtitle} numberOfLines={1}>{banner.subtitle}</Text>

        {/* Bottom row: countdown (left) + CTA (right) */}
        <View style={bStyles.bottomRow}>
          {banner.showCountdown && banner.countdownEndsAt
            ? <Countdown endsAt={banner.countdownEndsAt} />
            : <View />
          }
          <View style={bStyles.cta}>
            <Feather name="navigation" size={10} color="#1E293B" />
            <Text style={bStyles.ctaText}>{banner.ctaText}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Banner carousel ────────────────────────────────────────────────────────────
function BannerCarousel({ banners, cardWidth, onPress }: {
  banners: BannerItem[];
  cardWidth: number;
  onPress: (b: BannerItem) => void;
}) {
  const [current, setCurrent] = useState(0);
  const scrollRef   = useRef<ScrollView>(null);
  const autoTimer   = useRef<ReturnType<typeof setInterval>  | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouching  = useRef(false);

  const startAuto = useCallback(() => {
    if (autoTimer.current) clearInterval(autoTimer.current);
    autoTimer.current = setInterval(() => {
      if (isTouching.current || banners.length <= 1) return;
      setCurrent(prev => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * cardWidth, animated: true });
        return next;
      });
    }, BANNER_INTERVAL);
  }, [banners.length, cardWidth]);

  const pauseAuto = useCallback(() => {
    if (autoTimer.current) { clearInterval(autoTimer.current); autoTimer.current = null; }
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { isTouching.current = false; startAuto(); }, BANNER_RESUME);
  }, [startAuto]);

  useEffect(() => {
    startAuto();
    return () => {
      if (autoTimer.current)  clearInterval(autoTimer.current);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, [startAuto]);

  const onScrollEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    setCurrent(Math.round(e.nativeEvent.contentOffset.x / cardWidth));
  };

  if (banners.length === 0) return null;

  return (
    <View style={bStyles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollEndDrag={() => { isTouching.current = false; pauseAuto(); }}
        onMomentumScrollEnd={onScrollEnd}
        onTouchStart={() => { isTouching.current = true; pauseAuto(); }}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {banners.map(b => (
          <BannerCard key={b.id} banner={b} cardWidth={cardWidth} onPress={() => onPress(b)} />
        ))}
      </ScrollView>
      {banners.length > 1 && (
        <View style={bStyles.dots}>
          {banners.map((_, i) => (
            <View key={i} style={[bStyles.dot, i === current ? bStyles.dotActive : bStyles.dotInactive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const bStyles = StyleSheet.create({
  wrapper:  { marginBottom: 4 },
  card:     { borderRadius: 16, padding: 12, overflow: 'hidden', flexDirection: 'column' },
  // Decorative background
  circle1:  { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)', top: -30, right: -20 },
  circle2:  { position: 'absolute', width: 80,  height: 80,  borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.04)', top: 20,  right: 70 },
  bgIcon:   { position: 'absolute', right: -8, bottom: -8 },
  // Badge
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#FACC15', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#1E293B' },
  // Content
  title:       { color: '#FFFFFF', fontSize: 20, fontFamily: 'Inter_700Bold', lineHeight: 24, marginBottom: 2 },
  subtitle:    { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 6 },
  // Bottom row
  bottomRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countdown:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  countdownText: { color: '#FDE68A', fontSize: 13, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  // CTA
  cta:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FACC15', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  ctaText:     { color: '#1E293B', fontSize: 12, fontFamily: 'Inter_700Bold' },
  // Dots
  dots:        { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  dot:         { height: 4, borderRadius: 2 },
  dotActive:   { width: 16, backgroundColor: '#2563EB' },
  dotInactive: { width:  4, backgroundColor: '#CBD5E1' },
});

// ── Section header ───────────────────────────────────────────────────────────
function SectionHeader({
  title, badge, count, colors,
}: { title: string; badge?: string; count?: number; colors: ReturnType<typeof import('@/hooks/useColors').useColors> }) {
  return (
    <View style={secStyles.header}>
      <Text style={[secStyles.title, { color: colors.text }]}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {count != null && (
          <View style={[secStyles.countBadge, { backgroundColor: colors.muted }]}>
            <Text style={[secStyles.countText, { color: colors.mutedForeground }]}>{count}</Text>
          </View>
        )}
        {badge && (
          <View style={[secStyles.badge, { backgroundColor: colors.muted }]}>
            <Text style={[secStyles.badgeText, { color: colors.mutedForeground }]}>{badge}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const secStyles = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 12 },
  title:      { fontSize: 17, fontFamily: 'Inter_700Bold' },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText:  { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  badge:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText:  { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});

// ── Main component ────────────────────────────────────────────────────────────
export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapApi>(null);

  // ── Dynamic snap points ───────────────────────────────────────────────────
  // Leave ~80px map strip visible at top when fully open
  const SHEET_MAX = Math.round(SCREEN_HEIGHT - Math.max(insets.top, 20) - 80);
  const SHEET_MID = Math.round(SCREEN_HEIGHT * 0.55);
  const snapsRef  = useRef<[number, number, number]>([SHEET_MIN, SHEET_MID, SHEET_MAX]);
  snapsRef.current = [SHEET_MIN, SHEET_MID, SHEET_MAX];
  const snapToRef = useRef<(level: 0 | 1 | 2) => void>(() => {});

  // ── State ─────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeChip, setActiveChip] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [sheetAtTop, setSheetAtTop] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(false);
  const snapLevel = useRef<0 | 1 | 2>(0);

  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [markerPos, setMarkerPos] = useState<{ x: number; y: number } | null>(null);

  // ── Sheet animation ───────────────────────────────────────────────────────
  const sheetHeight  = useSharedValue(SHEET_MIN);
  const sheetStyle   = useAnimatedStyle(() => ({ height: sheetHeight.value }));
  // Shared values for RNGH worklets (must be shared values, not JS refs)
  const startHeight  = useSharedValue(SHEET_MIN);
  const snapLevelSV  = useSharedValue<0|1|2>(0);
  const sv_snapMin   = useSharedValue(SHEET_MIN);
  const sv_snapMid   = useSharedValue(SHEET_MID);
  const sv_snapMax   = useSharedValue(SHEET_MAX);

  const mapControlsStyle = useAnimatedStyle(() => {
    const h   = sheetHeight.value;
    const mid = SCREEN_HEIGHT * 0.55;
    const opacity = interpolate(h, [mid - 40, mid + 40], [1, 0], Extrapolation.CLAMP);
    return { bottom: h + 16, opacity };
  });

  // ── Snap helpers ──────────────────────────────────────────────────────────
  function animateTo(target: number, dur = 350) {
    sheetHeight.value = withTiming(target, { duration: dur, easing: IOS_EASE });
  }
  function snapTo(level: 0 | 1 | 2) {
    snapLevel.current = level;
    snapLevelSV.value = level;
    setSheetAtTop(level >= 1);
    setScrollEnabled(level === 2);
    animateTo(snapsRef.current[level]);
  }
  snapToRef.current = snapTo;

  // ── RNGH Gesture.Pan (replaces PanResponder) ─────────────────────────────
  // Keep snap-point shared values in sync with computed values
  useEffect(() => {
    sv_snapMid.value = SHEET_MID;
    sv_snapMax.value = SHEET_MAX;
  }, [SHEET_MID, SHEET_MAX]);

  // Called via runOnJS — safe for React state updates
  const doSnapJS = useCallback((level: 0|1|2) => {
    snapLevel.current = level;
    setSheetAtTop(level >= 1);
    setScrollEnabled(level === 2);
  }, []);

  const panGesture = useMemo(() => Gesture.Pan()
    .activeOffsetY([-10, 10])   // activate only on vertical intent
    .failOffsetX([-15, 15])     // fail on horizontal → lets inner h-scrolls win
    .onBegin(() => {
      'worklet';
      startHeight.value = sheetHeight.value;
    })
    .onUpdate((e) => {
      'worklet';
      const minH = sv_snapMin.value;
      const maxH = sv_snapMax.value;
      sheetHeight.value = Math.max(minH, Math.min(maxH, startHeight.value - e.translationY));
    })
    .onEnd((e) => {
      'worklet';
      const minH = sv_snapMin.value;
      const midH = sv_snapMid.value;
      const maxH = sv_snapMax.value;
      const h   = sheetHeight.value;
      const vy  = e.velocityY;
      let level: 0|1|2;
      let target: number;
      if (vy < -500)      { level = 2; target = maxH; }
      else if (vy > 500)  { level = 0; target = minH; }
      else {
        const snaps = [minH, midH, maxH];
        const nearest = snaps.reduce((p, c) => Math.abs(c - h) < Math.abs(p - h) ? c : p);
        level  = snaps.indexOf(nearest) as 0|1|2;
        target = nearest;
      }
      sheetHeight.value = withTiming(target, { duration: 350, easing: IOS_EASE });
      snapLevelSV.value = level;
      runOnJS(doSnapJS)(level);
    })
  , [doSnapJS]);

  const tapGesture = useMemo(() => Gesture.Tap()
    .onEnd(() => {
      'worklet';
      const next   = ((snapLevelSV.value + 1) % 3) as 0|1|2;
      const target = [sv_snapMin.value, sv_snapMid.value, sv_snapMax.value][next]!;
      sheetHeight.value = withTiming(target, { duration: 350, easing: IOS_EASE });
      snapLevelSV.value = next;
      runOnJS(doSnapJS)(next);
    })
  , [doSnapJS]);

  const handleGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  // ── Geolocation ───────────────────────────────────────────────────────────
  useEffect(() => {
    const TASHKENT = { lat: 41.2995, lng: 69.2401 };
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationPermissionDenied(true);
          setUserLocation(TASHKENT);
          return;
        }
        setLocationPermissionDenied(false);
        let loc: Location.LocationObject | null = null;
        try {
          loc = await Promise.race<Location.LocationObject>([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('gps_timeout')), 8_000)),
          ]);
        } catch {
          loc = await Location.getLastKnownPositionAsync().catch(() => null);
        }
        setUserLocation(loc ? { lat: loc.coords.latitude, lng: loc.coords.longitude } : TASHKENT);
      } catch {
        setUserLocation(TASHKENT);
      }
    })();
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { selectedVehicleId, userId } = useApp();
  const { data: userVehicles = [] } = useGetUserVehicles(userId);
  const defaultUserVehicle = userVehicles.find(uv => uv.id === selectedVehicleId) ?? userVehicles[0];
  const defaultConnectorType = defaultUserVehicle?.vehicle?.connector_type;

  // Stop station polling when the tab is not in focus — saves battery + bandwidth
  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(useCallback(() => {
    setIsFocused(true);
    return () => setIsFocused(false);
  }, []));

  const { data: stationsData, isLoading: stationsLoading } = useGetStations(undefined, {
    query: { refetchInterval: isFocused ? 30_000 : false },
  });
  // Пока нет реальных станций (первая загрузка, нет сети или боевая база ещё
  // не наполнена) — показываем демо-станции, чтобы карта/список никогда не
  // были пустыми (важно и для демонстрации, и для ревью Apple). Как только
  // приходят настоящие данные — они сразу вытесняют демо.
  const allStations = useMemo(() => {
    const real = (stationsData?.nearby ?? []) as any[];
    return real.length > 0 ? real : (DEMO_STATIONS as any[]);
  }, [stationsData]);
  const promotedFromApi = useMemo(() => {
    const real = (stationsData?.promoted ?? []) as any[];
    if (real.length > 0) return real;
    const hasRealNearby = ((stationsData?.nearby ?? []) as any[]).length > 0;
    return hasRealNearby ? [] : (DEMO_PROMOTED as any[]);
  }, [stationsData]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const applyChipFilter = useCallback(<T extends { status: string }>(list: T[]): T[] => {
    if (activeChip === 'free') return list.filter(s => s.status === 'free');
    if (activeChip === 'my-cars' && defaultConnectorType)
      return list.filter(s => ((s as any).connectors ?? []).some((c: any) => c.type === defaultConnectorType));
    if (activeChip === 'ac') return list.filter(s => ((s as any).connectors ?? []).some((c: any) => AC_TYPES.includes(c.type)));
    if (activeChip === 'dc') return list.filter(s => ((s as any).connectors ?? []).some((c: any) => DC_TYPES.includes(c.type)));
    return list;
  }, [activeChip, defaultConnectorType]);

  const applySheetFilter = useCallback((list: any[]): any[] => {
    let r = list;
    if (activeFilters.availability === 'free') r = r.filter(s => s.status === 'free');
    if (activeFilters.availability === 'busy') r = r.filter(s => s.status === 'occupied');
    if (activeFilters.connectorTypes.length > 0)
      r = r.filter(s => ((s.connectors ?? []) as any[]).some(c => activeFilters.connectorTypes.includes(c.type)));
    r = r.filter(s => s.power_kw >= activeFilters.minPowerKw && s.power_kw <= activeFilters.maxPowerKw);
    r = r.filter(s => s.price_per_kwh <= activeFilters.maxPriceSum);
    return r;
  }, [activeFilters]);

  const hasActiveFilters = activeFilters.connectorTypes.length > 0
    || activeFilters.availability !== 'all' || activeFilters.amenities.length > 0
    || activeFilters.maxPriceSum < 5000 || activeFilters.minPowerKw > 3 || activeFilters.maxPowerKw < 350;

  // filteredStations — base set shared by all sections
  const filteredStations = useMemo(() => {
    let r = allStations;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(s => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
    }
    r = applyChipFilter(r);
    r = applySheetFilter(r);
    return r.map(s => ({
      ...s,
      distance_km: userLocation
        ? haversine(userLocation.lat, userLocation.lng, s.lat, s.lng)
        : (s.distance_km ?? null),
    }));
  }, [allStations, search, applyChipFilter, applySheetFilter, userLocation]);

  const promotedStations = useMemo(() => {
    if (!search.trim()) return promotedFromApi;
    const q = search.toLowerCase();
    return promotedFromApi.filter(s => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
  }, [promotedFromApi, search]);

  // ── Section datasets ──────────────────────────────────────────────────────
  const nearbyStations = useMemo(() =>
    [...filteredStations].sort((a, b) => {
      if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km;
      return (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || a.name.localeCompare(b.name, 'ru');
    }),
  [filteredStations]);

  const cheapStations = useMemo(() => {
    const eff = (s: any) => {
      const d = Number(s.discount_pct) || 0;
      return d > 0 ? s.price_per_kwh * (1 - d / 100) : s.price_per_kwh;
    };
    return [...filteredStations].sort((a, b) => eff(a) - eff(b));
  }, [filteredStations]);

  const freeStations = useMemo(() =>
    filteredStations.filter(s => s.status === 'free'),
  [filteredStations]);

  // Dynamic connector sections — unique connector types from data, sorted by count desc
  const connectorSections = useMemo(() => {
    const typeCounts = new Map<string, any[]>();
    for (const s of filteredStations) {
      const types = new Set(((s.connectors ?? []) as any[]).map((c: any) => c.type as string));
      for (const t of types) {
        if (!typeCounts.has(t)) typeCounts.set(t, []);
        typeCounts.get(t)!.push(s);
      }
    }
    return [...typeCounts.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([type, stations]) => ({ type, stations }));
  }, [filteredStations]);

  const hybridStations = useMemo(() =>
    filteredStations.filter(s => {
      const types = ((s.connectors ?? []) as any[]).map((c: any) => c.type as string);
      return types.some(t => AC_TYPES.includes(t)) && types.some(t => DC_TYPES.includes(t));
    }),
  [filteredStations]);

  // ── Banners ───────────────────────────────────────────────────────────────
  const banners = useMemo(
    () => makeBanners([...allStations, ...promotedFromApi], userLocation),
    [allStations, promotedFromApi, userLocation],
  );

  // ── Map markers ───────────────────────────────────────────────────────────
  const markers = useMemo(() => filteredStations.map(s => ({
    id: s.id, lat: s.lat, lng: s.lng, name: s.name, status: s.status,
    power_kw: s.power_kw, price_per_kwh: s.price_per_kwh,
    is_promoted: !!(s as any).is_promoted,
  })), [filteredStations]);

  // Use a ref so handleStationPress never changes — this keeps MapViewWrapper
  // and all its markers stable (no re-render when a station is selected).
  const selectedStationIdRef2 = useRef<number | null>(selectedStationId);
  selectedStationIdRef2.current = selectedStationId;

  const handleStationPress = useCallback((id: number) => {
    if (selectedStationIdRef2.current === id) {
      // Second tap on the same pin → go to full page
      setSelectedStationId(null);
      setMarkerPos(null);
      router.push(`/station/${id}` as any);
    } else {
      // First tap → show quick-view card
      setSelectedStationId(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); // stable — does NOT depend on selectedStationId

  const selectedStation = useMemo<QuickViewStation | null>(() => {
    if (selectedStationId == null) return null;
    return [...allStations, ...promotedFromApi].find(s => s.id === selectedStationId) as QuickViewStation ?? null;
  }, [selectedStationId, allStations, promotedFromApi]);

  const selectedStationRef = useRef(selectedStation);
  selectedStationRef.current = selectedStation;

  const computeMarkerPos = useCallback(async (lat: number, lng: number) => {
    const pos = await mapRef.current?.projectPoint(lat, lng);
    if (pos) setMarkerPos(pos);
  }, []);

  useEffect(() => {
    if (!selectedStation) { setMarkerPos(null); return; }
    computeMarkerPos(selectedStation.lat, selectedStation.lng);
  }, [selectedStation?.id]);

  // Debounce projectPoint during map pan — without debounce this fires ~60×/sec
  // and floods the JS bridge with async calls, causing visible jank.
  const regionChangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRegionChange = useCallback(() => {
    const s = selectedStationRef.current;
    if (!s) return;
    if (regionChangeTimer.current) clearTimeout(regionChangeTimer.current);
    regionChangeTimer.current = setTimeout(() => {
      mapRef.current?.projectPoint(s.lat, s.lng).then((pos: { x: number; y: number } | null) => { if (pos) setMarkerPos(pos); });
    }, 50); // ≈ 3 frames — smooth enough, cheap enough
  }, []);

  const topOffset  = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad  = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 100;
  const routeFor   = (s: any) =>
    `/route/new?stationId=${s.id}&stationName=${encodeURIComponent(s.name)}&lat=${s.lat}&lng=${s.lng}` as any;

  // ── Horizontal section renderer ───────────────────────────────────────────
  // Card width = 78 % of screen; gap = 12; padding = 16 on each side.
  // ScrollView breaks out of parent's 16px horizontal padding via marginHorizontal: -16.
  const CARD_W    = Math.round(SCREEN_WIDTH * 0.78);
  const SNAP_STEP = CARD_W + 12;

  const renderHSection = useCallback((stations: any[]) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={SNAP_STEP}
      decelerationRate="fast"
      disableIntervalMomentum
      style={styles.hSection}
      contentContainerStyle={[styles.hSectionContent, { paddingRight: 16 + (SCREEN_WIDTH - CARD_W - 16) }]}
    >
      {/* Горизонтальная лента — не виртуализируется, поэтому рендерим не всё:
          с сотнями станций (после импорта из OSM) полный .map отрисовал бы
          сотни карточек разом и ронял бы FPS открытия. Топ-20 хватает для
          «пролистать рядом»; полный список — во вкладке «Список». */}
      {stations.slice(0, 20).map((s, i) => (
        <Animated.View
          key={s.id}
          entering={FadeInRight.delay(Math.min(i, 8) * 40).duration(260).easing(IOS_EASE)}
          style={{ width: CARD_W, marginRight: 12 }}
        >
          <StationCard
            station={s}
            onPress={() => router.push(`/station/${s.id}`)}
            onRoute={() => router.push(routeFor(s))}
            discount_pct={(s as any).discount_pct}
            is_promoted={(s as any).is_promoted}
            amenities={(s as any).amenities}
          />
        </Animated.View>
      ))}
    </ScrollView>
  ), [router, CARD_W, SNAP_STEP]);

  // ── TOP BAR ───────────────────────────────────────────────────────────────
  const TopBar = (
    <View style={[styles.topBar, { top: topOffset + 8 }]}>
      <Text style={[styles.logo, { color: colors.primary }]}>EVGO</Text>
      <View style={styles.segmentControl}>
        <Glass glassStyle="clear" style={[StyleSheet.absoluteFill, { borderRadius: 100 }]} />
        {(['map', 'list'] as const).map(mode => (
          <TouchableOpacity
            key={mode}
            onPress={() => { haptics.tap(); setViewMode(mode); }}
            style={[styles.segmentBtn, viewMode === mode && styles.segmentBtnActive]}
          >
            {viewMode === mode && (
              <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]}
                style={[StyleSheet.absoluteFill, { borderRadius: 100 }]} />
            )}
            <Text style={[styles.segmentText, { color: viewMode === mode ? '#fff' : colors.mutedForeground }]}>
              {mode === 'map' ? 'Карта' : 'Список'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.iconBtn}
        onPress={() => { haptics.tap(); router.push('/notifications'); }}>
        <Glass glassStyle="clear" interactive style={styles.iconBtnGlass}>
          <Feather name="bell" size={18} color={colors.text} />
        </Glass>
      </TouchableOpacity>
    </View>
  );

  // ── FILTER CHIPS ──────────────────────────────────────────────────────────
  const FilterChips = (
    <ScrollView
      horizontal showsHorizontalScrollIndicator={false}
      style={[styles.filterScroll, { top: topOffset + 60 }]}
      contentContainerStyle={styles.filterRow}
      keyboardShouldPersistTaps="always"
      scrollEventThrottle={16}
    >
      <Pressable
        onPress={() => setFiltersVisible(true)}
        style={({ pressed }) => [
          styles.filterPill,
          { backgroundColor: 'transparent', opacity: pressed ? 0.8 : 1 },
        ]}
      >
        {hasActiveFilters
          ? <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
          : <Glass glassStyle="clear" style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />}
        <Feather name="sliders" size={14} color={hasActiveFilters ? '#fff' : colors.text} style={{ position: 'relative', zIndex: 1 }} />
        <Text style={[styles.filterText, { color: hasActiveFilters ? '#fff' : colors.text }]}>
          Фильтры{hasActiveFilters ? ' ●' : ''}
        </Text>
      </Pressable>
      {([
        { id: 'all', label: 'Все' }, { id: 'free', label: 'Свободные' },
        { id: 'my-cars', label: 'Мои машины' }, { id: 'ac', label: 'AC' }, { id: 'dc', label: 'DC' },
      ] as { id: FilterStatus; label: string }[]).map(f => {
        const isActive = activeChip === f.id;
        return (
          <Pressable key={f.id} onPress={() => { haptics.tap(); setActiveChip(f.id); }}
            style={({ pressed }) => [
              styles.filterPill,
              { backgroundColor: 'transparent', opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {isActive
              ? <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
              : <Glass glassStyle="clear" style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />}
            <Text style={[styles.filterText, { color: isActive ? '#fff' : colors.text }]}>{f.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topOffset }]}>
        {TopBar}
        {/* Поиск идёт ПОД рядом фильтров: чипы позиционированы абсолютно на
            top+60 (высота ~40), поэтому поиск начинаем ниже, иначе он уезжал
            под чипы. */}
        <View style={[styles.searchWrap, { marginTop: topOffset + 112 }]}>
          <View style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchText, { color: colors.text }]}
              placeholder="Поиск станций…" placeholderTextColor={colors.mutedForeground}
              value={search} onChangeText={setSearch}
            />
            {search ? <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></TouchableOpacity> : null}
          </View>
        </View>
        {FilterChips}
        <FlatList
          data={nearbyStations}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          windowSize={5}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          removeClippedSubviews
          ListEmptyComponent={
            // Без этого при загрузке или пустом результате список был чёрной
            // пустотой — выглядело как сломанный экран.
            stationsLoading ? (
              <View style={styles.listEmpty}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Загружаем станции…</Text>
              </View>
            ) : (
              <View style={styles.listEmpty}>
                <Feather name="map-pin" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Станций нет</Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  {hasActiveFilters || search.trim() ? 'Ничего не найдено по вашему запросу' : 'Попробуйте позже'}
                </Text>
                {(hasActiveFilters || search.trim()) && (
                  <TouchableOpacity
                    onPress={() => { setActiveFilters(DEFAULT_FILTERS); setActiveChip('all'); setSearch(''); }}
                    style={[styles.resetBtn, { borderColor: colors.primary }]}
                  >
                    <Text style={[styles.resetBtnText, { color: colors.primary }]}>Сбросить</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
          renderItem={({ item: s, index: i }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(i, 8) * 35).duration(300).easing(IOS_EASE)}>
              <StationCard station={s} onPress={() => router.push(`/station/${s.id}`)}
                onRoute={() => router.push(routeFor(s))}
                discount_pct={(s as any).discount_pct} is_promoted={(s as any).is_promoted}
                amenities={(s as any).amenities} />
            </Animated.View>
          )}
        />
        <FiltersSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)} onApply={f => setActiveFilters(f)} />
      </View>
    );
  }

  // ── MAP VIEW ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <MapViewWrapper
        ref={mapRef} stations={markers} userLocation={userLocation}
        onStationPress={handleStationPress}
        onMapPress={() => { setSelectedStationId(null); setMarkerPos(null); }}
        onRegionChange={handleRegionChange}
      />
      {TopBar}
      {FilterChips}

      {/* Location permission denied banner */}
      {locationPermissionDenied && (
        <View style={[styles.permBanner, { top: topOffset + 112 }]}>
          <Feather name="map-pin" size={14} color="#92400E" />
          <Text style={styles.permBannerText}>Геолокация отключена — показываем Ташкент</Text>
          <TouchableOpacity onPress={() => Linking.openSettings()}>
            <Text style={styles.permBannerBtn}>Настройки</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bottom sheet ──────────────────────────────────────────────────── */}
      <Animated.View style={[styles.sheet, { backgroundColor: colors.card }, sheetStyle]}>

        {/* Handle — 60px drag zone: ручка + заголовок */}
        <GestureDetector gesture={handleGesture}>
          <Animated.View style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: colors.mutedForeground, opacity: 0.3 }]} />
          </Animated.View>
        </GestureDetector>

        {/* ── Scrollable sections ─────────────────────────────────────────── */}
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
        >
          {/* 1. Banner carousel — breaks out of horizontal padding */}
          <BannerCarousel
            banners={banners}
            cardWidth={SCREEN_WIDTH - 32}
            onPress={b => {
              if (b.stationId) router.push(`/station/${b.stationId}` as any);
            }}
          />

          {/* 2. Рекомендуем (is_promoted, desc discount) */}
          {promotedStations.length > 0 && (
            <>
              <SectionHeader title="Рекомендуем" badge="Реклама" count={promotedStations.length} colors={colors} />
              {renderHSection(
                [...promotedStations].sort((a, b) => (b.discount_pct ?? 0) - (a.discount_pct ?? 0))
              )}
            </>
          )}

          {/* 3. Рядом с вами */}
          {nearbyStations.length > 0 && (
            <>
              <SectionHeader title="Рядом с вами" count={nearbyStations.length} colors={colors} />
              {renderHSection(nearbyStations)}
            </>
          )}

          {/* 4. Самые дешёвые */}
          {cheapStations.length > 0 && (
            <>
              <SectionHeader title="Самые дешёвые" count={cheapStations.length} colors={colors} />
              {renderHSection(cheapStations)}
            </>
          )}

          {/* 5. Свободные */}
          {freeStations.length > 0 && (
            <>
              <SectionHeader title="Свободные" count={freeStations.length} colors={colors} />
              {renderHSection(freeStations)}
            </>
          )}

          {/* 6. Гибрид (AC + DC одновременно) */}
          {hybridStations.length > 0 && (
            <>
              <SectionHeader title="Гибрид" count={hybridStations.length} colors={colors} />
              {renderHSection(hybridStations)}
            </>
          )}

          {/* 7. Секции по типам коннекторов (генерируются из данных) */}
          {connectorSections.map(({ type, stations }) => (
            <React.Fragment key={type}>
              <SectionHeader title={type} count={stations.length} colors={colors} />
              {renderHSection(stations)}
            </React.Fragment>
          ))}

          {/* Empty state — shown only when the entire filtered set is empty */}
          {filteredStations.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="map-pin" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Станций нет</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Нет станций с такими фильтрами
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity onPress={() => setActiveFilters(DEFAULT_FILTERS)}
                  style={[styles.resetBtn, { borderColor: colors.primary }]}>
                  <Text style={[styles.resetBtnText, { color: colors.primary }]}>Сбросить фильтры</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Map controls */}
      <Animated.View
        style={[styles.mapControls, mapControlsStyle]}
        pointerEvents={sheetAtTop ? 'none' : 'box-none'}
      >
        <TouchableOpacity style={styles.mapBtn} onPress={() => { haptics.tap(); mapRef.current?.locate(); }} activeOpacity={0.75}>
          <Glass glassStyle="clear" interactive style={styles.mapBtnGlass}>
            <Feather name="navigation" size={18} color={colors.text} />
          </Glass>
        </TouchableOpacity>
        <View style={styles.zoomGroup}>
          <Glass glassStyle="clear" style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={styles.zoomBtn} onPress={() => mapRef.current?.zoomIn()} activeOpacity={0.75}>
            <Feather name="plus" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomBtn} onPress={() => mapRef.current?.zoomOut()} activeOpacity={0.75}>
            <Feather name="minus" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <FiltersSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)} onApply={f => setActiveFilters(f)} />

      {selectedStation && (
        <StationQuickView
          station={selectedStation} position={markerPos} userLocation={userLocation}
          onClose={() => { setSelectedStationId(null); setMarkerPos(null); }}
          onOpenFull={() => { setSelectedStationId(null); setMarkerPos(null); router.push(`/station/${selectedStation.id}`); }}
          onNavigate={() => { setSelectedStationId(null); setMarkerPos(null); router.push(routeFor(selectedStation) as any); }}
          onCharge={() => { setSelectedStationId(null); setMarkerPos(null); router.push(`/station/${selectedStation.id}`); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { position: 'absolute', left: 16, right: 16, zIndex: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  segmentControl: { flexDirection: 'row', borderRadius: 100, padding: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  segmentBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  segmentBtnActive: {},
  segmentText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', position: 'relative', zIndex: 1 },
  iconBtn: { width: 44, height: 44, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  iconBtnGlass: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterScroll: { position: 'absolute', left: 0, right: 0, zIndex: 20 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 2, position: 'relative', overflow: 'hidden' },
  filterText: { fontSize: 13, fontFamily: 'Inter_500Medium', position: 'relative', zIndex: 1 },
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  searchText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  handleArea: { alignItems: 'center', paddingTop: 14, paddingBottom: 10, width: '100%', minHeight: 60 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 4 },
  // Horizontal section: breaks out of parent 16px padding with negative margin
  hSection: { marginHorizontal: -16, marginBottom: 4 },
  hSectionContent: { paddingLeft: 16, paddingBottom: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  listEmpty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 4 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  resetBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  resetBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  permBanner: { position: 'absolute', left: 16, right: 16, zIndex: 25, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  permBannerText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: '#92400E' },
  permBannerBtn: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#2563EB' },
  mapControls: { position: 'absolute', right: 12, alignItems: 'center', gap: 10, zIndex: 30 },
  // Стеклянные контролы поверх карты: сам блюр даёт подложку, поэтому фон не
  // задаём. Тонкая светлая граница — блик материала, ловящего свет.
  // Стекло даёт подложку и границу — здесь только форма, тень и клип.
  mapBtn: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 },
  mapBtnGlass: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zoomGroup: { borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 },
  zoomBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomDivider: { height: 1, backgroundColor: '#E2E8F0', width: 44 },
});
