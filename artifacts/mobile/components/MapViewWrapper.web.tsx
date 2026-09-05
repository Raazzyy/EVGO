import React, {
  useEffect, useRef, useState, useImperativeHandle, forwardRef,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeScheme } from '@/contexts/ThemeContext';
import { pinColor, pinOpacity } from '@/lib/mapPins';

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
  /** Navigation camera follow — no-op on web (Leaflet has no heading/pitch). */
  followUser: (lat: number, lng: number, heading: number) => void;
  /** Returns pixel coords of lat/lng relative to the map container's top-left corner. */
  projectPoint: (lat: number, lng: number) => Promise<{ x: number; y: number } | null>;
}

export interface StationMarker {
  id: number; lat: number; lng: number;
  name: string; status: string;
  power_kw: number; price_per_kwh: number;
  is_promoted?: boolean;
}

interface Props {
  stations: StationMarker[];
  onStationPress: (id: number) => void;
  onMapPress?: () => void;
  onRegionChange?: () => void;
  userLocation?: { lat: number; lng: number } | null;
  routePoints?: Array<{ lat: number; lng: number; label?: string; type?: 'origin' | 'stop' | 'dest' }>;
  polylineCoords?: Array<[number, number]>;
}

export const MapViewWrapper = forwardRef<MapApi, Props>(
  ({ stations, onStationPress, onMapPress, onRegionChange, userLocation, routePoints, polylineCoords }, ref) => {
    const divRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const leafletRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const userMarkerRef = useRef<any>(null);
    const routeLayerRef = useRef<any>(null);
    const baseTileRef = useRef<any>(null);
    const refTileRef = useRef<any>(null);
    const onPressRef        = useRef(onStationPress);
    const onMapPressRef     = useRef(onMapPress);
    const onRegionChangeRef = useRef(onRegionChange);
    // Guard: prevent the map 'click' from clearing selection right after a marker click
    const markerJustClicked = useRef(false);
    onPressRef.current        = onStationPress;
    onMapPressRef.current     = onMapPress;
    onRegionChangeRef.current = onRegionChange;
    const [mapReady, setMapReady] = useState(false);
    // Счётчик для перерисовки маркеров при остановке панорамы/зума — нужен для
    // culling: на большом наборе рендерим только пины в видимой области.
    const [cullVer, setCullVer] = useState(0);
    // Тема карты — из настроек приложения, а не из системной (иначе при выборе
    // тёмной темы вручную тайлы оставались бы светлыми).
    const darkTheme = useThemeScheme() === 'dark';

    useImperativeHandle(ref, () => ({
      zoomIn:  () => mapRef.current?.zoomIn(),
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
      // Leaflet has no heading/pitch — pan + zoom without rotation
      followUser: (lat: number, lng: number, _heading: number) => {
        mapRef.current?.setView([lat, lng], 17, { animate: true, duration: 0.8 });
      },
      projectPoint: async (lat, lng) => {
        const map = mapRef.current;
        if (!map) return null;
        try {
          const pt = map.latLngToContainerPoint([lat, lng]);
          return { x: pt.x, y: pt.y };
        } catch {
          return null;
        }
      },
    }), [userLocation]);

    // Init map
    useEffect(() => {
      if (typeof window === 'undefined') return;
      injectLeafletCSS();
      let cancelled = false;
      let rafId: number | null = null;
      let resizeObs: ResizeObserver | null = null;

      (async () => {
        const L = (await import('leaflet')).default;
        leafletRef.current = L;
        if (cancelled || !divRef.current) return;
        const map = L.map(divRef.current, {
          center: TASHKENT, zoom: 12,
          zoomControl: false, attributionControl: false,
        });
        mapRef.current = map;
        // Тайлы подложки ставит отдельный эффект (ниже) — он же меняет их при
        // смене темы. Тема грузится из хранилища асинхронно, уже после init,
        // поэтому ставить тайлы прямо здесь нельзя: подхватили бы системную.

        // Map-level click → close quick view (skip if a marker was just clicked)
        map.on('click', () => {
          if (markerJustClicked.current) return;
          onMapPressRef.current?.();
        });

        // Region change → throttled via rAF so we don't fire >1× per frame
        const fireRegionChange = () => {
          if (rafId) return;
          rafId = requestAnimationFrame(() => {
            onRegionChangeRef.current?.();
            rafId = null;
          });
        };
        map.on('move', fireRegionChange);
        map.on('zoom', fireRegionChange);
        // Перерисовать видимые маркеры, когда движение остановилось (culling).
        map.on('moveend', () => setCullVer((v) => v + 1));
        map.on('zoomend', () => setCullVer((v) => v + 1));

        // При ресайзе/повороте (окно, поворот планшета, монитор авто) Leaflet
        // сам не пересчитывает размер → половина карты становится серой.
        // ResizeObserver дёргает invalidateSize (UI-03).
        if (typeof ResizeObserver !== 'undefined' && divRef.current) {
          resizeObs = new ResizeObserver(() => { mapRef.current?.invalidateSize(); });
          resizeObs.observe(divRef.current);
        }

        if (!cancelled) setMapReady(true);
      })();
      return () => {
        cancelled = true;
        if (rafId) cancelAnimationFrame(rafId);
        resizeObs?.disconnect();
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        mapRef.current?.remove();
        mapRef.current = null;
        leafletRef.current = null;
        setMapReady(false);
      };
    }, []);

    // Подложка карты по теме приложения. Отдельный эффект, потому что тема
    // приезжает из хранилища асинхронно уже после init; при смене темы тайлы
    // пересоздаются. Esri Canvas — бесключевая, приглушённая; в тёмной берём
    // Dark Gray, чтобы карта не была светлым пятном.
    useEffect(() => {
      const L = leafletRef.current;
      const map = mapRef.current;
      if (!L || !map) return;
      baseTileRef.current?.remove();
      refTileRef.current?.remove();
      const canvas = darkTheme ? 'Dark_Gray' : 'Light_Gray';
      baseTileRef.current = L.tileLayer(
        `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${canvas}_Base/MapServer/tile/{z}/{y}/{x}`,
        { maxZoom: 16 },
      ).addTo(map);
      refTileRef.current = L.tileLayer(
        `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${canvas}_Reference/MapServer/tile/{z}/{y}/{x}`,
        { maxZoom: 16 },
      ).addTo(map);
    }, [darkTheme, mapReady]);

    // Sync station markers
    useEffect(() => {
      const L = leafletRef.current;
      const map = mapRef.current;
      if (!L || !map) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      // Culling: на большом наборе (сотни станций) рендерим только те пины,
      // что попадают в видимую область (с запасом), иначе Leaflet создаёт
      // сотни DOM-иконок и карта заметно тормозит. Мелкие наборы — как есть.
      let visible = stations;
      if (stations.length > 250) {
        try {
          const b = map.getBounds().pad(0.3);
          const culled = stations.filter((s) => b.contains([s.lat, s.lng]));
          // Подстраховка: если в кадре пусто (сильно отдалили) — покажем всё.
          visible = culled.length > 0 ? culled : stations;
        } catch { visible = stations; }
      }
      // Жёсткий лимит DOM-иконок: на общем зуме весь город влезает в кадр, и
      // куллинг не спасает. Промо-пины оставляем всегда, остальные прореживаем.
      const MAX_MARKERS = 120;
      if (visible.length > MAX_MARKERS) {
        const promoted = visible.filter((s) => s.is_promoted);
        const rest = visible.filter((s) => !s.is_promoted);
        const slots = Math.max(0, MAX_MARKERS - promoted.length);
        const stride = slots > 0 ? Math.ceil(rest.length / slots) : rest.length + 1;
        const sampled = slots > 0 ? rest.filter((_, i) => i % stride === 0).slice(0, slots) : [];
        visible = [...promoted, ...sampled];
      }
      visible.forEach((s) => {
        // Цвет = скорость зарядки, прозрачность = занятость (см. lib/mapPins).
        const color = pinColor(s.power_kw, s.status);
        const opacity = pinOpacity(s.status);
        const promoted = !!s.is_promoted;
        // Аккуратные пины (в духе Яндекс Заправок / Electroverse)
        const size = promoted ? 32 : 26;
        const border = promoted ? '2px solid #FCD34D' : '1.5px solid #fff';
        const shadow = promoted
          ? '0 2px 8px rgba(245,158,11,.45)'
          : '0 2px 5px rgba(0,0,0,.3)';
        const zap = promoted ? 16 : 13;
        const icon = L.divIcon({
          html: `<div style="position:relative;background:${color};opacity:${opacity};width:${size}px;height:${size}px;border-radius:50%;border:${border};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .15s">
            <svg width="${zap}" height="${zap}" viewBox="0 0 24 24" fill="#FFFFFF">
              <path d="M13 2L4 13.5h7L10 22l9.5-11.5h-7L14 2z"/>
            </svg>
          </div>`,
          className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        });
        const marker = L.marker([s.lat, s.lng], { icon }).addTo(map);
        marker.on('click', (e: any) => {
          // e — LeafletMouseEvent; нативное событие в e.originalEvent, иначе
          // клик всплывает до map.on('click') и сбрасывает выбранную станцию.
          if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
          markerJustClicked.current = true;
          // На тач-экранах синтетический click приходит ~300 мс — окно 450 мс,
          // иначе карточка станции схлопывается сразу после открытия.
          setTimeout(() => { markerJustClicked.current = false; }, 450);
          onPressRef.current(s.id);
        });
        markersRef.current.push(marker);
      });
    }, [stations, mapReady, cullVer]);

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

      const waypointLatlngs = routePoints.map((p) => [p.lat, p.lng] as [number, number]);
      const roadLatlngs: [number, number][] = polylineCoords && polylineCoords.length >= 2
        ? polylineCoords
        : waypointLatlngs;

      const line = L.polyline(roadLatlngs, { color: '#2563EB', weight: 5, opacity: 0.9 }).addTo(map);

      const pointMarkers = routePoints.map((p) => {
        const bg =
          p.type === 'origin' ? '#2563EB' :
          p.type === 'dest'   ? '#7C3AED' : '#10B981';
        const icon = L.divIcon({
          html: `<div style="background:${bg};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,.25)"></div>`,
          className: '', iconSize: [14, 14], iconAnchor: [7, 7],
        });
        const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
        if (p.label) m.bindTooltip(p.label, { permanent: false, direction: 'top', offset: [0, -12] });
        return m;
      });

      map.fitBounds(waypointLatlngs, { padding: [50, 50], animate: true, maxZoom: 14 });

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
