export default function LiveBadge({ pulse = false, compact = false }) {
  return (
    <span className={['live-badge', pulse ? 'live-badge--pulse' : '', compact ? 'live-badge--compact' : ''].join(' ')}>
      <span className="live-badge__dot" />
      LIVE
    </span>
  );
}
