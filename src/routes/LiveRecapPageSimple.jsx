import { ArrowLeft, Download, Share2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { endLive } from '../services/createdLiveService.js';

export default function LiveRecapPageSimple() {
  const navigate = useNavigate();
  const location = useLocation();
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    const liveId = location.pathname.split('/')[2];
    console.log('[LiveRecapSimple] Path:', location.pathname, 'ID:', liveId);
    if (!liveId) {
      setLoading(false);
      return;
    }

    const fetchLiveData = async () => {
      try {
        const liveRef = doc(db, 'activeLives', liveId);
        const liveSnap = await getDoc(liveRef);
        console.log('[LiveRecapSimple] Firestore fetch - exists:', liveSnap.exists(), 'data:', liveSnap.data());
        if (liveSnap.exists()) {
          setLiveData(liveSnap.data());
        } else {
          // Try with fallback from location state
          if (location.state?.liveData) {
            console.log('[LiveRecapSimple] Using location.state data');
            setLiveData(location.state.liveData);
          }
        }
      } catch (err) {
        console.error('[LiveRecapSimple] Failed to fetch:', err);
        // Fallback to location state on error
        if (location.state?.liveData) {
          setLiveData(location.state.liveData);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLiveData();
  }, [location.pathname, location.state?.liveData]);

  const handleFinish = async () => {
    const liveId = location.pathname.split('/')[2];
    if (!liveId) return;

    setFinishing(true);
    try {
      await endLive(liveId);
      navigate('/watch', { replace: true });
    } catch (err) {
      console.error('[LiveRecapSimple] Finish failed:', err);
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <main className="live-recap-simple">
        <div className="live-recap-simple__loading">Loading recap...</div>
      </main>
    );
  }

  if (!liveData) {
    return (
      <main className="live-recap-simple">
        <div className="live-recap-simple__error">No data found</div>
      </main>
    );
  }

  const duration = liveData.durationSeconds || 0;
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <main className="live-recap-simple">
      <header className="live-recap-simple__header">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1>Live Recap</h1>
        <div style={{ width: 20 }} />
      </header>

      <div className="live-recap-simple__content">
        {/* Replay Video */}
        {liveData.replayUrl && (
          <div className="live-recap-simple__video-container">
            <video controls className="live-recap-simple__video" poster={liveData.image}>
              <source src={liveData.replayUrl} type="video/mp4" />
              Your browser doesn't support video playback.
            </video>
          </div>
        )}

        {/* Cover Image (fallback if no replay) */}
        {!liveData.replayUrl && liveData.image && (
          <div className="live-recap-simple__image-container">
            <img src={liveData.image} alt="Live cover" className="live-recap-simple__image" />
          </div>
        )}

        {/* Title */}
        <h2 className="live-recap-simple__title">{liveData.title || 'Untitled Live'}</h2>

        {/* Stats */}
        <div className="live-recap-simple__stats">
          <div className="stat">
            <span className="stat__label">Duration</span>
            <strong className="stat__value">{minutes}:{seconds.toString().padStart(2, '0')}</strong>
          </div>
          <div className="stat">
            <span className="stat__label">Peak Viewers</span>
            <strong className="stat__value">{liveData.peakViewerCount || 0}</strong>
          </div>
          <div className="stat">
            <span className="stat__label">Messages</span>
            <strong className="stat__value">{liveData.commentCount || 0}</strong>
          </div>
          <div className="stat">
            <span className="stat__label">Stars</span>
            <strong className="stat__value">{liveData.starCount || 0}</strong>
          </div>
        </div>

        {/* Raw Data (for debugging) */}
        <details className="live-recap-simple__debug">
          <summary>Data Details</summary>
          <pre>{JSON.stringify(liveData, null, 2)}</pre>
        </details>

        {/* Actions */}
        <div className="live-recap-simple__actions">
          <button type="button" className="btn btn-secondary" disabled={finishing}>
            <Share2 size={16} />
            Share
          </button>
          <button type="button" className="btn btn-secondary" disabled={finishing}>
            <Download size={16} />
            Download
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleFinish}
            disabled={finishing}
          >
            {finishing ? 'Finishing...' : 'Finish'}
          </button>
        </div>
      </div>

      <style>{`
        .live-recap-simple {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: linear-gradient(180deg, rgba(5, 20, 36, 0.96), rgba(3, 13, 24, 0.96));
          color: #86cae0;
          font-family: inherit;
        }

        .live-recap-simple__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(134, 202, 224, 0.11);
        }

        .live-recap-simple__header h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .live-recap-simple__header button {
          background: none;
          border: none;
          color: #86cae0;
          cursor: pointer;
          padding: 4px;
        }

        .live-recap-simple__content {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        }

        .live-recap-simple__loading,
        .live-recap-simple__error {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          font-size: 18px;
        }

        .live-recap-simple__video-container,
        .live-recap-simple__image-container {
          margin: 0 0 24px 0;
          border-radius: 12px;
          overflow: hidden;
          aspect-ratio: 16 / 9;
          max-height: 60vh;
        }

        .live-recap-simple__video-container {
          aspect-ratio: 16 / 9;
        }

        .live-recap-simple__video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          background: #000;
        }

        .live-recap-simple__image-container {
          aspect-ratio: 9 / 16;
        }

        .live-recap-simple__image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .live-recap-simple__title {
          margin: 0 0 24px 0;
          font-size: 24px;
          font-weight: 600;
          color: #fff;
        }

        .live-recap-simple__stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px;
          background: rgba(134, 202, 224, 0.08);
          border: 1px solid rgba(134, 202, 224, 0.11);
          border-radius: 8px;
        }

        .stat__label {
          font-size: 12px;
          color: rgba(134, 202, 224, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat__value {
          font-size: 20px;
          font-weight: 600;
          color: #fff;
        }

        .live-recap-simple__debug {
          margin: 24px 0;
          padding: 12px;
          background: rgba(134, 202, 224, 0.05);
          border: 1px solid rgba(134, 202, 224, 0.11);
          border-radius: 8px;
          cursor: pointer;
        }

        .live-recap-simple__debug pre {
          margin: 12px 0 0 0;
          font-size: 12px;
          overflow-x: auto;
          color: #86cae0;
        }

        .live-recap-simple__actions {
          display: flex;
          gap: 12px;
          padding-top: 24px;
          border-top: 1px solid rgba(134, 202, 224, 0.11);
        }

        .btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border: 1px solid rgba(134, 202, 224, 0.2);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #86cae0, #5ab5d1);
          color: #051424;
          border: none;
        }

        .btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #9ed8eb, #6fc2dd);
        }

        .btn-secondary {
          background: transparent;
          color: #86cae0;
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(134, 202, 224, 0.1);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </main>
  );
}
