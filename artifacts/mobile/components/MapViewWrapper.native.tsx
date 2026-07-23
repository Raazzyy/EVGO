import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
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

const TASHKENT = {
  latitude: 41.2995,
  longitude: 69.2401,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export const MapViewWrapper = forwardRef<MapApi, MapViewWrapperProps>(
  ({ stations, onStationPress, userLocation }, ref) => {
    const colors = useColors();

    // Native map has built-in controls; expose no-ops via ref
    useImperativeHandle(ref, () => ({
      zoomIn: () => {},
      zoomOut: () => {},
      locate: () => {},
    }), []);

    return (
      <MapView style={StyleSheet.absoluteFillObject} initialRegion={TASHKENT}>
        {stations.map((s) => {
          const pinColor =
            s.status === 'free' ? '#10B981' :
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
