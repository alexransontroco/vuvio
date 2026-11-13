import { useEffect } from 'react';
import IntroOrchestratorV2 from '../components/intro/v2/IntroOrchestratorV2.jsx';

export default function IntroPreviewPage() {
  const searchParams = new URLSearchParams(window.location.search);
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

  return <IntroOrchestratorV2 initialPhase={searchParams.get('phase')} autoAdvance={searchParams.get('auto') === '1'} />;
}
