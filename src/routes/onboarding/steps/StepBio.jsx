import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { suggestionsForCategories } from '../data/bioSuggestions.js';

const MAX_BIO = 160;

export default function StepBio({ draft, patch }) {
  const { t } = useTranslation();
  const suggestions = useMemo(
    () => suggestionsForCategories(draft.selectedCategories),
    [draft.selectedCategories],
  );

  const apply = (key) => patch({ bio: t(`onboarding.bio.suggestions.${key}`) });

  return (
    <div className="ob-step">
      <header className="ob-step__header">
        <p className="ob-step__eyebrow">{t('onboarding.stepLabel', { n: 4 })}</p>
        <h2 className="ob-step__title">{t('onboarding.bio.title')}</h2>
        <p className="ob-step__sub">{t('onboarding.bio.subtitle')}</p>
      </header>

      <div className="ob-bio">
        <textarea
          className="ob-bio__input"
          value={draft.bio}
          onChange={(e) => patch({ bio: e.target.value.slice(0, MAX_BIO) })}
          placeholder={t('onboarding.bio.placeholder')}
          maxLength={MAX_BIO}
          rows={5}
        />
        <p className="ob-bio__counter">{draft.bio.length} / {MAX_BIO}</p>
      </div>

      {suggestions.length > 0 && (
        <section className="ob-bio-suggest">
          <p className="ob-bio-suggest__title">
            <Sparkles size={14} strokeWidth={2} /> {t('onboarding.bio.suggestionsHeader')}
          </p>
          <div className="ob-bio-suggest__chips">
            {suggestions.map((key) => (
              <button
                key={key}
                type="button"
                className="ob-bio-suggest__chip"
                onClick={() => apply(key)}
              >
                {t(`onboarding.bio.suggestions.${key}`)}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
