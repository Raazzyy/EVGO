import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetRoutes } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { GradientButton } from '@/components/GradientButton';

interface RouteStop {
  station_name: string;
  arrival_battery_pct: number;
  departure_battery_pct: number;
  charge_time_min: number;
  distance_from_prev_km: number;
  eta?: string;
}

function formatTime(totalMin: number) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

type Tab = 'active' | 'history';

function RouteCard({ route, colors }: { route: any; colors: any }) {
  const [expanded, setExpanded] = useState(false);
  const stops: RouteStop[] = route.stops ?? [];
  const visibleStops = expanded ? stops : stops.slice(0, 2);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => setExpanded(!expanded)}
      style={[styles.routeCard, { backgroundColor: colors.card, shadowColor: '#000' }]}
    >
      {/* Header */}
      <View style={styles.routeHeader}>
        <View style={styles.originDestRow}>
          <Text style={[styles.originDestText, { color: colors.text }]} numberOfLines={1}>
            {route.origin.split(',')[0]}
          </Text>
          <Feather name="arrow-right" size={16} color={colors.mutedForeground} />
          <Text style={[styles.originDestText, { color: colors.text }]} numberOfLines={1}>
            {route.destination.split(',')[0]}
          </Text>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.mutedForeground} />
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <Text style={[styles.statsText, { color: colors.mutedForeground }]}>
          {Math.round(route.total_distance_km)} км · ~{formatTime(route.total_time_min)}
        </Text>
        {route.status === 'active' && (
          <View style={[styles.statusBadge, { backgroundColor: '#10B9811A' }]}>
            <Text style={[styles.statusText, { color: '#10B981' }]}>В пути</Text>
          </View>
        )}
      </View>

      {/* Progress Bar (Visual representation) */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]} />
        <View style={[styles.progressDot, { left: 0, backgroundColor: colors.primary }]} />
        {stops.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressStopDot,
              { left: `${((i + 1) / (stops.length + 1)) * 100}%`, backgroundColor: colors.primary },
            ]}
          />
        ))}
        <View style={[styles.progressDot, { right: 0, backgroundColor: colors.accent }]} />
      </View>

      {/* Stops */}
      {stops.length > 0 && (
        <View style={styles.stopsList}>
          {visibleStops.map((stop, i) => (
            <View key={i} style={styles.stopRow}>
              <View style={[styles.stopNumberCircle, { backgroundColor: colors.primary + '1A' }]}>
                <Text style={[styles.stopNumberText, { color: colors.primary }]}>{i + 1}</Text>
              </View>
              <View style={styles.stopInfo}>
                <Text style={[styles.stopName, { color: colors.text }]}>{stop.station_name}</Text>
                <Text style={[styles.stopDetails, { color: colors.mutedForeground }]}>
                  {stop.eta ? `${stop.eta} · ` : ''}{stop.arrival_battery_pct}% → {stop.departure_battery_pct}% · {stop.charge_time_min} мин
                </Text>
              </View>
            </View>
          ))}
          {!expanded && stops.length > 2 && (
            <Text style={[styles.moreStopsText, { color: colors.primary }]}>
              Еще {stops.length - 2} остановки...
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function RoutesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: routes = [], isLoading } = useGetRoutes();
  const [tab, setTab] = useState<Tab>('active');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const filteredRoutes = tab === 'active' 
    ? routes.filter(r => r.status === 'active')
    : routes.filter(r => r.status !== 'active');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Маршруты</Text>
          <TouchableOpacity style={styles.iconBtn}>
            <Feather name="filter" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Segment */}
        <View style={[styles.segment, { backgroundColor: colors.muted }]}>
          {(['active', 'history'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.segmentTab, tab === t && { backgroundColor: colors.card }]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: tab === t ? colors.text : colors.mutedForeground },
                ]}
              >
                {t === 'active' ? 'Активные' : 'История'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {filteredRoutes.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="zap" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Маршруты не найдены</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Постройте умный маршрут с остановками для зарядки, чтобы оптимизировать вашу поездку.
              </Text>
            </View>
          ) : (
            filteredRoutes.map((route) => (
              <RouteCard key={route.id} route={route} colors={colors} />
            ))
          )}
        </ScrollView>
      )}

      {/* New Route FAB / Footer Button */}
      <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: bottomPad + 12 }]}>
        <GradientButton
          label="Новый маршрут"
          onPress={() => router.push('/route/new')}
          icon={<Feather name="map" size={18} color="#fff" />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  segment: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  emptyDesc: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  routeCard: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    gap: 12,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  originDestRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originDestText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  progressBarContainer: {
    height: 20,
    justifyContent: 'center',
    marginVertical: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    width: '100%',
  },
  progressDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressStopDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    transform: [{ translateX: -5 }],
  },
  stopsList: {
    gap: 12,
    marginTop: 4,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stopNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNumberText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  stopDetails: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  moreStopsText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginLeft: 34,
  },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    paddingTop: 16,
  },
});
