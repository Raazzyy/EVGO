# Материалы для App Store и Google Play

**Задачи 88, 89** из `docs/tasks.md`. Тексты готовы к вставке, скриншоты и
иконка — отдельно (задачи 86, 87).

⚠️ Перед подачей сверить декларации о данных с фактическим поведением
приложения: если приложение собирает больше, чем заявлено, заявку отклонят,
а повторная подача занимает дни.

---

## Название и подзаголовок

| Поле | Значение | Ограничение |
|---|---|---|
| Название (App Store) | `EVGO — зарядки для электромобилей` | 30 знаков |
| Подзаголовок (App Store) | `Карта зарядок Узбекистана` | 30 знаков |
| Название (Google Play) | `EVGO: зарядки Узбекистана` | 30 знаков |
| Краткое описание (Google Play) | `Все зарядные станции Узбекистана на одной карте` | 80 знаков |

Название начинается с бренда, а не с ключевых слов: в выдаче видны первые
15–18 знаков, и «EVGO» должно быть среди них.

---

## Описание — русский

```
Видно, свободна ли зарядка, — до того как вы туда поехали.

EVGO показывает зарядные станции Узбекистана на одной карте: какие
коннекторы свободны прямо сейчас, какая мощность, какая цена.

КАРТА И ПОИСК
• Станции рядом с вами, отсортированные по расстоянию
• Фильтры по типу разъёма, мощности, цене и оператору
• Видно, когда данные о станции проверяли в последний раз
• Нашли неточность — сообщите прямо со станции, мы исправим

МАРШРУТ С ОСТАНОВКАМИ
Указываете, куда едете и на какой машине. Приложение расставляет зарядки
по пути так, чтобы вы не остались с нулём посреди трассы. Расчёт учитывает
запас хода вашей модели, а не усреднённый.

ВАШ АВТОМОБИЛЬ
Каталог из 1189 моделей: ёмкость батареи, запас хода, тип разъёма.
Поиск понимает кириллицу и опечатки — «тесла» найдёт Tesla.

БРОНИРОВАНИЕ
Коннектор держится за вами 15 минут, пока вы едете.

ТРИ ЯЗЫКА
Узбекский, русский, английский.

EVGO не владеет зарядными станциями — их обслуживают операторы. Мы
показываем, где они, и помогаем до них доехать.
```

## Описание — узбекский

```
Zaryadlagich bo'shmi — yo'lga chiqishdan oldin ko'rinadi.

EVGO O'zbekiston zaryadlash stansiyalarini bitta xaritada ko'rsatadi:
qaysi konnektorlar hozir bo'sh, quvvati qancha, narxi qancha.

XARITA VA QIDIRUV
• Sizga yaqin stansiyalar, masofa bo'yicha tartiblangan
• Ulagich turi, quvvat, narx va operator bo'yicha filtrlar
• Stansiya ma'lumotlari oxirgi marta qachon tekshirilgani ko'rinadi
• Xatolik topsangiz — to'g'ridan-to'g'ri stansiyadan xabar bering

TO'XTASHLAR BILAN MARSHRUT
Qayerga va qaysi mashinada ketayotganingizni ko'rsatasiz. Ilova
zaryadlagichlarni yo'l bo'ylab shunday joylashtiradiki, siz trassa
o'rtasida nolda qolmaysiz.

MASHINANGIZ
1189 ta model katalogi: batareya sig'imi, quvvat zaxirasi, ulagich turi.

BAND QILISH
Siz yo'ldasiz — konnektor 15 daqiqa sizga saqlanadi.

UCH TIL
O'zbekcha, ruscha, inglizcha.

EVGO zaryadlash stansiyalariga egalik qilmaydi — ularni operatorlar
xizmat ko'rsatadi. Biz ular qayerdaligini ko'rsatamiz va yetib borishga
yordam beramiz.
```

## Описание — английский

