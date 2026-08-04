import { ArrowLeft, Backpack, Check, ChevronUp, Hand, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandMark from '../components/BrandMark.jsx';
import SplashScreen from '../components/SplashScreen.jsx';
import CurrentGlobe from '../components/globe/CurrentGlobe.jsx';
import { LiveViewer } from './WatchPage.jsx';
import { mapStreams } from '../data/mapStreams.js';

const COMPLETED_KEY = 'vuvio_onboarding_completed';
const INTERESTS_KEY = 'vuvio_selected_interests';
const TUTORIALS_KEY = 'vuvio_onboarding_tutorials_seen';
const SPLASH_MS = 1650;

const interests = [
  { id: 'crafts-skills', label: 'Crafts & Skills', image: '/assets/pov/06_potter.jpg' },
  { id: 'food', label: 'Food', image: '/assets/pov/07_baker.jpg' },
  { id: 'outdoor', label: 'Outdoor', image: '/assets/pov/17_mountain_hiker.jpg' },
  { id: 'city-life', label: 'City Life', image: '/assets/pov/05_architect.jpg' },
  { id: 'transport', label: 'Transport', image: '/assets/pov/16_tgv_driver.jpg' },
  { id: 'nature', label: 'Nature', image: '/assets/pov/08_wildlife_photographer.jpg' },
  { id: 'sports', label: 'Sports', image: '/assets/videos/biking-cover.jpg' },
  { id: 'travel', label: 'Travel', image: '/assets/pov/03_hot_air_balloon.jpg' },
  { id: 'behind-scenes', label: 'Behind the Scenes', image: '/assets/pov/14_cinematographer.jpg', wide: true },
];

const tutorialSteps = [
  {
    id: 'swipe',
    text: 'Swipe up for the next perspective',
    className: 'onboarding-watch-tip--bottom',
    icon: <ChevronUp size={16} strokeWidth={2} />,
  },
  {
    id: 'backpack',
    text: 'Tap the backpack to see the gear',
    className: 'onboarding-watch-tip--actions',
    icon: <Backpack size={16} strokeWidth={2} />,
  },
  {
    id: 'immersive',
    text: 'Double tap for an immersive view',
    className: 'onboarding-watch-tip--center',
    icon: <Hand size={16} strokeWidth={2} />,
  },
];

function haptic() {
  window.navigator?.vibrate?.(8);
}

function persistSelectedInterests(selected) {
  window.localStorage?.setItem(INTERESTS_KEY, JSON.stringify(selected));
}

function OnboardingProgressDots({ step }) {
  return (
    <div className="onboarding-progress-dots" aria-label={`Step ${step} of 5`}>
      {[1, 2, 3, 4].map((item) => (
        <span key={item} className={item <= step - 1 ? 'is-active' : ''} />
      ))}
    </div>
  );
}

function OnboardingTooltip({ step, onNext, onDone }) {
  const isLast = step.id === 'immersive';

  return (
    <div className={`onboarding-watch-tip ${step.className}`} role="status">
      <span>{step.icon}</span>
      <p>{step.text}</p>
      <button type="button" onClick={isLast ? onDone : onNext}>
        {isLast ? 'Got it' : 'Next'}
      </button>
    </div>
  );
}

function OnboardingWelcome({ onContinue, onSignIn }) {
  return (
    <section className="onboarding-screen onboarding-welcome" aria-label="Welcome to Vuvio">
      <video
        className="onboarding-welcome__video"
        src="/videos/vuvio-onboarding-loop.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="onboarding-welcome__shade" />
      <div className="onboarding-welcome__brand">
        <BrandMark size={46} showName />
      </div>
      <div className="onboarding-welcome__content">
        <h1>See the world live.</h1>
        <p>Real people. Real places. Real perspectives.</p>
        <button type="button" className="onboarding-primary-button" onClick={onContinue}>
          Explore Vuvio
        </button>
        <button type="button" className="onboarding-secondary-button" onClick={onSignIn}>
          Sign in
        </button>
      </div>
    </section>
  );
}

function OnboardingInterests({ selected, onToggle, onContinue, onSkip }) {
  const count = selected.length;
  const canContinue = count >= 3;

  return (
    <section className="onboarding-screen onboarding-panel-screen" aria-label="Choose interests">
      <OnboardingProgressDots step={3} />
      <button type="button" className="onboarding-skip" onClick={onSkip}>Skip</button>
      <header className="onboarding-panel-header">
        <h1>What would you like to see?</h1>
        <p>Choose at least 3.</p>
      </header>
      <div className="onboarding-interest-grid">
        {interests.map((interest) => {
          const active = selected.includes(interest.id);
          return (
            <button
              type="button"
              key={interest.id}
              className={`onboarding-interest-card${active ? ' is-selected' : ''}${interest.wide ? ' is-wide' : ''}`}
              onClick={() => onToggle(interest.id)}
              aria-pressed={active}
            >
              <img src={interest.image} alt="" loading="lazy" />
              <span className="onboarding-interest-card__shade" />
              <span className="onboarding-interest-card__label">{interest.label}</span>
              <span className="onboarding-interest-card__check" aria-hidden="true">
                <Check size={13} strokeWidth={2.4} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="onboarding-bottom-action">
        <button type="button" className="onboarding-primary-button" onClick={onContinue} disabled={!canContinue}>
          {canContinue ? `Continue — ${count} selected` : 'Choose 3 interests'}
        </button>
      </div>
    </section>
  );
}

function OnboardingGlobe({ onContinue, onSkip }) {
  const globeStreams = useMemo(() => {
    const preferredIds = new Set(['chef-lyon', 'road-cyclist-mallorca', 'sailor-split', 'wildlife-kenya', 'skate-portland']);
    return mapStreams.filter((stream) => preferredIds.has(stream.id));
  }, []);

  return (
    <section className="onboarding-screen onboarding-globe-screen" aria-label="Vuvio globe introduction">
      <CurrentGlobe streams={globeStreams} onboarding onOnboardingLiveSelect={haptic} />
      <div className="onboarding-globe-overlay" aria-hidden="false">
        <OnboardingProgressDots step={4} />
        <button type="button" className="onboarding-skip" onClick={onSkip}>Skip</button>
        <header>
          <h1>Every light is a live perspective.</h1>
          <p>Tap a light</p>
        </header>
        <div className="onboarding-globe-hint" aria-hidden="true">
          <span />
          <Hand size={18} strokeWidth={1.8} />
        </div>
        <article className="onboarding-globe-card">
          <img src="/assets/pov/07_baker.jpg" alt="" />
          <div>
            <strong>Baker's morning</strong>
            <span>Paris, France</span>
          </div>
        </article>
        <div className="onboarding-bottom-action">
          <button type="button" className="onboarding-primary-button" onClick={onContinue}>
            Explore the globe
          </button>
        </div>
      </div>
    </section>
  );
}

function OnboardingWatchTutorial({ onDone, onSkip }) {
  const [tipIndex, setTipIndex] = useState(0);
  const step = tutorialSteps[tipIndex];

  const nextTip = () => {
    haptic();
    setTipIndex((current) => Math.min(current + 1, tutorialSteps.length - 1));
  };

  const finish = () => {
    window.localStorage?.setItem(TUTORIALS_KEY, JSON.stringify(tutorialSteps.map((item) => item.id)));
    onDone();
  };

  return (
    <section className="onboarding-screen onboarding-watch-screen" aria-label="Watch tutorial">
      <LiveViewer liveId="chef-michelin-paris" />
      <div className="onboarding-watch-overlay">
        <OnboardingProgressDots step={5} />
        <button type="button" className="onboarding-skip" onClick={onSkip}>Skip</button>
        {step?.id === 'backpack' ? <span className="onboarding-backpack-halo" aria-hidden="true" /> : null}
        <OnboardingTooltip step={step} onNext={nextTip} onDone={finish} />
      </div>
    </section>
  );
}

function OnboardingCompleted({ onReset }) {
  const navigate = useNavigate();

  return (
    <section className="onboarding-screen onboarding-complete" aria-label="Onboarding completed">
      <BrandMark size={58} showName />
      <h1>Onboarding completed.</h1>
      <p>It will stay hidden on normal app launches.</p>
      <button type="button" className="onboarding-primary-button" onClick={() => navigate('/watch', { replace: true })}>
        Go to Watch
      </button>
      <button type="button" className="onboarding-reset-button" onClick={onReset}>
        <RotateCcw size={15} strokeWidth={1.9} />
        Reset onboarding
      </button>
    </section>
  );
}

export default function OnboardingTestPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [leavingSplash, setLeavingSplash] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState(() => {
    try {
      return JSON.parse(window.localStorage?.getItem(INTERESTS_KEY) ?? '[]');
    } catch {
      return [];
    }
  });
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (step !== 1) return undefined;
    const leaveTimer = window.setTimeout(() => setLeavingSplash(true), Math.max(0, SPLASH_MS - 420));
    const nextTimer = window.setTimeout(() => setStep(2), SPLASH_MS);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(nextTimer);
    };
  }, [step]);

  useEffect(() => {
    persistSelectedInterests(selectedInterests);
  }, [selectedInterests]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      resetOnboarding();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const goToStep = (nextStep) => {
    haptic();
    setStep(nextStep);
  };

  const skip = () => {
    window.localStorage?.setItem(COMPLETED_KEY, 'true');
    window.localStorage?.setItem('vuvio-landing-shown', 'true');
    navigate('/watch', { replace: true });
  };

  const finish = () => {
    window.localStorage?.setItem(COMPLETED_KEY, 'true');
    window.localStorage?.setItem('vuvio-landing-shown', 'true');
    navigate('/watch', { replace: true });
  };

  const resetOnboarding = () => {
    window.localStorage?.removeItem(COMPLETED_KEY);
    window.localStorage?.removeItem(INTERESTS_KEY);
    window.localStorage?.removeItem(TUTORIALS_KEY);
    setSelectedInterests([]);
    setCompleted(false);
    setLeavingSplash(false);
    setStep(1);
  };

  const toggleInterest = (id) => {
    haptic();
    setSelectedInterests((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  if (completed) return <OnboardingCompleted onReset={resetOnboarding} />;

  return (
    <main className="onboarding-shell">
      <section className="phone-stage onboarding-stage" aria-label="Vuvio onboarding test">
        {step > 2 && step < 5 ? (
          <button type="button" className="onboarding-back" onClick={() => goToStep(step - 1)} aria-label="Back">
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
        ) : null}
        <div className="onboarding-step" key={step}>
          {step === 1 ? <SplashScreen leaving={leavingSplash} /> : null}
          {step === 2 ? (
            <OnboardingWelcome onContinue={() => goToStep(3)} onSignIn={() => navigate('/login')} />
          ) : null}
          {step === 3 ? (
            <OnboardingInterests
              selected={selectedInterests}
              onToggle={toggleInterest}
              onContinue={() => goToStep(4)}
              onSkip={skip}
            />
          ) : null}
          {step === 4 ? <OnboardingGlobe onContinue={() => goToStep(5)} onSkip={skip} /> : null}
          {step === 5 ? <OnboardingWatchTutorial onDone={finish} onSkip={skip} /> : null}
        </div>
        <button type="button" className="onboarding-reset-chip" onClick={resetOnboarding}>
          <RotateCcw size={13} strokeWidth={2} />
          Reset
        </button>
      </section>
    </main>
  );
}
