import { Logo } from '@/components/Logo';
import type { LegalDoc } from '@/legal';
import { LANGUAGES, LANGUAGE_LABELS, type Lang } from '@/content';

/**
 * Страница юридического документа.
 *
 * Отдельный простой макет: сюда попадают из App Store и Google Play при
 * проверке заявки, поэтому текст должен читаться сразу, без прокрутки через
 * маркетинг. Ширина колонки — около 70 знаков, иначе длинный текст читать
 * тяжело.
 */

interface LegalPageProps {
  doc: LegalDoc;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
}

export function LegalPage({ doc, lang, onLangChange }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-ink">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-6">
        <a href="/" aria-label="EVGO">
          <Logo size={24} color="#f1f4f2" />
        </a>

        <div className="flex items-center gap-1 rounded-full border border-ink-line p-0.5">
          {LANGUAGES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => onLangChange(code)}
              aria-pressed={lang === code}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                lang === code ? 'bg-volt text-ink' : 'text-muted hover:text-paper'
              }`}
            >
              {LANGUAGE_LABELS[code]}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
          {doc.title}
        </h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-wider text-muted">
          {doc.updated}
        </p>

        <p className="mt-8 text-lg leading-relaxed text-paper-dim">{doc.intro}</p>

        <div className="mt-12 space-y-10">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-medium text-paper">
                {section.heading}
              </h2>

              {section.paragraphs.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-muted">
                  {p}
                </p>
              ))}

              {section.list ? (
                <ul className="mt-4 space-y-2.5">
                  {section.list.map((item) => (
                    <li key={item} className="flex gap-3 leading-relaxed text-muted">
                      <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-volt" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <a
          href="/"
          className="mt-14 inline-block rounded-full border border-ink-line px-6 py-3 text-sm font-medium text-paper transition-colors hover:border-volt hover:text-volt"
        >
          ← EVGO
        </a>
      </main>
    </div>
  );
}
