import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import '../styles/pages/landing.css';

const COPY = {
  fr: {
    nav: 'Vuvio',
    titleLines: ['Des passions,', 'des métiers,', 'des expériences'],
    titleAccent: '— en direct.',
    subtitle: 'Découvrez des activités et des passions à travers ceux qui les vivent, au moment où elles se passent.',
    cta: "Tester l'app",
    scrollHint: 'En savoir plus',
    sections: [
      {
        eyebrow: 'LA VISION',
        title: 'Le monde est déjà en train de se passer.',
        body: "Vuvio permet de découvrir des métiers, des passions et des expériences réelles, au moment où elles se déroulent, à travers le point de vue des personnes qui les vivent.",
      },
      {
        eyebrow: 'LE PRODUIT',
        title: 'Un globe. Des lives. Des rencontres.',
        body: "Explorez la planète en temps réel. Entrez dans un atelier à Tokyo, suivez un cycliste dans les Alpes, découvrez un chef à Paris. Posez des questions, soutenez les créateurs, vivez l'instant.",
      },
      {
        eyebrow: 'POUR QUI',
        title: 'Créateurs, curieux, explorateurs.',
        body: "Que vous soyez passionné par l'artisanat, les voyages, la musique, le sport ou la cuisine — Vuvio vous connecte à ceux qui font vivre ces expériences, partout dans le monde.",
      },
    ],
    featuresTitle: 'Ce que vous allez trouver',
    features: [
      { k: '01', t: 'Live immersif', d: 'Des POV authentiques en direct, pas des reels filtrés.' },
      { k: '02', t: 'Globe interactif', d: 'Un atlas vivant des lives en cours à travers la planète.' },
      { k: '03', t: 'Questions & soutien', d: 'Échangez avec les créateurs, soutenez leur passion.' },
      { k: '04', t: 'Communauté', d: 'Rejoignez des gens curieux qui veulent voir le vrai monde.' },
    ],
    contactLabel: 'Une question, une idée, une collaboration ?',
    footer: 'VUVIO · 2026',
  },
  en: {
    nav: 'Vuvio',
    titleLines: ['Passions,', 'crafts,', 'real experiences'],
    titleAccent: '— live.',
    subtitle: 'Discover activities and passions through the people living them, the moment they happen.',
    cta: 'Try the app',
    scrollHint: 'Learn more',
    sections: [
      {
        eyebrow: 'THE VISION',
        title: "The world is already happening.",
        body: "Vuvio lets you discover crafts, passions and real experiences as they unfold — through the first-person view of the people living them.",
      },
      {
        eyebrow: 'THE PRODUCT',
        title: 'A globe. Live streams. Real encounters.',
        body: 'Explore the planet in real time. Step into a workshop in Tokyo, ride through the Alps, meet a chef in Paris. Ask questions, support creators, live the moment.',
      },
      {
        eyebrow: 'FOR WHOM',
        title: 'Creators, curious minds, explorers.',
        body: 'Whether you love craft, travel, music, sport or cooking — Vuvio connects you to the people making it happen, anywhere in the world.',
      },
    ],
    featuresTitle: "What you'll find",
    features: [
      { k: '01', t: 'Immersive live', d: 'Authentic first-person POV — not polished reels.' },
      { k: '02', t: 'Interactive globe', d: 'A living atlas of streams happening right now.' },
      { k: '03', t: 'Q&A + support', d: 'Chat with creators, back the passions you love.' },
      { k: '04', t: 'Community', d: 'Join curious people who want to see the real world.' },
    ],
    contactLabel: 'Questions, ideas, collaborations?',
    footer: 'VUVIO · 2026',
  },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';
  const t = COPY[lang];

  const enterApp = () => {
    navigate('/intro-preview');
  };

  return (
    <div className="vuvio-landing">
      <header className="vuvio-landing__topbar">
        <div className="vuvio-landing__wordmark">{t.nav}</div>
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

      <section className="vuvio-landing__hero">
        <div className="vuvio-landing__copy">
          <div className="vuvio-landing__eyebrow">VUVIO</div>
          <h1 className="vuvio-landing__title">
            {t.titleLines.map((line) => (
              <span key={line}>{line}<br /></span>
            ))}
            <span className="vuvio-landing__accent-text">{t.titleAccent}</span>
          </h1>
          <div className="vuvio-landing__accent" />
          <p className="vuvio-landing__subtitle">{t.subtitle}</p>
          <div className="vuvio-landing__cta-row">
            <button
              type="button"
              className="vuvio-landing__cta"
              onClick={enterApp}
            >
              {t.cta}
              <span aria-hidden>→</span>
            </button>
            <a href="#more" className="vuvio-landing__scroll">{t.scrollHint} ↓</a>
          </div>
        </div>
        <div className="vuvio-landing__visual">
          <img src="/assets/landing-cover-globe.png" alt="" />
        </div>
      </section>

      <section id="more" className="vuvio-landing__sections">
        {t.sections.map((s) => (
          <article key={s.eyebrow} className="vuvio-landing__section">
            <div className="vuvio-landing__section-eyebrow">{s.eyebrow}</div>
            <h2 className="vuvio-landing__section-title">{s.title}</h2>
            <p className="vuvio-landing__section-body">{s.body}</p>
          </article>
        ))}
      </section>

      <section className="vuvio-landing__features">
        <h2 className="vuvio-landing__features-title">{t.featuresTitle}</h2>
        <div className="vuvio-landing__features-grid">
          {t.features.map((f) => (
            <div key={f.k} className="vuvio-landing__feature">
              <div className="vuvio-landing__feature-num">{f.k}</div>
              <h3 className="vuvio-landing__feature-title">{f.t}</h3>
              <p className="vuvio-landing__feature-body">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="vuvio-landing__final">
        <div className="vuvio-landing__final-inner">
          <h2 className="vuvio-landing__final-title">{t.titleAccent.replace(/—\s*/, '')}</h2>
          <button
            type="button"
            className="vuvio-landing__cta vuvio-landing__cta--large"
            onClick={enterApp}
          >
            {t.cta}
            <span aria-hidden>→</span>
          </button>
          <div className="vuvio-landing__contact">
            <span className="vuvio-landing__contact-label">{t.contactLabel}</span>
            <a className="vuvio-landing__contact-email" href="mailto:hello@vuvio.app">hello@vuvio.app</a>
          </div>
        </div>
      </section>

      <footer className="vuvio-landing__footer">{t.footer}</footer>
    </div>
  );
}
