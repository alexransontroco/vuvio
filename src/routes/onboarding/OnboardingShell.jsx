import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ChevronLeft } from 'lucide-react';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { addEquipmentItem, initEquipmentService } from '../../services/equipmentService.js';
import BrandMark from '../../components/BrandMark.jsx';
import ProgressBar from './components/ProgressBar.jsx';
import StepCover from './steps/StepCover.jsx';
import StepInterests from './steps/StepInterests.jsx';
import StepActivities from './steps/StepActivities.jsx';
import StepEquipment from './steps/StepEquipment.jsx';
import StepBio from './steps/StepBio.jsx';
import StepRecap from './steps/StepRecap.jsx';
import { useOnboardingDraft, clearDraft } from './useOnboardingDraft.js';

const stepVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 32 : -32 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -32 : 32 }),
};

export default function OnboardingShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile, updateProfile, refreshUserProfile } = useAuth();
  const returnTo = location.state?.returnTo || '/watch';

  const {
    draft,
    patch,
    setStep,
    nextStep,
    prevStep,
    toggleCategory,
    toggleActivity,
    addCustomActivity,
    addEquipment,
    removeEquipment,
    hasEquipment,
    reset,
  } = useOnboardingDraft(user, userProfile);

  const [direction, setDirection] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const goNext = useCallback(() => {
    setDirection(1);
    setError('');
    nextStep();
  }, [nextStep]);

  const goBack = useCallback(() => {
    setDirection(-1);
    setError('');
    prevStep();
  }, [prevStep]);

  const goto = useCallback((step) => {
    setDirection(step > draft.step ? 1 : -1);
    setError('');
    setStep(step);
  }, [draft.step, setStep]);

  const persistAndExit = useCallback(async ({ full }) => {
    if (!user?.uid) {
      setError(t('onboarding.errors.sessionLoading'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      let photoURL = userProfile?.photoURL || null;
      if (full && draft.avatarDataUrl) {
        const ext = draft.avatarDataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
        const ref = storageRef(storage, `users/${user.uid}/profile/avatar.${ext}`);
        await uploadString(ref, draft.avatarDataUrl, 'data_url', {
          contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
        });
        photoURL = await getDownloadURL(ref);
      }

      const profilePatch = full
        ? {
            displayName: draft.displayName.trim() || '',
            preferredCategories: draft.selectedCategories,
            preferredActivities: draft.activities,
            bio: draft.bio.trim() || '',
            onboardingCompleted: true,
            photoURL,
          }
        : { onboardingCompleted: true };

      await updateProfile(profilePatch);

      if (full && draft.selectedEquipment.length > 0) {
        await initEquipmentService(user.uid);
        for (const gear of draft.selectedEquipment) {
          addEquipmentItem({
            brand: gear.brand,
            model: gear.model,
            displayName: gear.displayName,
            category: gear.category,
            equipmentType: gear.equipmentType,
            imageUrl: gear.imageUrl || null,
            thumbnailUrl: gear.thumbnailUrl || null,
            imageRightsStatus: gear.imageRightsStatus || null,
            imageSource: gear.imageSource || null,
            imageRightsSource: gear.imageRightsSource || null,
            imageAllowedUsages: gear.imageAllowedUsages || [],
            imageRightsCheckedAt: gear.imageRightsCheckedAt || null,
            imageRightsExpiresAt: gear.imageRightsExpiresAt || null,
            imageProductId: gear.imageProductId || null,
            imageHostingStatus: gear.imageHostingStatus || null,
            visualCategory: gear.visualCategory || null,
            associatedActivity: gear.associatedActivity || null,
            productId: gear.productId || null,
            sourceProductId: gear.sourceProductId || null,
            provider: gear.provider || 'user',
            identificationStatus: gear.identificationStatus || 'manual',
            enrichmentStatus: gear.enrichmentStatus || 'none',
            userId: user.uid,
            isPublic: true,
            isDefault: false,
            ownership: 'owned',
          });
        }
      }

      await refreshUserProfile();
      clearDraft(user.uid);
      reset();
      navigate(returnTo, { replace: true });
    } catch (e) {
      console.error('[Onboarding] finish error:', e);
      setError(e?.message || t('onboarding.errors.finishFailed'));
      setBusy(false);
    }
  }, [user, userProfile, draft, updateProfile, refreshUserProfile, reset, navigate, returnTo, t]);

  const onFinish = () => persistAndExit({ full: true });
  const onSkip = () => persistAndExit({ full: false });

  // Per-step CTA label + handler.
  let ctaLabel;
  let ctaHandler = goNext;
  let ctaIcon = <ArrowRight size={16} strokeWidth={2.4} />;
  let ctaDisabled = busy;
  switch (draft.step) {
    case 0:
      ctaLabel = t('onboarding.ctaStart');
      break;
    case 3: {
      const count = draft.selectedEquipment.length;
      ctaLabel = count > 0 ? t('onboarding.ctaContinueWithCount', { count }) : t('onboarding.ctaContinue');
      break;
    }
    case 5:
      ctaLabel = t('onboarding.ctaFinish');
      ctaHandler = onFinish;
      ctaIcon = <Check size={16} strokeWidth={2.4} />;
      break;
    default:
      ctaLabel = t('onboarding.ctaContinue');
  }

  // Render current step.
  let stepNode;
  switch (draft.step) {
    case 0:
      stepNode = <StepCover draft={draft} patch={patch} onStart={goNext} />;
      break;
    case 1:
      stepNode = <StepInterests draft={draft} toggleCategory={toggleCategory} />;
      break;
    case 2:
      stepNode = <StepActivities draft={draft} toggleActivity={toggleActivity} addCustomActivity={addCustomActivity} />;
      break;
    case 3:
      stepNode = (
        <StepEquipment
          draft={draft}
          addEquipment={addEquipment}
          removeEquipment={removeEquipment}
          hasEquipment={hasEquipment}
        />
      );
      break;
    case 4:
      stepNode = <StepBio draft={draft} patch={patch} />;
      break;
    case 5:
      stepNode = <StepRecap draft={draft} onGoto={goto} />;
      break;
    default:
      stepNode = null;
  }

  return (
    <div className="ob-screen">
      <header className="ob-header">
        <div className="ob-header__left">
          {draft.step > 0 ? (
            <button type="button" className="ob-header__back" onClick={goBack} aria-label={t('onboarding.back')}>
              <ChevronLeft size={18} strokeWidth={2} />
            </button>
          ) : (
            <BrandMark size={22} showName />
          )}
        </div>
        <ProgressBar step={draft.step} />
        <button type="button" className="ob-header__skip" onClick={onSkip} disabled={busy}>
          {t('onboarding.skip')}
        </button>
      </header>

      <main className="ob-body">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={draft.step}
            className="ob-body__inner"
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {stepNode}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="ob-cta">
        {error ? <p className="ob-cta__error" role="alert">{error}</p> : null}
        <button type="button" className="ob-cta__btn" onClick={ctaHandler} disabled={ctaDisabled}>
          {busy ? (
            <span className="ob-cta__spinner" aria-hidden="true" />
          ) : (
            <>
              <span>{ctaLabel}</span>
              {ctaIcon}
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
