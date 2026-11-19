import { useTranslation } from 'react-i18next';
import { TOTAL_CONTENT_STEPS } from '../useOnboardingDraft.js';

// Renders TOTAL_CONTENT_STEPS segments. step=0 (cover) shows all empty.
export default function ProgressBar({ step }) {
  const { t } = useTranslation();
  const activeIndex = Math.max(0, step - 1); // 0..4 maps to segment index
  return (
    <div
      className="ob-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={TOTAL_CONTENT_STEPS}
      aria-valuenow={Math.max(0, step)}
      aria-label={t('onboarding.stepXofY', { step: Math.max(1, step), total: TOTAL_CONTENT_STEPS })}
    >
      {Array.from({ length: TOTAL_CONTENT_STEPS }).map((_, i) => {
        const state = step === 0 ? 'idle' : i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'idle';
        return <span key={i} className={`ob-progress__seg is-${state}`} />;
      })}
    </div>
  );
}
