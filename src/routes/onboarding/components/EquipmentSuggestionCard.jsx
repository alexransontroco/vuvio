import { Check, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import EquipmentVisual from '../../../components/equipment/EquipmentVisual.jsx';

export default function EquipmentSuggestionCard({ item, added, onToggle }) {
  const primary = item.brand || item.model || item.displayName || '';
  const secondary = item.brand ? (item.model || item.displayName || '') : (item.equipmentType || '');
  const ariaLabel = `${added ? 'Remove' : 'Add'} ${primary} ${secondary}`.trim();
  return (
    <motion.div className={`ob-eq-card${added ? ' is-added' : ''}`} layout>
      <div className="ob-eq-card__icon" aria-hidden="true">
        <EquipmentVisual equipment={item} size={26} />
      </div>
      <div className="ob-eq-card__body">
        {item.brand ? <p className="ob-eq-card__brand">{item.brand}</p> : null}
        <p className="ob-eq-card__model">{item.model || item.displayName || item.equipmentType || ''}</p>
        {item.equipmentType && (item.brand || item.model) ? (
          <p className="ob-eq-card__type">{item.equipmentType}</p>
        ) : null}
      </div>
      <button
        type="button"
        className={`ob-eq-card__add${added ? ' is-added' : ''}`}
        onClick={() => onToggle(item)}
        aria-label={ariaLabel}
        aria-pressed={added}
      >
        {added ? <Check size={18} strokeWidth={2.5} /> : <Plus size={18} strokeWidth={2.5} />}
      </button>
    </motion.div>
  );
}
