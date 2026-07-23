import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import { View, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';

export interface MapApi {
  zoomIn: () => void;
  zoomOut: () => void;
  locate: () => void;
}

export interface StationMarker {
  id: number;
  lat: number;
  lng: number;
  name: string;
  status: string;
  power_kw: number;
  price_per_kwh: number;
}

interface MapViewWrapperProps {
  stations: StationMarker[];
  onStationPress: (id: number) => void;
  userLocation?: { lat: number; lng: number } | null;
  routePoints?: Array<{ lat: number; lng: number; label?: string; type?: 'origin' | 'stop' | 'dest' }>;
  polylineCoords?: Array<[number, number]>;
}

const TASHKENT: Region = {
  latitude: 41.2995,
  longitude: 69.2401,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

// How much to multiply delta on each zoom step (< 1 = zoom in, > 1 = zoom out)
const ZOOM_FACTOR = 0.5;

export const MapViewWrapper = forwardRef<MapApi, MapViewWrapperProps>(
  ({ stations, onStationPress, userLocation }, ref) => {
    const colors = useColors();
    const mapRef  = useRef<MapView>(null);
    // Track the current region so zoom steps are relative to it
    const regionRef = useRef<Region>(TASHKENT);

    useImperativeHandle(ref, () => ({
      zoomIn() {
        const r = regionRef.current;
        const next: Region = {
          ...r,
          latitudeDelta:  r.latitudeDelta  * ZOOM_FACTOR,
          longitudeDelta: r.longitudeDelta * ZOOM_FACTOR,
        };
        mapRef.current?.animateToRegion(next, 300);
        regionRef.current = next;
      },
      zoomOut() {
        const r = regionRef.current;
        const next: Region = {
          ...r,
          latitudeDelta:  r.latitudeDelta  / ZOOM_FACTOR,
          longitudeDelta: r.longitudeDelta / ZOOM_FACTOR,
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
    }), [userLocation]);

    return (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={TASHKENT}
        onRegionChangeComplete={(r) => { regionRef.current = r; }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {stations.map((s) => {
          const pinColor =
            s.status === 'free'     ? '#10B981' :
            s.status === 'occupied' ? '#F59E0B' : '#94A3B8';
          return (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              pinColor={pinColor}
              onPress={() => onStationPress(s.id)}
            >
              <Callout onPress={() => onStationPress(s.id)}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{s.name}</Text>
                  <Text style={styles.calloutSub}>
                    {s.power_kw} кВт · {s.price_per_kwh.toLocaleString('ru-RU')} сум/кВт·ч
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
    );
  }
);

MapViewWrapper.displayName = 'MapViewWrapper';

const styles = StyleSheet.create({
  callout: { padding: 8, minWidth: 160 },
  calloutTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  calloutSub: { fontSize: 12, color: '#64748B' },
});
