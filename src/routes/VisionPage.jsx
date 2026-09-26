import {
  BadgeCheck,
  Bell,
  Eye,
  Globe2,
  Lock,
  Map,
  MapPin,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BrandMark from '../components/BrandMark.jsx';

/* ─── Meta hook ──────────────────────────────────────────────── */

function useNoIndexMeta() {
  const { t } = useTranslation();
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const prev = document.title;
    document.title = t('vision.documentTitle');
    return () => { document.head.removeChild(meta); document.title = prev; };
  }, [t]);
}

/* ─── Shared atoms ───────────────────────────────────────────── */

function VisionLiveBadge() {
  const { t } = useTranslation();
  return (
    <span className="live-badge live-badge--compact">
      <span className="live-badge__dot" />
      {t('vision.liveBadge')}
    </span>
  );
}

/* ─── Header ─────────────────────────────────────────────────── */

function VisionHeader() {
  const { t } = useTranslation();
  return (
    <header className="vision-header">
      <a className="vision-header__brand" href="/vision" aria-label={t('vision.header.brandAriaLabel')}>
        <BrandMark size={30} showName />
      </a>
      <div className="vision-header__meta">
        <span><i />{t('vision.header.label')}</span>
        <span className="vision-header__sep">·</span>
        <small>{t('vision.header.subtitle')}</small>
        <Lock size={13} strokeWidth={1.8} aria-hidden="true" />
      </div>
    </header>
  );
}

/* ─── Hero phone inner screens ───────────────────────────────── */

function MiniBottomNav({ active }) {
  const { t } = useTranslation();
  const items = [
    { key: 'Home',     label: t('vision.miniNav.home') },
    { key: 'Discover', label: t('vision.miniNav.discover') },
    { key: 'V',        label: 'V' },
    { key: 'Globe',    label: t('vision.miniNav.globe') },
    { key: 'Profile',  label: t('vision.miniNav.profile') },
  ];
  return (
    <div className="vision-mini-nav" aria-hidden="true">
      {items.map(item => (
        <span key={item.key} className={active === item.key ? 'is-active' : item.key === 'V' ? 'is-create' : ''}>
          {item.label}
        </span>
      ))}
    </div>
  );
}

function HomeScreen() {
  const { t } = useTranslation();
  return (
    <div className="vision-phone-screen vision-phone-screen--app">
      <div className="vision-mini-header">
        <BrandMark size={16} showName />
        <span><Search size={11} /><Bell size={11} /></span>
      </div>
      <div className="vision-mini-tabs"><span>{t('vision.tabs.forYou')}</span><span>{t('vision.tabs.live')}</span><span>{t('vision.tabs.followed')}</span></div>
      <article className="vision-mini-hero">
        <img src="/assets/VuVio_POV_Pack_20/01_mountain_rescue_helicopter.jpg" alt="" loading="eager" decoding="async" />
        <div><VisionLiveBadge /><small><Eye size={8} /> 128</small></div>
        <strong>{t('vision.home.streamTitle')}</strong>
        <p>{t('vision.home.streamMeta')}</p>
      </article>
      <div className="vision-mini-section">
        <b>{t('vision.home.nearby')}</b>
        <div>
          <img src="/assets/VuVio_20_New_POV/15_scuba_diver.jpg" alt="" loading="lazy" decoding="async" />
          <img src="/assets/VuVio_20_New_POV/01_surfer.jpg" alt="" loading="lazy" decoding="async" />
        </div>
      </div>
      <MiniBottomNav active="Home" />
    </div>
  );
}

