import { useEffect, useRef } from 'react';
import { Logo, LogoMark } from '@/components/Logo';
import { CoverageMap } from '@/components/CoverageMap';
import { ChargeCurve } from '@/components/ChargeCurve';

/** Плавное появление секции при попадании в область просмотра. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Без IntersectionObserver (старые вебвью) секция просто видна сразу.
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.visible = 'true';
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.visible = 'true';
          io.disconnect();
        }
      },
      { rootMargin: '-10% 0px' },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}

function Section({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useReveal<HTMLElement>();
  return (
    <section id={id} ref={ref} className={`reveal ${className}`}>
      {children}
    </section>
  );
}

// ── Данные страницы ─────────────────────────────────────────────────────────

// «Как это работает» — настоящая последовательность действий, поэтому шаги
// пронумерованы. В остальных блоках нумерации нет: там порядок ничего не значит.
const STEPS = [
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
];

const FEATURES = [
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
];

const FAQ = [
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
    a: 'Нажмите «Сообщить о неточности» на экране станции. Жалобы попадают к нам в тот же день, а на карте у станции появляется отметка.',
  },
  {
    q: 'Я оператор зарядных станций. Как подключиться?',
    a: 'Напишите нам — обсудим интеграцию. Поддерживаем протокол OCPI, но начать можно и с простой выгрузки: главное, чтобы статусы приходили автоматически.',
  },
];

// ── Страница ────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <div className="min-h-screen bg-ink">
      {/* ── Шапка ─────────────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Logo size={26} color="#f1f4f2" />
        <nav className="flex items-center gap-6 text-sm">
          <a href="#how" className="hidden text-muted transition-colors hover:text-paper sm:block">
            Как работает
          </a>
          <a href="#operators" className="hidden text-muted transition-colors hover:text-paper sm:block">
            Операторам
          </a>
          <a
            href="#get"
            className="rounded-full bg-volt px-4 py-2 font-medium text-ink transition-transform hover:scale-[1.03]"
          >
            Скачать
          </a>
        </nav>
      </header>

      {/* ── Первый экран ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Кривая заряда фоном: тот самый график, который узнаёт владелец EV */}
        <div className="pointer-events-none absolute inset-x-0 top-24 opacity-[0.13]">
          <ChargeCurve strokeWidth={1.5} />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pt-16">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-volt">
              Узбекистан
            </p>

            <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-paper sm:text-6xl">
              Зарядки страны
              <br />
              на одной карте
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper-dim">
              Видно, свободна ли станция, — до того как вы туда поехали.
              Маршрут с остановками под запас хода вашей машины. Оплата с
              баланса у любого партнёра.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#get"
                className="rounded-full bg-volt px-6 py-3.5 font-medium text-ink transition-transform hover:scale-[1.03]"
              >
                Скачать приложение
              </a>
              <a
                href="#how"
                className="rounded-full border border-ink-line px-6 py-3.5 font-medium text-paper transition-colors hover:border-volt hover:text-volt"
              >
                Как это работает
              </a>
            </div>
          </div>

          <CoverageMap />
        </div>
      </section>

      {/* ── Как это работает ──────────────────────────────────────────── */}
      <Section id="how" className="border-t border-ink-line bg-ink-soft py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
            Три шага до розетки
          </h2>

          <ol className="mt-12 grid gap-10 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <span className="font-mono text-sm text-volt">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 font-display text-xl font-medium text-paper">
                  {s.title}
                </h3>
                <p className="mt-2.5 leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* ── Возможности ───────────────────────────────────────────────── */}
      <Section className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-px overflow-hidden rounded-3xl border border-ink-line bg-ink-line sm:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="bg-ink p-7">
                <h3 className="font-display text-xl font-medium leading-snug text-paper">
                  {f.title}
                </h3>
                <p className="mt-3 leading-relaxed text-muted">{f.text}</p>
                <p className="mt-5 font-mono text-[11px] uppercase tracking-wider text-volt">
                  {f.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Почему до 80 % ────────────────────────────────────────────
          Кривая здесь не украшение, а объяснение: она показывает, почему
          маршрут строится с остановками именно до 80 %. */}
      <Section className="border-y border-ink-line bg-ink-soft py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-paper">
              Почему остановки — до 80 %
            </h2>
            <p className="mt-5 leading-relaxed text-muted">
              После 80 % батарея заряжается заметно медленнее: последние
              проценты могут занять столько же времени, сколько первые
              шестьдесят. Поэтому в дороге выгоднее заряжаться чаще и
              понемногу — приложение считает остановки именно так.
            </p>
          </div>

          <div className="rounded-3xl border border-ink-line bg-ink p-7">
            <ChargeCurve labelled strokeWidth={2.5} />
            <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted">
              мощность зарядки по мере заполнения батареи
            </p>
          </div>
        </div>
      </Section>

      {/* ── Операторам ────────────────────────────────────────────────── */}
      <Section id="operators" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="rounded-3xl border border-ink-line bg-gradient-to-br from-ink-soft to-ink p-8 sm:p-12">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber">
                  Операторам станций
                </p>
                <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
                  Подключите свои станции
                </h2>
                <p className="mt-5 max-w-xl leading-relaxed text-paper-dim">
                  Ваши станции увидят все, кто ищет зарядку поблизости. Мы
                  берём на себя карту, поиск, бронирование и оплату — вам
                  остаётся отдавать статусы коннекторов.
                </p>
                <ul className="mt-6 space-y-2.5 text-muted">
                  <li className="flex gap-3">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber" />
                    Поддерживаем OCPI — отраслевой стандарт роуминга
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber" />
                    Если OCPI нет — сделаем адаптер под ваш API
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber" />
                    Промо-размещение для новых станций
                  </li>
                </ul>
              </div>

              <a
                href="mailto:partners@evgo.uz?subject=Подключение станций к EVGO"
                className="inline-flex items-center justify-center rounded-full bg-amber px-7 py-4 font-medium text-ink transition-transform hover:scale-[1.03]"
              >
                Написать нам
              </a>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Скачать ───────────────────────────────────────────────────── */}
      <Section id="get" className="border-t border-ink-line py-20">
        <div className="mx-auto max-w-6xl px-5 text-center">
          <LogoMark size={52} className="mx-auto" />
          <h2 className="mt-7 font-display text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
            Приложение выходит скоро
          </h2>
          <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted">
            Готовим публикацию в App Store и Google Play. Оставьте почту —
            напишем в день выхода, без рассылок и рекламы.
          </p>

          {/* Форма ведёт на почту: собственный сборщик адресов пока не нужен,
              а обещать рассылку без работающей отписки нечестно. */}
          <a
            href="mailto:hello@evgo.uz?subject=Сообщите о выходе приложения"
            className="mt-8 inline-block rounded-full bg-volt px-7 py-4 font-medium text-ink transition-transform hover:scale-[1.03]"
          >
            Сообщить о выходе
          </a>
        </div>
      </Section>

      {/* ── Вопросы ───────────────────────────────────────────────────── */}
      <Section className="border-t border-ink-line bg-ink-soft py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-paper">
            Частые вопросы
          </h2>

          <dl className="mt-10 divide-y divide-ink-line">
            {FAQ.map((item) => (
              <div key={item.q} className="py-6">
                <dt className="font-display text-lg font-medium text-paper">
                  {item.q}
                </dt>
                <dd className="mt-2.5 leading-relaxed text-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {/* ── Подвал ────────────────────────────────────────────────────── */}
      <footer className="border-t border-ink-line py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 sm:flex-row sm:items-center sm:justify-between">
          <Logo size={22} color="#7c9490" />

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <a href="/privacy" className="transition-colors hover:text-paper">
              Политика конфиденциальности
            </a>
            <a href="/terms" className="transition-colors hover:text-paper">
              Условия использования
            </a>
            <a href="mailto:hello@evgo.uz" className="transition-colors hover:text-paper">
              hello@evgo.uz
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
