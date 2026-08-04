import { Bell } from 'lucide-react';

export default function UpcomingItem({ item, active, onToggle }) {
  return (
    <article className="upcoming-item">
      <img src={item.image} alt="" />
      <time>
        <span>{item.day}</span>
        <strong>{item.time}</strong>
      </time>
      <div>
        <h3>{item.title}</h3>
        <p>{item.who}</p>
      </div>
      <button
        type="button"
        className={active ? 'notify-button is-active' : 'notify-button'}
        aria-label={active ? 'Notification active' : 'Enable notification'}
        onClick={onToggle}
      >
        <Bell size={17} strokeWidth={1.8} />
      </button>
    </article>
  );
}
