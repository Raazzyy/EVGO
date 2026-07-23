import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';

const API = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : '/api';

const FAQ = [
  {
    q: 'Как начать зарядку?',
    a: 'Найдите станцию на карте, нажмите на неё → «Зарядить» → выберите разъём и способ оплаты. Зарядка начнётся автоматически.',
  },
  {
    q: 'Как рассчитывается стоимость?',
    a: 'Стоимость зависит от тарифа станции (сум/кВт·ч) и потреблённой энергии. Итоговая сумма отображается в чеке после завершения сессии.',
  },
  {
    q: 'Что делать, если станция не отвечает?',
    a: 'Попробуйте обновить страницу. Если статус «Оффлайн» — станция временно недоступна. Напишите нам в поддержку, мы разберёмся.',
  },
  {
    q: 'Как добавить автомобиль?',
    a: 'Перейдите в Профиль → «Мои автомобили» → нажмите «+ Добавить». Найдите марку и модель через поиск.',
  },
  {
    q: 'Почему маршрут добавляет остановки?',
    a: 'iON автоматически рассчитывает, хватит ли заряда до пункта назначения. Если нет — предлагает промежуточные зарядки.',
  },
  {
    q: 'Можно ли отменить сессию?',
    a: 'Активную сессию можно остановить через экран зарядки. Оплата рассчитывается за фактически потреблённую энергию.',
  },
];

function ContactRow({ icon, label, value, url }: { icon: string; label: string; value: string; url: string }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(url)}
      style={[cStyles.contactRow, { borderBottomColor: colors.border }]}
      activeOpacity={0.7}
    >
      <View style={[cStyles.contactIcon, { backgroundColor: '#EEF2FF' }]}>
        <Feather name={icon as any} size={18} color="#2563EB" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[cStyles.contactLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[cStyles.contactValue, { color: colors.text }]}>{value}</Text>
      </View>
      <Feather name="external-link" size={14} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => setOpen(v => !v)}
      activeOpacity={0.8}
      style={[cStyles.faqItem, { borderBottomColor: colors.border }]}
    >
      <View style={cStyles.faqHeader}>
        <Text style={[cStyles.faqQ, { color: colors.text, flex: 1 }]}>{q}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </View>
      {open && (
        <Text style={[cStyles.faqA, { color: colors.mutedForeground }]}>{a}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function SupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useApp();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function sendTicket() {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Заполните поля', 'Укажите тему и текст обращения.');
      return;
    }
    setSending(true);
    try {
      const r = await fetch(`${API}/support-tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId ?? null,
          subject: subject.trim(),
          message: message.trim(),
          status: 'open',
        }),
      });
      if (!r.ok) throw new Error('Server error');
      Alert.alert('Отправлено!', 'Мы ответим вам в течение 24 часов.');
      setSubject('');
      setMessage('');
    } catch {
      Alert.alert('Ошибка', 'Не удалось отправить. Попробуйте написать нам напрямую: support@ioncharge.uz');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <View style={[cStyles.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={cStyles.iconBtn}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[cStyles.headerTitle, { color: colors.text }]}>Поддержка</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 32, gap: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Contacts */}
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <Text style={[cStyles.sectionLabel, { color: colors.mutedForeground }]}>КОНТАКТЫ</Text>
          <View style={[cStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ContactRow icon="phone" label="Телефон" value="+998 71 200-00-00" url="tel:+998712000000" />
            <ContactRow icon="mail" label="Email" value="support@ioncharge.uz" url="mailto:support@ioncharge.uz" />
            <TouchableOpacity
              onPress={() => Linking.openURL('https://t.me/ioncharge_support')}
              style={[cStyles.contactRow, { borderBottomWidth: 0 }]}
              activeOpacity={0.7}
            >
              <View style={[cStyles.contactIcon, { backgroundColor: '#EFF6FF' }]}>
                <Feather name="send" size={18} color="#0088CC" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cStyles.contactLabel, { color: colors.mutedForeground }]}>Telegram</Text>
                <Text style={[cStyles.contactValue, { color: colors.text }]}>@ioncharge_support</Text>
              </View>
              <Feather name="external-link" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* FAQ */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <Text style={[cStyles.sectionLabel, { color: colors.mutedForeground }]}>ЧАСТЫЕ ВОПРОСЫ</Text>
          <View style={[cStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {FAQ.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </View>
        </Animated.View>

        {/* Ticket form */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <Text style={[cStyles.sectionLabel, { color: colors.mutedForeground }]}>НАПИСАТЬ В ПОДДЕРЖКУ</Text>
          <View style={[cStyles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 16, gap: 12 }]}>
            <View>
              <Text style={[cStyles.inputLabel, { color: colors.mutedForeground }]}>Тема</Text>
              <TextInput
                style={[cStyles.input, { backgroundColor: colors.muted, color: colors.text }]}
                placeholder="Например: проблема с оплатой"
                placeholderTextColor={colors.mutedForeground}
                value={subject}
                onChangeText={setSubject}
                returnKeyType="next"
              />
            </View>
            <View>
              <Text style={[cStyles.inputLabel, { color: colors.mutedForeground }]}>Сообщение</Text>
              <TextInput
                style={[cStyles.input, cStyles.textArea, { backgroundColor: colors.muted, color: colors.text }]}
                placeholder="Опишите проблему подробно..."
                placeholderTextColor={colors.mutedForeground}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>
            <TouchableOpacity
              onPress={sendTicket}
              disabled={sending}
              style={[cStyles.sendBtn, { opacity: sending ? 0.6 : 1 }]}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Feather name="send" size={16} color="#fff" />
                    <Text style={cStyles.sendBtnText}>Отправить обращение</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const cStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  sectionLabel: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, marginLeft: 4, marginBottom: 6,
  },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  contactIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  contactValue: { fontSize: 15, fontFamily: 'Inter_500Medium', marginTop: 1 },
  faqItem: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  faqQ: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  faqA: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, marginTop: 8 },
  inputLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular' },
  textArea: { height: 110, paddingTop: 10 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14,
  },
  sendBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
