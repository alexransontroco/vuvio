import { CalendarPlus, Compass, Globe2, ImagePlus, Radio, Video, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import BrandMark from './BrandMark.jsx';

const navItems = [
  { to: '/live', label: 'Live', icon: Radio },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/map', label: 'Globe', icon: Globe2 },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

const createActions = [
  { label: 'Lancer un live', icon: Video },
  { label: 'Programmer un live', icon: CalendarPlus },
  { label: 'Ajouter une vidéo', icon: ImagePlus },
];

export default function BottomNav({ collapsible = false, collapsed = false, onExpand, onCollapse }) {
  const [createOpen, setCreateOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setCreateOpen(false);
  }, [location.pathname]);

  if (collapsible && collapsed) {
    return (
      <button type="button" className="bottom-nav-peek" onClick={onExpand} aria-label="Afficher la navigation">
        <span />
      </button>
    );
  }

  return (
    <>
      {createOpen ? (
        <div className="create-sheet" role="dialog" aria-label="Créer sur Vuvio">
          <div className="create-sheet__panel">
            <div className="create-sheet__header">
              <BrandMark size={22} showName />
              <button type="button" onClick={() => setCreateOpen(false)} aria-label="Fermer">
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>
            <div className="create-sheet__actions">
              {createActions.map(({ label, icon: Icon }) => (
                <button key={label} type="button" onClick={() => setCreateOpen(false)}>
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <nav className={collapsible ? 'bottom-nav bottom-nav--floating' : 'bottom-nav'} aria-label="Navigation principale">
        {collapsible ? (
          <button type="button" className="bottom-nav__collapse" onClick={onCollapse} aria-label="Réduire la navigation">
            <span />
          </button>
        ) : null}
        {navItems.slice(0, 2).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="bottom-nav__item" aria-label={label} onClick={() => setCreateOpen(false)}>
            <span className="bottom-nav__icon">
              <Icon size={23} strokeWidth={1.9} />
            </span>
            <span className="bottom-nav__label">{label}</span>
          </NavLink>
        ))}
        <button type="button" className="bottom-nav__create" onClick={() => setCreateOpen(true)} aria-label="Créer">
          <BrandMark size={24} />
        </button>
        {navItems.slice(2).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="bottom-nav__item" aria-label={label} onClick={() => setCreateOpen(false)}>
            <span className="bottom-nav__icon">
              <Icon size={23} strokeWidth={1.9} />
            </span>
            <span className="bottom-nav__label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
