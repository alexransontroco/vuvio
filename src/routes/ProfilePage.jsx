import { ChevronRight } from 'lucide-react';
import BrandMark from '../components/BrandMark.jsx';
import { currentUser } from '../data/mockUser.js';

export default function ProfilePage() {
  return (
    <section className="screen-scroll profile-screen" aria-label="Profil">
      <header className="profile-hero">
        <div className="profile-avatar">{currentUser.initial}</div>
        <div>
          <h1>{currentUser.name}</h1>
          <p>{currentUser.location}</p>
        </div>
      </header>

      <div className="profile-stats">
        {currentUser.stats.map((stat) => (
          <article key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </div>

      <button className="go-live-button" type="button">
        <BrandMark size={22} dark />
        <span>Go live - share your view</span>
      </button>

      <section className="history-section">
        <h2>Where you've been</h2>
        {currentUser.history.map((stream) => (
          <button key={stream.id} type="button" className="history-item">
            <span className="history-thumb">
              <img src={stream.image} alt="" />
            </span>
            <span>
              <strong>
                {stream.role} - {stream.name}
              </strong>
              <small>{stream.place}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
      </section>
    </section>
  );
}