function DiscoverScreen() {
  const { t } = useTranslation();
  return (
    <div className="vision-phone-screen vision-phone-screen--discover">
      <img src="/assets/VuVio_20_New_POV/01_surfer.jpg" alt="" loading="eager" decoding="async" />
      <div className="vision-mini-discover-top"><span>{t('vision.tabs.forYou')}</span><span>{t('vision.tabs.random')}</span></div>
      <div className="vision-mini-actions"><i /><i /><i /><i /></div>
      <div className="vision-mini-discover-copy">
        <div><VisionLiveBadge /><small><Eye size={8} /> 342</small></div>
        <strong>{t('vision.discover.streamTitle')}</strong>
        <p>{t('vision.discover.streamMeta')}</p>
        <span>WaveLive <button type="button">{t('vision.discover.follow')}</button></span>
      </div>
      <MiniBottomNav active="Discover" />
    </div>
  );
}

function GlobeScreen() {
  const { t } = useTranslation();
  return (
    <div className="vision-phone-screen vision-phone-screen--globe">
      <div className="vision-mini-header">
        <span className="vision-mini-title"><Globe2 size={12} /> {t('vision.globe.title')}</span>
        <span><Search size={11} /><Map size={11} /></span>
      </div>
      <div className="vision-mini-filter-row">
        <span className="is-active">{t('vision.tabs.live')}</span><span>{t('vision.globe.filters.countries')}</span><span>{t('vision.globe.filters.cities')}</span><span>{t('vision.globe.filters.activities')}</span><span>{t('vision.tabs.followed')}</span>
      </div>
      <div className="vision-mini-globe">
        <img src="/globe/earth-night.jpg" alt="" loading="eager" decoding="async" />
        {Array.from({ length: 14 }).map((_, i) => <i key={i} />)}
      </div>
      <div className="vision-mini-nearby">
        <b>{t('vision.globe.nearby.title')}</b>
        <p>{t('vision.globe.nearby.item1')}</p>
        <p>{t('vision.globe.nearby.item2')}</p>
        <p>{t('vision.globe.nearby.item3')}</p>
      </div>
      <MiniBottomNav active="Globe" />
    </div>
  );
}

function VisionPhoneMockup({ screen, className = '' }) {
  return (
    <div className={`vision-phone vision-phone--${screen} ${className}`}>
      <div className="vision-phone__frame">
        <div className="vision-phone__island" />
        {screen === 'home'     && <HomeScreen />}
        {screen === 'discover' && <DiscoverScreen />}
        {screen === 'globe'    && <GlobeScreen />}
      </div>
    </div>
  );
}

/* ─── Hero constellation SVG ─────────────────────────────────── */

function VisionHeroConstellationSVG() {
  return (
    <svg className="vision-hero-svg" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1="22" y1="8"  x2="7"  y2="30" stroke="rgba(255,200,80,0.22)" strokeWidth="0.28" strokeDasharray="3 5" />
      <line x1="7"  y1="30" x2="3"  y2="76" stroke="rgba(255,200,80,0.16)" strokeWidth="0.28" strokeDasharray="3 5" />
      <line x1="22" y1="8"  x2="96" y2="9"  stroke="rgba(255,200,80,0.14)" strokeWidth="0.28" strokeDasharray="4 6" />
      <line x1="96" y1="9"  x2="98" y2="55" stroke="rgba(255,200,80,0.14)" strokeWidth="0.28" strokeDasharray="3 5" />
      <circle cx="22" cy="8"  r="1.2" fill="rgba(255,200,80,0.55)" />
      <circle cx="7"  cy="30" r="1"   fill="rgba(255,200,80,0.45)" />
      <circle cx="3"  cy="76" r="1"   fill="rgba(255,200,80,0.45)" />
      <circle cx="96" cy="9"  r="1.2" fill="rgba(255,200,80,0.55)" />
      <circle cx="98" cy="55" r="1"   fill="rgba(255,200,80,0.45)" />
      <circle cx="38"  cy="4"  r="0.5" fill="rgba(244,247,250,0.28)" />
      <circle cx="58"  cy="16" r="0.6" fill="rgba(244,247,250,0.2)"  />
      <circle cx="72"  cy="5"  r="0.4" fill="rgba(244,247,250,0.22)" />
      <circle cx="82"  cy="30" r="0.4" fill="rgba(244,247,250,0.16)" />
      <circle cx="18"  cy="55" r="0.5" fill="rgba(244,247,250,0.18)" />
    </svg>
  );
}

