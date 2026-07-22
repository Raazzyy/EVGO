import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { View, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';

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
}

const TASHKENT = {
  latitude: 41.2995,
  longitude: 69.2401,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export function MapViewWrapper({ stations, onStationPress }: MapViewWrapperProps) {
  const colors = useColors();

  const markerColor = (status: string) =>
    status === 'free' ? colors.free : status === 'occupied' ? colors.occupied : colors.offline;

  return (
    <MapView style={StyleSheet.absoluteFill} initialRegion={TASHKENT} showsUserLocation>
      {stations.map((s) => (
        <Marker
          key={s.id}
          coordinate={{ latitude: s.lat, longitude: s.lng }}
          pinColor={markerColor(s.status)}
          onCalloutPress={() => onStationPress(s.id)}
        >
          <Callout tooltip>
            <View style={[styles.callout, { backgroundColor: colors.card }]}>
              <Text style={[styles.calloutName, { color: colors.text }]}>{s.name}</Text>
              <Text style={[styles.calloutPower, { color: colors.primary }]}>
                {s.power_kw} kW · {s.price_per_kwh.toLocaleString()} sum/kWh
              </Text>
              <Text style={[styles.calloutTap, { color: colors.primary }]}>
                Tap for details →
              </Text>
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  callout: {
    padding: 12,
    borderRadius: 12,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  calloutName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  calloutPower: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
  },
  calloutTap: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
});
