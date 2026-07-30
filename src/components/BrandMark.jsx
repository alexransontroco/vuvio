export default function BrandMark({ size = 34, showName = false, dark = false, withCircle = true }) {
  const iconColor = dark ? '#062320' : null; // null = use gradient
  const dotColor  = dark ? '#062320' : '#3B82F6';
  const textColor = dark ? '#062320' : '#ffffff';
  const gradId    = 'vuvio-brand-grad';
  const circleGradId = 'vuvio-circle-grad';

  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {!dark && (
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#0FBFB0" />
            <stop offset="50%"  stopColor="#2BD9C8" />
            <stop offset="100%" stopColor="#1EC8BA" />
          </linearGradient>
          {withCircle && (
            <linearGradient id={circleGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#41B4FF" />
              <stop offset="100%" stopColor="#2184D8" />
            </linearGradient>
          )}
        </defs>
      )}
      {withCircle && <circle cx="48" cy="48" r="45" stroke={dark ? '#162429' : `url(#${circleGradId})`} strokeWidth="2.5" fill="none" />}
      <path
        d="M16 34 L34 66 L48 44 L62 66 L80 34"
        stroke={dark ? iconColor : `url(#${gradId})`}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="48" cy="24" r="8" fill={dotColor} />
    </svg>
  );

  if (!showName) {
    return <span className="brand-mark" aria-label="Vuvio">{icon}</span>;
  }

  return (
    <span
      className="brand-mark"
      aria-label="Vuvio"
      style={{ display: 'inline-flex', alignItems: 'center', gap: `${Math.round(size * 0.32)}px` }}
    >
      {icon}
      <span
        aria-hidden="true"
        style={{
          color: textColor,
          fontSize: `${Math.round(size * 0.82)}px`,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          textShadow: dark ? 'none' : '0 2px 12px rgba(0,0,0,0.28)',
        }}
      >
        Vuvio
      </span>
    </span>
  );
}
