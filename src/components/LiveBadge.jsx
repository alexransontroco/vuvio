import { useTranslation } from 'react-i18next';

export default function LiveBadge({ pulse = false, compact = false }) {
  const { t } = useTranslation();

  return (
    <span className={['live-badge', pulse ? 'live-badge--pulse' : '', compact ? 'live-badge--compact' : ''].join(' ')}>
      <span className="live-badge__dot" />
      {t('live.badge')}
    </span>
  );
}
