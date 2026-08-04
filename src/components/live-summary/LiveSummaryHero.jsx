export default function LiveSummaryHero({ liveData }) {
  if (!liveData) return null;

  const durationMins = Math.round((liveData.durationSeconds || 0) / 60);
  const endedAt = liveData.endedAt
    ? new Date(liveData.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Message personnalisé selon l'audience
  const uniqueViewers = liveData.uniqueViewers || liveData.currentViewerCount || 0;
  let mainMessage = 'Your live is complete';
  let subMessage = 'Now turn it into something worth sharing.';

  if (uniqueViewers === 0) {
    mainMessage = 'Your first Vuvio live is complete';
    subMessage = 'Now turn it into something worth sharing.';
  } else if (uniqueViewers < 5) {
    mainMessage = 'Great start!';
    subMessage = 'Every stream helps you grow.';
  } else if (uniqueViewers < 50) {
    mainMessage = 'Nice session!';
    subMessage = 'Your audience loved it.';
  } else {
    mainMessage = 'Impressive performance!';
    subMessage = 'Your viewers can\'t wait for the next one.';
  }

  return (
    <section className="live-summary-hero">
      <div className="live-summary-hero__image">
        <img
          src={liveData.image || liveData.thumbnailUrl || '/assets/icons/icon-192.png'}
          alt={liveData.title}
        />
        <div className="live-summary-hero__overlay" />
      </div>

      <div className="live-summary-hero__content">
        <h2 className="live-summary-hero__title">{mainMessage}</h2>
        <p className="live-summary-hero__subtitle">{subMessage}</p>

        <div className="live-summary-hero__meta">
          <div className="live-summary-hero__meta-item">
            <span className="live-summary-hero__label">Duration</span>
            <strong>{durationMins} min</strong>
          </div>
          <div className="live-summary-hero__divider" />
          <div className="live-summary-hero__meta-item">
            <span className="live-summary-hero__label">Viewers</span>
            <strong>{uniqueViewers}</strong>
          </div>
        </div>

        <div className="live-summary-hero__live-info">
          <h3>{liveData.title || 'Untitled Live'}</h3>
          <p>{liveData.location || 'Location unknown'} · {endedAt}</p>
        </div>
      </div>
    </section>
  );
}
