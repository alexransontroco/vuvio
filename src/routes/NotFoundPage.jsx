import { Link, useLocation } from 'react-router-dom';
import SEO from '../components/SEO.jsx';

export default function NotFoundPage() {
  const location = useLocation();

  return (
    <section className="screen-scroll not-found-page">
      <SEO
        title="Page introuvable | Vuvio"
        description="Cette page Vuvio n existe pas ou n est plus disponible."
        canonical={location.pathname}
        robots="noindex,follow"
      />
      <div className="not-found-page__content">
        <p>404</p>
        <h1>Page introuvable</h1>
        <span>Ce live, ce profil ou cette experience n est pas disponible a cette adresse.</span>
        <Link to="/watch">Retour aux lives</Link>
      </div>
    </section>
  );
}
