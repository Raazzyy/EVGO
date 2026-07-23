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
import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';

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

const PIN_SIZE          = 40;
const PIN_PROMOTED_SIZE = 50;

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
    const mapRef    = useRef<MapView>(null);
    const regionRef = useRef<Region>(TASHKENT);

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
        if (!userLocation) return;
        const next: Region = {
          latitude:       userLocation.lat,
          longitude:      userLocation.lng,
          latitudeDelta:  0.01,
          longitudeDelta: 0.01,
        };
        mapRef.current?.animateToRegion(next, 400);
        regionRef.current = next;
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

    // ── Fit camera to route when routePoints change ─────────────────────
    useEffect(() => {
      if (!routePoints || routePoints.length < 2) return;
      const coords = routePoints.map(p => ({
        latitude:  p.lat,
        longitude: p.lng,
      }));
      // Delay slightly so MapView has finished its own layout
      const t = setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 40, bottom: 260, left: 40 },
          animated: true,
        });
      }, 200);
      return () => clearTimeout(t);
    }, [routePoints]);

    // ── Derived route geometry ──────────────────────────────────────────
    // Prefer road-snapped coords; fall back to straight waypoint lines
    const polylinePath =
      polylineCoords && polylineCoords.length >= 2
        ? polylineCoords.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
        : routePoints && routePoints.length >= 2
          ? routePoints.map(p => ({ latitude: p.lat, longitude: p.lng }))
          : null;

    // ── Render ──────────────────────────────────────────────────────────
    return (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={TASHKENT}
        onRegionChange={(r) => {
          regionRef.current = r;
          onRegionChange?.();
        }}
        onRegionChangeComplete={(r) => { regionRef.current = r; }}
        onPress={() => onMapPress?.()}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* ── Station markers ─────────────────────────────────────────── */}
        {stations.map((s) => {
          const statusColor =
            s.status === 'free'     ? '#10B981' :
            s.status === 'occupied' ? '#F59E0B' : '#94A3B8';
          const promoted = !!s.is_promoted;
          const size     = promoted ? PIN_PROMOTED_SIZE : PIN_SIZE;

          return (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              onPress={() => onStationPress(s.id)}
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
                    backgroundColor: statusColor,
                  },
                  promoted && styles.pinPromoted,
                ]}
              >
                <Feather name="zap" size={promoted ? 18 : 14} color="#fff" />

                {/* Gold star badge for promoted stations */}
                {promoted && (
                  <View style={styles.starBadge}>
                    <Text style={styles.starText}>★</Text>
                  </View>
                )}
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
          />
        )}

        {/* ── Route waypoint markers ───────────────────────────────────── */}
        {routePoints?.map((p, i) => {
          const color  = ROUTE_COLORS[p.type ?? 'stop'] ?? ROUTE_COLORS.stop;
          const icon: 'navigation' | 'map-pin' | 'zap' =
            p.type === 'origin' ? 'navigation' :
            p.type === 'dest'   ? 'map-pin'    : 'zap';

          return (
            <Marker
              key={`rp-${i}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.routePin, { backgroundColor: color }]}>
                <Feather name={icon} size={8} color="#fff" />
              </View>
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
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  // Promoted override: gold border + stronger glow
  pinPromoted: {
    borderColor: '#FCD34D',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 9,
  },
  // Tiny gold badge in the top-right corner of promoted pins
  starBadge: {
    position: 'absolute',
    top:    -5,
    right:  -5,
    width:   16,
    height:  16,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  starText: {
    color:    '#fff',
    fontSize: 8,
    lineHeight: 10,
    // Inter_700Bold may not load inside a Marker; fallback to System Bold is fine
    fontWeight: '700',
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
});
