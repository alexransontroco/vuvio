import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getCreatedLives, subscribeToCreatedLives } from '../services/createdLiveService.js';
import { CreatorLiveSession } from './WatchPage.jsx';

export default function LivePage() {
  const { liveId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [createdLives, setCreatedLives] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [endingLiveId, setEndingLiveId] = useState(null);
  const handleEndingChange = useCallback((isEnding, id) => {
    setEndingLiveId(isEnding ? id : null);
  }, []);

  useEffect(() => {
    getCreatedLives().then((lives) => {
      setCreatedLives(lives);
      setLoaded(true);
    }).catch(() => {
      setCreatedLives([]);
      setLoaded(true);
    });
  }, []);

  useEffect(() => subscribeToCreatedLives(setCreatedLives), []);

  useEffect(() => {
    if (!loaded || !user) return;

    const live = createdLives.find((l) => l.id === liveId);

    // Check if user owns this live
    if (endingLiveId === liveId) return;

    if (!live || live.creatorUid !== user.uid || live.status !== 'live') {
      navigate(`/watch?live=${encodeURIComponent(liveId)}&mode=view${location.search ? `&${location.search.slice(1)}` : ''}`, { replace: true });
    }
  }, [loaded, user, liveId, createdLives, endingLiveId, navigate, location.search]);

  const live = createdLives.find((l) => l.id === liveId);

  // Show spinner while loading, nothing (redirect pending) once loaded but unauthorized
  if (!loaded) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <span className="auth-submit__spinner" aria-label="Loading…" style={{ width: 28, height: 28 }} />
      </div>
    );
  }
  if (!live || live.creatorUid !== user?.uid || (live.status !== 'live' && endingLiveId !== liveId)) {
    return null;
  }

  return <CreatorLiveSession live={live} onEndingChange={handleEndingChange} />;
}
