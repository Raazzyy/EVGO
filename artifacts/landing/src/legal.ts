/**
 * Политика конфиденциальности и условия использования.
 *
 * Без них приложение не примут ни в App Store, ни в Google Play: обе площадки
 * требуют публичную ссылку на политику ещё до загрузки сборки.
 *
 * Текст описывает то, что приложение делает на самом деле — геолокация,
 * номер телефона, история зарядок. Проверять соответствие фактическому
 * поведению нужно при каждом изменении сбора данных, иначе декларация в
 * App Privacy разойдётся с политикой и заявку отклонят.
 *
 * ⚠️ Перед публикацией юрист должен вычитать текст и подставить реквизиты
 * компании: сейчас на их месте заглушки.
 */

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  /** Маркированный список после абзацев. */
  list?: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

/** Реквизиты — заполняются, когда будет юридическое лицо. */
export const COMPANY = {
  name: 'EVGO',
  legalName: '[Наименование юридического лица]',
  address: '[Юридический адрес, Узбекистан]',
  email: 'hello@evgo.uz',
  privacyEmail: 'privacy@evgo.uz',
};

/**
 * Дата последнего изменения — на языке документа.
 *
 * Одна строка на все три языка давала «YANGILANGAN: 30 августа 2026»:
 * заголовок переведён, а месяц остался русским.
 */
const UPDATED = {
  ru: '30 августа 2026',
  uz: '2026-yil 30-avgust',
  en: '30 August 2026',
} as const;

