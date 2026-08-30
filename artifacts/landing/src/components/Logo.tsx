/**
 * Знак EVGO.
 *
 * Буква O — это круговой индикатор заряда: разомкнутое кольцо с заполненной
 * дугой. Тот самый элемент, который человек видит в приложении во время
 * зарядки, поэтому знак читается как «заряд», а не как абстрактная фигура.
 * Разрыв кольца стоит сверху справа — там же, где у индикатора начинается
 * отсчёт.
 */

interface LogoProps {
  /** Высота знака в пикселях. Ширина считается пропорционально. */
  size?: number;
  /** Цвет надписи. Дуга всегда красится акцентом. */
  color?: string;
  className?: string;
}

export function Logo({ size = 28, color = 'currentColor', className }: LogoProps) {
  return (
    <svg
      height={size}
      viewBox="0 0 118 32"
      fill="none"
      className={className}
      role="img"
      aria-label="EVGO"
    >
      {/* E V G — обычная надпись, знак несёт только буква O */}
      <path
        d="M2 4h18v4.6H7.2v6.1h11.9v4.6H7.2v6.1H20V32H2V4z"
        fill={color}
      />
      <path
        d="M24 4h5.7l7.1 20.2L43.9 4h5.7L39.4 32h-5.2L24 4z"
        fill={color}
      />
      <path
        d="M67.4 3.4c4.6 0 8.5 1.9 10.9 5.2l-4.1 3.2c-1.7-2.3-4-3.5-6.8-3.5-5 0-8.6 3.8-8.6 9.7s3.6 9.7 8.8 9.7c4.2 0 7.1-2.3 7.7-6h-8v-4.4h13.2v2.3c0 8-5.3 13.1-13 13.1C58.8 32.7 53 26.7 53 18s5.9-14.6 14.4-14.6z"
        fill={color}
      />

      {/* O — индикатор заряда. Базовое кольцо: полная ёмкость */}
      <circle
        cx="100"
        cy="18"
        r="13"
        stroke={color}
        strokeWidth="4.6"
        opacity="0.38"
      />
      {/* Заполненная дуга — примерно три четверти круга: буква должна
          читаться как O, а не как разомкнутый полумесяц */}
      <path
        d="M100 5a13 13 0 1 1-9.2 22.2"
        stroke="var(--volt, #5b8cff)"
        strokeWidth="4.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Монограмма для favicon и мест, где полное написание не помещается:
 * то же кольцо заряда с молнией внутри.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="EVGO"
    >
      <rect width="32" height="32" rx="9" fill="#071A1C" />
      <circle cx="16" cy="16" r="10" stroke="#5b8cff" strokeWidth="2.4" opacity="0.25" />
      <path
        d="M16 6a10 10 0 1 1-8.5 15.2"
        stroke="#5b8cff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M17.4 10.2l-4.6 7h3.1l-1.3 4.9 4.8-7.2h-3.2l1.2-4.7z"
        fill="#5b8cff"
      />
    </svg>
  );
}