/* ─── Hero ───────────────────────────────────────────────────── */

function VisionHero() {
  const { t } = useTranslation();

  const heroCities = useMemo(() => [
    { id: 'chamonix',  name: t('vision.cities.chamonix'),  country: t('vision.countries.france'),  time: '02:13', style: { top: '8%',   left: '24%'  } },
    { id: 'cappadoce', name: t('vision.cities.cappadoce'), country: t('vision.countries.turkey'),  time: '04:13', style: { top: '30%',  left: '7%'   } },
    { id: 'tokyo',     name: t('vision.cities.tokyo'),     country: t('vision.countries.japan'),   time: '10:13', style: { top: '9%',   right: '4%'  } },
    { id: 'biarritz',  name: t('vision.cities.biarritz'),  country: t('vision.countries.france'),  time: '02:13', style: { top: '55%',  right: '2%'  } },
    { id: 'marseille', name: t('vision.cities.marseille'), country: t('vision.countries.france'),  time: '02:13', style: { bottom: '26%', left: '3%' } },
  ], [t]);

  const benefits = useMemo(() => [
    { icon: Radio,       title: t('vision.benefits.live.title'),          text: t('vision.benefits.live.text') },
    { icon: ShieldCheck, title: t('vision.benefits.authentic.title'),     text: t('vision.benefits.authentic.text') },
    { icon: Eye,         title: t('vision.benefits.immersive.title'),     text: t('vision.benefits.immersive.text') },
    { icon: Globe2,      title: t('vision.benefits.everywhere.title'),    text: t('vision.benefits.everywhere.text') },
  ], [t]);

  return (
    <section className="vision-hero">
      {/* Earth background image - behind everything */}
      <div className="vision-hero__earth-bg" aria-hidden="true">
        <img src="/vision/earth-hero.png" alt="" loading="eager" decoding="async" />
      </div>

      <div className="vision-hero__copy">
        <p className="vision-eyebrow">{t('vision.hero.eyebrow')}</p>
        <h1>{t('vision.hero.title')}</h1>
        <p className="vision-lead">
          {t('vision.hero.lead')}
        </p>
        <p className="vision-hero__accent">{t('vision.hero.accent')}</p>
        <div className="vision-benefits">
          {benefits.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="vision-hero__phones" aria-label={t('vision.hero.phonesAriaLabel')}>
        <VisionHeroConstellationSVG />
        {heroCities.map(city => (
          <div key={city.id} className="vision-city-label" style={city.style}>
            <span className="vision-city-label__dot" />
            <strong className="vision-city-label__name">{city.name}</strong>
            <span className="vision-city-label__sub">{city.country}</span>
            <span className="vision-city-label__sub">{city.time}</span>
          </div>
        ))}
        <VisionPhoneMockup screen="home"     className="vision-phone--left"   />
        <VisionPhoneMockup screen="discover" className="vision-phone--center" />
        <VisionPhoneMockup screen="globe"    className="vision-phone--right"  />
      </div>
    </section>
  );
}

/* ─── Wireframe globe SVG ────────────────────────────────────── */

function VisionWireframeGlobe() {
  return (
    <svg className="vision-wireframe-globe" viewBox="0 0 240 240" aria-hidden="true">
      <defs>
        <filter id="vg-glow">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Sphere outline */}
      <circle cx="120" cy="120" r="100" fill="none" stroke="rgba(19,200,204,0.22)" strokeWidth="0.8" />
      {/* Latitude rings */}
      <ellipse cx="120" cy="78"  rx="85"  ry="21"  fill="none" stroke="rgba(19,200,204,0.14)" strokeWidth="0.6" />
      <ellipse cx="120" cy="120" rx="100" ry="27"  fill="none" stroke="rgba(19,200,204,0.18)" strokeWidth="0.6" />
      <ellipse cx="120" cy="162" rx="85"  ry="21"  fill="none" stroke="rgba(19,200,204,0.14)" strokeWidth="0.6" />
      <ellipse cx="120" cy="48"  rx="50"  ry="13"  fill="none" stroke="rgba(19,200,204,0.1)"  strokeWidth="0.5" />
      <ellipse cx="120" cy="192" rx="50"  ry="13"  fill="none" stroke="rgba(19,200,204,0.1)"  strokeWidth="0.5" />
      {/* Longitude arcs */}
      <ellipse cx="120" cy="120" rx="28"  ry="100" fill="none" stroke="rgba(19,200,204,0.14)" strokeWidth="0.6" />
      <ellipse cx="120" cy="120" rx="66"  ry="100" fill="none" stroke="rgba(19,200,204,0.12)" strokeWidth="0.5" />
      <ellipse cx="120" cy="120" rx="100" ry="100" fill="none" stroke="rgba(19,200,204,0.1)"  strokeWidth="0.5" />
      {/* Glowing dots */}
      <circle cx="120" cy="20"  r="3.5" fill="#13C8CC"             opacity="0.7" filter="url(#vg-glow)" />
      <circle cx="48"  cy="78"  r="2.5" fill="rgba(255,200,80,0.8)"              filter="url(#vg-glow)" />
      <circle cx="193" cy="78"  r="2"   fill="rgba(19,200,204,0.6)"              />
      <circle cx="20"  cy="120" r="2.5" fill="rgba(255,59,78,0.75)"              filter="url(#vg-glow)" />
      <circle cx="220" cy="120" r="2.5" fill="rgba(255,200,80,0.6)"              filter="url(#vg-glow)" />
      <circle cx="70"  cy="158" r="2"   fill="rgba(255,200,80,0.65)"             filter="url(#vg-glow)" />
      <circle cx="176" cy="148" r="3"   fill="#13C8CC"             opacity="0.8" filter="url(#vg-glow)" />
      <circle cx="148" cy="57"  r="2"   fill="rgba(255,59,78,0.55)"             />
      <circle cx="92"  cy="177" r="2"   fill="rgba(19,200,204,0.5)"             />
      <circle cx="120" cy="220" r="2.5" fill="rgba(255,200,80,0.55)"            />
      <circle cx="156" cy="102" r="1.5" fill="rgba(19,200,204,0.45)"            />
      <circle cx="84"  cy="138" r="2"   fill="rgba(255,59,78,0.5)"              />
    </svg>
  );
}