export const PRIVACY: Record<'ru' | 'uz' | 'en', LegalDoc> = {
  ru: {
    title: 'Политика конфиденциальности',
    updated: `Обновлено: ${UPDATED.ru}`,
    intro:
      'Этот документ объясняет, какие данные собирает приложение EVGO, зачем они нужны и что вы можете с ними сделать. Мы собираем только то, без чего приложение не работает.',
    sections: [
      {
        heading: 'Какие данные мы собираем',
        paragraphs: ['Приложение работает с четырьмя видами данных.'],
        list: [
          'Номер телефона — им вы входите в приложение. Пароля нет: вместо него приходит код в SMS.',
          'Имя и язык интерфейса — если вы их указали. Имя можно не указывать.',
          'Геолокация — чтобы показать станции рядом и построить маршрут. Запрашивается только когда вы открываете карту, и её можно запретить: приложение продолжит работать, но станции придётся искать вручную.',
          'История зарядок — станция, время, объём энергии и стоимость. Нужна для чеков и для сверки с оператором станции.',
        ],
      },
      {
        heading: 'Чего мы не делаем',
        paragraphs: [
          'Мы не продаём ваши данные и не передаём их рекламным сетям. Мы не отслеживаем вас между приложениями и сайтами. Мы не собираем контакты, фотографии, переписку и содержимое буфера обмена.',
        ],
      },
      {
        heading: 'Кому передаются данные',
        paragraphs: [
          'Данные передаются только тем, без кого услуга не оказывается, и только в необходимом объёме.',
        ],
        list: [
          'Оператору зарядной станции — факт вашей зарядки, чтобы он мог запустить сессию и выставить счёт. Номер телефона оператору не передаётся.',
          'Платёжной системе — сумма и идентификатор платежа. Данные вашей карты обрабатывает платёжная система, у нас они не хранятся.',
          'SMS-шлюзу — номер телефона, чтобы доставить код подтверждения.',
          'Картографическим сервисам — координаты для построения маршрута.',
        ],
      },
      {
        heading: 'Сколько данные хранятся',
        paragraphs: [
          'Профиль хранится, пока существует ваш аккаунт. История зарядок хранится дольше — она нужна для сверки взаиморасчётов с операторами станций, но после удаления аккаунта она обезличивается: связь с вами теряется.',
          'Коды подтверждения удаляются через несколько минут после отправки. В базе хранится не сам код, а его необратимое преобразование.',
        ],
      },
      {
        heading: 'Ваши права',
        paragraphs: [
          'Вы можете удалить аккаунт прямо в приложении: «Настройки» → «Аккаунт» → «Удалить аккаунт». Номер телефона, имя и электронная почта стираются безвозвратно.',
          `Если хотите получить копию своих данных или что-то исправить — напишите на ${COMPANY.privacyEmail}. Мы ответим в течение 30 дней.`,
        ],
      },
      {
        heading: 'Безопасность',
        paragraphs: [
          'Данные передаются по защищённому соединению. Токены доступа хранятся в защищённом хранилище устройства — Keychain на iOS и EncryptedSharedPreferences на Android, а не в открытых файлах приложения.',
        ],
      },
      {
        heading: 'Дети',
        paragraphs: [
          'Приложение не предназначено для лиц младше 18 лет и не собирает данные детей осознанно.',
        ],
      },
      {
        heading: 'Изменения',
        paragraphs: [
          'Если политика изменится, мы обновим дату в начале документа. Существенные изменения покажем в приложении до того, как они вступят в силу.',
        ],
      },
      {
        heading: 'Контакты',
        paragraphs: [
          `${COMPANY.legalName}, ${COMPANY.address}. Вопросы о данных: ${COMPANY.privacyEmail}, общие вопросы: ${COMPANY.email}.`,
        ],
      },
    ],
  },

  uz: {
    title: 'Maxfiylik siyosati',
    updated: `Yangilangan: ${UPDATED.uz}`,
    intro:
      "Ushbu hujjat EVGO ilovasi qanday ma'lumotlarni yig'ishini, ular nima uchun kerakligini va siz ular bilan nima qila olishingizni tushuntiradi. Biz faqat ilova ishlashi uchun zarur bo'lgan narsalarni yig'amiz.",
    sections: [
      {
        heading: "Qanday ma'lumotlarni yig'amiz",
        paragraphs: ["Ilova to'rt turdagi ma'lumot bilan ishlaydi."],
        list: [
          "Telefon raqami — u bilan ilovaga kirasiz. Parol yo'q: uning o'rniga SMS orqali kod keladi.",
          "Ism va interfeys tili — agar ko'rsatgan bo'lsangiz. Ismni ko'rsatmaslik mumkin.",
          "Joylashuv — yaqin atrofdagi stansiyalarni ko'rsatish va marshrut qurish uchun. Faqat xaritani ochganingizda so'raladi va uni taqiqlash mumkin: ilova ishlashda davom etadi, lekin stansiyalarni qo'lda qidirishga to'g'ri keladi.",
          "Zaryadlash tarixi — stansiya, vaqt, energiya hajmi va narxi. Cheklar uchun va stansiya operatori bilan solishtirish uchun kerak.",
        ],
      },
      {
        heading: 'Biz nima qilmaymiz',
        paragraphs: [
          "Biz sizning ma'lumotlaringizni sotmaymiz va reklama tarmoqlariga bermaymiz. Sizni ilovalar va saytlar o'rtasida kuzatmaymiz. Kontaktlar, fotosuratlar, yozishmalar va vaqtinchalik xotira tarkibini yig'maymiz.",
        ],
      },
      {
        heading: "Ma'lumotlar kimga beriladi",
        paragraphs: [
          "Ma'lumotlar faqat xizmat ko'rsatish uchun zarur bo'lganlarga va faqat zarur hajmda beriladi.",
        ],
        list: [
          "Zaryadlash stansiyasi operatoriga — seansni boshlash va hisob chiqarish uchun zaryadlash fakti. Telefon raqami operatorga berilmaydi.",
          "To'lov tizimiga — summa va to'lov identifikatori. Karta ma'lumotlaringizni to'lov tizimi qayta ishlaydi, bizda ular saqlanmaydi.",
          "SMS-shlyuzga — tasdiqlash kodini yetkazish uchun telefon raqami.",
          "Xarita xizmatlariga — marshrut qurish uchun koordinatalar.",
        ],
      },
      {
        heading: "Ma'lumotlar qancha saqlanadi",
        paragraphs: [
          "Profil hisobingiz mavjud bo'lgan vaqtgacha saqlanadi. Zaryadlash tarixi uzoqroq saqlanadi — u stansiya operatorlari bilan hisob-kitoblarni solishtirish uchun kerak, lekin hisob o'chirilgandan keyin u shaxssizlantiriladi: siz bilan aloqa yo'qoladi.",
          "Tasdiqlash kodlari yuborilgandan bir necha daqiqa keyin o'chiriladi. Bazada kodning o'zi emas, balki uning qaytarilmas o'zgarishi saqlanadi.",
        ],
      },
      {
        heading: 'Sizning huquqlaringiz',
        paragraphs: [
          "Hisobingizni to'g'ridan-to'g'ri ilovada o'chirishingiz mumkin: «Sozlamalar» → «Hisob» → «Hisobni o'chirish». Telefon raqami, ism va elektron pochta butunlay o'chiriladi.",
          `Ma'lumotlaringiz nusxasini olish yoki biror narsani tuzatish istasangiz — ${COMPANY.privacyEmail} ga yozing. 30 kun ichida javob beramiz.`,
        ],
      },
      {
        heading: 'Xavfsizlik',
        paragraphs: [
          "Ma'lumotlar himoyalangan ulanish orqali uzatiladi. Kirish tokenlari qurilmaning himoyalangan xotirasida saqlanadi — iOS'da Keychain, Android'da EncryptedSharedPreferences, ilovaning ochiq fayllarida emas.",
        ],
      },
      {
        heading: 'Bolalar',
        paragraphs: [
          "Ilova 18 yoshdan kichik shaxslar uchun mo'ljallanmagan va bolalar ma'lumotlarini ongli ravishda yig'maydi.",
        ],
      },
      {
        heading: "O'zgarishlar",
        paragraphs: [
          "Agar siyosat o'zgarsa, hujjat boshidagi sanani yangilaymiz. Muhim o'zgarishlarni kuchga kirishidan oldin ilovada ko'rsatamiz.",
        ],
      },
      {
        heading: 'Kontaktlar',
        paragraphs: [
          `${COMPANY.legalName}, ${COMPANY.address}. Ma'lumotlar bo'yicha savollar: ${COMPANY.privacyEmail}, umumiy savollar: ${COMPANY.email}.`,
        ],
      },
    ],
  },

  en: {
    title: 'Privacy Policy',
    updated: `Updated: ${UPDATED.en}`,
    intro:
      'This document explains what data the EVGO app collects, why it is needed, and what you can do about it. We collect only what the app cannot work without.',
    sections: [
      {
        heading: 'What we collect',
        paragraphs: ['The app works with four kinds of data.'],
        list: [
          'Phone number — this is how you sign in. There is no password; you receive a code by SMS instead.',
          'Name and interface language — if you provided them. The name is optional.',
          'Location — to show nearby stations and plan routes. Requested only when you open the map, and you can deny it: the app keeps working, but you will have to search for stations manually.',
          'Charging history — station, time, energy delivered and cost. Needed for receipts and for reconciliation with the station operator.',
        ],
      },
      {
        heading: 'What we do not do',
        paragraphs: [
          'We do not sell your data and do not share it with advertising networks. We do not track you across other apps and websites. We do not collect contacts, photos, messages or clipboard contents.',
        ],
      },
      {
        heading: 'Who receives your data',
        paragraphs: [
          'Data is shared only with parties required to deliver the service, and only to the extent required.',
        ],
        list: [
          'The charging station operator — the fact of your charging session, so they can start it and bill it. Your phone number is not shared with the operator.',
          'The payment provider — amount and payment identifier. Your card details are handled by the payment provider and are not stored by us.',
          'The SMS gateway — your phone number, to deliver the confirmation code.',
          'Mapping services — coordinates, to plan routes.',
        ],
      },
      {
        heading: 'How long we keep data',
        paragraphs: [
          'Your profile is kept while your account exists. Charging history is kept longer — it is needed to reconcile settlements with station operators — but once you delete your account it is anonymised and can no longer be linked to you.',
          'Confirmation codes are deleted within minutes. The database stores an irreversible transformation of the code, not the code itself.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'You can delete your account inside the app: Settings → Account → Delete account. Your phone number, name and email are erased permanently.',
          `To request a copy of your data or have something corrected, write to ${COMPANY.privacyEmail}. We respond within 30 days.`,
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'Data is transmitted over a secure connection. Access tokens are stored in the device secure storage — Keychain on iOS and EncryptedSharedPreferences on Android — not in plain app files.',
        ],
      },
      {
        heading: 'Children',
        paragraphs: [
          'The app is not intended for people under 18 and does not knowingly collect data from children.',
        ],
      },
      {
        heading: 'Changes',
        paragraphs: [
          'If this policy changes, we update the date at the top. Material changes are shown in the app before they take effect.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          `${COMPANY.legalName}, ${COMPANY.address}. Data questions: ${COMPANY.privacyEmail}; general questions: ${COMPANY.email}.`,
        ],
      },
    ],
  },
};

