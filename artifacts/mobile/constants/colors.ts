const colors = {
  light: {
    // Core
    text: '#0F172A',
    tint: '#2563EB',
    background: '#F7F8FA',
    foreground: '#0F172A',

    // Cards
    card: '#FFFFFF',
    cardForeground: '#0F172A',

    // Primary (blue)
    primary: '#2563EB',
    primaryForeground: '#FFFFFF',

    // Accent (violet)
    accent: '#7C3AED',
    accentForeground: '#FFFFFF',

    // Secondary
    secondary: '#F1F5F9',
    secondaryForeground: '#475569',

    // Muted
    muted: '#F1F5F9',
    mutedForeground: '#64748B',

    // Destructive
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',

    // Border / input
    border: '#E2E8F0',
    input: '#E2E8F0',

    // Station status
    free: '#10B981',
    occupied: '#F59E0B',
    offline: '#94A3B8',

    // Gradient stops
    gradientStart: '#2563EB',
    gradientEnd: '#7C3AED',
  },

  // Тёмная тема. Ключи 1-в-1 со светлой — useColors переключает набор по
  // системной теме. Бренд (сине-фиолетовый градиент) сохранён; нейтрали —
  // глубокий сине-чёрный с лёгким уклоном в синий, а не «мёртвый» серый.
  dark: {
    text: '#F1F5F9',
    tint: '#3B82F6',
    background: '#0B0F1A',
    foreground: '#F1F5F9',

    card: '#151B2B',
    cardForeground: '#F1F5F9',

    primary: '#3B82F6',
    primaryForeground: '#FFFFFF',

    accent: '#8B5CF6',
    accentForeground: '#FFFFFF',

    secondary: '#1E293B',
    secondaryForeground: '#CBD5E1',

    muted: '#1E293B',
    mutedForeground: '#94A3B8',

    destructive: '#F87171',
    destructiveForeground: '#0B0F1A',

    border: '#26314A',
    input: '#26314A',

    // Статусы станций — те же, что на светлой, чуть светлее «офлайн».
    free: '#10B981',
    occupied: '#F59E0B',
    offline: '#64748B',

    gradientStart: '#2563EB',
    gradientEnd: '#7C3AED',
  },
  radius: 16,
};

export default colors;