/* ─── Journey constellation lines SVG ───────────────────────── */

function VisionConstellationLines() {
  return (
    <svg
      className="vision-const-lines"
      aria-hidden="true"
      viewBox="0 0 1000 560"
      preserveAspectRatio="none"
    >
      {/* 01 top-left → globe center */}
      <path d="M 240 130 C 320 180 370 230 430 290" fill="none" stroke="rgba(255,200,80,0.22)" strokeWidth="1.2" strokeDasharray="5 8" />
      {/* 04 top-right → globe center */}
      <path d="M 760 130 C 680 180 580 230 430 290" fill="none" stroke="rgba(255,200,80,0.22)" strokeWidth="1.2" strokeDasharray="5 8" />
      {/* 02 bottom-left → globe center */}
      <path d="M 200 440 C 300 390 360 340 430 290" fill="none" stroke="rgba(255,200,80,0.16)" strokeWidth="1"   strokeDasharray="4 7" />
      {/* 03 bottom-right → globe center */}
      <path d="M 800 440 C 700 390 560 340 430 290" fill="none" stroke="rgba(255,200,80,0.16)" strokeWidth="1"   strokeDasharray="4 7" />
      {/* Dots along 01 line */}
      <circle cx="310" cy="163" r="2.5" fill="rgba(255,200,80,0.45)" />
      <circle cx="370" cy="215" r="2"   fill="rgba(255,200,80,0.35)" />
      {/* Dots along 04 line */}
      <circle cx="690" cy="163" r="2.5" fill="rgba(255,200,80,0.45)" />
      <circle cx="610" cy="210" r="2"   fill="rgba(255,200,80,0.35)" />
      {/* Dots along 02 line */}
      <circle cx="290" cy="400" r="2"   fill="rgba(255,200,80,0.3)"  />
      {/* Dots along 03 line */}
      <circle cx="710" cy="400" r="2"   fill="rgba(255,200,80,0.3)"  />
      {/* Small background stars */}
      <circle cx="500" cy="60"  r="1"   fill="rgba(244,247,250,0.25)" />
      <circle cx="620" cy="180" r="0.8" fill="rgba(244,247,250,0.2)"  />
      <circle cx="280" cy="320" r="0.8" fill="rgba(244,247,250,0.18)" />
      <circle cx="800" cy="280" r="1"   fill="rgba(244,247,250,0.2)"  />
    </svg>
  );
}

