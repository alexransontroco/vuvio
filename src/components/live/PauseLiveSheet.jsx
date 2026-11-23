import { useState } from 'react';
import { Pause } from 'lucide-react';

const PAUSE_OPTIONS = [
  { minutes: 2, label: 'min', display: '2' },
  { minutes: 5, label: 'min', display: '5' },
  { minutes: 10, label: 'min', display: '10' },
  { minutes: null, label: 'Durée indéterminée', display: '∞', note: 'max 30 min' },
];

export default function PauseLiveSheet({ onPause, onCancel }) {
  const [selected, setSelected] = useState(5);

  const handlePause = () => {
    onPause(selected);
  };

  return (
    <div className="pause-sheet" role="dialog" aria-modal="true" aria-label="Mettre le live en pause">
      <button type="button" className="pause-sheet__backdrop" onClick={onCancel} aria-label="Annuler" />
      <div className="pause-sheet__panel">
        <div className="pause-sheet__header">
          <span className="pause-sheet__icon">
            <Pause size={20} strokeWidth={2} />
          </span>
          <h2>Mettre le live en pause ?</h2>
          <p>La diffusion sera temporairement interrompue. Vos spectateurs verront un écran d'attente.</p>
        </div>

        <div>
          <span className="pause-sheet__label">Durée estimée</span>
          <div className="pause-sheet__options" style={{ marginTop: 10 }}>
            {PAUSE_OPTIONS.map((opt) => (
              <button
                key={opt.display}
                type="button"
                className={`pause-sheet__option${opt.minutes === null ? ' pause-sheet__option-open' : ''}${selected === opt.minutes ? ' is-selected' : ''}`}
                onClick={() => setSelected(opt.minutes)}
              >
                <span className="pause-sheet__option-time">{opt.display}</span>
                <span className="pause-sheet__option-label">{opt.label}{opt.note ? ` · ${opt.note}` : ''}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pause-sheet__actions">
          <button type="button" className="pause-sheet__btn-pause" onClick={handlePause}>
            Mettre en pause
          </button>
          <button type="button" className="pause-sheet__btn-cancel" onClick={onCancel}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
