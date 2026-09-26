import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext.jsx';

const OPTIONS = [
  { id: 'auto', labelKey: 'settings.language.optionAuto', descriptionKey: 'settings.language.optionAutoDesc' },
  { id: 'en', labelKey: 'settings.language.optionEn', descriptionKey: 'settings.language.optionEnDesc' },
  { id: 'fr', labelKey: 'settings.language.optionFr', descriptionKey: 'settings.language.optionFrDesc' },
];

export default function LanguageSheet({ onClose }) {
  const { t } = useTranslation();
  const { mode, language, setLanguage } = useLanguage();
  const active = mode === 'auto' ? 'auto' : language;

  const handleSelect = (id) => {
    setLanguage(id);
    onClose?.();
  };

  return (
    <div
      className="create-sheet"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.language.sheetTitle')}
    >
      <div className="create-sheet__panel language-sheet">
        <div className="create-sheet__header">
          <strong>{t('settings.language.sheetTitle')}</strong>
          <button type="button" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="language-sheet__list">
          {OPTIONS.map((option) => {
            const isActive = option.id === active;
            return (
              <button
                key={option.id}
                type="button"
                className={`language-sheet__option${isActive ? ' is-active' : ''}`}
                onClick={() => handleSelect(option.id)}
                aria-pressed={isActive}
              >
                <span className="language-sheet__copy">
                  <strong>{t(option.labelKey)}</strong>
                  <small>{t(option.descriptionKey)}</small>
                </span>
                {isActive ? <Check size={18} strokeWidth={2} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
