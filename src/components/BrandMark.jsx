export default function BrandMark({ size = 34, showName = false, dark = false }) {
  const stroke = dark ? '#062320' : '#2BD9C8';
  const dot = dark ? '#062320' : '#3B82E6';

  return (
    <span className="brand-mark" aria-label="VuVio">
      <svg width={size} height={size} viewBox="0 0 96 96" role="img">
        <path
          d="M16 34 L34 66 L48 44 L62 66 L80 34"
          stroke={stroke}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="48" cy="26" r="8" fill={dot} />
      </svg>
      {showName ? <span className="brand-mark__name">VuVio</span> : null}
    </span>
  );
}