export const TERMS: Record<'ru' | 'uz' | 'en', LegalDoc> = {
  ru: {
    title: 'Условия использования',
    updated: `Обновлено: ${UPDATED.ru}`,
    intro:
      'Устанавливая приложение EVGO, вы соглашаетесь с этими условиями. Если вы с ними не согласны — не пользуйтесь приложением.',
    sections: [
      {
        heading: 'Что делает EVGO',
        paragraphs: [
          'EVGO показывает зарядные станции на карте, помогает планировать маршруты и — там, где это доступно — позволяет оплатить зарядку.',
          'Мы не владеем зарядными станциями. Их обслуживают операторы, и качество зарядки, исправность оборудования и цена зависят от них.',
        ],
      },
      {
        heading: 'Точность данных о станциях',
        paragraphs: [
          'Данные о станциях поступают из открытых источников и от операторов. Часть записей может устареть: станция может не работать, цена — отличаться, а разъём — оказаться другим.',
          'На экране станции видно, когда её проверяли в последний раз. Если данные неверны, сообщите об этом кнопкой «Сообщить о неточности» — мы проверим и исправим.',
          'Мы не гарантируем, что станция окажется свободной или исправной к моменту вашего приезда.',
        ],
      },
      {
        heading: 'Аккаунт',
        paragraphs: [
          'Для входа нужен действующий номер телефона. Вы отвечаете за доступ к своему номеру: любой, кто получит код из SMS, войдёт в ваш аккаунт.',
          'Один человек — один аккаунт. Аккаунт нельзя передавать другим людям.',
        ],
      },
      {
        heading: 'Оплата',
        paragraphs: [
          'Оплата зарядки проходит через платёжные системы. Стоимость сессии определяется тарифом оператора станции и объёмом полученной энергии.',
          'Возврат средств за состоявшуюся зарядку не производится. Если зарядка не состоялась, а деньги списаны — напишите нам, мы разберёмся и вернём.',
        ],
      },
      {
        heading: 'Чего делать нельзя',
        paragraphs: ['Пользуясь приложением, вы не должны:'],
        list: [
          'пытаться получить доступ к чужим аккаунтам и данным;',
          'автоматически выгружать данные приложения для перепродажи;',
          'намеренно перегружать сервис запросами;',
          'сообщать заведомо ложные сведения о станциях.',
        ],
      },
      {
        heading: 'Ответственность',
        paragraphs: [
          'Приложение предоставляется «как есть». Мы не отвечаем за убытки, возникшие из-за неточности данных о станции, недоступности станции, действий оператора или сбоя платёжной системы.',
          'Это не ограничивает вашу защиту по законодательству о правах потребителей в той мере, в какой такое ограничение недопустимо.',
        ],
      },
      {
        heading: 'Прекращение доступа',
        paragraphs: [
          'Вы можете удалить аккаунт в любой момент через настройки приложения. Мы можем ограничить доступ, если вы нарушаете эти условия.',
        ],
      },
      {
        heading: 'Изменения условий',
        paragraphs: [
          'Условия могут меняться. Существенные изменения мы показываем в приложении. Продолжая пользоваться приложением после изменений, вы принимаете новую редакцию.',
        ],
      },
      {
        heading: 'Контакты',
        paragraphs: [`${COMPANY.legalName}, ${COMPANY.address}. Связь: ${COMPANY.email}.`],
      },
    ],
  },

  uz: {
    title: 'Foydalanish shartlari',
    updated: `Yangilangan: ${UPDATED.uz}`,
    intro:
      "EVGO ilovasini o'rnatish orqali siz ushbu shartlarga rozilik bildirasiz. Agar rozi bo'lmasangiz — ilovadan foydalanmang.",
    sections: [
      {
        heading: 'EVGO nima qiladi',
        paragraphs: [
          "EVGO zaryadlash stansiyalarini xaritada ko'rsatadi, marshrutlarni rejalashtirishga yordam beradi va — mavjud bo'lgan joyda — zaryadlash uchun to'lash imkonini beradi.",
          "Biz zaryadlash stansiyalariga egalik qilmaymiz. Ularni operatorlar xizmat ko'rsatadi va zaryadlash sifati, uskuna nosozligi va narx ularga bog'liq.",
        ],
      },
      {
        heading: "Stansiyalar ma'lumotlarining aniqligi",
        paragraphs: [
          "Stansiyalar haqidagi ma'lumotlar ochiq manbalardan va operatorlardan keladi. Ba'zi yozuvlar eskirgan bo'lishi mumkin: stansiya ishlamasligi, narx boshqacha bo'lishi, ulagich boshqa turdagi bo'lishi mumkin.",
          "Stansiya ekranida uning oxirgi marta qachon tekshirilgani ko'rinadi. Agar ma'lumotlar noto'g'ri bo'lsa, «Xatolik haqida xabar berish» tugmasi orqali bizga bildiring — tekshirib, tuzatamiz.",
          "Siz yetib borganingizda stansiya bo'sh yoki soz bo'lishini kafolatlamaymiz.",
        ],
      },
      {
        heading: 'Hisob',
        paragraphs: [
          "Kirish uchun amaldagi telefon raqami kerak. Raqamingizga kirish uchun siz javobgarsiz: SMS'dagi kodni olgan har kim hisobingizga kiradi.",
          "Bir kishi — bitta hisob. Hisobni boshqalarga berish mumkin emas.",
        ],
      },
      {
        heading: "To'lov",
        paragraphs: [
          "Zaryadlash uchun to'lov to'lov tizimlari orqali amalga oshiriladi. Seans narxi stansiya operatorining tarifi va olingan energiya hajmi bilan belgilanadi.",
          "Amalga oshgan zaryadlash uchun pul qaytarilmaydi. Agar zaryadlash bo'lmagan bo'lsa-yu, pul yechilgan bo'lsa — bizga yozing, tekshirib qaytaramiz.",
        ],
      },
      {
        heading: 'Nima qilish mumkin emas',
        paragraphs: ['Ilovadan foydalanar ekansiz, siz:'],
        list: [
          "boshqalarning hisoblari va ma'lumotlariga kirishga urinmasligingiz;",
          "ilova ma'lumotlarini qayta sotish uchun avtomatik yuklab olmasligingiz;",
          "xizmatni so'rovlar bilan ataylab ortiqcha yuklamasligingiz;",
          "stansiyalar haqida ataylab yolg'on ma'lumot bermasligingiz kerak.",
        ],
      },
      {
        heading: 'Javobgarlik',
        paragraphs: [
          "Ilova «qanday bo'lsa, shundayligicha» taqdim etiladi. Stansiya ma'lumotlarining noaniqligi, stansiyaning mavjud emasligi, operator harakatlari yoki to'lov tizimidagi nosozlik tufayli yuzaga kelgan zarar uchun javob bermaymiz.",
          "Bu iste'molchilar huquqlari to'g'risidagi qonunchilik bo'yicha himoyangizni cheklamaydi.",
        ],
      },
      {
        heading: "Kirishni to'xtatish",
        paragraphs: [
          "Hisobingizni istalgan vaqtda ilova sozlamalari orqali o'chirishingiz mumkin. Agar siz ushbu shartlarni buzsangiz, biz kirishni cheklashimiz mumkin.",
        ],
      },
      {
        heading: "Shartlarning o'zgarishi",
        paragraphs: [
          "Shartlar o'zgarishi mumkin. Muhim o'zgarishlarni ilovada ko'rsatamiz. O'zgarishlardan keyin ilovadan foydalanishda davom etib, siz yangi tahrirni qabul qilasiz.",
        ],
      },
      {
        heading: 'Kontaktlar',
        paragraphs: [`${COMPANY.legalName}, ${COMPANY.address}. Aloqa: ${COMPANY.email}.`],
      },
    ],
  },

  en: {
    title: 'Terms of Use',
    updated: `Updated: ${UPDATED.en}`,
    intro:
      'By installing the EVGO app you agree to these terms. If you do not agree with them, do not use the app.',
    sections: [
      {
        heading: 'What EVGO does',
        paragraphs: [
          'EVGO shows charging stations on a map, helps plan routes and — where available — lets you pay for charging.',
          'We do not own the charging stations. They are operated by third parties, and charging quality, equipment condition and pricing depend on them.',
        ],
      },
      {
        heading: 'Accuracy of station data',
        paragraphs: [
          'Station data comes from open sources and from operators. Some records may be out of date: a station may not work, the price may differ, the connector may be a different type.',
          'The station screen shows when it was last verified. If the data is wrong, use "Report an inaccuracy" — we will check and fix it.',
          'We do not guarantee that a station will be free or operational when you arrive.',
        ],
      },
      {
        heading: 'Account',
        paragraphs: [
          'A working phone number is required to sign in. You are responsible for access to your number: anyone who receives the SMS code can sign in to your account.',
          'One person, one account. Accounts may not be transferred to other people.',
        ],
      },
      {
        heading: 'Payment',
        paragraphs: [
          'Charging is paid through payment providers. The cost of a session is set by the station operator tariff and the energy delivered.',
          'Completed charging sessions are not refunded. If charging did not happen but you were charged, write to us — we will investigate and refund.',
        ],
      },
      {
        heading: 'What you must not do',
        paragraphs: ['While using the app, you must not:'],
        list: [
          'attempt to access other people’s accounts or data;',
          'scrape app data for resale;',
          'deliberately overload the service with requests;',
          'knowingly submit false information about stations.',
        ],
      },
      {
        heading: 'Liability',
        paragraphs: [
          'The app is provided "as is". We are not liable for losses arising from inaccurate station data, station unavailability, operator actions or payment provider failures.',
          'This does not limit your consumer rights where such limitation is not permitted by law.',
        ],
      },
      {
        heading: 'Ending access',
        paragraphs: [
          'You can delete your account at any time in the app settings. We may restrict access if you breach these terms.',
        ],
      },
      {
        heading: 'Changes to these terms',
        paragraphs: [
          'These terms may change. Material changes are shown in the app. Continuing to use the app after a change means you accept the new version.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [`${COMPANY.legalName}, ${COMPANY.address}. Contact: ${COMPANY.email}.`],
      },
    ],
  },
};