```
See whether a charger is free before you drive there.

EVGO shows charging stations across Uzbekistan on one map: which
connectors are free right now, what power, what price.

MAP AND SEARCH
• Stations near you, sorted by distance
• Filter by connector type, power, price and operator
• See when each station was last verified
• Spotted something wrong? Report it right from the station

ROUTES WITH CHARGING STOPS
Tell us where you're going and which car you drive. The app places
chargers along the way so you never end up at zero mid-highway. The
calculation uses your model's range, not an average.

YOUR CAR
A catalogue of 1189 EV models: battery capacity, range, connector type.

RESERVATIONS
The connector is held for you for 15 minutes while you drive over.

THREE LANGUAGES
Uzbek, Russian, English.

EVGO does not own the charging stations — they are run by operators.
We show you where they are and help you get there.
```

---

## Ключевые слова (App Store, 100 знаков)

```
зарядка,электромобиль,EV,charger,заправка,Ташкент,Узбекистан,CCS2,Tesla,BYD,станция,маршрут
```

Бренд и название приложения в ключевые слова не включаются — Apple
индексирует их отдельно, и повтор тратит лимит впустую.

---

## Декларации о данных

### App Store — App Privacy

| Тип данных | Собираем | Связаны с личностью | Для отслеживания | Зачем |
|---|---|---|---|---|
| Номер телефона | да | да | нет | Вход в приложение |
| Имя | да | да | нет | Обращение к пользователю |
| Электронная почта | да | да | нет | Необязательное поле профиля |
| Точная геолокация | да | нет | нет | Показать станции рядом, построить маршрут |
| История покупок | да | да | нет | Чеки по сессиям зарядки |
| Идентификаторы устройства | да | да | нет | Токен push-уведомлений |

**Отслеживание между приложениями и сайтами: нет.** Рекламных сетей и
сторонней аналитики в приложении нет, поэтому запрос ATT не требуется.

### Google Play — Data Safety

- Данные передаются по защищённому соединению: **да**
- Пользователь может запросить удаление данных: **да** (в приложении:
  «Настройки» → «Аккаунт» → «Удалить аккаунт»)
- Собранные данные: местоположение (приблизительное и точное), личные
  данные (имя, email, номер телефона), финансовая информация (история
  покупок), идентификаторы устройства
- Все категории: для работы приложения, не для рекламы

### Обязательные ссылки

| Что | Адрес |
|---|---|
| Политика конфиденциальности | `https://evgo.uz/privacy` |
| Условия использования | `https://evgo.uz/terms` |
| Поддержка | `https://evgo.uz` |

Страницы уже готовы на лендинге. **До подачи заявки нужен домен** — задача 76.

---

## Разрешения и обоснования для iOS

Тексты появляются в системном диалоге. Apple отклоняет заявки с общими
формулировками вроде «приложению нужен доступ»: нужно объяснить пользу.

| Ключ | Текст |
|---|---|
| `NSLocationWhenInUseUsageDescription` | Чтобы показать зарядные станции рядом с вами и построить маршрут с остановками |
| `NSUserNotificationsUsageDescription` | Чтобы сообщить, когда зарядка завершится или освободится нужный коннектор |

Проверить, что в `app.json` не осталось разрешений, которыми приложение не
пользуется: каждое лишнее — повод для вопроса на ревью.

---

## Возрастной рейтинг

**4+ / 3+** — в приложении нет пользовательского контента, чатов и покупок
внутри приложения (оплата зарядки идёт через внешние платёжные системы).

---

## Что ещё нужно перед подачей

1. **Демо-аккаунт для ревьюера Apple** — вход по SMS-коду, а у ревьюера
   нет узбекского номера. Нужен тестовый номер с фиксированным кодом,
   иначе заявку отклонят с формулировкой «не удалось войти». Это отдельная
   доработка на стороне сервера
2. **Скриншоты** — минимум 3 на каждый размер экрана, задача 87
3. **Иконка** 1024×1024 без прозрачности и скруглений, задача 86
4. **Домен** — без него ссылки на политику не работают, задача 76
