import { Compass, Radio, Send, UsersRound, UserRound } from 'lucide-react';
import BrandMark from '../BrandMark.jsx';

const navItems = [
  { label: 'Live', icon: Radio, active: true },
  { label: 'Explore', icon: Compass },
  { label: 'Following', icon: UsersRound },
  { label: 'Messages', icon: Send },
];

export default function LiveRecapSidebar() {
  return (
    <aside className="live-recap-sidebar" aria-label="Vuvio navigation">
      <div className="live-recap-sidebar__brand">
        <BrandMark size={40} />
        <span>VUVIO</span>
      </div>
      <nav className="live-recap-sidebar__nav">
        {navItems.map(({ label, icon: Icon, active }) => (
          <button key={label} type="button" className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}>
            <Icon size={24} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <button type="button" className="live-recap-sidebar__profile">
        <span className="live-recap-avatar live-recap-avatar--photo">AR</span>
        <span>Profile</span>
      </button>
    </aside>
  );
}
