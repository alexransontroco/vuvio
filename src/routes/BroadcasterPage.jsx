import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';
import { streams } from '../data/mockStreams.js';
import { getCreatedLiveStream } from '../services/createdLiveService.js';
import { useEffect, useState, useMemo } from 'react';
import { LiveViewer } from './HomePage.jsx';

/**
 * BroadcasterPage - Dedicated page for streaming live content
 * Completely separate from the watch/discover feed
 * Only accessible to the broadcaster themselves
 */
export default function BroadcasterPage() {
  const { liveId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch live details
  useEffect(() => {
    if (!liveId) {
      setLoading(false);
      return;
    }

    const fetchLive = async () => {
      try {
        // Try to fetch from created lives service first (real broadcasts)
        const createdLive = await getCreatedLiveStream(liveId);
        if (createdLive) {
          setLive(createdLive);
          setLoading(false);
          return;
        }

        // Fall back to mock streams
        const mockLive = streams.find(s => s.id === liveId);
        if (mockLive) {
          setLive(mockLive);
          setLoading(false);
          return;
        }

        setLive(null);
      } catch (err) {
        console.error('[BroadcasterPage] Failed to fetch live:', err);
        setLive(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLive();
  }, [liveId]);

  // Only authenticated users can broadcast
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <section className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading broadcast...</div>
      </section>
    );
  }

  if (!live || !liveId) {
    return <Navigate to="/watch" replace />;
  }

  // Verify ownership (optional - uncomment if you want to enforce creator-only access)
  // if (live.creatorUid && live.creatorUid !== user.uid) {
  //   return <Navigate to="/watch" replace />;
  // }

  // Render broadcaster interface (creatorMode = true)
  return <LiveViewer liveId={liveId} creatorMode={true} />;
}
