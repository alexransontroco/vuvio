import { Compass, Globe2, Tv2, UserRound } from 'lucide-react';
import BrandMark from '../../../BrandMark.jsx';

const items = [
  { label: 'Watch', Icon: Tv2 },
  { label: 'Explore', Icon: Compass },
  { label: 'Globe', Icon: Globe2 },
  { label: 'Profile', Icon: UserRound },
];

export default function IntroBottomNav({ active = 'Watch', createActive = false, createPressed = false, onCreate, cursor }) {
  const renderItem = ({ label, Icon }) => (
    <div key={label} className={'bottom-nav__item' + (active === label ? ' active' : '')}>
      <span className="bottom-nav__icon"><Icon size={23} strokeWidth={1.9} /></span>
      <span className="bottom-nav__label">{label}</span>
    </div>
  );

  return (
    <nav className="bottom-nav introv2-bottom-nav" aria-label="Vuvio navigation" aria-hidden={!onCreate}>
      {items.slice(0, 2).map(renderItem)}
      <button
        type="button"
        className={'bottom-nav__create introv2-bottom-nav__create' + (onCreate ? ' is-interactive' : '') + (createActive ? ' is-active' : '') + (createPressed ? ' is-pressed' : '')}
        onClick={onCreate}
        tabIndex={onCreate ? 0 : -1}
        aria-label="Start a live"
      >
        <BrandMark size={40} withCircle={false} useLegacy style={{ marginTop: 10 }} />
        <span className="bottom-nav__create-badge" aria-hidden="true">+</span>
        {cursor}
      </button>
      {items.slice(2).map(renderItem)}
    </nav>
  );
}
