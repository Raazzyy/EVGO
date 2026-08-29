/**
 * Кривая зарядки — фирменный мотив страницы.
 *
 * Мощность держится высокой примерно до 80 % заряда, потом резко падает:
 * именно поэтому маршрут строят с остановками до 80 %, а не до полной. Любой
 * владелец электромобиля узнаёт этот график, поэтому он работает подписью
 * бренда, а не декоративной волной.
 *
 * Используется как разделитель между секциями и как фон в первом экране.
 */

interface ChargeCurveProps {
  className?: string;
  /** Толщина линии. */
  strokeWidth?: number;
  /** Подписать оси — уместно там, где кривая объясняет смысл, а не украшает. */
  labelled?: boolean;
}

// Реальная форма: подъём, плато на максимуме, спад после 80 %.
const PATH =
  'M0 180 C 40 180, 70 40, 130 34 C 200 27, 280 30, 360 36 C 430 41, 470 60, 520 104 C 570 148, 610 168, 720 176';

export function ChargeCurve({ className, strokeWidth = 2, labelled = false }: ChargeCurveProps) {
  return (
    <svg
      viewBox="0 0 720 200"
      className={`charge-curve block w-full ${className ?? ''}`}
      style={{ ['--curve-length' as string]: 1400 }}
      fill="none"
      aria-hidden={!labelled}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? 'График мощности зарядки: спад после 80 процентов' : undefined}
    >
      <defs>
        <linearGradient id="curve-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2fd08a" stopOpacity="0.15" />
          <stop offset="35%" stopColor="#2fd08a" />
          <stop offset="78%" stopColor="#2fd08a" />
          <stop offset="100%" stopColor="#f5a524" stopOpacity="0.65" />
        </linearGradient>
      </defs>

      <path
        d={PATH}
        stroke="url(#curve-stroke)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {labelled && (
        <>
          {/* Отметка 80 % — точка, после которой зарядка резко замедляется */}
          <line
            x1="520" y1="20" x2="520" y2="190"
            stroke="#f5a524"
            strokeWidth="1"
            strokeDasharray="3 4"
            opacity="0.5"
          />
          <text
            x="530" y="34"
            fill="#f5a524"
            fontSize="12"
            fontFamily="var(--font-mono)"
          >
            80 %
          </text>
          <text
            x="0" y="198"
            fill="#7c9490"
            fontSize="11"
            fontFamily="var(--font-mono)"
          >
            заряд →
          </text>
        </>
      )}
    </svg>
  );
}
