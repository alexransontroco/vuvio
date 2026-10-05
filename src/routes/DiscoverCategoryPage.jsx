import { Link, useParams } from 'react-router-dom';
import SEO, { SITE_URL } from '../components/SEO.jsx';
import { CATEGORY_SEO, getCategoryStreams, streamCreator, streamDescription, streamLocation, streamTitle } from '../utils/seoData.js';

const DEFAULT_IMAGE = 'https://storage.googleapis.com/vuvio-bf328.firebasestorage.app/mock-videos/live-mockups/mockup-dubai-thumb.jpg';

function liveJsonLd(streams, canonical) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Vuvio category',
    url: `${SITE_URL}${canonical}`,
    hasPart: streams.slice(0, 8).map((stream) => ({
      '@type': 'VideoObject',
      name: streamTitle(stream),
      description: streamDescription(stream),
      thumbnailUrl: stream.image ? [stream.image.startsWith('http') ? stream.image : `${SITE_URL}${stream.image}`] : undefined,
      uploadDate: '2026-10-05',
      creator: {
        '@type': 'Person',
        name: streamCreator(stream),
      },
      contentUrl: `${SITE_URL}/watch?live=${encodeURIComponent(stream.id)}`,
    })),
  };
}

export default function DiscoverCategoryPage() {
  const { categorySlug } = useParams();
  const category = CATEGORY_SEO[categorySlug];
  const streams = getCategoryStreams(categorySlug, 24);

  if (!category) {
    return (
      <>
        <SEO
          title="Categorie introuvable | Vuvio"
          description="Cette categorie Vuvio n existe pas encore."
          canonical={`/discover/${categorySlug || ''}`}
          robots="noindex,follow"
        />
        <section className="screen-scroll seo-category-page">
          <h1>Categorie introuvable</h1>
          <p>Cette page n existe pas encore sur Vuvio.</p>
          <Link to="/watch">Retour aux lives</Link>
        </section>
      </>
    );
  }

  const canonical = `/discover/${categorySlug}`;

  return (
    <section className="screen-scroll seo-category-page">
      <SEO
        title={category.title}
        description={category.intro}
        canonical={canonical}
        image={streams[0]?.image || DEFAULT_IMAGE}
        jsonLd={liveJsonLd(streams, canonical)}
      />
      <header className="seo-category-page__header">
        <p>Vuvio Discover</p>
        <h1>{category.h1}</h1>
        <span>{category.intro}</span>
      </header>
      <div className="seo-category-page__grid">
        {streams.map((stream) => (
          <article key={stream.id} className="seo-category-card">
            <Link to={`/watch?live=${encodeURIComponent(stream.id)}`}>
              <img src={stream.image || DEFAULT_IMAGE} alt={`${streamTitle(stream)} - ${streamCreator(stream)}`} loading="lazy" />
              <div>
                <h2>{streamTitle(stream)}</h2>
                <p>{streamCreator(stream)}</p>
                <span>{streamLocation(stream)}</span>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
