/**
 * MapViewWrapper — native (iOS / Android)
 * Uses react-native-maps.
 *
 * Features:
 * - Custom circular pin markers with Feather lightning icon
 * - Promoted stations: larger pin with gold border + star badge
 * - Route polyline (road geometry from polylineCoords, fallback: straight waypoint lines)
 * - Route waypoint markers (origin/stop/dest with distinct colours)
 * - fitToCoordinates when routePoints changes
 * - zoomIn / zoomOut via animateToRegion delta manipulation
 * - locate → animateToRegion on userLocation
 * - projectPoint → pointForCoordinate (used by StationQuickView overlay in index.tsx)
 */
import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline, Callout, Region } from 'react-native-maps';
import { pinColor, pinOpacity } from '@/lib/mapPins';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';

// ── Public API (forwarded via ref) ────────────────────────────────────────
export interface MapApi {
  zoomIn:  () => void;
  zoomOut: () => void;
  locate:  () => void;
  /**
   * Navigation camera follow — centers on the user, tilts with heading.
   * Called every GPS tick during active navigation.
   */
  followUser: (lat: number, lng: number, heading: number) => void;
  /** Pixel coords of lat/lng relative to the MapView's top-left corner. */
  projectPoint: (lat: number, lng: number) => Promise<{ x: number; y: number } | null>;
}

// ── Data types ────────────────────────────────────────────────────────────
export interface StationMarker {
  id: number;
  lat: number;
  lng: number;
  name: string;
  status: string;
  power_kw: number;
  price_per_kwh: number;
  is_promoted?: boolean;
}

interface MapViewWrapperProps {
  stations: StationMarker[];
  onStationPress: (id: number) => void;
  onMapPress?: () => void;
  onRegionChange?: () => void;
  userLocation?: { lat: number; lng: number } | null;
  /** Waypoints: origin, intermediate stops, destination */
  routePoints?: Array<{
    lat: number;
    lng: number;
    label?: string;
    type?: 'origin' | 'stop' | 'dest';
  }>;
  /** Road-snapped polyline coordinates [lat, lng][] from the routing API */
  polylineCoords?: Array<[number, number]>;
}

// ── Constants ─────────────────────────────────────────────────────────────
const TASHKENT: Region = {
  latitude:      41.2995,
  longitude:     69.2401,
  latitudeDelta:  0.15,
  longitudeDelta: 0.15,
};

const ZOOM_IN_FACTOR  = 0.5;   // multiply delta by this to zoom in
const ZOOM_OUT_FACTOR = 2.0;   // multiply delta by this to zoom out

// Аккуратные небольшие пины (в духе Яндекса), не «бандуры».
const PIN_SIZE          = 18;
const PIN_PROMOTED_SIZE = 24;

// Cap on simultaneously-rendered native markers. Each marker is an RN View +
// icon; hundreds of them exhaust memory and OOM-crash the app on real devices
// (and especially inside Expo Go). Promoted pins are never dropped by the cap.
const MAX_MARKERS = 120;

const ROUTE_COLORS: Record<string, string> = {
  origin: '#2563EB',
  stop:   '#10B981',
  dest:   '#7C3AED',
};

