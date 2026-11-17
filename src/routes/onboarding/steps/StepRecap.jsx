import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Pencil } from 'lucide-react';
import { ACTIVITY_CATEGORIES } from '../../../data/activityCategories.js';
import { CATEGORY_IMAGES } from '../data/categoryImages.js';
import EquipmentVisual from '../../../components/equipment/EquipmentVisual.jsx';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
};

export default function StepRecap({ draft, onGoto }) {
  const { t } = useTranslation();

  const catsSelected = useMemo(
    () => ACTIVITY_CATEGORIES.filter((c) => draft.selectedCategories.includes(c.id)),
    [draft.selectedCategories],
  );

  return (
    <motion.div className="ob-step ob-step--recap" variants={container} initial="hidden" animate="show">
      <motion.header className="ob-step__header" variants={item}>
        <h2 className="ob-step__title">{t('onboarding.recap.title')}</h2>
        <p className="ob-step__sub">{t('onboarding.recap.subtitle')}</p>
      </motion.header>

      {catsSelected.length > 0 && (
        <motion.section className="ob-recap-section" variants={item}>
          <div className="ob-recap-section__head">
            <h3 className="ob-recap-section__title">{t('onboarding.recap.interestsHeader')}</h3>
            <button type="button" className="ob-recap-edit" onClick={() => onGoto(1)}>
              <Pencil size={13} strokeWidth={2} /> {t('onboarding.recap.editSection')}
            </button>
          </div>
          <div className="ob-recap-cats">
            {catsSelected.map((c) => (
              <div key={c.id} className="ob-recap-cat" style={{ '--cat-color': c.color }}>
                <img className="ob-recap-cat__bg" src={CATEGORY_IMAGES[c.id] || ''} alt="" aria-hidden="true" />
                <span className="ob-recap-cat__shade" aria-hidden="true" />
                <span className="ob-recap-cat__label">{c.label}</span>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {draft.activities.length > 0 && (
        <motion.section className="ob-recap-section" variants={item}>
          <div className="ob-recap-section__head">
            <h3 className="ob-recap-section__title">{t('onboarding.recap.activitiesHeader')}</h3>
            <button type="button" className="ob-recap-edit" onClick={() => onGoto(2)}>
              <Pencil size={13} strokeWidth={2} /> {t('onboarding.recap.editSection')}
            </button>
          </div>
          <div className="ob-recap-chips">
            {draft.activities.map((a) => (
              <span key={a} className="ob-recap-chip">{a}</span>
            ))}
          </div>
        </motion.section>
      )}

      {draft.selectedEquipment.length > 0 && (
        <motion.section className="ob-recap-section" variants={item}>
          <div className="ob-recap-section__head">
            <h3 className="ob-recap-section__title">
              {t('onboarding.recap.equipmentHeader', { count: draft.selectedEquipment.length })}
            </h3>
            <button type="button" className="ob-recap-edit" onClick={() => onGoto(3)}>
              <Pencil size={13} strokeWidth={2} /> {t('onboarding.recap.editSection')}
            </button>
          </div>
          <div className="ob-recap-eq">
            {draft.selectedEquipment.map((e) => {
              const name = e.brand && e.displayName?.toLowerCase().startsWith(`${e.brand.toLowerCase()} `)
                ? (e.model || e.displayName.slice(e.brand.length).trim())
                : (e.displayName || e.model);
              return (
                <div key={e.id} className="ob-recap-eq__item">
                  <div className="ob-recap-eq__thumb" aria-hidden="true">
                    <EquipmentVisual equipment={e} size={20} />
                  </div>
                  <div className="ob-recap-eq__meta">
                    {e.brand ? <span className="ob-recap-eq__brand">{e.brand}</span> : null}
                    <span className="ob-recap-eq__model">{name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {draft.bio.trim() && (
        <motion.section className="ob-recap-section" variants={item}>
          <div className="ob-recap-section__head">
            <h3 className="ob-recap-section__title">{t('onboarding.recap.bioHeader')}</h3>
            <button type="button" className="ob-recap-edit" onClick={() => onGoto(4)}>
              <Pencil size={13} strokeWidth={2} /> {t('onboarding.recap.editSection')}
            </button>
          </div>
          <p className="ob-recap-bio">"{draft.bio}"</p>
        </motion.section>
      )}
    </motion.div>
  );
}
