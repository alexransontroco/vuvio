import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

export default function FinancialForecastViewer({ url, lang = 'en' }) {
  const iframeRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!iframeRef.current) return;

    // Detect iframe blocking after short timeout (Google typically blocks private sheets)
    const timer = setTimeout(() => {
      if (isLoading) {
        setBlocked(true);
        setIsLoading(false);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isLoading]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setBlocked(true);
    setIsLoading(false);
  };

  const copy = {
    en: {
      loading: 'Loading financial forecast...',
      openSheet: 'Open in Google Sheets',
      blocked: 'Google Sheets not embedded',
      blockedMsg: 'Private Google Sheets cannot be embedded directly for security reasons. Click the button below to open it in a full tab with your authorized account.',
      error: 'Unable to load the spreadsheet',
    },
    fr: {
      loading: 'Chargement du prévisionnel...',
      openSheet: 'Ouvrir dans Google Sheets',
      blocked: 'Google Sheets non intégré',
      blockedMsg: 'Les Google Sheets privés ne peuvent pas être intégrés directement pour des raisons de sécurité. Clique sur le bouton ci-dessous pour l\'ouvrir dans un onglet complet avec ton compte autorisé.',
      error: 'Impossible de charger le classeur',
    },
  };

  const t = copy[lang] || copy.en;

  if (!url) {
    return (
      <div style={{
        padding: '24px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.4)',
      }}>
        {lang === 'fr' ? 'Lien du prévisionnel à configurer' : 'Financial forecast URL not configured'}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24, marginBottom: 24 }}>
      {/* Header with button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 12,
      }}>
        <h3 style={{
          fontSize: 15,
          fontWeight: 600,
          margin: 0,
          color: '#fff',
        }}>
          {lang === 'fr' ? 'Prévisionnel financier 2027–2029' : 'Financial Forecast 2027–2029'}
        </h3>
        <button
          type="button"
          onClick={() => window.open(url, '_blank')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 8,
            background: '#35e3dc',
            color: '#0a0e1a',
            border: 'none',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          <ExternalLink size={14} strokeWidth={2} />
          {t.openSheet}
        </button>
      </div>

      {/* Iframe or fallback */}
      {isLoading && (
        <div style={{
          height: 600,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 14,
        }}>
          {t.loading}
        </div>
      )}

      {blocked && (
        <div style={{
          padding: '32px 24px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.8)',
            marginBottom: 8,
          }}>
            {t.blocked}
          </div>
          <div style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.4)',
            marginBottom: 16,
          }}>
            {t.blockedMsg}
          </div>
          <button
            type="button"
            onClick={() => window.open(url, '_blank')}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              background: '#35e3dc',
              color: '#0a0e1a',
              border: 'none',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t.openSheet}
          </button>
        </div>
      )}

      {!isLoading && !blocked && (
        <iframe
          ref={iframeRef}
          src={url}
          title="Financial Forecast"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          style={{
            width: '100%',
            height: 600,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            background: '#fff',
          }}
          allow="clipboard-write"
        />
      )}

      {/* Mobile note */}
      <div style={{
        fontSize: 12,
        color: 'rgba(255,255,255,0.3)',
        marginTop: 12,
        textAlign: 'center',
      }}>
        {lang === 'fr'
          ? 'Sur mobile, ouvre le classeur dans l\'onglet complet pour une meilleure navigation.'
          : 'On mobile, open the full spreadsheet in a new tab for better navigation.'}
      </div>
    </div>
  );
}
