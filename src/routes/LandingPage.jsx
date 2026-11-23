import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import '../styles/pages/landing.css';

const COPY = {
  fr: {
    nav: 'Vuvio',

    heroTitle: ['Des passions,', 'des métiers,', 'des expériences'],
    heroTitleAccent: '— en direct.',
    heroSubtitle: 'Découvrez le monde à travers ceux qui le vivent.',
    waitlistIntro: 'Vuvio arrive bientôt. Laissez votre email pour être informé dès son lancement.',

    emailLabel: 'Votre adresse email',
    notify: 'Me prévenir du lancement',
    notifyFinal: 'Être informé du lancement',
    waitlistNote: 'Confirmation immédiate, puis un email au lancement.',
    privacyLink: 'Politique de confidentialité',
    betaLink: 'Accéder à la bêta',
    invalidEmail: 'Saisissez une adresse email valide.',
    challengeNeeded: 'Validez la vérification avant de continuer.',
    success: "C'est noté. Nous vous préviendrons au lancement.",
    technicalError: "L'inscription a échoué. Réessayez dans un instant.",
    remove: 'Retirer mon inscription',
    removed: 'Votre adresse a été retirée.',

    manifestoLineA: "Le live d'aujourd'hui filme surtout la personne.",
    manifestoLineB: "Vuvio filme ce qu'elle voit.",

    experiencesTitle: 'Un monde à vivre, pas à défiler.',
    experiences: [
      { tag: 'OUTDOOR & AVENTURE', title: 'Sur le terrain.', image: '/pitch-assets/Cycliste.jpg' },
      { tag: 'MÉTIERS & SAVOIR-FAIRE', title: "Dans l'atelier.", image: '/pitch-assets/cabinetmaker.jpg' },
      { tag: 'TERRITOIRES & TOURISME', title: 'Partout dans le monde.', image: '/pitch-assets/Guide.jpg' },
    ],
    experiencesNote: "Ces trois univers sont des exemples. Vuvio accueille toutes les passions qui méritent d'être vécues en direct.",

    appTitle: "Trois portes d'entrée, un seul monde en direct.",
    appSections: [
      { tag: 'WATCH', title: "Vivez l'instant.", body: 'Entrez dans un live immersif, à la première personne.', image: '/assets/landing/screens/live-cuisine.jpg' },
      { tag: 'GLOBE', title: 'Explorez le monde.', body: 'Un atlas vivant des lives en cours, partout sur la planète.', image: '/assets/landing/screens/globe.jpg' },
      { tag: 'IMMERSION', title: 'À la première personne.', body: 'Entrez dans le POV du créateur. Son regard, son rythme, son terrain.', image: '/assets/landing/screens/live-moto.jpg' },
    ],
    appDemoNote: "Visuels de démonstration du produit.",

    foundersTitle: 'Une vision commune.',
    foundersIntro: "Un frère et une sœur réunis autour d'une ambition : proposer une nouvelle façon de découvrir le monde.",
    founders: [
      {
        name: 'Alexandre Ranson',
        role: 'Cofondateur — Produit & technologie',
        bio: "Formation en informatique, parcours dans la musique et la production. Responsable du développement technique, du produit et de l'expérience utilisateur de Vuvio.",
        image: '/assets/avatars/alexvuv.png',
      },
      {
        name: 'Cécilia Ranson',
        role: 'Cofondatrice — Marketing, stratégie & partenariats',
        bio: "Expérience en marketing, stratégie et développement de marché. Responsable du positionnement, des partenariats et du développement de la communauté Vuvio.",
        image: '/assets/avatars/ceciliaimagevuv.jpeg',
      },
    ],

    finalTitle: 'Le monde, vu de l\'intérieur.',
    contactLabel: 'Créateurs, marques, partenaires :',
    footer: 'VUVIO · 2026',
  },

  en: {
    nav: 'Vuvio',

    heroTitle: ['Passions,', 'crafts,', 'real experiences'],
    heroTitleAccent: '— live.',
    heroSubtitle: 'Discover the world through those who live it.',
    waitlistIntro: 'Vuvio is coming soon. Leave your email to hear when it launches.',

    emailLabel: 'Your email address',
    notify: 'Notify me at launch',
    notifyFinal: 'Get notified at launch',
    waitlistNote: 'Instant confirmation, then one email at launch.',
    privacyLink: 'Privacy policy',
    betaLink: 'Access the beta',
    invalidEmail: 'Enter a valid email address.',
    challengeNeeded: 'Complete the verification before continuing.',
    success: "You're on the list. We'll notify you at launch.",
    technicalError: 'Signup failed. Please try again shortly.',
    remove: 'Remove my signup',
    removed: 'Your address has been removed.',

    manifestoLineA: "Live today is mostly about filming the person.",
    manifestoLineB: 'Vuvio films what they see.',

    experiencesTitle: 'A world to live, not to scroll.',
    experiences: [
      { tag: 'OUTDOOR & ADVENTURE', title: 'On the field.', image: '/pitch-assets/Cycliste.jpg' },
      { tag: 'CRAFTS & KNOW-HOW', title: 'In the workshop.', image: '/pitch-assets/cabinetmaker.jpg' },
      { tag: 'TERRITORIES & TRAVEL', title: 'Everywhere on Earth.', image: '/pitch-assets/Guide.jpg' },
    ],
    experiencesNote: "These three universes are examples. Vuvio welcomes any passion worth living, live.",

    appTitle: 'Three ways in, one live world.',
    appSections: [
      { tag: 'WATCH', title: 'Live the moment.', body: 'Step into an immersive first-person live stream.', image: '/assets/landing/screens/live-cuisine.jpg' },
      { tag: 'GLOBE', title: 'Explore the world.', body: 'A living atlas of streams happening right now.', image: '/assets/landing/screens/globe.jpg' },
      { tag: 'IMMERSION', title: 'First-person reality.', body: "Step into the creator's POV. Their gaze, their pace, their field.", image: '/assets/landing/screens/live-moto.jpg' },
    ],
    appDemoNote: 'Product demo visuals.',

    foundersTitle: 'A shared vision.',
    foundersIntro: 'A brother and sister united around one ambition: a new way to discover the world.',
    founders: [
      {
        name: 'Alexandre Ranson',
        role: 'Co-founder — Product & technology',
        bio: 'Computer science background, experience in music and production. Leads technical development, product and user experience at Vuvio.',
        image: '/assets/avatars/alexvuv.png',
      },
      {
        name: 'Cécilia Ranson',
        role: 'Co-founder — Marketing, strategy & partnerships',
        bio: 'Experience in marketing, strategy and market development. Leads positioning, partnerships and community growth at Vuvio.',
        image: '/assets/avatars/ceciliaimagevuv.jpeg',
      },
    ],

    finalTitle: 'The world, from the inside.',
    contactLabel: 'Creators, brands, partners:',
    footer: 'VUVIO · 2026',
  },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';
  const t = COPY[lang];
  const emailRef = useRef(null);
  const widgetRef = useRef(null);
  const turnstileIdRef = useRef(null);
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [subscription, setSubscription] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const appRailRef = useRef(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    const rail = appRailRef.current;
    if (!rail) return;
    const items = rail.querySelectorAll('[data-slide-index]');
    if (!items.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = Number(visible.target.getAttribute('data-slide-index'));
          if (!Number.isNaN(idx)) setActiveSlide(idx);
        }
      },
      { root: rail, threshold: [0.55, 0.9] }
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [lang]);

  const goToSlide = (idx) => {
    const rail = appRailRef.current;
    if (!rail) return;
    const el = rail.querySelector(`[data-slide-index="${idx}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  useEffect(() => {
    if (!siteKey) return;
    let active = true;
    const render = () => {
      if (!active || !widgetRef.current || !window.turnstile || turnstileIdRef.current) return;
      turnstileIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        size: 'flexible',
        callback: setTurnstileToken,
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      });
    };
    const script = document.getElementById('vuvio-turnstile-script') || document.createElement('script');
    if (!script.id) {
      script.id = 'vuvio-turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);
    render();
    return () => {
      active = false;
      script.removeEventListener('load', render);
      if (turnstileIdRef.current && window.turnstile) window.turnstile.remove(turnstileIdRef.current);
      turnstileIdRef.current = null;
    };
  }, [siteKey]);

  const resetChallenge = () => {
    setTurnstileToken('');
    if (turnstileIdRef.current && window.turnstile) window.turnstile.reset(turnstileIdRef.current);
  };

  const submitWaitlist = async (event) => {
    event.preventDefault();
    if (status === 'loading') return;
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalized) || normalized.length > 254) {
      setStatus('error');
      setMessage(t.invalidEmail);
      return;
    }
    if (!turnstileToken) {
      setStatus('error');
      setMessage(siteKey ? t.challengeNeeded : t.technicalError);
      setHasInteracted(true);
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, locale: lang, website: event.currentTarget.elements.website.value, turnstileToken }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.code || 'network');
      setSubscription(result.entryId && result.unsubscribeToken ? result : null);
      setStatus('success');
      setMessage(t.success);
      setEmail('');
    } catch (error) {
      setStatus('error');
      setMessage(
        error.message === 'invalid_email' ? t.invalidEmail
          : error.message === 'challenge_failed' ? t.challengeNeeded
            : t.technicalError
      );
    } finally {
      resetChallenge();
    }
  };

  const removeSubscription = async () => {
    if (!subscription) return;
    setStatus('loading');
    try {
      const response = await fetch('/api/waitlist/subscription', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: subscription.entryId, token: subscription.unsubscribeToken }),
      });
      if (!response.ok) throw new Error('network');
      setSubscription(null);
      setStatus('idle');
      setMessage(t.removed);
    } catch {
      setStatus('error');
      setMessage(t.technicalError);
    }
  };

  const focusWaitlist = () => {
    emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    emailRef.current?.focus({ preventScroll: true });
  };

  const enterApp = () => {
    navigate('/intro-preview');
  };

  const challengeVisible = hasInteracted;

  return (
    <div className="vuvio-landing">
      <div className="vuvio-landing__ambient" aria-hidden="true" />

      <header className="vuvio-landing__topbar">
        <div className="vuvio-landing__wordmark">
          <img src="/assets/logo/vuvio-logo.png" alt="" />
          <span>{t.nav}</span>
        </div>
        <div className="vuvio-landing__lang" role="group" aria-label="Language">
          <button
            type="button"
            className={`vuvio-landing__lang-btn${lang === 'en' ? ' is-active' : ''}`}
            onClick={() => setLanguage('en')}
          >EN</button>
          <span className="vuvio-landing__lang-sep">·</span>
          <button
            type="button"
            className={`vuvio-landing__lang-btn${lang === 'fr' ? ' is-active' : ''}`}
            onClick={() => setLanguage('fr')}
          >FR</button>
        </div>
      </header>

      {/* ---------- Hero : demi-globe top + copy below ---------- */}
      <section className="vuvio-landing__hero">
        <div className="vuvio-landing__hero-globe" aria-hidden="true">
          <img src="/pitch-assets/globe-pins.png" alt="" />
        </div>
        <div className="vuvio-landing__hero-inner">
          <h1 className="vuvio-landing__hero-title">
            {t.heroTitle.map((line) => (
              <span key={line}>{line}<br /></span>
            ))}
            <span className="vuvio-landing__hero-accent">{t.heroTitleAccent}</span>
          </h1>

          <p className="vuvio-landing__hero-subtitle">{t.heroSubtitle}</p>
          <p className="vuvio-landing__waitlist-intro">{t.waitlistIntro}</p>

          <form className="vuvio-landing__form" onSubmit={submitWaitlist} noValidate>
            <label className="vuvio-landing__sr-only" htmlFor="launch-email">{t.emailLabel}</label>
            <input
              id="launch-email"
              ref={emailRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t.emailLabel}
              value={email}
              onFocus={() => setHasInteracted(true)}
              onChange={(event) => {
                setEmail(event.target.value);
                setHasInteracted(true);
                if (status === 'error') { setStatus('idle'); setMessage(''); }
              }}
              aria-invalid={status === 'error' && message === t.invalidEmail}
              aria-describedby="launch-waitlist-message"
            />
            <input className="vuvio-landing__honeypot" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <button type="submit" className="vuvio-landing__cta" disabled={status === 'loading'}>
              {status === 'loading' ? <span className="vuvio-landing__spinner" aria-hidden="true" /> : t.notify}
            </button>
          </form>

          <div
            ref={widgetRef}
            className={`vuvio-landing__challenge${challengeVisible ? ' is-visible' : ''}`}
          />

          <p id="launch-waitlist-message" className={`vuvio-landing__form-message${status === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">
            {message}
          </p>

          {subscription && (
            <button type="button" className="vuvio-landing__text-link" onClick={removeSubscription} disabled={status === 'loading'}>
              {t.remove}
            </button>
          )}

          <p className="vuvio-landing__hero-note">
            {t.waitlistNote} · <Link to="/privacy" className="vuvio-landing__text-link vuvio-landing__text-link--muted">{t.privacyLink}</Link>
          </p>

          <button type="button" className="vuvio-landing__beta-btn" onClick={enterApp}>
            {t.betaLink} <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      {/* ---------- Manifesto ---------- */}
      <section className="vuvio-landing__manifesto" id="manifesto">
        <p className="vuvio-landing__manifesto-line vuvio-landing__manifesto-line--muted">{t.manifestoLineA}</p>
        <p className="vuvio-landing__manifesto-line vuvio-landing__manifesto-line--accent">{t.manifestoLineB}</p>
      </section>

      {/* ---------- Experiences — éditoriales, plein cadre ---------- */}
      <section className="vuvio-landing__experiences">
        <h2 className="vuvio-landing__h2">{t.experiencesTitle}</h2>

        <div className="vuvio-landing__exp-stack">
          {t.experiences.map((exp) => (
            <figure key={exp.tag} className="vuvio-landing__exp-figure">
              <img src={exp.image} alt="" loading="lazy" />
              <figcaption>
                <span className="vuvio-landing__exp-tag">{exp.tag}</span>
                <span className="vuvio-landing__exp-title">{exp.title}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="vuvio-landing__exp-note">{t.experiencesNote}</p>
      </section>

      {/* ---------- L'app : 3 screenshots, carousel mobile / row desktop ---------- */}
      <section className="vuvio-landing__app">
        <h2 className="vuvio-landing__h2">{t.appTitle}</h2>

        <div className="vuvio-landing__app-row" ref={appRailRef}>
          {t.appSections.map((sec, i) => (
            <article key={sec.tag} className="vuvio-landing__app-item" data-slide-index={i}>
              <div className="vuvio-landing__app-screen">
                <img src={sec.image} alt="" loading="lazy" />
              </div>
              <div className="vuvio-landing__app-copy">
                <span className="vuvio-landing__app-tag">{sec.tag}</span>
                <h3 className="vuvio-landing__app-title">{sec.title}</h3>
                <p className="vuvio-landing__app-text">{sec.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="vuvio-landing__app-dots" role="tablist" aria-label="App preview">
          {t.appSections.map((sec, i) => (
            <button
              key={sec.tag}
              type="button"
              role="tab"
              aria-selected={activeSlide === i}
              aria-label={sec.tag}
              className={`vuvio-landing__app-dot${activeSlide === i ? ' is-active' : ''}`}
              onClick={() => goToSlide(i)}
            />
          ))}
        </div>

        <p className="vuvio-landing__app-demo">{t.appDemoNote}</p>
      </section>

      {/* ---------- Founders ---------- */}
      <section className="vuvio-landing__founders">
        <div className="vuvio-landing__founders-head">
          <h2 className="vuvio-landing__h2">{t.foundersTitle}</h2>
          <p className="vuvio-landing__founders-intro">{t.foundersIntro}</p>
        </div>

        <div className="vuvio-landing__founders-grid">
          {t.founders.map((f) => (
            <article key={f.name} className="vuvio-landing__founder">
              <div className="vuvio-landing__founder-portrait">
                <img src={f.image} alt={f.name} loading="lazy" />
              </div>
              <h3 className="vuvio-landing__founder-name">{f.name}</h3>
              <p className="vuvio-landing__founder-role">{f.role}</p>
              <p className="vuvio-landing__founder-bio">{f.bio}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="vuvio-landing__final">
        <h2 className="vuvio-landing__final-title">{t.finalTitle}</h2>
        <button
          type="button"
          className="vuvio-landing__cta vuvio-landing__cta--large"
          onClick={focusWaitlist}
        >
          {t.notifyFinal}
          <span aria-hidden>→</span>
        </button>

        <div className="vuvio-landing__contact">
          <span className="vuvio-landing__contact-label">{t.contactLabel}</span>
          <a className="vuvio-landing__contact-email" href="mailto:hello@vuvio.app">hello@vuvio.app</a>
        </div>
      </section>

      <footer className="vuvio-landing__footer">{t.footer}</footer>
    </div>
  );
}
