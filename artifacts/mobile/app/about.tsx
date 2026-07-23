import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

const VERSION = '1.0.0';
const BUILD = '2026.07';

function LinkRow({ icon, label, url, last }: { icon: string; label: string; url: string; last?: boolean }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(url)}
      activeOpacity={0.7}
      style={[aStyles.linkRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
    >
      <Feather name={icon as any} size={16} color={colors.primary} />
      <Text style={[aStyles.linkText, { color: colors.text }]}>{label}</Text>
      <Feather name="external-link" size={14} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

export default function AboutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <View style={[aStyles.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={aStyles.iconBtn}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[aStyles.headerTitle, { color: colors.text }]}>О приложении</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 32, gap: 20, padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo hero */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={aStyles.heroWrap}>
          <LinearGradient
            colors={['#2563EB', '#7C3AED']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={aStyles.logoGradient}
          >
            <Feather name="zap" size={40} color="#fff" />
          </LinearGradient>
          <Text style={[aStyles.appName, { color: colors.text }]}>iON Charge</Text>
          <Text style={[aStyles.appTagline, { color: colors.mutedForeground }]}>
            Умная зарядка для электромобилей в Узбекистане
          </Text>
          <View style={aStyles.versionRow}>
            <View style={[aStyles.versionBadge, { backgroundColor: colors.muted }]}>
              <Text style={[aStyles.versionText, { color: colors.mutedForeground }]}>v{VERSION} · {BUILD}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Description */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <View style={[aStyles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 16 }]}>
            <Text style={[aStyles.descText, { color: colors.text }]}>
              iON Charge — агрегатор зарядных станций для электромобилей в Узбекистане. Мы объединяем все публичные сети зарядки в одном приложении: находите ближайшую станцию, планируйте маршруты с остановками для зарядки и экономьте с эксклюзивными скидками от партнёров.
            </Text>
          </View>
        </Animated.View>

        {/* Features */}
        <Animated.View entering={FadeInDown.delay(90).springify()}>
          <Text style={[aStyles.sectionLabel, { color: colors.mutedForeground }]}>ВОЗМОЖНОСТИ</Text>
          <View style={[aStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { icon: 'map-pin', text: '37+ зарядных станций по всей стране' },
              { icon: 'navigation', text: 'Умное планирование маршрутов с учётом заряда' },
              { icon: 'tag', text: 'HOT DEAL скидки от операторов' },
              { icon: 'activity', text: 'История сессий и аналитика' },
              { icon: 'cpu', text: 'Поддержка всех типов разъёмов: CCS2, CHAdeMO, GB-T' },
            ].map((item, i, arr) => (
              <View
                key={i}
                style={[aStyles.featureRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
                <View style={[aStyles.featureIcon, { backgroundColor: '#EEF2FF' }]}>
                  <Feather name={item.icon as any} size={16} color="#2563EB" />
                </View>
                <Text style={[aStyles.featureText, { color: colors.text }]}>{item.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Legal */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <Text style={[aStyles.sectionLabel, { color: colors.mutedForeground }]}>ДОКУМЕНТЫ</Text>
          <View style={[aStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <LinkRow icon="file-text" label="Пользовательское соглашение" url="https://ioncharge.uz/terms" />
            <LinkRow icon="shield" label="Политика конфиденциальности" url="https://ioncharge.uz/privacy" last />
          </View>
        </Animated.View>

        {/* Company */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Text style={[aStyles.sectionLabel, { color: colors.mutedForeground }]}>КОМПАНИЯ</Text>
          <View style={[aStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <LinkRow icon="globe" label="ioncharge.uz" url="https://ioncharge.uz" />
            <LinkRow icon="mail" label="info@ioncharge.uz" url="mailto:info@ioncharge.uz" />
            <LinkRow icon="send" label="Telegram канал" url="https://t.me/ioncharge" last />
          </View>
        </Animated.View>

        <Text style={[aStyles.copyright, { color: colors.mutedForeground }]}>
          © {new Date().getFullYear()} iON Charge. Все права защищены.{'\n'}
          Ташкент, Узбекистан
        </Text>
      </ScrollView>
    </View>
  );
}

const aStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  heroWrap: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  logoGradient: {
    width: 88, height: 88, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  appName: { fontSize: 26, fontFamily: 'Inter_700Bold', marginTop: 4 },
  appTagline: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  versionRow: { marginTop: 4 },
  versionBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  versionText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  descText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, marginLeft: 4, marginBottom: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  featureIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  linkText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  copyright: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18, marginTop: 4 },
});
