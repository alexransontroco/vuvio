import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Sparkles, Compass, Wrench, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import { readImageFile } from '../../../services/profileService.js';

const PREVIEW_STEPS = [
  { key: 'interests', icon: Compass },
  { key: 'activities', icon: Sparkles },
  { key: 'equipment', icon: Wrench },
  { key: 'bio', icon: Mic },
];

export default function StepCover({ draft, patch, onStart }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);

  const handleSelectAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      patch({ avatarPreview: dataUrl, avatarDataUrl: dataUrl });
    } catch { /* ignore */ }
    e.target.value = '';
  };

  return (
    <div className="ob-step ob-step--cover">
      <div className="ob-cover__body">
        <h1 className="ob-cover__title">{t('onboarding.cover.title')}</h1>
        <p className="ob-cover__subtitle">{t('onboarding.cover.subtitle')}</p>

        <div className="ob-cover__profile">
          <button
            type="button"
            className="ob-cover__avatar"
            onClick={() => fileRef.current?.click()}
            aria-label={t('onboarding.cover.addPhoto')}
          >
            {draft.avatarPreview ? (
              <>
                <img src={draft.avatarPreview} alt="" />
                <span className="ob-cover__avatar-edit" aria-hidden="true"><Camera size={14} strokeWidth={2} /></span>
              </>
            ) : (
              <Camera size={22} strokeWidth={1.6} />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleSelectAvatar}
          />
          <div className="ob-cover__name-field">
            <label className="ob-cover__name-label" htmlFor="ob-cover-name">
              {t('onboarding.cover.displayNameLabel')}
            </label>
            <input
              id="ob-cover-name"
              type="text"
              className="ob-cover__name-input"
              value={draft.displayName}
              onChange={(e) => patch({ displayName: e.target.value })}
              placeholder={t('onboarding.cover.displayNamePlaceholder')}
              autoComplete="name"
            />
          </div>
        </div>

        <ul className="ob-cover__preview">
          {PREVIEW_STEPS.map(({ key, icon: Icon }) => (
            <motion.li
              key={key}
              className="ob-cover__preview-item"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <span className="ob-cover__preview-icon" aria-hidden="true">
                <Icon size={16} strokeWidth={2} />
              </span>
              <span className="ob-cover__preview-text">
                <strong>{t(`onboarding.cover.previewSteps.${key}.title`)}</strong>
                <span>{t(`onboarding.cover.previewSteps.${key}.sub`)}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