// ── Component ─────────────────────────────────────────────────────────────
export const MapViewWrapper = forwardRef<MapApi, MapViewWrapperProps>(
  (
    {
      stations,
      onStationPress,
      onMapPress,
      onRegionChange,
      userLocation,
      routePoints,
      polylineCoords,
    },
    ref,
  ) => {
    const mapRef          = useRef<MapView>(null);
    const regionRef       = useRef<Region>(TASHKENT);
    // Visible region for marker culling (updated in onRegionChangeComplete)
    const [visibleRegion, setVisibleRegion] = useState<Region>(TASHKENT);
    // Prevent MapView.onPress from clearing selection right after a Marker press.
    // react-native-maps fires both Marker.onPress AND MapView.onPress on the same tap.
    const markerJustPressed = useRef(false);

    // Keep the latest onStationPress in a ref so markers never need to re-render
    // when the parent changes the callback. With tracksViewChanges=false the native
    // view won't re-render anyway, but the ref ensures the JS closure is always fresh.
    const onStationPressRef = useRef(onStationPress);
    useEffect(() => { onStationPressRef.current = onStationPress; }, [onStationPress]);

    // Same for onMapPress
    const onMapPressRef = useRef(onMapPress);
    useEffect(() => { onMapPressRef.current = onMapPress; }, [onMapPress]);

    // ── Imperative API ──────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      zoomIn() {
        const r = regionRef.current;
        const next: Region = {
          ...r,
          latitudeDelta:  r.latitudeDelta  * ZOOM_IN_FACTOR,
          longitudeDelta: r.longitudeDelta * ZOOM_IN_FACTOR,
        };
        mapRef.current?.animateToRegion(next, 300);
        regionRef.current = next;
      },
      zoomOut() {
        const r = regionRef.current;
        const next: Region = {
          ...r,
          latitudeDelta:  r.latitudeDelta  * ZOOM_OUT_FACTOR,
          longitudeDelta: r.longitudeDelta * ZOOM_OUT_FACTOR,
        };
        mapRef.current?.animateToRegion(next, 300);
        regionRef.current = next;
      },
      locate() {
        const go = (lat: number, lng: number) => {
          const next: Region = {
            latitude:       lat,
            longitude:      lng,
            latitudeDelta:  0.01,
            longitudeDelta: 0.01,
          };
          mapRef.current?.animateToRegion(next, 400);
          regionRef.current = next;
        };
        if (userLocation) {
          go(userLocation.lat, userLocation.lng);
        } else {
          // Fallback: request position via expo-location when prop not available
          (async () => {
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') return;
              const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });
              go(pos.coords.latitude, pos.coords.longitude);
            } catch {
              // silently ignore — user declined or device unavailable
            }
          })();
        }
      },
      followUser(lat: number, lng: number, heading: number) {
        // animateCamera supports heading + pitch on both iOS and Android.
        // zoom=17 ≈ street level; altitude=500 is the iOS equivalent.
        mapRef.current?.animateCamera(
          {
            center:   { latitude: lat, longitude: lng },
            heading:  heading >= 0 ? heading : 0,
            pitch:    45,
            zoom:     17,
            altitude: 500,
          },
          { duration: 800 },
        );
      },
      async projectPoint(lat, lng) {
        const map = mapRef.current;
        if (!map) return null;
        try {
          const pt = await map.pointForCoordinate({ latitude: lat, longitude: lng });
          return { x: pt.x, y: pt.y };
        } catch {
          return null;
        }
      },
    }), [userLocation]);

    // ── Fit camera when route changes (stable key → no re-render loop) ──
    // Dependency is a stable string derived from the first/last waypoint, not
    // the array reference. A new array with the same endpoints won't re-fire.
    const routeKey = routePoints && routePoints.length >= 2
      ? `${routePoints[0].lat},${routePoints[0].lng}|${routePoints[routePoints.length - 1].lat},${routePoints[routePoints.length - 1].lng}`
      : null;

    useEffect(() => {
      if (!routeKey || !routePoints || routePoints.length < 2) return;
      const coords = routePoints.map(p => ({ latitude: p.lat, longitude: p.lng }));
      // Delay slightly so MapView finishes layout before fitting
      const t = setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 40, bottom: 200, left: 40 },
          animated: true,
        });
      }, 200);
      return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeKey]); // ← stable string, never causes an infinite loop

    // ── Derive polyline path (memoised; hard-capped at 1 500 points) ────
    // The backend already runs RDP simplification, so this is purely a
    // client-side safety net for any residual points above the bridge limit.
    const polylinePath = useMemo(() => {
      const HARD_CAP = 1500;
      function cap<T>(arr: T[]): T[] {
        if (arr.length <= HARD_CAP) return arr;
        const step = Math.ceil(arr.length / HARD_CAP);
        return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
      }

      if (polylineCoords && polylineCoords.length >= 2) {
        const pts = cap(polylineCoords.map(([lat, lng]) => ({ latitude: lat, longitude: lng })));
        return pts;
      }
      if (routePoints && routePoints.length >= 2) {
        return cap(routePoints.map(p => ({ latitude: p.lat, longitude: p.lng })));
      }
      return null;
    }, [polylineCoords, routePoints]);

    // ── Marker culling + hard cap ─────────────────────────────────────────
    // Hundreds of native markers exhaust memory and OOM-crash the app on real
    // devices (silent drop to the home screen, no JS error) — the failure seen
    // on iPhone in Expo Go. Two guards keep the rendered set bounded:
    //   1) viewport culling once the dataset is non-trivial;
    //   2) a hard cap (MAX_MARKERS) — at city-wide zoom the whole city fits the
    //      viewport, so culling alone can't help; the cap does. Promoted pins
    //      are always kept, the rest are evenly sampled.
    // onRegionChangeComplete keeps visibleRegion in sync so panning/zooming
    // re-runs both guards.
    const visibleStations = useMemo(() => {
      let list = stations;

      if (list.length > 150) {
        const { latitude: cLat, longitude: cLng, latitudeDelta, longitudeDelta } = visibleRegion;
        const latPad = latitudeDelta  * 1.5; // buffer so pins pre-load before a pan
        const lngPad = longitudeDelta * 1.5;
        list = list.filter(s =>
          s.lat >= cLat - latPad && s.lat <= cLat + latPad &&
          s.lng >= cLng - lngPad && s.lng <= cLng + lngPad
        );
      }

      if (list.length > MAX_MARKERS) {
        const promoted = list.filter(s => s.is_promoted);
        const rest     = list.filter(s => !s.is_promoted);
        const slots    = Math.max(0, MAX_MARKERS - promoted.length);
        const stride   = slots > 0 ? Math.ceil(rest.length / slots) : rest.length + 1;
        const sampled  = slots > 0 ? rest.filter((_, i) => i % stride === 0).slice(0, slots) : [];
        list = [...promoted, ...sampled];
      }

      return list;
    }, [stations, visibleRegion]);

    // ── Render ──────────────────────────────────────────────────────────
    return (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={TASHKENT}
        onRegionChange={(r: Region) => {
          regionRef.current = r;
          onRegionChange?.();
        }}
        onRegionChangeComplete={(r: Region) => {
          regionRef.current = r;
          setVisibleRegion(r); // triggers marker culling re-memoisation
        }}
        onPress={() => {
          if (markerJustPressed.current) return; // swallow map-tap that piggybacks a marker tap
          onMapPressRef.current?.();
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* ── Station markers (culled to visible viewport) ────────────── */}
        {visibleStations.map((s) => {
          // Цвет = скорость зарядки, прозрачность = занятость (lib/mapPins).
          const pinFill = pinColor(s.power_kw, s.status);
          const pinAlpha = pinOpacity(s.status);
          const promoted = !!s.is_promoted;
          const size     = promoted ? PIN_PROMOTED_SIZE : PIN_SIZE;

          return (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              onPress={() => {
                markerJustPressed.current = true;
                // MapView.onPress may arrive later than one frame when JS is busy
                // (sheet animation). 450 ms window so the card doesn't get cleared.
                setTimeout(() => { markerJustPressed.current = false; }, 450);
                onStationPressRef.current(s.id);
              }}
              // tracksViewChanges=false prevents expensive re-renders on each map move
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                style={[
                  styles.pin,
                  {
                    width:           size,
                    height:          size,
                    borderRadius:    size / 2,
                    backgroundColor: pinFill,
                    opacity:         pinAlpha,
                  },
                  promoted && styles.pinPromoted,
                ]}
              >
                <Feather name="zap" size={promoted ? 12 : 9} color="#fff" />
              </View>
            </Marker>
          );
        })}

        {/* ── Route polyline ───────────────────────────────────────────── */}
        {polylinePath && (
          <Polyline
            coordinates={polylinePath}
            strokeWidth={5}
            strokeColor="#2563EB"
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* ── Route waypoint markers ───────────────────────────────────── */}
        {routePoints?.map((p, i) => {
          const color = ROUTE_COLORS[p.type ?? 'stop'] ?? ROUTE_COLORS.stop;
          // Count only intermediate stops for numbering
          const stopIndex = routePoints
            .slice(0, i)
            .filter(x => x.type === 'stop' || (!x.type && i > 0))
            .length + 1;

          return (
            <Marker
              key={`rp-${i}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.routePin, { backgroundColor: color }]}>
                {p.type === 'stop' || (!p.type && i > 0 && i < (routePoints.length - 1)) ? (
                  // Stop: show sequential number instead of icon
                  <Text style={styles.routePinNumber}>{stopIndex}</Text>
                ) : p.type === 'origin' ? (
                  <Feather name="navigation" size={8} color="#fff" />
                ) : (
                  <Feather name="map-pin" size={8} color="#fff" />
                )}
              </View>
              {/* Callout shows label on tap */}
              {p.label ? (
                <Callout tooltip={false}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutText}>{p.label}</Text>
                  </View>
                </Callout>
              ) : null}
            </Marker>
          );
        })}
      </MapView>
    );
  },
);

MapViewWrapper.displayName = 'MapViewWrapper';

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Station pin — circular with status colour
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  // Promoted override: тонкое золотое кольцо + лёгкое свечение (без звезды)
  pinPromoted: {
    borderWidth: 2,
    borderColor: '#FCD34D',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  // Route waypoint dot
  routePin: {
    width:        18,
    height:       18,
    borderRadius:  9,
    alignItems:   'center',
    justifyContent: 'center',
    borderWidth:  2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  // Stop number shown inside stop waypoint pins
  routePinNumber: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
  },
  // Callout bubble shown when tapping a route waypoint
  callout: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    maxWidth: 180,
  },
  calloutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
