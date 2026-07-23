import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Modal,
  SafeAreaView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';

interface FiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: any) => void;
  stationCount: number;
}

export function FiltersSheet({ visible, onClose, onApply, stationCount }: FiltersSheetProps) {
  const colors = useColors();
  
  const [chargingTypes, setChargingTypes] = useState<string[]>(['Все']);
  const [availability, setAvailability] = useState('Все');
  const [amenities, setAmenities] = useState<string[]>([]);
  
  const toggleChargingType = (type: string) => {
    if (type === 'Все') {
      setChargingTypes(['Все']);
      return;
    }
    const newTypes = chargingTypes.filter(t => t !== 'Все');
    if (newTypes.includes(type)) {
      const filtered = newTypes.filter(t => t !== type);
      setChargingTypes(filtered.length === 0 ? ['Все'] : filtered);
    } else {
      setChargingTypes([...newTypes, type]);
    }
  };

  const toggleAmenity = (am: string) => {
    if (amenities.includes(am)) {
      setAmenities(amenities.filter(a => a !== am));
    } else {
      setAmenities([...amenities, am]);
    }
  };

  const renderSectionHeader = (title: string) => (
    <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Фильтры</Text>
              <View style={styles.headerRight}>
                <TouchableOpacity onPress={() => { setChargingTypes(['Все']); setAvailability('Все'); setAmenities([]); }}>
                  <Text style={[styles.resetText, { color: colors.primary }]}>Сбросить</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Feather name="x" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Мои автомобили */}
              <View style={styles.section}>
                {renderSectionHeader('Мои автомобили')}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                  <View style={[styles.carChip, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <Feather name="zap" size={14} color={colors.primary} />
                    <Text style={[styles.carChipText, { color: colors.text }]}>IONIQ 5 · 85% · 410 км</Text>
                  </View>
                  <TouchableOpacity style={[styles.carChip, { borderStyle: 'dashed', borderColor: colors.mutedForeground, backgroundColor: colors.card }]}>
                    <Feather name="plus" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.carChipText, { color: colors.mutedForeground }]}>Добавить авто</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Тип зарядки */}
              <View style={styles.section}>
                {renderSectionHeader('Тип зарядки')}
                <View style={styles.chipGroup}>
                  {['Все', 'CCS2', 'CHAdeMO', 'Type 2', 'GB/T'].map(type => {
                    const isActive = chargingTypes.includes(type);
                    return (
                      <TouchableOpacity key={type} onPress={() => toggleChargingType(type)} activeOpacity={0.8}>
                        {isActive ? (
                          <LinearGradient
                            colors={[colors.gradientStart, colors.gradientEnd]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={[styles.filterChip, { borderWidth: 0 }]}
                          >
                            <Text style={[styles.filterChipText, { color: '#FFF' }]}>{type}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={[styles.filterChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.filterChipText, { color: colors.text }]}>{type}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Мощность, кВт */}
              <View style={styles.section}>
                <View style={styles.rowBetween}>
                  {renderSectionHeader('Мощность, кВт')}
                  <Text style={[styles.rangeValue, { color: colors.primary }]}>3 — 350+</Text>
                </View>
                <View style={styles.sliderTrackContainer}>
                  <View style={[styles.sliderTrack, { backgroundColor: colors.muted }]} />
                  <LinearGradient
                    colors={[colors.gradientStart, colors.gradientEnd]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.sliderActiveTrack, { left: '10%', right: '20%' }]}
                  />
                  <View style={[styles.sliderThumb, { left: '10%', borderColor: colors.primary, backgroundColor: colors.card }]} />
                  <View style={[styles.sliderThumb, { left: '80%', borderColor: colors.primary, backgroundColor: colors.card }]} />
                </View>
              </View>

              {/* Доступность */}
              <View style={styles.section}>
                {renderSectionHeader('Доступность')}
                <View style={[styles.segmentedControl, { backgroundColor: colors.muted }]}>
                  {['Все', 'Свободные', 'Занятые'].map(status => {
                    const isActive = availability === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[styles.segment, isActive && [styles.segmentActive, { backgroundColor: colors.card, shadowColor: '#000' }]]}
                        onPress={() => setAvailability(status)}
                      >
                        <Text style={[styles.segmentText, { color: isActive ? colors.text : colors.mutedForeground }]}>{status}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Оператор */}
              <View style={styles.section}>
                {renderSectionHeader('Оператор')}
                <TouchableOpacity style={[styles.dropdownBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Text style={[styles.dropdownText, { color: colors.text }]}>Все операторы</Text>
                  <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {/* Цена */}
              <View style={styles.section}>
                <View style={styles.rowBetween}>
                  {renderSectionHeader('Цена, сум/кВт·ч')}
                  <Text style={[styles.rangeValue, { color: colors.primary }]}>0 — 5000+</Text>
                </View>
                <View style={styles.sliderTrackContainer}>
                  <View style={[styles.sliderTrack, { backgroundColor: colors.muted }]} />
                  <LinearGradient
                    colors={[colors.gradientStart, colors.gradientEnd]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.sliderActiveTrack, { left: '0%', right: '0%' }]}
                  />
                  <View style={[styles.sliderThumb, { left: '0%', borderColor: colors.primary, backgroundColor: colors.card }]} />
                  <View style={[styles.sliderThumb, { left: '100%', borderColor: colors.primary, backgroundColor: colors.card }]} />
                </View>
              </View>

              {/* Дополнительно */}
              <View style={styles.section}>
                {renderSectionHeader('Дополнительно')}
                <View style={styles.amenityRow}>
                  {[
                    { id: 'coffee', icon: 'coffee' },
                    { id: 'users', icon: 'users' },
                    { id: 'shop', icon: 'shopping-bag' },
                    { id: 'wifi', icon: 'wifi' }
                  ].map(item => {
                    const isActive = amenities.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.amenityBtn, { backgroundColor: isActive ? colors.primary : colors.muted }]}
                        onPress={() => toggleAmenity(item.id)}
                      >
                        <Feather name={item.icon as any} size={18} color={isActive ? '#FFF' : colors.text} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Bottom Sticky Button */}
            <View style={[styles.bottomSticky, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
              <TouchableOpacity
                onPress={() => {
                  onApply({ chargingTypes, availability, amenities });
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.applyBtn}
                >
                  <Text style={styles.applyBtnText}>Показать {stationCount} станций</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  resetText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    gap: 24,
    paddingBottom: 40,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rangeValue: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  hScroll: {
    gap: 8,
    paddingRight: 20,
  },
  carChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  carChipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  sliderTrackContainer: {
    height: 30,
    justifyContent: 'center',
    position: 'relative',
    marginTop: 4,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    width: '100%',
  },
  sliderActiveTrack: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginLeft: -12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  dropdownText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  amenityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  amenityBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSticky: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  applyBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
