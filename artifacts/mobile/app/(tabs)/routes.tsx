import React, { useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, Easing } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetRoutes, useDeleteRoute, getGetRoutesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { MapViewWrapper, MapApi } from '@/components/MapViewWrapper';
import { GradientButton } from '@/components/GradientButton';
import { LinearGradient } from 'expo-linear-gradient';

const IOS_EASE = Easing.bezier(0.25, 0.46, 0.45, 0.94);

function formatTime(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

export default function RoutesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const mapRef = useRef<MapApi>(null);

  const { data: routesData, isLoading } = useGetRoutes();
  const routes = useMemo(() => (Array.isArray(routesData) ? routesData : []), [routesData]);

  const deleteRoute = useDeleteRoute({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetRoutesQueryKey() }),
    },
  });

  // Use only the first active route
  const activeRoute = useMemo(
    () => routes.find((r: any) => r && r.status === 'active') ?? null,
    [routes]
  );

  // Build route points for map
  const routePoints = useMemo(() => {
    if (!activeRoute || activeRoute.origin_lat == null || activeRoute.origin_lng == null || activeRoute.dest_lat == null || activeRoute.dest_lng == null) return undefined;
    const stops: any[] = activeRoute.stops ?? [];
    return [
      { lat: Number(activeRoute.origin_lat), lng: Number(activeRoute.origin_lng), label: (activeRoute.origin ?? '').split(',')[0], type: 'origin' as const },
      ...stops.filter((s: any) => s.lat != null && s.lng != null).map((s: any) => ({
        lat: Number(s.lat), lng: Number(s.lng), label: s.station_name, type: 'stop' as const,
      })),
      { lat: Number(activeRoute.dest_lat), lng: Number(activeRoute.dest_lng), label: (activeRoute.destination ?? '').split(',')[0], type: 'dest' as const },
    ];
  }, [activeRoute]);

  // Real road polyline from Yandex Router (already fetched by API)
  const polylinePoints = useMemo(() => {
    const poly = (activeRoute as any)?.polyline;
    if (!poly?.length) return undefined;
    return poly as Array<[number, number]>;
  }, [activeRoute]);

  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 + 16 : insets.bottom + 84;

  // ── Empty state ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Маршруты</Text>
        </View>
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      </View>
    );
  }

  if (!activeRoute) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Навигация</Text>
        </View>
        <Animated.View entering={FadeInDown.duration(320).easing(IOS_EASE)} style={[styles.emptyState]}>
          <View style={[styles.emptyIconBox, { backgroundColor: colors.muted }]}>
            <Feather name="map" size={44} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Нет активного маршрута</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Постройте маршрут со станциями зарядки для вашей поездки
          </Text>
          <GradientButton
            label="Новый маршрут"
            onPress={() => router.push('/route/new')}
            icon={<Feather name="map" size={18} color="#fff" />}
            style={{ marginTop: 8, width: '100%' }}
          />
        </Animated.View>
      </View>
    );
  }

  // ── Navigation map view ──────────────────────────────────────────────
  const stops: any[] = activeRoute.stops ?? [];

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapViewWrapper
        ref={mapRef}
        stations={[]}
        onStationPress={() => {}}
        routePoints={routePoints}
        polylineCoords={polylinePoints}
      />

      {/* Top overlay — route header */}
      <Animated.View
        entering={FadeInDown.duration(300).easing(IOS_EASE)}
        style={[styles.navHeader, { paddingTop: topPad + 12, backgroundColor: colors.card }]}
      >
        <View style={styles.navHeaderRow}>
          <View style={styles.navRoute}>
            <Text style={[styles.navOrigin, { color: colors.text }]} numberOfLines={1}>
              {activeRoute.origin.split(',')[0]}
            </Text>
            <Feather name="arrow-right" size={16} color={colors.primary} style={{ marginHorizontal: 8 }} />
            <Text style={[styles.navDest, { color: colors.primary }]} numberOfLines={1}>
              {activeRoute.destination.split(',')[0]}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => mapRef.current?.locate()}
            style={[styles.locBtn, { backgroundColor: colors.muted }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Моё местоположение"
          >
            <Feather name="navigation" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.navStats}>
          <View style={styles.navStat}>
            <Feather name="map" size={13} color={colors.mutedForeground} />
            <Text style={[styles.navStatText, { color: colors.text }]}>
              {Math.round(activeRoute.total_distance_km)} км
            </Text>
          </View>
          <View style={[styles.navStatDot, { backgroundColor: colors.border }]} />
          <View style={styles.navStat}>
            <Feather name="clock" size={13} color={colors.mutedForeground} />
            <Text style={[styles.navStatText, { color: colors.text }]}>
              {formatTime(activeRoute.total_time_min)}
            </Text>
          </View>
          <View style={[styles.navStatDot, { backgroundColor: colors.border }]} />
          <View style={styles.navStat}>
            <Feather name="zap" size={13} color={colors.mutedForeground} />
            <Text style={[styles.navStatText, { color: colors.text }]}>
              {stops.length} ост.
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Bottom panel — stops list */}
      <Animated.View
        entering={FadeInUp.duration(300).easing(IOS_EASE)}
        style={[styles.bottomPanel, { backgroundColor: colors.card, paddingBottom: bottomPad }]}
      >
        <View style={[styles.panelHandle, { backgroundColor: colors.border }]} />

        <ScrollView showsVerticalScrollIndicator={false} style={styles.stopsScroll}>
          {/* Origin */}
          <View style={styles.stopRow}>
            <View style={[styles.stopDot, { backgroundColor: colors.primary, width: 12, height: 12, borderRadius: 6 }]} />
            <View style={styles.stopLine}>
              <Text style={[styles.stopLabel, { color: colors.mutedForeground }]}>Начало</Text>
              <Text style={[styles.stopName, { color: colors.text }]} numberOfLines={1}>{activeRoute.origin}</Text>
            </View>
            <Text style={[styles.battBadge, { backgroundColor: colors.muted, color: colors.text }]}>
              {activeRoute.initial_battery_pct}%
            </Text>
          </View>

          {/* Charging stops */}
          {stops.map((stop, i) => (
            <React.Fragment key={i}>
              <View style={[styles.connector, { borderColor: colors.border }]} />
              <Animated.View
                entering={FadeInDown.delay(i * 60).duration(260).easing(IOS_EASE)}
                style={styles.stopRow}
              >
                <LinearGradient colors={['#2563EB', '#7C3AED']} style={styles.stopBadge}>
                  <Text style={styles.stopBadgeText}>{i + 1}</Text>
                </LinearGradient>
                <View style={styles.stopLine}>
                  <View style={styles.stopMeta}>
                    <Text style={[styles.stopLabel, { color: colors.mutedForeground }]}>
                      {stop.charge_time_min} мин · прибытие {stop.eta}
                    </Text>
                  </View>
                  <Text style={[styles.stopName, { color: colors.text }]} numberOfLines={1}>{stop.station_name}</Text>
                  <Text style={[styles.stopBattery, { color: colors.mutedForeground }]}>
                    {stop.arrival_battery_pct}% → {stop.departure_battery_pct}%
                  </Text>
                </View>
                <Text style={[styles.battBadge, { backgroundColor: '#10B9811A', color: '#10B981' }]}>
                  {stop.departure_battery_pct}%
                </Text>
              </Animated.View>
            </React.Fragment>
          ))}

          {/* Destination */}
          <View style={[styles.connector, { borderColor: colors.border }]} />
          <View style={styles.stopRow}>
            <View style={[styles.stopDot, { backgroundColor: '#7C3AED', width: 12, height: 12, borderRadius: 6 }]} />
            <View style={styles.stopLine}>
              <Text style={[styles.stopLabel, { color: colors.mutedForeground }]}>Пункт назначения</Text>
              <Text style={[styles.stopName, { color: colors.text }]} numberOfLines={1}>{activeRoute.destination}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={styles.panelActions}>
          <TouchableOpacity
            onPress={() => deleteRoute.mutate({ id: activeRoute.id })}
            style={[styles.cancelBtn, { backgroundColor: colors.muted }]}
            disabled={deleteRoute.isPending}
          >
            {deleteRoute.isPending
              ? <ActivityIndicator size="small" color={colors.mutedForeground} />
              : <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Отменить</Text>}
          </TouchableOpacity>
          <GradientButton
            label="Новый маршрут"
            onPress={() => router.push('/route/new')}
            icon={<Feather name="map" size={16} color="#fff" />}
            style={{ flex: 1 }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyIconBox: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  emptyDesc: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  // Navigation header
  navHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  navHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navRoute: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  navOrigin: { fontSize: 16, fontFamily: 'Inter_600SemiBold', flex: 1 },
  navDest: { fontSize: 16, fontFamily: 'Inter_700Bold', flex: 1 },
  locBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  navStats: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 },
  navStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navStatText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  navStatDot: { width: 3, height: 3, borderRadius: 1.5 },
  // Bottom panel
  bottomPanel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '55%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 20,
  },
  panelHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
  stopsScroll: { paddingHorizontal: 16, maxHeight: 240 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  stopDot: {},
  stopBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stopBadgeText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  stopLine: { flex: 1 },
  stopMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stopLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  stopName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 1 },
  stopBattery: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  battBadge: { fontSize: 12, fontFamily: 'Inter_600SemiBold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  connector: { width: 1, height: 20, borderLeftWidth: 1.5, borderStyle: 'dashed', marginLeft: 14, marginVertical: 2 },
  panelActions: { flexDirection: 'row', gap: 10, padding: 16, paddingTop: 10 },
  cancelBtn: { paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
