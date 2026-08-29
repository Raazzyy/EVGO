/**
 * Тексты лендинга на трёх языках.
 *
 * Без i18next: у страницы один экран текста, и тащить ради него библиотеку
 * с загрузчиками и плюрализацией незачем — это лишние килобайты на странице,
 * которая должна открываться за секунду на мобильном интернете.
 *
 * Язык берётся из настроек браузера и запоминается при переключении.
 */

export const LANGUAGES = ['uz', 'ru', 'en'] as const;
export type Lang = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Lang, string> = {
  uz: "O'z",
  ru: 'Рус',
  en: 'EN',
};

interface Content {
  nav: { how: string; operators: string; download: string };
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    lead: string;
    download: string;
    how: string;
  };
  map: { stations: string; freeNow: string; loading: string; failed: string; live: string };
  steps: { heading: string; items: Array<{ title: string; text: string }> };
  features: Array<{ title: string; text: string; detail: string }>;
  curve: { heading: string; text: string; caption: string };
  operators: {
    eyebrow: string;
    heading: string;
    text: string;
    bullets: string[];
    cta: string;
  };
  get: { heading: string; text: string; cta: string };
  faq: { heading: string; items: Array<{ q: string; a: string }> };
  footer: { privacy: string; terms: string };
}

export const CONTENT: Record<Lang, Content> = {
  ru: {
    nav: { how: 'Как работает', operators: 'Операторам', download: 'Скачать' },
    hero: {
      eyebrow: 'Узбекистан',
      titleLine1: 'Зарядки страны',
      titleLine2: 'на одной карте',
      lead: 'Видно, свободна ли станция, — до того как вы туда поехали. Маршрут с остановками под запас хода вашей машины. Оплата с баланса у любого партнёра.',
      download: 'Скачать приложение',
      how: 'Как это работает',
    },
    map: {
      stations: 'станций в базе',
      freeNow: 'свободны сейчас',
      loading: 'загрузка…',
      failed: 'Карта временно недоступна — данные подгружаются из приложения',
      live: 'Данные обновляются в реальном времени',
    },
    steps: {
      heading: 'Три шага до розетки',
      items: [
        {
          title: 'Найдите станцию',
          text: 'Карта показывает, какие коннекторы свободны прямо сейчас, а какие заняты. Фильтры — по разъёму, мощности и цене.',
        },
        {
          title: 'Забронируйте на 15 минут',
          text: 'Пока едете, коннектор держится за вами. Никто не займёт его перед вашим носом.',
        },
        {
          title: 'Оплатите с баланса',
          text: 'Пополнили один раз — заряжаетесь у любого партнёра. Чек приходит сразу после сессии.',
        },
      ],
    },
    features: [
      {
        title: 'Маршрут с остановками',
        text: 'Указываете, куда едете и на какой машине. Приложение само расставляет зарядки по пути так, чтобы вы не остались с нулём посреди трассы.',
        detail: 'Ташкент → Самарканд, 300 км',
      },
      {
        title: 'Ваш автомобиль в базе',
        text: '1189 моделей электромобилей: ёмкость батареи, запас хода, тип разъёма. Поиск понимает кириллицу и опечатки — «тесла» найдёт Tesla.',
        detail: 'CCS2 · CHAdeMO · Type 2 · GB-T',
      },
      {
        title: 'Данные, которым можно верить',
        text: 'Видно, когда станцию проверяли в последний раз. Если что-то не так — сообщите прямо со станции, и мы исправим.',
        detail: 'Проверка живьём, не только по базе',
      },
    ],
    curve: {
      heading: 'Почему остановки — до 80 %',
      text: 'После 80 % батарея заряжается заметно медленнее: последние проценты могут занять столько же времени, сколько первые шестьдесят. Поэтому в дороге выгоднее заряжаться чаще и понемногу — приложение считает остановки именно так.',
      caption: 'мощность зарядки по мере заполнения батареи',
    },
    operators: {
      eyebrow: 'Операторам станций',
      heading: 'Подключите свои станции',
      text: 'Ваши станции увидят все, кто ищет зарядку поблизости. Мы берём на себя карту, поиск, бронирование и оплату — вам остаётся отдавать статусы коннекторов.',
      bullets: [
        'Поддерживаем OCPI — отраслевой стандарт роуминга',
        'Если OCPI нет — сделаем адаптер под ваш API',
        'Промо-размещение для новых станций',
      ],
      cta: 'Написать нам',
    },
    get: {
      heading: 'Приложение выходит скоро',
      text: 'Готовим публикацию в App Store и Google Play. Напишите нам — сообщим в день выхода.',
      cta: 'Сообщить о выходе',
    },
    faq: {
      heading: 'Частые вопросы',
      items: [
        {
          q: 'Сколько станций уже в приложении?',
          a: 'Все, что удалось найти в открытых источниках по Узбекистану, плюс станции партнёров. Точное число видно на карте выше — оно меняется, потому что база пополняется.',
        },
        {
          q: 'Нужно ли платить за само приложение?',
          a: 'Нет. Вы платите только за электричество, которое залили в машину.',
        },
        {
          q: 'Что если станция не работает?',
          a: 'Нажмите «Сообщить о неточности» на экране станции. Жалобы попадают к нам в тот же день, а у станции появляется отметка.',
        },
        {
          q: 'Я оператор зарядных станций. Как подключиться?',
          a: 'Напишите нам — обсудим интеграцию. Поддерживаем протокол OCPI, но начать можно и с простой выгрузки: главное, чтобы статусы приходили автоматически.',
        },
      ],
    },
    footer: { privacy: 'Политика конфиденциальности', terms: 'Условия использования' },
  },

  uz: {
    nav: { how: 'Qanday ishlaydi', operators: 'Operatorlarga', download: 'Yuklab olish' },
    hero: {
      eyebrow: "O'zbekiston",
      titleLine1: 'Mamlakat zaryadlagichlari',
      titleLine2: 'bitta xaritada',
      lead: "Stansiya bo'shmi yoki yo'qmi — yo'lga chiqishdan oldin ko'rinadi. Mashinangiz quvvat zaxirasiga mos to'xtashlar bilan marshrut. Har qanday hamkorda balansdan to'lov.",
      download: 'Ilovani yuklab olish',
      how: 'Qanday ishlaydi',
    },
    map: {
      stations: 'ta stansiya bazada',
      freeNow: "tasi hozir bo'sh",
      loading: 'yuklanmoqda…',
      failed: "Xarita vaqtincha mavjud emas — ma'lumotlar ilovadan yuklanadi",
      live: "Ma'lumotlar real vaqtda yangilanadi",
    },
    steps: {
      heading: 'Rozetkagacha uch qadam',
      items: [
        {
          title: 'Stansiyani toping',
          text: "Xarita qaysi konnektorlar hozir bo'sh, qaysilari band ekanini ko'rsatadi. Filtrlar — ulagich, quvvat va narx bo'yicha.",
        },
        {
          title: '15 daqiqaga band qiling',
          text: "Siz yo'ldasiz, konnektor sizga saqlanadi. Hech kim uni oldingizdan olib qo'ymaydi.",
        },
        {
          title: "Balansdan to'lang",
          text: "Bir marta to'ldirasiz — istalgan hamkorda zaryadlaysiz. Chek seansdan keyin darrov keladi.",
        },
      ],
    },
    features: [
      {
        title: "To'xtashlar bilan marshrut",
        text: "Qayerga va qaysi mashinada ketayotganingizni ko'rsatasiz. Ilova zaryadlagichlarni yo'l bo'ylab shunday joylashtiradiki, siz trassa o'rtasida nolda qolmaysiz.",
        detail: 'Toshkent → Samarqand, 300 km',
      },
      {
        title: 'Mashinangiz bazada',
        text: "1189 ta elektromobil modeli: batareya sig'imi, quvvat zaxirasi, ulagich turi. Qidiruv kirill yozuvini va xatolarni tushunadi.",
        detail: 'CCS2 · CHAdeMO · Type 2 · GB-T',
      },
      {
        title: "Ishonish mumkin bo'lgan ma'lumotlar",
        text: "Stansiya oxirgi marta qachon tekshirilgani ko'rinadi. Agar biror narsa noto'g'ri bo'lsa — to'g'ridan-to'g'ri stansiyadan xabar bering, biz tuzatamiz.",
        detail: "Jonli tekshiruv, faqat baza bo'yicha emas",
      },
    ],
    curve: {
      heading: "Nega to'xtashlar 80 % gacha",
      text: "80 % dan keyin batareya sezilarli sekinroq zaryadlanadi: oxirgi foizlar birinchi oltmishtasi qadar vaqt olishi mumkin. Shuning uchun yo'lda tez-tez va ozdan zaryadlash foydaliroq — ilova to'xtashlarni shunday hisoblaydi.",
      caption: "batareya to'lishi bo'yicha zaryadlash quvvati",
    },
    operators: {
      eyebrow: 'Stansiya operatorlariga',
      heading: 'Stansiyalaringizni ulang',
      text: "Stansiyalaringizni yaqin atrofdan zaryadlagich qidirayotgan har bir kishi ko'radi. Xarita, qidiruv, band qilish va to'lovni biz o'z zimmamizga olamiz — sizga konnektor holatlarini berish qoladi.",
      bullets: [
        "OCPI ni qo'llab-quvvatlaymiz — rouming uchun soha standarti",
        "OCPI bo'lmasa — API'ingiz uchun adapter yozamiz",
        'Yangi stansiyalar uchun promo-joylashtirish',
      ],
      cta: 'Bizga yozing',
    },
    get: {
      heading: 'Ilova tez orada chiqadi',
      text: "App Store va Google Play'da chiqarishga tayyorlanmoqdamiz. Bizga yozing — chiqqan kuni xabar beramiz.",
      cta: 'Chiqishi haqida xabar berish',
    },
    faq: {
      heading: 'Ko\'p beriladigan savollar',
      items: [
        {
          q: 'Ilovada nechta stansiya bor?',
          a: "O'zbekiston bo'yicha ochiq manbalardan topilgan hammasi, ustiga hamkor stansiyalari. Aniq soni yuqoridagi xaritada — u o'zgaradi, chunki baza to'ldirilib boradi.",
        },
        {
          q: "Ilovaning o'zi uchun to'lash kerakmi?",
          a: "Yo'q. Siz faqat mashinaga quygan elektr uchun to'laysiz.",
        },
        {
          q: 'Agar stansiya ishlamasa nima bo\'ladi?',
          a: "Stansiya ekranida «Xatolik haqida xabar berish» ni bosing. Shikoyatlar o'sha kuni bizga tushadi, stansiyada esa belgi paydo bo'ladi.",
        },
        {
          q: 'Men stansiya operatoriman. Qanday ulanaman?',
          a: "Bizga yozing — integratsiyani muhokama qilamiz. OCPI protokolini qo'llab-quvvatlaymiz, lekin oddiy yuklamadan ham boshlash mumkin: asosiysi, holatlar avtomatik kelsin.",
        },
      ],
    },
    footer: { privacy: 'Maxfiylik siyosati', terms: 'Foydalanish shartlari' },
  },

  en: {
    nav: { how: 'How it works', operators: 'For operators', download: 'Get the app' },
    hero: {
      eyebrow: 'Uzbekistan',
      titleLine1: "The country's chargers",
      titleLine2: 'on one map',
      lead: "See whether a charger is free before you drive there. Routes with stops matched to your car's range. Pay from your balance at any partner.",
      download: 'Get the app',
      how: 'How it works',
    },
    map: {
      stations: 'stations listed',
      freeNow: 'free right now',
      loading: 'loading…',
      failed: 'Map is temporarily unavailable — data loads from the app',
      live: 'Data updates in real time',
    },
    steps: {
      heading: 'Three steps to the plug',
      items: [
        {
          title: 'Find a station',
          text: 'The map shows which connectors are free right now and which are busy. Filter by plug type, power and price.',
        },
        {
          title: 'Reserve for 15 minutes',
          text: "While you drive, the connector is held for you. Nobody takes it from under your nose.",
        },
        {
          title: 'Pay from your balance',
          text: 'Top up once — charge at any partner. The receipt arrives right after the session.',
        },
      ],
    },
    features: [
      {
        title: 'Routes with charging stops',
        text: "Tell us where you're going and which car you drive. The app places chargers along the way so you never end up at zero mid-highway.",
        detail: 'Tashkent → Samarkand, 300 km',
      },
      {
        title: 'Your car in the catalogue',
        text: '1189 EV models: battery capacity, range, connector type. Search handles Cyrillic and typos.',
        detail: 'CCS2 · CHAdeMO · Type 2 · GB-T',
      },
      {
        title: 'Data you can trust',
        text: 'You can see when a station was last verified. If something is off, report it right from the station and we fix it.',
        detail: 'Verified in person, not just from a database',
      },
    ],
    curve: {
      heading: 'Why stops end at 80 %',
      text: 'Past 80 % a battery charges noticeably slower: the last few percent can take as long as the first sixty. On the road it pays to charge more often and less deeply — that is how the app plans stops.',
      caption: 'charging power as the battery fills',
    },
    operators: {
      eyebrow: 'For station operators',
      heading: 'Connect your stations',
      text: 'Everyone looking for a charger nearby will see your stations. We handle the map, search, reservations and payments — you supply connector statuses.',
      bullets: [
        'We support OCPI, the industry roaming standard',
        "No OCPI? We'll build an adapter for your API",
        'Promoted placement for new stations',
      ],
      cta: 'Get in touch',
    },
    get: {
      heading: 'The app is coming soon',
      text: "We're preparing the App Store and Google Play release. Write to us and we'll tell you the day it ships.",
      cta: 'Tell me when it ships',
    },
    faq: {
      heading: 'Common questions',
      items: [
        {
          q: 'How many stations are in the app?',
          a: 'Everything we could find in open sources across Uzbekistan, plus partner stations. The exact number is on the map above — it changes as the database grows.',
        },
        {
          q: 'Does the app itself cost anything?',
          a: 'No. You only pay for the electricity you put in the car.',
        },
        {
          q: "What if a station doesn't work?",
          a: 'Tap "Report an inaccuracy" on the station screen. Reports reach us the same day and the station gets flagged.',
        },
        {
          q: "I run charging stations. How do I connect?",
          a: "Write to us and we'll discuss integration. We support OCPI, but a simple feed works to start — what matters is that statuses arrive automatically.",
        },
      ],
    },
    footer: { privacy: 'Privacy policy', terms: 'Terms of use' },
  },
};

const STORAGE_KEY = 'evgo.lang';

/** Сохранённый выбор, иначе язык браузера, иначе русский. */
export function detectLanguage(): Lang {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && (LANGUAGES as readonly string[]).includes(saved)) return saved as Lang;
  } catch {
    // Приватный режим — читаем язык браузера.
  }

  const tag = navigator.language.slice(0, 2).toLowerCase();
  return (LANGUAGES as readonly string[]).includes(tag) ? (tag as Lang) : 'ru';
}

export function rememberLanguage(lang: Lang): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Не сохранилось — язык всё равно сменится на текущую сессию.
  }
}
