import { Music } from 'lucide-react';
import { useEffect, useState } from 'react';
import { enrichPlaylistsMetadata } from '../../services/spotifyService.js';
import './playlists-section.css';

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

  return (
    <section className="playlists-section" aria-label="Creator playlists">
      <h2>
        <Music size={18} strokeWidth={1.8} />
        Playlists
      </h2>
      <div className="playlists-grid">
        {enrichedPlaylists.map((playlist) => (
          <div key={playlist.id} className="playlist-card">
            {playlist.imageUrl && (
              <div className="playlist-card__image">
                <img src={playlist.imageUrl} alt={playlist.name} loading="lazy" />
              </div>
            )}
            <div className="playlist-card__content">
              <h3>{playlist.name}</h3>
              <p className="playlist-card__platform">{playlist.platform || 'Spotify'}</p>
              {playlist.songCount && (
                <p className="playlist-card__meta">{playlist.songCount} songs</p>
              )}
              {playlist.description && (
                <p className="playlist-card__description">{playlist.description}</p>
              )}
              {playlist.spotifyUrl && (
                <a
                  href={playlist.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="playlist-card__button"
                >
                  Open in Spotify
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
