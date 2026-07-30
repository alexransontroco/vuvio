export default function GlobeMarkerLegend() {
  return (
    <div className="globe-marker-legend">
      <div className="globe-marker-legend__title">Live Types</div>
      <div className="globe-marker-legend__items">
        <div className="globe-marker-legend__item">
          <div className="globe-marker-legend__dot globe-marker-legend__dot--standard" />
          <span>Standard live</span>
        </div>
        <div className="globe-marker-legend__item">
          <div className="globe-marker-legend__diamond globe-marker-legend__diamond--sponsored" />
          <span>Sponsored</span>
        </div>
        <div className="globe-marker-legend__item">
          <div className="globe-marker-legend__star globe-marker-legend__star--vuvio" />
          <span>Vuvio selection</span>
        </div>
      </div>
      <div className="globe-marker-legend__hint">Sponsored lives may appear even outside active filters if relevant to you</div>
    </div>
  );
}
