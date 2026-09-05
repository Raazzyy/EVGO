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
const inHours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

export const DEMO_STATIONS: DemoStation[] = [
  // ── Центр и Шайхонтохур ────────────────────────────────────────────────────
  {
    id: -1001, name: 'Tok Bor · Amir Temur',
    address: 'Ташкент, проспект Амира Темура, 15',
    lat: 41.3111, lng: 69.2797, status: 'free', power_kw: 120, price_per_kwh: 1500,
    connectors: [
      { type: 'CCS2', power_kw: 120, total: 2, available: 2 },
      { type: 'CHAdeMO', power_kw: 50, total: 1, available: 1 },
      { type: 'GB/T', power_kw: 120, total: 2, available: 1 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 30, is_promoted: true,
    promo_ends_at: inHours(2), rating: 4.8, amenities: ['wifi', '24/7', 'coffee', 'parking'], source: 'mock',
  },
  {
    id: -1002, name: 'EVGO Hub · Tashkent City Mall',
    address: 'Ташкент, ул. Батыра Закирова, ТРЦ Tashkent City Mall',
    lat: 41.3135, lng: 69.2520, status: 'free', power_kw: 180, price_per_kwh: 1650,
    connectors: [
      { type: 'CCS2', power_kw: 180, total: 4, available: 3 },
      { type: 'GB/T', power_kw: 180, total: 4, available: 4 },
      { type: 'Type2', power_kw: 22, total: 2, available: 2 },
    ],
    operator: { name: 'EVGO' }, discount_pct: 25, is_promoted: true,
    promo_ends_at: inHours(3), rating: 4.9, amenities: ['24/7', 'shop', 'parking', 'wifi', 'coffee'], source: 'mock',
  },
  {
    id: -1003, name: 'EVGO Ultra · Hilton & Congress Hall',
    address: 'Ташкент, Tashkent City, ул. Ислама Каримова, 2',
    lat: 41.3150, lng: 69.2485, status: 'free', power_kw: 240, price_per_kwh: 1750,
    connectors: [
      { type: 'CCS2', power_kw: 240, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 240, total: 2, available: 1 },
    ],
    operator: { name: 'EVGO' }, discount_pct: 0, is_promoted: true,
    promo_ends_at: null, rating: 4.9, amenities: ['24/7', 'parking', 'wifi', 'coffee'], source: 'mock',
  },
  {
    id: -1004, name: 'Megawatt · Navoiy Shox',
    address: 'Ташкент, проспект Алишера Навои, 30',
    lat: 41.3195, lng: 69.2440, status: 'free', power_kw: 120, price_per_kwh: 1450,
    connectors: [
      { type: 'GB/T', power_kw: 120, total: 2, available: 2 },
      { type: 'CCS2', power_kw: 120, total: 1, available: 1 },
    ],
    operator: { name: 'Megawatt' }, discount_pct: 15, is_promoted: false,
    promo_ends_at: inHours(1), rating: 4.6, amenities: ['parking', 'coffee'], source: 'mock',
  },
  {
    id: -1005, name: 'Tok Bor · Chorsu Bozor',
    address: 'Ташкент, площадь Чорсу, гостиница Чорсу',
    lat: 41.3270, lng: 69.2345, status: 'occupied', power_kw: 90, price_per_kwh: 1400,
    connectors: [
      { type: 'GB/T', power_kw: 90, total: 2, available: 0 },
      { type: 'Type2', power_kw: 22, total: 2, available: 0 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.5, amenities: ['shop', 'parking'], source: 'mock',
  },
  {
    id: -1006, name: 'K-Watt · Khadra Hotel',
    address: 'Ташкент, ул. Заркайнар, 2, Хадра',
    lat: 41.3235, lng: 69.2435, status: 'free', power_kw: 60, price_per_kwh: 1350,
    connectors: [
      { type: 'CCS2', power_kw: 60, total: 2, available: 1 },
      { type: 'Type2', power_kw: 22, total: 2, available: 2 },
    ],
    operator: { name: 'K-Watt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.4, amenities: ['hotel', 'parking'], source: 'mock',
  },
  {
    id: -1007, name: 'Quwatt · Samarqand Darvoza Mall',
    address: 'Ташкент, ул. Коратош, 5А, ТРЦ Samarqand Darvoza',
    lat: 41.3168, lng: 69.2272, status: 'free', power_kw: 120, price_per_kwh: 1550,
    connectors: [
      { type: 'CCS2', power_kw: 120, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 120, total: 2, available: 1 },
    ],
    operator: { name: 'Quwatt' }, discount_pct: 20, is_promoted: true,
    promo_ends_at: inHours(4), rating: 4.7, amenities: ['shop', 'coffee', 'parking', 'wifi'], source: 'mock',
  },
  {
    id: -1008, name: 'Energo · Alisher Navoi Teatr',
    address: 'Ташкент, ул. Зарафшан, сквер Театра Навои',
    lat: 41.3090, lng: 69.2715, status: 'free', power_kw: 60, price_per_kwh: 1300,
    connectors: [
      { type: 'Type2', power_kw: 22, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 60, total: 1, available: 1 },
    ],
    operator: { name: 'Energo' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.3, amenities: ['parking'], source: 'mock',
  },
  {
    id: -1009, name: 'Carwon · Beshagach',
    address: 'Ташкент, ул. Бешагач, парк Миллий Бог',
    lat: 41.3045, lng: 69.2440, status: 'free', power_kw: 120, price_per_kwh: 1480,
    connectors: [
      { type: 'CCS2', power_kw: 120, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 120, total: 2, available: 2 },
    ],
    operator: { name: 'Carwon' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.6, amenities: ['park', 'parking', 'coffee'], source: 'mock',
  },
  {
    id: -1010, name: 'Tok Bor · Sebzor Center',
    address: 'Ташкент, ул. Себзор, 8, ТЦ Sebzor',
    lat: 41.3360, lng: 69.2480, status: 'free', power_kw: 90, price_per_kwh: 1420,
    connectors: [
      { type: 'CCS2', power_kw: 90, total: 1, available: 1 },
      { type: 'GB/T', power_kw: 90, total: 2, available: 1 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.5, amenities: ['shop', 'parking'], source: 'mock',
  },
  {
    id: -1011, name: 'EVGO Fast · Magic City',
    address: 'Ташкент, ул. Бабура, 174, парк Magic City',
    lat: 41.3020, lng: 69.2460, status: 'free', power_kw: 150, price_per_kwh: 1600,
    connectors: [
      { type: 'CCS2', power_kw: 150, total: 3, available: 2 },
      { type: 'GB/T', power_kw: 150, total: 3, available: 3 },
    ],
    operator: { name: 'EVGO' }, discount_pct: 15, is_promoted: true,
    promo_ends_at: inHours(5), rating: 4.9, amenities: ['park', 'shop', 'coffee', 'parking'], source: 'mock',
  },
  {
    id: -1012, name: 'K-Watt · Oloy Bozori',
    address: 'Ташкент, ул. Амира Темура, Алайский рынок',
    lat: 41.3200, lng: 69.2840, status: 'occupied', power_kw: 90, price_per_kwh: 1450,
    connectors: [
      { type: 'Type2', power_kw: 22, total: 2, available: 0 },
      { type: 'CCS2', power_kw: 90, total: 2, available: 0 },
    ],
    operator: { name: 'K-Watt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.4, amenities: ['shop', 'parking'], source: 'mock',
  },
  {
    id: -1013, name: 'Tok Bor · Minor Metro',
    address: 'Ташкент, проспект Амира Темура, мечеть Минор',
    lat: 41.3320, lng: 69.2820, status: 'free', power_kw: 120, price_per_kwh: 1500,
    connectors: [
      { type: 'CCS2', power_kw: 120, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 120, total: 2, available: 1 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.7, amenities: ['parking', '24/7'], source: 'mock',
  },
  {
    id: -1014, name: 'Megawatt · Hyatt Regency',
    address: 'Ташкент, ул. Навои, 1, отель Hyatt Regency',
    lat: 41.3175, lng: 69.2750, status: 'free', power_kw: 120, price_per_kwh: 1600,
    connectors: [
      { type: 'CCS2', power_kw: 120, total: 2, available: 2 },
      { type: 'Type2', power_kw: 22, total: 2, available: 2 },
    ],
    operator: { name: 'Megawatt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.8, amenities: ['hotel', 'coffee', 'parking'], source: 'mock',
  },

  // ── Чиланзар и Учтепа ──────────────────────────────────────────────────────
  {
    id: -1015, name: 'Megawatt · Bunyodkor Chilanzar',
    address: 'Ташкент, Чиланзарский район, проспект Бунёдкор, 45',
    lat: 41.2748, lng: 69.2035, status: 'free', power_kw: 120, price_per_kwh: 1400,
    connectors: [
      { type: 'Type2', power_kw: 22, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 120, total: 2, available: 2 },
    ],
    operator: { name: 'Megawatt' }, discount_pct: 15, is_promoted: false,
    promo_ends_at: inHours(1), rating: 4.6, amenities: ['wifi', 'parking'], source: 'mock',
  },
  {
    id: -1016, name: 'EVGO Fast · Chilanzar Metro',
    address: 'Ташкент, Чиланзар 2-й квартал, станция метро Чиланзар',
    lat: 41.2710, lng: 69.1980, status: 'free', power_kw: 150, price_per_kwh: 1550,
    connectors: [
      { type: 'CCS2', power_kw: 150, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 150, total: 2, available: 1 },
    ],
    operator: { name: 'EVGO' }, discount_pct: 20, is_promoted: true,
    promo_ends_at: inHours(3), rating: 4.8, amenities: ['shop', 'parking', 'coffee'], source: 'mock',
  },
  {
    id: -1017, name: 'Tok Bor · Farhod Bozori',
    address: 'Ташкент, Учтепинский район, ул. Фархадская, рынок Фархад',
    lat: 41.2785, lng: 69.1780, status: 'free', power_kw: 120, price_per_kwh: 1450,
    connectors: [
      { type: 'GB/T', power_kw: 120, total: 2, available: 2 },
      { type: 'CCS2', power_kw: 120, total: 2, available: 1 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.5, amenities: ['shop', 'parking'], source: 'mock',
  },
  {
    id: -1018, name: 'K-Watt · Qatortol Mall',
    address: 'Ташкент, Чиланзар, ул. Катартал, ТРЦ Parus / Катартал',
    lat: 41.2825, lng: 69.2120, status: 'free', power_kw: 90, price_per_kwh: 1420,
    connectors: [
      { type: 'CCS2', power_kw: 90, total: 2, available: 1 },
      { type: 'Type2', power_kw: 22, total: 2, available: 2 },
    ],
    operator: { name: 'K-Watt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.6, amenities: ['shop', 'coffee', 'parking'], source: 'mock',
  },
  {
    id: -1019, name: 'Volt Auto · Mirzo Ulugbek Metro',
    address: 'Ташкент, проспект Бунёдкор, стадион Бунёдкор',
    lat: 41.2840, lng: 69.2195, status: 'free', power_kw: 160, price_per_kwh: 1580,
    connectors: [
      { type: 'GB/T', power_kw: 160, total: 2, available: 2 },
      { type: 'CCS2', power_kw: 160, total: 2, available: 2 },
    ],
    operator: { name: 'Volt Auto' }, discount_pct: 10, is_promoted: true,
    promo_ends_at: inHours(2), rating: 4.7, amenities: ['parking', '24/7'], source: 'mock',
  },
  {
    id: -1020, name: 'Makro EV · Chilonzor 9',
    address: 'Ташкент, Чиланзар, 9-й квартал, супермаркет Makro',
    lat: 41.2680, lng: 69.1890, status: 'free', power_kw: 60, price_per_kwh: 1350,
    connectors: [
      { type: 'GB/T', power_kw: 60, total: 1, available: 1 },
      { type: 'Type2', power_kw: 22, total: 2, available: 2 },
    ],
    operator: { name: 'Makro EV' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.3, amenities: ['shop', 'parking'], source: 'mock',
  },
  {
    id: -1021, name: 'Quwatt · Lutfiy Uchtepa',
    address: 'Ташкент, Учтепинский район, ул. Лутфий, 54',
    lat: 41.2890, lng: 69.1810, status: 'occupied', power_kw: 60, price_per_kwh: 1300,
    connectors: [
      { type: 'Type2', power_kw: 22, total: 2, available: 0 },
      { type: 'GB/T', power_kw: 60, total: 1, available: 0 },
    ],
    operator: { name: 'Quwatt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.2, amenities: ['parking'], source: 'mock',
  },
  {
    id: -1022, name: 'Tok Bor · Rakatbashi',
    address: 'Ташкент, Яккасарайский район, ул. Ракатбоши, 24',
    lat: 41.2925, lng: 69.2460, status: 'free', power_kw: 90, price_per_kwh: 1450,
    connectors: [
      { type: 'CCS2', power_kw: 90, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 90, total: 2, available: 1 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.6, amenities: ['coffee', 'parking'], source: 'mock',
  },
  {
    id: -1023, name: 'Carwon · Muqimiy Ko\'chasi',
    address: 'Ташкент, Чиланзар, ул. Мукими, мост Новза',
    lat: 41.2855, lng: 69.2260, status: 'free', power_kw: 120, price_per_kwh: 1480,
    connectors: [
      { type: 'GB/T', power_kw: 120, total: 2, available: 2 },
      { type: 'CCS2', power_kw: 120, total: 2, available: 1 },
    ],
    operator: { name: 'Carwon' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.5, amenities: ['parking', '24/7'], source: 'mock',
  },
  {
    id: -1024, name: 'Tok Bor · Samarkand Highway (M39)',
    address: 'Ташкент, выезд на трассу М39 (Самарканд), пост ДПС Эркин',
    lat: 41.2450, lng: 69.1550, status: 'free', power_kw: 180, price_per_kwh: 1650,
    connectors: [
      { type: 'CCS2', power_kw: 180, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 180, total: 2, available: 2 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 20, is_promoted: true,
    promo_ends_at: inHours(6), rating: 4.9, amenities: ['24/7', 'coffee', 'toilet', 'parking'], source: 'mock',
  },

  // ── Яккасарай и Мирабад ────────────────────────────────────────────────────
  {
    id: -1025, name: 'Quwatt · Shota Rustaveli',
    address: 'Ташкент, Яккасарайский район, ул. Шота Руставели, 21',
    lat: 41.2857, lng: 69.2453, status: 'occupied', power_kw: 43, price_per_kwh: 1350,
    connectors: [{ type: 'Type2', power_kw: 43, total: 3, available: 1 }],
    operator: { name: 'Quwatt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.4, amenities: ['wifi', 'shop'], source: 'mock',
  },
  {
    id: -1026, name: 'EVGO Hub · Next Mall',
    address: 'Ташкент, ул. Бабура, 6, ТРЦ Next',
    lat: 41.2980, lng: 69.2505, status: 'free', power_kw: 180, price_per_kwh: 1600,
    connectors: [
      { type: 'CCS2', power_kw: 180, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 180, total: 3, available: 2 },
    ],
    operator: { name: 'EVGO' }, discount_pct: 15, is_promoted: true,
    promo_ends_at: inHours(4), rating: 4.8, amenities: ['shop', 'coffee', 'parking', 'wifi'], source: 'mock',
  },
  {
    id: -1027, name: 'Megawatt · Bobur Park',
    address: 'Ташкент, ул. Бабура, парк Дружбы (бывш. Бабура)',
    lat: 41.2930, lng: 69.2550, status: 'free', power_kw: 120, price_per_kwh: 1480,
    connectors: [
      { type: 'GB/T', power_kw: 120, total: 2, available: 2 },
      { type: 'CCS2', power_kw: 120, total: 1, available: 1 },
    ],
    operator: { name: 'Megawatt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.5, amenities: ['park', 'parking'], source: 'mock',
  },
  {
    id: -1028, name: 'K-Watt · Grand Mir Hotel',
    address: 'Ташкент, ул. Мирабадская, 2, гостиница Grand Mir',
    lat: 41.2985, lng: 69.2680, status: 'free', power_kw: 90, price_per_kwh: 1550,
    connectors: [
      { type: 'CCS2', power_kw: 90, total: 2, available: 2 },
      { type: 'Type2', power_kw: 22, total: 2, available: 1 },
    ],
    operator: { name: 'K-Watt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.6, amenities: ['hotel', 'coffee', 'parking'], source: 'mock',
  },
  {
    id: -1029, name: 'Tok Bor · Oybek Metro',
    address: 'Ташкент, ул. Афросиаб, 12, станция метро Ойбек',
    lat: 41.2965, lng: 69.2810, status: 'free', power_kw: 120, price_per_kwh: 1520,
    connectors: [
      { type: 'GB/T', power_kw: 120, total: 2, available: 1 },
      { type: 'CCS2', power_kw: 120, total: 2, available: 2 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.7, amenities: ['coffee', 'parking', '24/7'], source: 'mock',
  },
  {
    id: -1030, name: 'Energo · Nukus Shox',
    address: 'Ташкент, Мирабадский район, ул. Нукус, 89',
    lat: 41.2905, lng: 69.2740, status: 'free', power_kw: 60, price_per_kwh: 1350,
    connectors: [
      { type: 'Type2', power_kw: 22, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 60, total: 1, available: 1 },
    ],
    operator: { name: 'Energo' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.3, amenities: ['parking'], source: 'mock',
  },
  {
    id: -1031, name: 'Volt Auto · Severny Vokzal',
    address: 'Ташкент, Привокзальная площадь, Северный вокзал',
    lat: 41.2915, lng: 69.2940, status: 'free', power_kw: 150, price_per_kwh: 1580,
    connectors: [
      { type: 'CCS2', power_kw: 150, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 150, total: 2, available: 1 },
    ],
    operator: { name: 'Volt Auto' }, discount_pct: 10, is_promoted: false,
    promo_ends_at: inHours(2), rating: 4.6, amenities: ['24/7', 'parking'], source: 'mock',
  },
  {
    id: -1032, name: 'Tok Bor · Yuzhny Vokzal',
    address: 'Ташкент, ул. Усмана Носира, Южный вокзал',
    lat: 41.2635, lng: 69.2290, status: 'free', power_kw: 90, price_per_kwh: 1450,
    connectors: [
      { type: 'GB/T', power_kw: 90, total: 2, available: 2 },
      { type: 'CCS2', power_kw: 90, total: 1, available: 1 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.4, amenities: ['parking', '24/7'], source: 'mock',
  },
  {
    id: -1033, name: 'EVGO Hub · Aeroport Islam Karimov',
    address: 'Ташкент, аэропорт Ислама Каримова (Терминал 2)',
    lat: 41.2579, lng: 69.2817, status: 'free', power_kw: 240, price_per_kwh: 1700,
    connectors: [
      { type: 'CCS2', power_kw: 240, total: 3, available: 3 },
      { type: 'GB/T', power_kw: 240, total: 3, available: 2 },
      { type: 'CHAdeMO', power_kw: 50, total: 1, available: 1 },
    ],
    operator: { name: 'EVGO' }, discount_pct: 20, is_promoted: true,
    promo_ends_at: inHours(4), rating: 4.9, amenities: ['24/7', 'coffee', 'wifi', 'parking'], source: 'mock',
  },
  {
    id: -1034, name: 'Carwon · Askiya Bozori',
    address: 'Ташкент, ул. Шота Руставели, базар Аския',
    lat: 41.2895, lng: 69.2385, status: 'free', power_kw: 90, price_per_kwh: 1420,
    connectors: [
      { type: 'GB/T', power_kw: 90, total: 2, available: 2 },
      { type: 'Type2', power_kw: 22, total: 2, available: 1 },
    ],
    operator: { name: 'Carwon' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.4, amenities: ['shop', 'parking'], source: 'mock',
  },

  // ── Юнусабад и Алмазар ─────────────────────────────────────────────────────
  {
    id: -1035, name: 'EVGO Hub · Mega Planet Yunusabad',
    address: 'Ташкент, Юнусабад 11-й квартал, ТРЦ Mega Planet',
    lat: 41.3639, lng: 69.2894, status: 'free', power_kw: 180, price_per_kwh: 1650,
    connectors: [
      { type: 'CCS2', power_kw: 180, total: 4, available: 3 },
      { type: 'GB/T', power_kw: 180, total: 2, available: 2 },
    ],
    operator: { name: 'EVGO' }, discount_pct: 15, is_promoted: true,
    promo_ends_at: inHours(3), rating: 4.9, amenities: ['24/7', 'shop', 'parking', 'wifi', 'coffee'], source: 'mock',
  },
  {
    id: -1036, name: 'Megawatt · Shahriston',
    address: 'Ташкент, Юнусабад, проспект Амира Темура, метро Шахристан',
    lat: 41.3530, lng: 69.2860, status: 'free', power_kw: 120, price_per_kwh: 1450,
    connectors: [
      { type: 'GB/T', power_kw: 120, total: 2, available: 1 },
      { type: 'CCS2', power_kw: 120, total: 2, available: 2 },
    ],
    operator: { name: 'Megawatt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.6, amenities: ['parking', 'coffee'], source: 'mock',
  },
  {
    id: -1037, name: 'Quwatt · Bodomzor',
    address: 'Ташкент, Юнусабад, ул. Бодомзор, рядом с Узэкспоцентром',
    lat: 41.3410, lng: 69.2840, status: 'free', power_kw: 60, price_per_kwh: 1350,
    connectors: [
      { type: 'GB/T', power_kw: 60, total: 2, available: 2 },
      { type: 'Type2', power_kw: 22, total: 2, available: 2 },
    ],
    operator: { name: 'Quwatt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.4, amenities: ['parking'], source: 'mock',
  },
  {
    id: -1038, name: 'Energo · Farobi Olmazor',
    address: 'Ташкент, Алмазарский район, ул. Фароби, 5',
    lat: 41.3505, lng: 69.2033, status: 'free', power_kw: 60, price_per_kwh: 1300,
    connectors: [{ type: 'Type2', power_kw: 22, total: 2, available: 2 }, { type: 'GB/T', power_kw: 60, total: 1, available: 1 }],
    operator: { name: 'Energo' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.3, amenities: ['parking'], source: 'mock',
  },
  {
    id: -1039, name: 'Makro EV · Beruniy Metro',
    address: 'Ташкент, Алмазар, ул. Беруни, ТЦ Beruniy',
    lat: 41.3440, lng: 69.2070, status: 'free', power_kw: 90, price_per_kwh: 1400,
    connectors: [
      { type: 'GB/T', power_kw: 90, total: 2, available: 2 },
      { type: 'CCS2', power_kw: 90, total: 1, available: 1 },
    ],
    operator: { name: 'Makro EV' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.5, amenities: ['shop', 'parking'], source: 'mock',
  },
  {
    id: -1040, name: 'Tok Bor · Riviera Mall',
    address: 'Ташкент, Алмазар, ул. Нурафшон, 5, ТРЦ Riviera',
    lat: 41.3420, lng: 69.2470, status: 'free', power_kw: 150, price_per_kwh: 1600,
    connectors: [
      { type: 'CCS2', power_kw: 150, total: 3, available: 2 },
      { type: 'GB/T', power_kw: 150, total: 3, available: 3 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 20, is_promoted: true,
    promo_ends_at: inHours(4), rating: 4.8, amenities: ['shop', 'coffee', 'parking', 'wifi'], source: 'mock',
  },
  {
    id: -1041, name: 'Volt Auto · Karakamysh',
    address: 'Ташкент, Алмазар, Каракамыш 2/4, ТЦ Строймарт',
    lat: 41.3600, lng: 69.2150, status: 'free', power_kw: 90, price_per_kwh: 1420,
    connectors: [
      { type: 'GB/T', power_kw: 90, total: 2, available: 1 },
      { type: 'CCS2', power_kw: 90, total: 1, available: 1 },
    ],
    operator: { name: 'Volt Auto' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.4, amenities: ['parking'], source: 'mock',
  },
  {
    id: -1042, name: 'Uzbekneftegaz EV · TKAD Shimoliy',
    address: 'Ташкент, ТКАД Северная сторона, АЗС UNG',
    lat: 41.3780, lng: 69.2700, status: 'free', power_kw: 120, price_per_kwh: 1450,
    connectors: [
      { type: 'GB/T', power_kw: 120, total: 2, available: 2 },
      { type: 'CCS2', power_kw: 120, total: 2, available: 2 },
    ],
    operator: { name: 'Uzbekneftegaz EV' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.6, amenities: ['24/7', 'shop', 'toilet', 'parking'], source: 'mock',
  },

  // ── Мирзо-Улугбек и Яшнабад ────────────────────────────────────────────────
  {
    id: -1043, name: 'K-Watt · Mustaqillik Shox',
    address: 'Ташкент, Мирзо-Улугбекский район, проспект Мустакиллик, 78',
    lat: 41.3275, lng: 69.3352, status: 'free', power_kw: 90, price_per_kwh: 1550,
    connectors: [{ type: 'CCS2', power_kw: 90, total: 2, available: 1 }],
    operator: { name: 'K-Watt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.5, amenities: ['coffee', 'toilet'], source: 'mock',
  },
  {
    id: -1044, name: 'EVGO Fast · Buyuk Ipak Yoli',
    address: 'Ташкент, Мирзо-Улугбек, метро Буюк Ипак Йули',
    lat: 41.3270, lng: 69.3400, status: 'free', power_kw: 160, price_per_kwh: 1600,
    connectors: [
      { type: 'CCS2', power_kw: 160, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 160, total: 2, available: 1 },
    ],
    operator: { name: 'EVGO' }, discount_pct: 15, is_promoted: true,
    promo_ends_at: inHours(3), rating: 4.8, amenities: ['24/7', 'shop', 'parking'], source: 'mock',
  },
  {
    id: -1045, name: 'Tok Bor · Parkent Bozori',
    address: 'Ташкент, Яшнабадский район, ул. Паркентская, Паркентский рынок',
    lat: 41.3150, lng: 69.3170, status: 'free', power_kw: 120, price_per_kwh: 1480,
    connectors: [
      { type: 'GB/T', power_kw: 120, total: 2, available: 2 },
      { type: 'CCS2', power_kw: 120, total: 2, available: 2 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.6, amenities: ['shop', 'parking'], source: 'mock',
  },
  {
    id: -1046, name: 'Megawatt · Ecobozor Mirzo-Ulugbek',
    address: 'Ташкент, Мирзо-Улугбек, ул. Тимура Малика, рынок Ecobozor',
    lat: 41.3470, lng: 69.3480, status: 'free', power_kw: 120, price_per_kwh: 1450,
    connectors: [
      { type: 'GB/T', power_kw: 120, total: 2, available: 2 },
      { type: 'CCS2', power_kw: 120, total: 1, available: 1 },
    ],
    operator: { name: 'Megawatt' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.7, amenities: ['shop', 'parking', 'coffee'], source: 'mock',
  },
  {
    id: -1047, name: 'Carwon · Aviasozlar (Kadysheva)',
    address: 'Ташкент, Яшнабадский район, ул. Авиасозлар, базар Кадышева',
    lat: 41.2880, lng: 69.3360, status: 'free', power_kw: 120, price_per_kwh: 1450,
    connectors: [
      { type: 'GB/T', power_kw: 120, total: 2, available: 1 },
      { type: 'CCS2', power_kw: 120, total: 1, available: 1 },
    ],
    operator: { name: 'Carwon' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.5, amenities: ['shop', 'parking'], source: 'mock',
  },
  {
    id: -1048, name: 'Tok Bor · Rohat Aylanmasi',
    address: 'Ташкент, круговая развязка Рохат, трасса Ташкент-Ош',
    lat: 41.2780, lng: 69.3650, status: 'free', power_kw: 150, price_per_kwh: 1550,
    connectors: [
      { type: 'CCS2', power_kw: 150, total: 2, available: 2 },
      { type: 'GB/T', power_kw: 150, total: 2, available: 2 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 20, is_promoted: true,
    promo_ends_at: inHours(5), rating: 4.8, amenities: ['24/7', 'coffee', 'parking'], source: 'mock',
  },

  // ── Сергели и Бектемир ─────────────────────────────────────────────────────
  {
    id: -1049, name: 'Tok Bor · Sergeli MKAD',
    address: 'Ташкент, Сергелийский район, Малая кольцевая дорога',
    lat: 41.2255, lng: 69.2201, status: 'free', power_kw: 120, price_per_kwh: 1450,
    connectors: [
      { type: 'GB/T', power_kw: 120, total: 2, available: 2 },
      { type: 'CCS2', power_kw: 120, total: 1, available: 1 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.5, amenities: ['parking', '24/7'], source: 'mock',
  },
  {
    id: -1050, name: 'EVGO Hub · Yangi Sergeli',
    address: 'Ташкент, Сергели, массив Курувчилар, ул. Янги Сергели',
    lat: 41.2180, lng: 69.2100, status: 'free', power_kw: 180, price_per_kwh: 1600,
    connectors: [
      { type: 'CCS2', power_kw: 180, total: 3, available: 3 },
      { type: 'GB/T', power_kw: 180, total: 3, available: 2 },
    ],
    operator: { name: 'EVGO' }, discount_pct: 25, is_promoted: true,
    promo_ends_at: inHours(3), rating: 4.9, amenities: ['24/7', 'parking', 'coffee', 'shop'], source: 'mock',
  },
  {
    id: -1051, name: 'Tok Bor · Compass Mall & Qo\'yliq',
    address: 'Ташкент, Бектемирский район, ТКАД, 17, ТРЦ Compass',
    lat: 41.2400, lng: 69.3350, status: 'free', power_kw: 180, price_per_kwh: 1650,
    connectors: [
      { type: 'CCS2', power_kw: 180, total: 4, available: 3 },
      { type: 'GB/T', power_kw: 180, total: 4, available: 4 },
      { type: 'CHAdeMO', power_kw: 50, total: 1, available: 1 },
    ],
    operator: { name: 'Tok Bor' }, discount_pct: 20, is_promoted: true,
    promo_ends_at: inHours(4), rating: 4.9, amenities: ['shop', 'coffee', 'parking', 'wifi', '24/7'], source: 'mock',
  },
  {
    id: -1052, name: 'Uzbekneftegaz EV · TKAD Janubiy',
    address: 'Ташкент, ТКАД Южная сторона, Сергелийский мост, АЗС UNG',
    lat: 41.2150, lng: 69.2600, status: 'free', power_kw: 120, price_per_kwh: 1450,
    connectors: [
      { type: 'GB/T', power_kw: 120, total: 2, available: 2 },
      { type: 'CCS2', power_kw: 120, total: 2, available: 1 },
    ],
    operator: { name: 'Uzbekneftegaz EV' }, discount_pct: 0, is_promoted: false,
    promo_ends_at: null, rating: 4.6, amenities: ['24/7', 'shop', 'toilet', 'parking'], source: 'mock',
  },
];

/** Промо-подмножество для секции «Рекомендуем». */
export const DEMO_PROMOTED = DEMO_STATIONS.filter((s) => s.is_promoted);
