import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import '../styles/pages/landing.css';

export default function WaitlistUnsubscribePage() {
  const [params] = useSearchParams();
  const { language } = useLanguage();
  const [status, setStatus] = useState('idle');
  const fr = language === 'fr';
  const entryId = params.get('id');
  const token = params.get('token');
  const valid = /^[A-Za-z0-9]{20}$/.test(entryId || '') && /^[a-f0-9]{64}$/.test(token || '');

  const remove = async () => {
    setStatus('loading');
    try {
      const response = await fetch('/api/waitlist/subscription', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, token }),
      });
      if (!response.ok) throw new Error('network');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return (
    <main className="vuvio-landing vuvio-landing__unsubscribe">
      <div>
        <p className="vuvio-landing__waitlist-eyebrow">VUVIO</p>
        <h1>{fr ? 'Retirer mon inscription' : 'Remove my signup'}</h1>
        <p role="status" aria-live="polite">
          {status === 'done'
            ? (fr ? 'Votre adresse a été retirée de la liste.' : 'Your address has been removed from the list.')
            : status === 'error'
              ? (fr ? 'Une erreur est survenue. Réessayez ou écrivez à hello@vuvio.app.' : 'Something went wrong. Try again or email hello@vuvio.app.')
              : valid
                ? (fr ? 'Confirmez le retrait de votre adresse de la liste de lancement.' : 'Confirm removal of your address from the launch list.')
                : (fr ? 'Ce lien est invalide. Écrivez à hello@vuvio.app pour retirer votre inscription.' : 'This link is invalid. Email hello@vuvio.app to remove your signup.')}
        </p>
        {valid && status !== 'done' && <button className="vuvio-landing__cta" type="button" onClick={remove} disabled={status === 'loading'}>{fr ? 'Confirmer le retrait' : 'Confirm removal'}</button>}
        <Link to="/">{fr ? 'Retour à Vuvio' : 'Back to Vuvio'}</Link>
      </div>
    </main>
  );
}
