const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Cache for playlist data to avoid repeated API calls
const playlistCache = new Map();

export async function enrichPlaylistMetadata(playlist) {
  if (!playlist.spotifyUrl) return playlist;

  // Extract playlist ID from Spotify URL
  const playlistId = extractPlaylistId(playlist.spotifyUrl);
  if (!playlistId) return playlist;

  // Check cache first
  if (playlistCache.has(playlistId)) {
    return { ...playlist, ...playlistCache.get(playlistId) };
  }

  try {
    // For public playlists, Spotify allows unauthenticated access
    const response = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[Spotify] Failed to fetch playlist ${playlistId}:`, response.status);
      return playlist;
    }

    const data = await response.json();

    const enriched = {
      imageUrl: data.images?.[0]?.url || playlist.imageUrl,
      songCount: data.tracks?.total || playlist.songCount,
      description: data.description || playlist.description,
    };

    // Cache the result
    playlistCache.set(playlistId, enriched);

    return { ...playlist, ...enriched };
  } catch (error) {
    console.warn(`[Spotify] Error fetching playlist ${playlistId}:`, error.message);
    return playlist;
  }
}

export async function enrichPlaylistsMetadata(playlists = []) {
  if (!Array.isArray(playlists)) return [];

  return Promise.all(
    playlists.map(async (playlist) => {
      try {
        return await enrichPlaylistMetadata(playlist);
      } catch (error) {
        console.warn('[Spotify] Error enriching playlist:', error);
        return playlist;
      }
    })
  );
}

function extractPlaylistId(spotifyUrl) {
  try {
    // Extract from: spotify:playlist:ID or https://open.spotify.com/playlist/ID
    const match = spotifyUrl.match(/(?:spotify:playlist:|\/playlist\/)([a-zA-Z0-9]+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export function isValidSpotifyPlaylistUrl(url) {
  if (!url) return false;
  return /spotify:playlist:|open\.spotify\.com\/playlist\//.test(url);
}
