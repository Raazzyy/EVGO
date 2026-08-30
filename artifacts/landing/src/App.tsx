import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo, LogoMark } from '@/components/Logo';
import { CoverageMap } from '@/components/CoverageMap';
import { ChargeCurve } from '@/components/ChargeCurve';
import { LegalPage } from '@/LegalPage';
import { PRIVACY, TERMS } from '@/legal';
import {
  CONTENT,
  LANGUAGES,
  LANGUAGE_LABELS,
  detectLanguage,
  rememberLanguage,
  type Lang,
} from '@/content';

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

export default function App() {
  const [lang, setLang] = useState<Lang>('ru');
  // Роутер ради двух страниц не нужен: смотрим путь напрямую. Сервер отдаёт
  // index.html на любой адрес (rewrite в artifact.toml), поэтому /privacy и
  // /terms доходят сюда.
  const path = typeof window === 'undefined' ? '/' : window.location.pathname;

  // Язык определяется после монтирования: на сервере localStorage и
  // navigator недоступны, а разметка должна совпасть при гидратации.
  useEffect(() => setLang(detectLanguage()), []);

  // Атрибут lang нужен и поисковикам, и переносам слов в браузере.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const switchLang = useCallback((next: Lang) => {
    setLang(next);
    rememberLanguage(next);
  }, []);

  const t = CONTENT[lang];

  // Ссылки на эти страницы уходят в App Store и Google Play при проверке
  // заявки — без них приложение не примут.
  if (path.startsWith('/privacy')) {
    return <LegalPage doc={PRIVACY[lang]} lang={lang} onLangChange={switchLang} />;
  }
  if (path.startsWith('/terms')) {
    return <LegalPage doc={TERMS[lang]} lang={lang} onLangChange={switchLang} />;
  }

  return (
    <div className="min-h-screen bg-ink">
      {/* ── Шапка ─────────────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6">
        <Logo size={26} color="#f1f4f2" />

        <nav className="flex items-center gap-4 text-sm sm:gap-6">
          <a href="#how" className="hidden text-muted transition-colors hover:text-paper sm:block">
            {t.nav.how}
          </a>
          <a
            href="#operators"
            className="hidden text-muted transition-colors hover:text-paper sm:block"
          >
            {t.nav.operators}
          </a>

          {/* Переключатель языка: три коротких кода, а не выпадающий список —
              вариантов всего три, и лишнее нажатие тут ни к чему. */}
          <div className="flex items-center gap-1 rounded-full border border-ink-line p-0.5">
            {LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => switchLang(code)}
                aria-pressed={lang === code}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  lang === code
                    ? 'bg-volt-deep text-white'
                    : 'text-muted hover:text-paper'
                }`}
              >
                {LANGUAGE_LABELS[code]}
              </button>
            ))}
          </div>

          <a
            href="#get"
            className="rounded-full bg-gradient-to-r from-volt-deep to-violet px-4 py-2 font-medium text-white transition-transform hover:scale-[1.03]"
          >
            {t.nav.download}
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
              {t.hero.eyebrow}
            </p>

            <h1 className="mt-5 font-display text-[2.4rem] font-semibold leading-[1.06] tracking-tight text-paper sm:text-5xl lg:text-[3.4rem]">
              {t.hero.titleLine1}
              <br />
              {t.hero.titleLine2}
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper-dim">
              {t.hero.lead}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#get"
                className="rounded-full bg-gradient-to-r from-volt-deep to-violet px-6 py-3.5 font-medium text-white transition-transform hover:scale-[1.03]"
              >
                {t.hero.download}
              </a>
              <a
                href="#how"
                className="rounded-full border border-ink-line px-6 py-3.5 font-medium text-paper transition-colors hover:border-volt hover:text-volt"
              >
                {t.hero.how}
              </a>
            </div>
          </div>

          <CoverageMap labels={t.map} />
        </div>
      </section>

      {/* ── Как это работает ──────────────────────────────────────────── */}
      <Section id="how" className="border-t border-ink-line bg-ink-soft py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
            {t.steps.heading}
          </h2>

          {/* Нумерация здесь оправдана: это настоящая последовательность
              действий, а не просто три карточки. */}
          <ol className="mt-12 grid gap-10 sm:grid-cols-3">
            {t.steps.items.map((s, i) => (
              <li key={s.title}>
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
            {t.features.map((f) => (
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
          Кривая здесь не украшение, а объяснение. */}
      <Section className="border-y border-ink-line bg-ink-soft py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-paper">
              {t.curve.heading}
            </h2>
            <p className="mt-5 leading-relaxed text-muted">{t.curve.text}</p>
          </div>

          <div className="rounded-3xl border border-ink-line bg-ink p-7">
            <ChargeCurve labelled strokeWidth={2.5} />
            <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted">
              {t.curve.caption}
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
                  {t.operators.eyebrow}
                </p>
                <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
                  {t.operators.heading}
                </h2>
                <p className="mt-5 max-w-xl leading-relaxed text-paper-dim">
                  {t.operators.text}
                </p>
                <ul className="mt-6 space-y-2.5 text-muted">
                  {t.operators.bullets.map((b) => (
                    <li key={b} className="flex gap-3">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href="mailto:partners@evgo.uz?subject=EVGO"
                className="inline-flex items-center justify-center rounded-full bg-amber px-7 py-4 font-medium text-ink transition-transform hover:scale-[1.03]"
              >
                {t.operators.cta}
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
            {t.get.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted">
            {t.get.text}
          </p>

          {/* Ведёт на почту: своего сборщика адресов пока нет, а обещать
              рассылку без работающей отписки нечестно. */}
          <a
            href="mailto:hello@evgo.uz?subject=EVGO"
            className="mt-8 inline-block rounded-full bg-gradient-to-r from-volt-deep to-violet px-7 py-4 font-medium text-white transition-transform hover:scale-[1.03]"
          >
            {t.get.cta}
          </a>
        </div>
      </Section>

      {/* ── Вопросы ───────────────────────────────────────────────────── */}
      <Section className="border-t border-ink-line bg-ink-soft py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-paper">
            {t.faq.heading}
          </h2>

          <dl className="mt-10 divide-y divide-ink-line">
            {t.faq.items.map((item) => (
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
              {t.footer.privacy}
            </a>
            <a href="/terms" className="transition-colors hover:text-paper">
              {t.footer.terms}
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
