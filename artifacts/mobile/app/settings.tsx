import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';

const STORAGE_KEY = '@ion_settings';

interface Settings {
  notifSessionDone: boolean;
  notifDiscount: boolean;
  notifStationFree: boolean;
  notifLowBattery: boolean;
  unitsKm: boolean;
  onlyCompatible: boolean;
  language: 'ru' | 'uz' | 'en';
  theme: 'light' | 'dark' | 'system';
}

const DEFAULTS: Settings = {
  notifSessionDone: true,
  notifDiscount: true,
  notifStationFree: false,
  notifLowBattery: true,
  unitsKm: true,
  onlyCompatible: false,
  language: 'ru',
  theme: 'system',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={sStyles.section}>
      <Text style={[sStyles.sectionTitle, { color: colors.mutedForeground }]}>{title.toUpperCase()}</Text>
      <View style={[sStyles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function ToggleRow({
  label, sub, value, onChange, last,
}: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  const colors = useColors();
  return (
    <View style={[sStyles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[sStyles.rowLabel, { color: colors.text }]}>{label}</Text>
        {sub && <Text style={[sStyles.rowSub, { color: colors.mutedForeground }]}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
        thumbColor="#fff"
      />
    </View>
  );
}

function SelectRow<T extends string>({
  label, options, value, onChange, last,
}: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; last?: boolean }) {
  const colors = useColors();
  return (
    <View style={[sStyles.row, sStyles.selectRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[sStyles.rowLabel, { color: colors.text }]}>{label}</Text>
      <View style={sStyles.optionRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              sStyles.optionBtn,
              { borderColor: value === opt.value ? '#2563EB' : colors.border },
              value === opt.value && { backgroundColor: '#EEF2FF' },
            ]}
          >
            <Text style={[sStyles.optionText, { color: value === opt.value ? '#2563EB' : colors.mutedForeground }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try { setSettings({ ...DEFAULTS, ...JSON.parse(raw) }); } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  if (!loaded) return null;

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <View style={[sStyles.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={sStyles.iconBtn}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[sStyles.headerTitle, { color: colors.text }]}>Настройки</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 32, gap: 4 }} showsVerticalScrollIndicator={false}>

        <Section title="Уведомления">
          <ToggleRow label="Сессия завершена" value={settings.notifSessionDone} onChange={v => update({ notifSessionDone: v })} />
          <ToggleRow label="Скидка рядом" sub="Акции в радиусе 10 км" value={settings.notifDiscount} onChange={v => update({ notifDiscount: v })} />
          <ToggleRow label="Станция снова свободна" value={settings.notifStationFree} onChange={v => update({ notifStationFree: v })} />
          <ToggleRow label="Низкий заряд" sub="Предупреждение при < 20%" value={settings.notifLowBattery} onChange={v => update({ notifLowBattery: v })} last />
        </Section>

        <Section title="Единицы и фильтры">
          <ToggleRow label="Расстояние в километрах" sub="Выкл — показывает мили" value={settings.unitsKm} onChange={v => update({ unitsKm: v })} />
          <ToggleRow label="Только совместимые станции" sub="Фильтр по типу разъёма вашего авто" value={settings.onlyCompatible} onChange={v => update({ onlyCompatible: v })} last />
        </Section>

        <Section title="Язык">
          <SelectRow
            label="Язык интерфейса"
            options={[{ value: 'ru', label: 'Рус' }, { value: 'uz', label: "O'z" }, { value: 'en', label: 'EN' }]}
            value={settings.language}
            onChange={v => update({ language: v })}
            last
          />
        </Section>

        <Section title="Тема">
          <SelectRow
            label="Цветовая схема"
            options={[{ value: 'light', label: '☀ Светлая' }, { value: 'dark', label: '● Тёмная' }, { value: 'system', label: '⚙ Авто' }]}
            value={settings.theme}
            onChange={v => update({ theme: v })}
            last
          />
        </Section>

        <Text style={[sStyles.hint, { color: colors.mutedForeground }]}>
          Настройки сохраняются локально на устройстве
        </Text>
      </ScrollView>
    </View>
  );
}

const sStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  section: { gap: 6, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginLeft: 4, marginBottom: 2, letterSpacing: 0.5 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  selectRow: { flexDirection: 'column', alignItems: 'flex-start', gap: 10 },
  rowLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  rowSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  optionText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8 },
});
