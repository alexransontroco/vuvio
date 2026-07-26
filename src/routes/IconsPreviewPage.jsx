import { vuvioIcons } from '../assets/icons/index.ts';
import referenceBoard from '../../ChatGPT Image 18 juil. 2026, 08_02_38.png';

const categoryMeta = {
  air: { label: 'AIR', note: 'Approved set', className: 'is-air' },
  eau: { label: 'WATER', note: 'All icons', className: 'is-eau' },
  terre: { label: 'LAND', note: 'Set 02', className: 'is-terre' },
  transport: { label: 'TRANSPORT', note: 'Lot 03', className: 'is-transport' },
  live: { label: 'LIVE TYPES', note: 'Set 04', className: 'is-live' },
  metiers: { label: 'WORK', note: 'Set 05', className: 'is-metiers' },
  passions: { label: 'PASSIONS', note: 'All icons', className: 'is-passions' },
  navigation: { label: 'NAVIGATION', note: 'All icons', className: 'is-navigation' },
  interface: { label: 'INTERFACE', note: 'All icons', className: 'is-interface' },
};

const categoryOrder = ['air', 'eau', 'terre', 'metiers', 'passions', 'live', 'transport', 'navigation', 'interface'];

export default function IconsPreviewPage() {
  return (
    <section className="icons-preview-screen" aria-label="Vuvio icon preview">
      <header className="icons-preview-header">
        <div>
          <p className="icons-preview-kicker">Vuvio Icon System v2</p>
          <h1>Icons</h1>
          <p>Vector sets: 24px grid, 1.8 stroke, currentColor, no background or hard-coded color.</p>
        </div>
        <span>{vuvioIcons.length}</span>
      </header>

      <main className="icons-preview-content">
        <section className="icons-reference-card" aria-label="Reference board">
          <img src={referenceBoard} alt="Vuvio icon system reference board" />
        </section>

        {categoryOrder.map((category) => {
          const icons = vuvioIcons.filter((item) => item.category === category);
          const meta = categoryMeta[category];

          return (
            <section key={category} className={`icons-preview-group ${meta.className}`} aria-labelledby={`icons-${category}`}>
              <div className="icons-preview-group-header">
                <h2 id={`icons-${category}`}>{meta.label}</h2>
                <span>{meta.note}</span>
              </div>

              <div className="icons-preview-grid">
                {icons.map((item) => (
                  <article key={`${item.category}-${item.name}`} className="icons-preview-card">
                    <div className="icons-preview-sizes" aria-hidden="true">
                      {[24, 32, 48].map((size) => (
                        <span key={size}>
                          <i
                            className="icons-preview-glyph"
                            style={{ '--preview-icon-size': `${size}px` }}
                            dangerouslySetInnerHTML={{ __html: item.svg }}
                          />
                          <em>{size}px</em>
                        </span>
                      ))}
                    </div>
                    <strong>{item.label}</strong>
                    <small>{item.name}.svg</small>
                    <b>{item.source}</b>
                    <small>{item.sourceIcon}</small>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        <p className="icons-preview-footer">
          All icons present in src/assets/icons are displayed here. No icon is integrated into the app from this page.
        </p>
      </main>
    </section>
  );
}
