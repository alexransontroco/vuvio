import { Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ISSLiveCard({ onClose }) {
  const navigate = useNavigate();

  const issStream = {
    id: 'iss-live',
    creatorName: 'Sofie Adenot',
    displayName: 'Sofie Adenot',
    status: 'live',
    viewersNumber: 24587,
    profileImageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    previewImage: 'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=800&h=600&fit=crop',
    description: 'LIVE FROM SPACE',
    location: 'International Space Station (ISS)',
    altitude: 'Orbiting Earth • 408 km altitude',
    bio: 'ESA astronaut | Earth observer | Broadcasting live from orbit',
  };

  const handleWatchLive = () => {
    navigate(`/live/${issStream.id}`);
    onClose?.();
  };

  const handleProfile = () => {
    navigate(`/creator/${issStream.displayName}`);
    onClose?.();
  };

  return (
    <div className="iss-live-card">
      <div className="iss-live-card__header">
        <button className="iss-live-card__close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="iss-live-card__preview">
        <img
          src={issStream.previewImage}
          alt="ISS view"
          className="iss-live-card__preview-image"
        />
        <div className="iss-live-card__badge">
          <span className="iss-live-card__badge-dot"></span>
          <span className="iss-live-card__badge-text">LIVE</span>
        </div>
      </div>

      <div className="iss-live-card__content">
        <div className="iss-live-card__info">
          <h2 className="iss-live-card__title">{issStream.displayName}</h2>
          <p className="iss-live-card__subtitle">{issStream.description}</p>
          {issStream.bio && <p className="iss-live-card__bio">{issStream.bio}</p>}
          <p className="iss-live-card__location">{issStream.location}</p>
          <p className="iss-live-card__altitude">{issStream.altitude}</p>
          <p className="iss-live-card__viewers">{issStream.viewersNumber.toLocaleString()} viewers</p>
        </div>

        <div className="iss-live-card__actions">
          <button className="iss-live-card__watch-btn" onClick={handleWatchLive}>
            <span className="iss-live-card__watch-icon">▶</span>
            Watch Live
          </button>
          <button className="iss-live-card__action-btn" onClick={handleProfile} title="Profile">
            <span>Profile</span>
          </button>
          <button className="iss-live-card__action-btn" title="Notifications">
            <Bell size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
