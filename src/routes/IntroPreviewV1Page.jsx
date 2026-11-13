import { useEffect } from 'react';
import IntroOrchestratorV1 from '../components/intro/IntroOrchestratorV1.jsx';

export default function IntroPreviewV1Page() {
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  return <IntroOrchestratorV1 />;
}
