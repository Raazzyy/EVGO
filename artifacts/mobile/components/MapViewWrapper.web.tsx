import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

const TASHKENT: [number, number] = [41.2995, 69.2401];
let yandexKeyCache: string | null = null;

async function fetchYandexKey(): Promise<string> {
  if (yandexKeyCache !== null) return yandexKeyCache;
  try {
    const base = (typeof window !== 'undefined' && (window as any).__API_BASE__) || '';
    const res = await fetch(`${base}/api/config`);
    const data = await res.json();
    yandexKeyCache = data.yandex_maps_key || '';
  } catch {
    yandexKeyCache = '';
  }
  return yandexKeyCache!;
}

function injectLeafletCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ion-leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'ion-leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

async function loadYandexMaps(apiKey: string): Promise<boolean> {
  if (typeof document === 'undefined' || !apiKey) return false;
  if ((window as any).ymaps) return true;
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.onload = () => {
      (window as any).ymaps.ready(() => resolve(true));
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
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

// ─── Yandex Maps implementation ─────────────────────────────────────────────

function useYandexMap(
  divRef: React.RefObject<HTMLDivElement | null>,
  stations: Station[],
  onStationPress: (id: number) => void,
  enabled: boolean
) {
  const mapRef = useRef<any>(null);
  const placemarks = useRef<any[]>([]);
  const onPressRef = useRef(onStationPress);
  onPressRef.current = onStationPress;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      if (!divRef.current) return;
      const ymaps = (window as any).ymaps;
      const map = new ymaps.Map(divRef.current, {
        center: [TASHKENT[0], TASHKENT[1]],
        zoom: 12,
        controls: ['zoomControl'],
      });
      mapRef.current = map;
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    const ymaps = (window as any).ymaps;
    const map = mapRef.current;
    if (!ymaps || !map || !stations.length) return;

    placemarks.current.forEach(p => map.geoObjects.remove(p));
    placemarks.current = [];

    stations.forEach(s => {
      const color =
        s.status === 'free' ? '#10B981'
        : s.status === 'occupied' ? '#F59E0B'
        : '#94A3B8';

      const placemark = new ymaps.Placemark(
        [s.lat, s.lng],
        { balloonContent: `<b>${s.name}</b><br>${s.power_kw} кВт · ${s.price_per_kwh.toLocaleString('ru-RU')} сум/кВт·ч` },
        {
          preset: 'islands#circleDotIcon',
          iconColor: color,
        }
      );
      placemark.events.add('click', () => onPressRef.current(s.id));
      map.geoObjects.add(placemark);
      placemarks.current.push(placemark);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, ready]);
}

// ─── Leaflet (OpenStreetMap) fallback ────────────────────────────────────────

function useLeafletMap(
  divRef: React.RefObject<HTMLDivElement | null>,
  stations: Station[],
  onStationPress: (id: number) => void,
  enabled: boolean
) {
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const onPressRef = useRef(onStationPress);
  onPressRef.current = onStationPress;
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    injectLeafletCSS();
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      leafletRef.current = L;
      if (cancelled || !divRef.current) return;
      const map = L.map(divRef.current, { center: TASHKENT, zoom: 12, zoomControl: true });
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !stations.length) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    stations.forEach(s => {
      const color = s.status === 'free' ? '#10B981' : s.status === 'occupied' ? '#F59E0B' : '#94A3B8';
      const icon = L.divIcon({
        html: `<div style="background:${color};width:34px;height:34px;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>`,
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const marker = L.marker([s.lat, s.lng], { icon })
        .addTo(map)
        .on('click', () => onPressRef.current(s.id));
      marker.bindTooltip(
        `<div style="font-family:system-ui,sans-serif"><div style="font-weight:700;font-size:13px">${s.name}</div><div style="color:#64748B;font-size:11px;margin-top:2px">${s.power_kw} кВт · ${s.price_per_kwh.toLocaleString('ru-RU')} сум/кВт·ч</div></div>`,
        { direction: 'top', offset: [0, -22], opacity: 1 }
      );
      markersRef.current.push(marker);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, mapReady]);
}

// ─── Main component ──────────────────────────────────────────────────────────

export function MapViewWrapper({ stations, onStationPress }: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const [useYandex, setUseYandex] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    (async () => {
      const key = await fetchYandexKey();
      if (key) {
        const loaded = await loadYandexMaps(key);
        setUseYandex(loaded);
      }
      setResolved(true);
    })();
  }, []);

  useYandexMap(divRef, stations, onStationPress, resolved && useYandex);
  useLeafletMap(divRef, stations, onStationPress, resolved && !useYandex);

  return (
    <View style={styles.container}>
      {/* @ts-ignore */}
      <div ref={divRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
