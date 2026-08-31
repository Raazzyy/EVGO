/**
 * Демо-станции для показа, когда API не вернул ни одной станции.
 *
 * Зачем: приложение никогда не должно открываться пустой картой — это плохо
 * и для демонстрации инвесторам/операторам, и для ревью Apple (у ревьюеров
 * нет узбекской геолокации и, возможно, доступа к боевому API). Как только
 * приходят настоящие станции, эти демо полностью скрываются.
 *
 * Помечены `source: 'mock'` — карточка станции честно рисует бейдж «демо»,
 * чтобы их нельзя было принять за реальные.
 */

export interface DemoStation {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  status: 'free' | 'occupied' | 'offline';
  power_kw: number;
  price_per_kwh: number;
  connectors: Array<{ type: string; power_kw: number; total: number; available: number }>;
  operator: { name: string };
  discount_pct: number;
  is_promoted: boolean;
  promo_ends_at: string | null;
  rating: number | null;
  amenities: string[];
  source: 'mock';
}

// Даём промо-акции час жизни от момента запуска — чтобы таймеры на баннерах
// шли, а не стояли на нуле.
const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

export const DEMO_STATIONS: DemoStation[] = [
  {
    id: -1001, name: 'Tok Bor · Amir Temur',
    address: 'Ташкент, проспект Амира Темура, 15',
    lat: 41.3111, lng: 69.2797, status: 'free', power_kw: 120, price_per_kwh: 1500,
    connectors: [
      { type: 'CCS2', power_kw: 120, total: 2, available: 2 },
      { type: 'CHAdeMO', power_kw: 50, total: 1, available: 1 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 30, is_promoted: true,
    promo_ends_at: inOneHour(), rating: 4.8, amenities: ['wifi', '24/7', 'coffee'], source: 'mock',
  },
  {
    id: -1002, name: 'EVGO Hub · Yunusabad',
    address: 'Ташкент, Юнусабадский район, ул. Амир Темур, 108',
    lat: 41.3639, lng: 69.2894, status: 'occupied', power_kw: 150, price_per_kwh: 1650,
    connectors: [{ type: 'CCS2', power_kw: 150, total: 4, available: 0 }],
    operator: { name: 'EVGO' }, discount_pct: 0, is_promoted: true,
    promo_ends_at: null, rating: 4.9, amenities: ['24/7', 'shop', 'parking'], source: 'mock',
  },
  {
    id: -1003, name: 'Megawatt · Chilanzar',
    address: 'Ташкент, Чиланзарский район, ул. Бунёдкор, 45',
    lat: 41.2748, lng: 69.2035, status: 'free', power_kw: 60, price_per_kwh: 1400,
    connectors: [
      { type: 'Type2', power_kw: 22, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 60, total: 1, available: 1 },
    ],
    operator: { name: 'Megawatt' }, discount_pct: 15, is_promoted: false,
    promo_ends_at: inOneHour(), rating: 4.6, amenities: ['wifi', 'parking'], source: 'mock',
  },
  {
    id: -1004, name: 'K-Watt · Mirzo Ulugbek',
    address: 'Ташкент, Мирзо-Улугбекский район, ул. Мустакиллик, 78',
    lat: 41.3275, lng: 69.3352, status: 'free', power_kw: 90, price_per_kwh: 1550,
    connectors: [{ type: 'CCS2', power_kw: 90, total: 2, available: 1 }],
    operator: { name: 'K-Watt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.5, amenities: ['coffee', 'toilet'], source: 'mock',
  },
  {
    id: -1005, name: 'Tok Bor · Sergeli',
    address: 'Ташкент, Сергелийский район, Малая кольцевая дорога',
    lat: 41.2255, lng: 69.2201, status: 'offline', power_kw: 50, price_per_kwh: 1450,
    connectors: [{ type: 'CHAdeMO', power_kw: 50, total: 1, available: 0 }],
    operator: { name: 'Tok Bor' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.2, amenities: ['parking'], source: 'mock',
  },
  {
    id: -1006, name: 'Quwatt · Yakkasaray',
    address: 'Ташкент, Яккасарайский район, ул. Шота Руставели, 21',
    lat: 41.2857, lng: 69.2453, status: 'occupied', power_kw: 43, price_per_kwh: 1350,
    connectors: [{ type: 'Type2', power_kw: 43, total: 3, available: 1 }],
    operator: { name: 'Quwatt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.4, amenities: ['wifi', 'shop'], source: 'mock',
  },
  {
    id: -1007, name: 'EVGO Hub · Aeroport',
    address: 'Ташкент, аэропорт Ислама Каримова (TAS)',
    lat: 41.2579, lng: 69.2817, status: 'free', power_kw: 180, price_per_kwh: 1700,
    connectors: [
      { type: 'CCS2', power_kw: 180, total: 2, available: 2 },
      { type: 'CHAdeMO', power_kw: 50, total: 1, available: 1 },
      { type: 'Type2', power_kw: 22, total: 2, available: 2 },
    ],
    operator: { name: 'EVGO' }, discount_pct: 20, is_promoted: true,
    promo_ends_at: inOneHour(), rating: 4.7, amenities: ['24/7', 'coffee', 'wifi', 'parking'], source: 'mock',
  },
  {
    id: -1008, name: 'Energo · Olmazor',
    address: 'Ташкент, Алмазарский район, ул. Фароби, 5',
    lat: 41.3505, lng: 69.2033, status: 'free', power_kw: 22, price_per_kwh: 1250,
    connectors: [{ type: 'Type2', power_kw: 22, total: 2, available: 2 }],
    operator: { name: 'Energo' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.3, amenities: ['parking'], source: 'mock',
  },
];

/** Промо-подмножество для секции «Рекомендуем». */
export const DEMO_PROMOTED = DEMO_STATIONS.filter((s) => s.is_promoted);
