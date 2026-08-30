import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Карта покрытия с реальными станциями из API.
 *
 * Намеренно не картинка и не встроенный Google Maps: во-первых, число
 * станций — главное доказательство, что сервисом можно пользоваться уже
 * сегодня; во-вторых, чужой скрипт карты тянет мегабайт кода и трекеры на
 * страницу, которая должна открываться на мобильном интернете за секунду.
 *
 * Координаты проецируются на SVG простым линейным преобразованием. На
 * масштабе одной страны искажение проекции незаметно, а зависимость от
 * картографической библиотеки исчезает совсем.
 */

interface Station {
  id: number;
  name: string;
  lat: number;
  lng: number;
  status: 'free' | 'occupied' | 'offline';
}

// Границы Узбекистана с небольшим запасом по краям.
const BOUNDS = { minLng: 55.9, maxLng: 73.2, minLat: 37.1, maxLat: 45.6 };
const VIEW = { w: 720, h: 420 };

/**
 * Упрощённый контур Узбекистана.
 *
 * Без него точки висят в пустой сетке и не читаются как карта: почти все
 * станции сосредоточены вокруг Ташкента, то есть в правой части кадра, а
 * левая половина страны остаётся пустой. Контур объясняет эту пустоту —
 * видно, что покрытие есть не везде, а не что карта сломалась.
 *
 * Точность намеренно грубая: силуэт узнаваем, а тащить ради лендинга
 * настоящую геометрию границ незачем.
 */
const OUTLINE: Array<[number, number]> = [
  [56.0, 41.3], [55.9, 44.9], [58.6, 45.6], [61.0, 44.2], [62.0, 43.5],
  [64.9, 43.0], [66.0, 42.0], [68.5, 41.0], [70.0, 42.2], [70.9, 42.3],
  [71.5, 41.5], [73.1, 41.0], [72.0, 40.2], [71.0, 39.5], [69.5, 40.2],
  [68.0, 40.2], [67.4, 38.9], [68.0, 38.0], [66.6, 37.5], [65.0, 38.2],
  [64.2, 38.9], [62.0, 39.9], [60.0, 41.2], [58.0, 42.7],
];

/** Города-ориентиры: без них набор точек не читается как карта страны. */
const CITIES = [
  { name: 'Ташкент', lat: 41.2995, lng: 69.2401 },
  { name: 'Самарканд', lat: 39.6542, lng: 66.9597 },
  { name: 'Бухара', lat: 39.7747, lng: 64.4286 },
  { name: 'Наманган', lat: 40.9983, lng: 71.6726 },
  { name: 'Нукус', lat: 42.4531, lng: 59.6103 },
];

// Поля вокруг контура: без них силуэт страны упирается в края кадра и
// выглядит обрезанным.
const PAD = { x: 40, y: 34 };

function project(lat: number, lng: number) {
  const w = VIEW.w - PAD.x * 2;
  const h = VIEW.h - PAD.y * 2;
  const x = PAD.x + ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * w;
  // Ось Y в SVG направлена вниз, а широта растёт вверх — переворачиваем.
  const y = PAD.y + h - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * h;
  return { x, y };
}

interface MapLabels {
  stations: string;
  freeNow: string;
  loading: string;
  failed: string;
  live: string;
}

export function CoverageMap({ labels }: { labels: MapLabels }) {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // На Replit лендинг и API живут рядом, и относительного пути достаточно.
    // На внешнем хостинге бэкенда нет — тогда адрес задаётся переменной
    // VITE_API_URL при сборке.
    const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

    fetch(`${base}/api/stations`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { nearby?: Station[] } | Station[]) => {
        // Эндпоинт отдаёт { promoted, nearby }; массив — на случай отката формата.
        const list = Array.isArray(data) ? data : (data.nearby ?? []);
        setStations(list.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)));
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setFailed(true);
      });

    return () => ctrl.abort();
  }, []);

  const points = useMemo(
    () => (stations ?? []).map((s) => ({ ...s, ...project(s.lat, s.lng) })),
    [stations],
  );

  const freeCount = points.filter((p) => p.status === 'free').length;

  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-3xl border border-ink-line bg-ink-soft">
        <svg
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          className="block w-full h-auto"
          role="img"
          aria-label={
            stations
              ? `${stations.length} ${labels.stations}`
              : labels.loading
          }
        >
          {/* Сетка координат: даёт масштаб и не спорит с точками */}
          <defs>
            <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0H0V48" fill="none" stroke="#16403f" strokeWidth="1" />
            </pattern>
            <radialGradient id="glow">
              <stop offset="0%" stopColor="#5b8cff" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#5b8cff" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width={VIEW.w} height={VIEW.h} fill="url(#grid)" opacity="0.35" />

          {/* Контур страны: точки должны читаться как карта, а не как россыпь */}
          <polygon
            points={OUTLINE.map(([lng, lat]) => {
              const p = project(lat, lng);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            }).join(' ')}
            fill="#0c2528"
            stroke="#1f5551"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Свечение вокруг Ташкента — там сосредоточено почти всё покрытие */}
          <circle cx={project(41.2995, 69.2401).x} cy={project(41.2995, 69.2401).y} r="130" fill="url(#glow)" />

          {/* Города-ориентиры */}
          {CITIES.map((c) => {
            const { x, y } = project(c.lat, c.lng);
            return (
              <g key={c.name}>
                <circle cx={x} cy={y} r="2" fill="#7c9490" />
                <text
                  x={x + 8}
                  y={y + 4}
                  fill="#7c9490"
                  fontSize="11"
                  fontFamily="var(--font-body)"
                >
                  {c.name}
                </text>
              </g>
            );
          })}

          {/* Станции */}
          {points.map((p) => (
            <g key={p.id}>
              {/* Пины «свободна» — зелёные: это статус коннектора, а не бренд.
                  Тот же зелёный, что у свободной станции в приложении. */}
              {p.status === 'free' && (
                <circle cx={p.x} cy={p.y} r="4" fill="#2fd08a" className="pin-pulse" />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r="3.4"
                fill={
                  p.status === 'free'
                    ? '#2fd08a'
                    : p.status === 'occupied'
                      ? '#f5a524'
                      : '#7c9490'
                }
              >
                <title>{p.name}</title>
              </circle>
            </g>
          ))}
        </svg>

        {/* Счётчик поверх карты: число станций — и есть главный аргумент.
            Стоит внизу слева: там у карты пусто, а сверху карточка накрывала
            бы западную часть страны. */}
        <div className="absolute bottom-5 left-5 rounded-2xl bg-ink/85 px-4 py-3 backdrop-blur">
          {stations ? (
            <>
              <div className="font-display text-3xl leading-none text-paper">
                {stations.length}
              </div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted">
                {labels.stations}
              </div>
              {freeCount > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-volt">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-volt" />
                  {freeCount} {labels.freeNow}
                </div>
              )}
            </>
          ) : failed ? (
            <div className="max-w-[15rem] text-sm text-muted">{labels.failed}</div>
          ) : (
            <div className="font-mono text-xs text-muted">{labels.loading}</div>
          )}
        </div>
      </div>

      <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted">
        {labels.live}
      </figcaption>
    </figure>
  );
}
