import React, {
  useEffect, useRef, useState, useImperativeHandle, forwardRef,
} from 'react';
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
  id: number; lat: number; lng: number;
  name: string; status: string;
  power_kw: number; price_per_kwh: number;
}

interface Props {
  stations: StationMarker[];
  onStationPress: (id: number) => void;
  userLocation?: { lat: number; lng: number } | null;
  // For route preview mode: draw a polyline through these points
  routePoints?: Array<{ lat: number; lng: number; label?: string; type?: 'origin' | 'stop' | 'dest' }>;
}

export const MapViewWrapper = forwardRef<MapApi, Props>(
  ({ stations, onStationPress, userLocation, routePoints }, ref) => {
    const divRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const leafletRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const userMarkerRef = useRef<any>(null);
    const routeLayerRef = useRef<any>(null);
    const onPressRef = useRef(onStationPress);
    onPressRef.current = onStationPress;
    const [mapReady, setMapReady] = useState(false);

    useImperativeHandle(ref, () => ({
      zoomIn: () => mapRef.current?.zoomIn(),
      zoomOut: () => mapRef.current?.zoomOut(),
      locate: () => {
        if (userLocation) {
          mapRef.current?.setView([userLocation.lat, userLocation.lng], 15, { animate: true });
        } else {
          navigator.geolocation?.getCurrentPosition(
            (pos) => mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 15, { animate: true }),
            () => {},
          );
        }
      },
    }), [userLocation]);

    // Init map
    useEffect(() => {
      if (typeof window === 'undefined') return;
      injectLeafletCSS();
      let cancelled = false;
      (async () => {
        const L = (await import('leaflet')).default;
        leafletRef.current = L;
        if (cancelled || !divRef.current) return;
        const map = L.map(divRef.current, {
          center: TASHKENT, zoom: 12,
          zoomControl: false, attributionControl: false,
        });
        mapRef.current = map;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        if (!cancelled) setMapReady(true);
      })();
      return () => {
        cancelled = true;
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        mapRef.current?.remove();
        mapRef.current = null;
        leafletRef.current = null;
        setMapReady(false);
      };
    }, []);

    // Sync station markers
    useEffect(() => {
      const L = leafletRef.current;
      const map = mapRef.current;
      if (!L || !map) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      stations.forEach((s) => {
        const color =
          s.status === 'free' ? '#10B981' :
          s.status === 'occupied' ? '#F59E0B' : '#94A3B8';
        const icon = L.divIcon({
          html: `<div style="background:${color};width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .15s">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>`,
          className: '', iconSize: [36, 36], iconAnchor: [18, 18],
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

    // User location dot
    useEffect(() => {
      const L = leafletRef.current;
      const map = mapRef.current;
      if (!L || !map || !userLocation) return;
      userMarkerRef.current?.remove();
      const icon = L.divIcon({
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 0 0 4px rgba(37,99,235,.25)"></div>`,
        className: '', iconSize: [16, 16], iconAnchor: [8, 8],
      });
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon }).addTo(map);
      // Center map on first location fix
      map.setView([userLocation.lat, userLocation.lng], 14, { animate: true });
    }, [userLocation, mapReady]);

    // Route polyline
    useEffect(() => {
      const L = leafletRef.current;
      const map = mapRef.current;
      if (!L || !map) return;
      routeLayerRef.current?.remove();
      routeLayerRef.current = null;
      if (!routePoints || routePoints.length < 2) return;

      const latlngs = routePoints.map((p) => [p.lat, p.lng] as [number, number]);

      // Draw dashed polyline
      const line = L.polyline(latlngs, {
        color: '#2563EB', weight: 4, opacity: 0.85, dashArray: '10 6',
      }).addTo(map);

      // Place point markers
      const pointMarkers = routePoints.map((p) => {
        const bg =
          p.type === 'origin' ? '#2563EB' :
          p.type === 'dest' ? '#7C3AED' : '#10B981';
        const icon = L.divIcon({
          html: `<div style="background:${bg};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,.25)"></div>`,
          className: '', iconSize: [14, 14], iconAnchor: [7, 7],
        });
        const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
        if (p.label) m.bindTooltip(p.label, { permanent: false, direction: 'top', offset: [0, -12] });
        return m;
      });

      // Fit bounds
      map.fitBounds(latlngs, { padding: [40, 40], animate: true });

      const group = L.layerGroup([line, ...pointMarkers]).addTo(map);
      routeLayerRef.current = group;

      return () => { group.remove(); };
    }, [routePoints, mapReady]);

    return (
      <View style={styles.container}>
        {/* @ts-ignore */}
        <div ref={divRef} style={{ width: '100%', height: '100%' }} />
      </View>
    );
  }
);

MapViewWrapper.displayName = 'MapViewWrapper';
const styles = StyleSheet.create({ container: { flex: 1 } });
