import { useEffect, useState } from 'react';
import { enrichPlaylistsMetadata } from '../../services/spotifyService.js';
import { ACTIVITY_CATEGORIES } from '../../data/activityCategories.js';
import './playlists-section.css';

function SpotifyIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1ED760" />
      <path d="M7 9.5c2.8-1 6.4-.8 8.8.8" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7.5 12c2.4-.8 5.5-.6 7.5.8" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 14.5c1.9-.6 4.3-.4 5.8.6" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function PlaylistsSection({ playlists = [] }) {
  const [enrichedPlaylists, setEnrichedPlaylists] = useState(playlists);

  useEffect(() => {
    if (!playlists || playlists.length === 0) {
      setEnrichedPlaylists([]);
      return;
    }

    enrichPlaylistsMetadata(playlists).then(setEnrichedPlaylists);
  }, [playlists]);

  if (!enrichedPlaylists || enrichedPlaylists.length === 0) {
    return null;
  }

  const groups = [];
  ACTIVITY_CATEGORIES.forEach((cat) => {
    const items = enrichedPlaylists.filter((p) => p.category === cat.id);
    if (items.length) groups.push({ cat, items });
  });
  const uncategorized = enrichedPlaylists.filter((p) => !p.category);

  function renderCard(playlist, cat) {
    return (
      <div key={playlist.id} className="playlist-card">
        {playlist.imageUrl && (
          <div className="playlist-card__image">
            <img src={playlist.imageUrl} alt={playlist.name} loading="lazy" />
          </div>
        )}
        <div className="playlist-card__content">
          <h3>{playlist.name}</h3>
          <p className="playlist-card__platform">
            {cat ? <cat.icon size={12} strokeWidth={1.8} style={{ color: cat.color }} /> : <SpotifyIcon size={13} />}
            {cat ? cat.label : (playlist.platform || 'Spotify')}
          </p>
          {playlist.songCount && (
            <p className="playlist-card__meta">{playlist.songCount} songs</p>
          )}
          {playlist.description && (
            <p className="playlist-card__description">{playlist.description}</p>
          )}
          {playlist.spotifyUrl && (
            <a href={playlist.spotifyUrl} target="_blank" rel="noopener noreferrer" className="playlist-card__button">
              <SpotifyIcon size={13} />
              Open in Spotify
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="playlists-section" aria-label="Creator playlists">
      <h2>
        <SpotifyIcon size={18} />
        Playlists
      </h2>
      {groups.map(({ cat, items }) => (
        <div key={cat.id}>
          <div className="playlists-section__group-header">
            <cat.icon size={16} strokeWidth={1.8} style={{ color: cat.color }} />
            <span>{cat.label}</span>
          </div>
          <div className="playlists-grid">{items.map((p) => renderCard(p, cat))}</div>
        </div>
      ))}
      {uncategorized.length > 0 && (
        <div className="playlists-grid">{uncategorized.map((p) => renderCard(p, null))}</div>
      )}
    </section>
  );
}
