import { useState, useEffect } from 'react';
import { Play, Download, Share2, RotateCcw, Zap } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { generateHighlightMock } from '../../services/highlightService.js';

const MOCK_MODE = true; // Set to true for MVP testing without real Cloudflare

export default function HighlightGenerator({ liveData, liveId }) {
  const [highlightState, setHighlightState] = useState('ready'); // ready | processing | done | error | expired
  const [generatedHighlight, setGeneratedHighlight] = useState(null);
  const [error, setError] = useState(null);
  const [recordingExpiry, setRecordingExpiry] = useState(null);

  useEffect(() => {
    if (liveData?.highlightStatus === 'ready' && liveData?.highlightUrl) {
      setHighlightState('done');
      setGeneratedHighlight({
        url: liveData.highlightUrl,
        thumbnailUrl: liveData.highlightThumbnailUrl,
        durationSeconds: liveData.highlightDurationSeconds || 30,
      });
    } else if (liveData?.highlightStatus === 'processing') {
      setHighlightState('processing');
    } else if (liveData?.highlightStatus === 'failed') {
      setHighlightState('error');
    }

    // Calculate recording expiry time
    if (liveData?.recordingExpiresAt) {
      const expiryDate = new Date(liveData.recordingExpiresAt);
      const now = new Date();
      const hoursLeft = Math.max(0, Math.floor((expiryDate - now) / (1000 * 60 * 60)));
      setRecordingExpiry(hoursLeft);

      if (hoursLeft === 0) {
        setHighlightState('expired');
      }
    }
  }, [liveData]);

  const handleGenerateHighlight = async () => {
    if (highlightState === 'processing' || !liveId) return;

    setHighlightState('processing');
    setError(null);

    try {
      if (MOCK_MODE) {
        // Mock generation for testing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const mockHighlight = generateHighlightMock(liveData);

        // Update Firestore
        await updateDoc(doc(db, 'activeLives', liveId), {
          highlightStatus: 'ready',
          highlightUrl: mockHighlight.url,
          highlightThumbnailUrl: mockHighlight.thumbnailUrl,
          highlightDurationSeconds: mockHighlight.durationSeconds,
        });

        setGeneratedHighlight(mockHighlight);
        setHighlightState('done');
      } else {
        // Real implementation would call backend
        // POST /api/lives/:liveId/highlight
        const response = await fetch(`/api/lives/${liveId}/highlight`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to generate highlight');

        const data = await response.json();
        setGeneratedHighlight(data);
        setHighlightState('done');
      }
    } catch (err) {
      console.error('[HighlightGenerator] Failed to generate:', err);
      setError(err.message);
      setHighlightState('error');
    }
  };

  const handleShare = async () => {
    if (!generatedHighlight?.url) return;

    if (navigator.share) {
      await navigator.share({
        title: liveData.title,
        text: 'Watch the highlight from my Vuvio live',
        url: generatedHighlight.url,
      }).catch(() => {});
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(generatedHighlight.url);
      alert('Link copied to clipboard!');
    }
  };

  const handleRegenerate = () => {
    setGeneratedHighlight(null);
    setHighlightState('ready');
    setError(null);
  };

  return (
    <section className="highlight-generator">
      <div className="highlight-generator__header">
        <h2>
          <Zap size={18} strokeWidth={2} />
          Your Highlight
        </h2>
        {recordingExpiry !== null && highlightState !== 'done' && (
          <span className="highlight-generator__expiry">
            {recordingExpiry === 0 ? 'Recording expired' : `Available for ${recordingExpiry}h`}
          </span>
        )}
      </div>

      {/* Ready State */}
      {highlightState === 'ready' && (
        <div className="highlight-generator__ready">
          <div className="highlight-generator__preview">
            <img
              src={liveData?.image || liveData?.thumbnailUrl || '/icons/icon-192.png'}
              alt="Live preview"
            />
            <div className="highlight-generator__preview-overlay">
              <Play size={40} strokeWidth={1.5} fill="white" />
            </div>
          </div>
          <p className="highlight-generator__description">
            Turn your live into a short video ready to share.
          </p>
          <button
            type="button"
            className="highlight-generator__cta"
            onClick={handleGenerateHighlight}
            disabled={recordingExpiry === 0}
          >
            <Zap size={16} strokeWidth={2} />
            Generate Highlight
          </button>
          {MOCK_MODE && (
            <small style={{ color: 'rgba(43, 217, 200, 0.6)', fontSize: '11px' }}>
              (Mock mode - returns sample video)
            </small>
          )}
        </div>
      )}

      {/* Processing State */}
      {highlightState === 'processing' && (
        <div className="highlight-generator__processing">
          <div className="highlight-generator__spinner" />
          <p className="highlight-generator__status">Finding your best moments…</p>
          <p style={{ fontSize: '12px', color: 'rgba(242, 247, 246, 0.52)' }}>
            This may take a minute.
          </p>
        </div>
      )}

      {/* Done State */}
      {highlightState === 'done' && generatedHighlight && (
        <div className="highlight-generator__done">
          <div className="highlight-generator__player">
            <video
              src={generatedHighlight.url}
              poster={generatedHighlight.thumbnailUrl}
              controls
              controlsList="nodownload"
              style={{
                width: '100%',
                borderRadius: '12px',
                backgroundColor: '#000',
              }}
            />
          </div>

          <div className="highlight-generator__duration">
            {Math.floor(generatedHighlight.durationSeconds / 60)}:
            {String(generatedHighlight.durationSeconds % 60).padStart(2, '0')}
          </div>

          <div className="highlight-generator__actions">
            <button
              type="button"
              className="highlight-generator__action-btn is-primary"
              onClick={handleShare}
            >
              <Share2 size={16} strokeWidth={2} />
              Share
            </button>
            <button
              type="button"
              className="highlight-generator__action-btn"
              onClick={handleRegenerate}
            >
              <RotateCcw size={16} strokeWidth={2} />
              Regenerate
            </button>
          </div>

          <div className="highlight-generator__next-steps">
            <p>
              <strong>Next:</strong> Add to your profile or publish on Vuvio to reach more viewers.
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {highlightState === 'error' && (
        <div className="highlight-generator__error">
          <p>
            {error || 'Failed to generate highlight. Try again.'}
          </p>
          <button
            type="button"
            className="highlight-generator__retry"
            onClick={handleGenerateHighlight}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Expired State */}
      {highlightState === 'expired' && (
        <div className="highlight-generator__expired">
          <p>Recording is no longer available.</p>
          <small>Recordings are kept for 24 hours after your live ends.</small>
        </div>
      )}
    </section>
  );
}
