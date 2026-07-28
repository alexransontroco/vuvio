import { useParams, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getCreatedLives, subscribeToCreatedLives } from '../services/createdLiveService.js';
import { CreatorLiveSession } from './HomePage.jsx';

export default function LivePage() {
  const { liveId } = useParams();
  const navigate = useNavigate();
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
      navigate('/watch', { replace: true });
    }
  }, [loaded, user, liveId, createdLives, endingLiveId, navigate]);

  const live = createdLives.find((l) => l.id === liveId);

  // Show nothing while loading or if not authorized
  if (!loaded || !live || live.creatorUid !== user?.uid || (live.status !== 'live' && endingLiveId !== liveId)) {
    return null;
  }

  return <CreatorLiveSession live={live} onEndingChange={handleEndingChange} />;
}