/* ─── Journey: stream card (step 01) ────────────────────────── */

function VisionStreamCard() {
  const { t } = useTranslation();
  return (
    <div className="vision-stream-card">
      <div className="vision-stream-card__media">
        <img src="/assets/VuVio_POV_Pack_20/01_mountain_rescue_helicopter.jpg" alt={t('vision.streamCard.imageAlt')} loading="lazy" decoding="async" />
        <div className="vision-stream-card__badges">
          <VisionLiveBadge />
          <small><Eye size={9} /> 1,2 k</small>
        </div>
      </div>
      <div className="vision-stream-card__body">
        <strong>{t('vision.streamCard.title')}</strong>
        <p>{t('vision.streamCard.meta')}</p>
        <div className="vision-stream-card__tags">
          <span>{t('vision.streamCard.tag1')}</span>
          <span>{t('vision.streamCard.tag2')}</span>
          <button type="button">{t('vision.streamCard.watch')}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Journey: mini profile card (step 04) ──────────────────── */

function VisionMiniProfileCard() {
  const { t } = useTranslation();
  return (
    <div className="vision-mini-profile">
      <div className="vision-mini-profile__head">
        <img
          src="/assets/VuVio_10_POV/08_wildlife_photographer.jpg"
          alt={t('vision.profileCard.avatarAlt')}
          className="vision-mini-profile__avatar"
          loading="lazy"
          decoding="async"
        />
        <div>
          <strong>{t('vision.profileCard.name')} <BadgeCheck size={12} /></strong>
          <span>@aventurethomas</span>
          <span><MapPin size={9} aria-hidden="true" /> {t('vision.profileCard.location')}</span>
        </div>
      </div>
      <p>{t('vision.profileCard.bio')}</p>
      <div className="vision-mini-profile__stats">
        <span><b>128</b><small>{t('vision.profileCard.stats.lives')}</small></span>
        <span><b>3,2 k</b><small>{t('vision.profileCard.stats.followers')}</small></span>
        <span><b>256</b><small>{t('vision.profileCard.stats.following')}</small></span>
        <span><b>42</b><small>{t('vision.profileCard.stats.countries')}</small></span>
      </div>
    </div>
  );
}

/* ─── Journey: landscape kayak window (step 02/03) ──────────── */

function VisionKayakWindow() {
  const { t } = useTranslation();
  return (
    <div className="vision-kayak-window">
      <img src="/assets/VuVio_20_New_POV/16_kayaker.jpg" alt={t('vision.kayakWindow.imageAlt')} loading="lazy" decoding="async" />
      <div className="vision-kayak-window__overlay">
        <div className="vision-kayak-window__actions"><i /><i /></div>
        <span className="vision-kayak-window__stat"><small>💬</small> 2,1 k</span>
      </div>
    </div>
  );
}

/* ─── Step text label ────────────────────────────────────────── */

function VisionStepLabel({ num, title, text, align = 'left' }) {
  return (
    <div className={`vision-step-label vision-step-label--${align}`}>
      <div className="vision-step-label__head">
        <span className="vision-step-badge">{num}</span>
        <h3>{title}</h3>
      </div>
      <p>{text}</p>
    </div>
  );
}

/* ─── Journey section (constellation layout) ─────────────────── */

function VisionJourney() {
  const { t } = useTranslation();
  return (
    <section className="vision-journey-section" aria-labelledby="vision-journey-title">
      <div className="vision-journey-section__inner">

        {/* Section header: eyebrow + manifesto quote */}
        <div className="vision-journey-header">
          <p className="vision-eyebrow">{t('vision.journey.eyebrow')}</p>
          <h2 id="vision-journey-title">
            {t('vision.journey.titleLine1')}<br />
            {t('vision.journey.titleLine2')}
          </h2>
        </div>

        {/* Constellation layout */}
        <div className="vision-constellation-wrap">
          {/* Earth at the bottom of this section */}
          <div className="vision-const-earth" aria-hidden="true">
            <img src="/vision/earth-hero.png" alt="" loading="lazy" decoding="async" />
          </div>

          {/* Connecting lines overlay */}
          <VisionConstellationLines />

          {/* 01 — top left */}
          <div className="vision-const-pos vision-const-pos--01">
            <VisionStepLabel
              num="01"
              title={t('vision.journey.steps.home.title')}
              text={t('vision.journey.steps.home.text')}
            />
            <VisionStreamCard />
          </div>

          {/* 02 — bottom left */}
          <div className="vision-const-pos vision-const-pos--02">
            <VisionStepLabel
              num="02"
              title={t('vision.journey.steps.discover.title')}
              text={t('vision.journey.steps.discover.text')}
            />
          </div>

          {/* Center: wireframe globe */}
          <div className="vision-const-pos vision-const-pos--globe">
            <VisionWireframeGlobe />
          </div>

          {/* Center-right: kayak landscape phone */}
          <div className="vision-const-pos vision-const-pos--kayak">
            <VisionKayakWindow />
          </div>

          {/* 03 — bottom right */}
          <div className="vision-const-pos vision-const-pos--03">
            <VisionStepLabel
              num="03"
              title={t('vision.journey.steps.globe.title')}
              text={t('vision.journey.steps.globe.text')}
              align="right"
            />
          </div>

          {/* 04 — top right */}
          <div className="vision-const-pos vision-const-pos--04">
            <VisionStepLabel
              num="04"
              title={t('vision.journey.steps.profile.title')}
              text={t('vision.journey.steps.profile.text')}
              align="right"
            />
            <VisionMiniProfileCard />
          </div>
        </div>

      </div>
    </section>
  );
}

/* ─── Moments mosaic ─────────────────────────────────────────── */

function VisionMomentsMosaic() {
  const { t } = useTranslation();

  const mosaicMoments = useMemo(() => [
    { key: 'surf',       title: t('vision.mosaic.items.surf.title'),       place: t('vision.mosaic.items.surf.place'),       env: 'Water', viewers: '368',  image: '/assets/VuVio_20_New_POV/01_surfer.jpg'          },
    { key: 'baker',      title: t('vision.mosaic.items.baker.title'),      place: t('vision.mosaic.items.baker.place'),      env: 'Work',  viewers: '442',  image: '/assets/VuVio_20_New_POV/07_baker.jpg'           },
    { key: 'balloon',    title: t('vision.mosaic.items.balloon.title'),    place: t('vision.mosaic.items.balloon.place'),    env: 'Air',   viewers: '642',  image: '/assets/VuVio_20_New_POV/03_hot_air_balloon.jpg' },
    { key: 'fishing',    title: t('vision.mosaic.items.fishing.title'),    place: t('vision.mosaic.items.fishing.place'),    env: 'Water', viewers: '512',  image: '/assets/VuVio_20_New_POV/14_fishing.jpg'         },
    { key: 'paraglider', title: t('vision.mosaic.items.paraglider.title'), place: t('vision.mosaic.items.paraglider.place'), env: 'Air',   viewers: '1.2k', image: '/assets/VuVio_20_New_POV/02_paraglider.jpg'      },
    { key: 'drone',      title: t('vision.mosaic.items.drone.title'),      place: t('vision.mosaic.items.drone.place'),      env: 'Air',   viewers: '753',  image: '/assets/VuVio_20_New_POV/19_drone_pilot.jpg'     },
  ], [t]);

  return (
    <section className="vision-moments-section" aria-labelledby="vision-moments-title">
      <div className="vision-moments-section__inner">
        <div className="vision-moments-header">
          <p className="vision-eyebrow">{t('vision.mosaic.eyebrow')}</p>
          <h2 id="vision-moments-title">{t('vision.mosaic.titleLine1')}<br />{t('vision.mosaic.titleLine2')}</h2>
        </div>
        <div className="vision-mosaic">
          {mosaicMoments.map(moment => (
            <article key={moment.key} className={`vision-mosaic-item vision-mosaic-item--${moment.key}`}>
              <img src={moment.image} alt={moment.title} loading="lazy" decoding="async" />
              <div className="vision-mosaic-item__overlay">
                <div className="vision-mosaic-item__top">
                  <VisionLiveBadge />
                  <small><Eye size={9} /> {moment.viewers}</small>
                </div>
                <div className="vision-mosaic-item__meta">
                  <strong>{moment.title}</strong>
                  <span><MapPin size={10} aria-hidden="true" /> {moment.place}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Final section ──────────────────────────────────────────── */

function VisionFinalSection() {
  const { t } = useTranslation();

  const finalStats = useMemo(() => [
    { icon: MapPin,   label: t('vision.finalStats.perspectives') },
    { icon: Globe2,   label: t('vision.finalStats.countries') },
    { icon: Eye,      label: t('vision.finalStats.moments') },
    { icon: Sparkles, label: t('vision.finalStats.world') },
  ], [t]);

  return (
    <section className="vision-final" aria-labelledby="vision-final-title">
      <div className="vision-final__copy">
        <p className="vision-eyebrow">{t('vision.final.eyebrow')}</p>
        <h2 id="vision-final-title">{t('vision.final.title')}</h2>
        <p>
          {t('vision.final.line1')}<br />
          {t('vision.final.line2')}<br />
          {t('vision.final.line3')}
        </p>
        <div className="vision-final__stats">
          {finalStats.map(({ icon: Icon, label }) => (
            <span key={label}><Icon size={15} strokeWidth={1.7} aria-hidden="true" />{label}</span>
          ))}
        </div>
      </div>
      <div className="vision-planet" aria-hidden="true">
        <img src="/vision/earth-space.png" alt="" loading="lazy" decoding="async" />
        <div>
          <BrandMark size={48} showName />
          <strong>{t('vision.final.cta')}</strong>
          <small>{t('vision.final.ctaSub')}</small>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────── */

function VisionFooter() {
  const { t } = useTranslation();
  return (
    <footer className="vision-footer">
      <BrandMark size={20} showName />
      <span>{t('vision.footer.text')}</span>
    </footer>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function VisionPage() {
  useNoIndexMeta();
  return (
    <main className="vision-page">
      <VisionHeader />
      <VisionHero />
      <VisionJourney />
      <VisionMomentsMosaic />
      <VisionFinalSection />
      <VisionFooter />
    </main>
  );
}
