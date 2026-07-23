import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';

const TASHKENT: [number, number] = [41.2995, 69.2401];

function injectLeafletCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ion-leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'ion-leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

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

interface Props {
  stations: StationMarker[];
  onStationPress: (id: number) => void;
}

export const MapViewWrapper = forwardRef<MapApi, Props>(({ stations, onStationPress }, ref) => {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const onPressRef = useRef(onStationPress);
  onPressRef.current = onStationPress;
  const [mapReady, setMapReady] = useState(false);

  // Expose zoom/locate to parent
  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    locate: () => {
      navigator.geolocation?.getCurrentPosition(
        (pos) => mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 15),
        () => {},
      );
    },
  }), []);

  // Init map once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    injectLeafletCSS();
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      leafletRef.current = L;
      if (cancelled || !divRef.current) return;

      const map = L.map(divRef.current, {
        center: TASHKENT,
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      if (!cancelled) setMapReady(true);
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Sync markers whenever stations or map change
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    stations.forEach(s => {
      const color =
        s.status === 'free' ? '#10B981' :
        s.status === 'occupied' ? '#F59E0B' : '#94A3B8';

      const icon = L.divIcon({
        html: `<div style="background:${color};width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(0,0,0,.30);display:flex;align-items:center;justify-content:center;cursor:pointer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([s.lat, s.lng], { icon })
        .addTo(map)
        .on('click', () => onPressRef.current(s.id));

      marker.bindTooltip(
        `<div style="font-family:system-ui,sans-serif;padding:2px 4px">
          <div style="font-weight:700;font-size:13px">${s.name}</div>
          <div style="color:#64748B;font-size:11px;margin-top:2px">${s.power_kw} кВт · ${s.price_per_kwh.toLocaleString('ru-RU')} сум/кВт·ч</div>
        </div>`,
        { direction: 'top', offset: [0, -22], opacity: 1 },
      );

      markersRef.current.push(marker);
    });
  }, [stations, mapReady]);

  return (
    <View style={styles.container}>
      {/* @ts-ignore */}
      <div ref={divRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
});

MapViewWrapper.displayName = 'MapViewWrapper';

const styles = StyleSheet.create({
  container: { flex: 1 },
});
