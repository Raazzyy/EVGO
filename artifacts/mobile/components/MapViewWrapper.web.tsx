/**
 * Web map using Leaflet + OpenStreetMap.
 * Yandex Maps JS API 2.1 requires domain registration in Yandex Cloud Console —
 * once the key is registered for this domain, swap this file to use ymaps.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

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

interface Station {
  id: number;
  lat: number;
  lng: number;
  name: string;
  status: string;
  power_kw: number;
  price_per_kwh: number;
}

interface Props {
  stations: Station[];
  onStationPress: (id: number) => void;
}

export function MapViewWrapper({ stations, onStationPress }: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const onPressRef = useRef(onStationPress);
  onPressRef.current = onStationPress;
  const [mapReady, setMapReady] = useState(false);

  // ── Init map once ──────────────────────────────────────────────────────────
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
        zoomControl: false,          // custom buttons below
        attributionControl: false,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      if (!cancelled) setMapReady(true);
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  // ── Sync markers whenever stations or map change ───────────────────────────
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
  }, [stations, mapReady]);   // re-run when mapReady flips true or stations update

  // ── Control callbacks ──────────────────────────────────────────────────────
  const handleZoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => mapRef.current?.zoomOut(), []);
  const handleLocate = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 15),
      () => {},
    );
  }, []);

  return (
    <View style={styles.container}>
      {/* @ts-ignore */}
      <div ref={divRef} style={{ width: '100%', height: '100%' }} />

      {/* Controls — bottom-right */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.btn} onPress={handleLocate} activeOpacity={0.8}>
          <Feather name="navigation" size={18} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.zoomGroup}>
          <TouchableOpacity style={[styles.btn, styles.noRadius]} onPress={handleZoomIn} activeOpacity={0.8}>
            <Feather name="plus" size={20} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={[styles.btn, styles.noRadius]} onPress={handleZoomOut} activeOpacity={0.8}>
            <Feather name="minus" size={20} color="#1E293B" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: {
    position: 'absolute',
    bottom: 200,
    right: 12,
    alignItems: 'center',
    gap: 10,
    zIndex: 50,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  zoomGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  noRadius: {
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  divider: { height: 1, backgroundColor: '#E2E8F0', width: 44 },
});
