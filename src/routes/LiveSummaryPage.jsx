import { ArrowLeft, Share2, MessageCircle, Users } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import HighlightGenerator from '../components/live-summary/HighlightGenerator.jsx';
import LiveSummaryHero from '../components/live-summary/LiveSummaryHero.jsx';
import LiveSummaryStats from '../components/live-summary/LiveSummaryStats.jsx';
import '../styles/pages/live-summary.css';

export default function LiveSummaryPage() {
  const { liveId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [liveData, setLiveData] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!liveId || !user) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const liveRef = doc(db, 'activeLives', liveId);
        const liveSnap = await getDoc(liveRef);

        if (!liveSnap.exists()) {
          setError('Live not found');
          setLoading(false);
          return;
        }

        const data = liveSnap.data();

        // Verify ownership
        if (data.creatorUid !== user.uid) {
          setError('Unauthorized');
          setLoading(false);
          return;
        }

        setLiveData(data);

        // Fetch comments for this live
        try {
          const commentsRef = collection(db, `activeLives/${liveId}/comments`);
          const q = query(commentsRef, orderBy('timestamp', 'asc'), limit(100));
          const commentsSnap = await getDocs(q);
          const commentsData = commentsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          setComments(commentsData);
        } catch (commentsErr) {
          console.warn('[LiveSummaryPage] Failed to load comments:', commentsErr);
        }

        setLoading(false);
      } catch (err) {
        console.error('[LiveSummaryPage] Failed to load live:', err);
        setError(err.message);
        setLoading(false);
      }
    })();
  }, [liveId, user]);

  if (loading) {
    return (
      <section className="live-summary-page">
        <div className="live-summary-loading">Loading your live summary…</div>
      </section>
    );
  }

  if (error || !liveData) {
    return (
      <section className="live-summary-page">
        <header className="live-summary-header">
          <button type="button" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft size={20} strokeWidth={1.9} />
          </button>
          <h1>Live Summary</h1>
          <div />
        </header>
        <div className="live-summary-error">
          <p>{error || 'Live not found'}</p>
          <button type="button" onClick={() => navigate('/watch')}>Back to Watch</button>
        </div>
      </section>
    );
  }

  return (
    <section className="live-summary-page">
      <header className="live-summary-header">
        <button type="button" onClick={() => navigate('/watch')} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={1.9} />
        </button>
        <h1>Your Live</h1>
        <button type="button" className="live-summary-share-btn" aria-label="Share">
          <Share2 size={18} strokeWidth={1.9} />
        </button>
      </header>

      <main className="live-summary-content" ref={contentRef}>
        {/* Hero Section */}
        <LiveSummaryHero liveData={liveData} />

        {/* Stats */}
        <LiveSummaryStats liveData={liveData} />

        {/* Your Highlight */}
        <HighlightGenerator liveData={liveData} liveId={liveId} />

        {/* Full Replay Video */}
        {liveData?.playbackUrl && (
          <section className="live-summary-replay">
            <h2>Full Replay</h2>
            <div className="live-summary-video-player">
              <video
                src={liveData.playbackUrl}
                controls
                controlsList="nodownload"
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  backgroundColor: '#000',
                }}
              />
            </div>
            <p className="live-summary-replay-info">
              Watch the complete {Math.floor(liveData.durationSeconds / 60)}m recording
            </p>
          </section>
        )}

        {/* Comments Section */}
        <section className="live-summary-comments">
          <h2 className="live-summary-comments-title">
            <MessageCircle size={18} strokeWidth={2} />
            Comments ({comments.length})
          </h2>
          <div className="live-summary-comments-list">
            {comments.length === 0 ? (
              <p className="live-summary-comments-empty">No comments yet</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="live-summary-comment-item">
                  <div className="live-summary-comment-avatar">
                    {comment.userDisplayName?.charAt(0) || '?'}
                  </div>
                  <div className="live-summary-comment-content">
                    <strong>{comment.userDisplayName || 'Anonymous'}</strong>
                    <p>{comment.text}</p>
                    <time>
                      {comment.timestamp
                        ? new Date(comment.timestamp.toDate?.() || comment.timestamp).toLocaleTimeString()
                        : 'Unknown time'}
                    </time>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Viewers Section */}
        <section className="live-summary-viewers">
          <h2 className="live-summary-viewers-title">
            <Users size={18} strokeWidth={2} />
            Viewer Insights
          </h2>
          <div className="live-summary-viewers-grid">
            <div className="live-summary-viewer-card">
              <div className="live-summary-viewer-label">Peak Viewers</div>
              <div className="live-summary-viewer-value">{liveData?.peakViewerCount || 0}</div>
            </div>
            <div className="live-summary-viewer-card">
              <div className="live-summary-viewer-label">Total Unique</div>
              <div className="live-summary-viewer-value">{liveData?.totalUniqueViewers || 0}</div>
            </div>
            <div className="live-summary-viewer-card">
              <div className="live-summary-viewer-label">Duration</div>
              <div className="live-summary-viewer-value">
                {Math.floor((liveData?.durationSeconds || 0) / 60)}m
              </div>
            </div>
            <div className="live-summary-viewer-card">
              <div className="live-summary-viewer-label">Engagement</div>
              <div className="live-summary-viewer-value">{comments.length}</div>
            </div>
          </div>
        </section>

        {/* Footer Action */}
        <section className="live-summary-footer">
          <button
            type="button"
            className="live-summary-cta"
            onClick={() => navigate('/watch')}
          >
            Back to Feed
          </button>
        </section>
      </main>
    </section>
  );
}
