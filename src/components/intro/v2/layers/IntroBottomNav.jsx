import { Compass, Globe2, Tv2, UserRound } from 'lucide-react';
import BrandMark from '../../../BrandMark.jsx';
import { useIntroCopy } from '../introCopy.js';

const items = [
  { id: 'Watch', key: 'watch', Icon: Tv2 },
  { id: 'Explore', key: 'explore', Icon: Compass },
  { id: 'Globe', key: 'globe', Icon: Globe2 },
  { id: 'Profile', key: 'profile', Icon: UserRound },
];

export default function IntroBottomNav({ active = 'Watch', createActive = false, createPressed = false, onCreate, cursor }) {
  const t = useIntroCopy();
  const renderItem = ({ id, key, Icon }) => (
    <div key={id} className={'bottom-nav__item' + (active === id ? ' active' : '')}>
      <span className="bottom-nav__icon"><Icon size={23} strokeWidth={1.9} /></span>
      <span className="bottom-nav__label">{t.nav[key]}</span>
    </div>
  );

  return (
    <nav className="bottom-nav introv2-bottom-nav" aria-label={t.nav.navigation} aria-hidden={!onCreate}>
      {items.slice(0, 2).map(renderItem)}
      <button
        type="button"
        className={'bottom-nav__create introv2-bottom-nav__create' + (onCreate ? ' is-interactive' : '') + (createActive ? ' is-active' : '') + (createPressed ? ' is-pressed' : '')}
        onClick={onCreate}
        tabIndex={onCreate ? 0 : -1}
        aria-label={t.nav.start}
      >
        <BrandMark size={40} withCircle={false} useLegacy style={{ marginTop: 10 }} />
        <span className="bottom-nav__create-badge" aria-hidden="true">+</span>
        {cursor}
      </button>
      {items.slice(2).map(renderItem)}
    </nav>
  );
}
