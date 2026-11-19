import { Check, Sparkle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ActivityTile({ name, icon: Icon, color, selected, onToggle, custom }) {
  const DisplayIcon = Icon || Sparkle;
  return (
    <motion.button
      type="button"
      className={`ob-act-tile${selected ? ' is-selected' : ''}${custom ? ' is-custom' : ''}`}
      style={{ '--cat-color': color || 'var(--vuvio-cyan)' }}
      onClick={() => onToggle(name)}
      whileTap={{ scale: 0.97 }}
      aria-pressed={selected}
    >
      <span className="ob-act-tile__icon" aria-hidden="true">
        <DisplayIcon size={22} strokeWidth={1.8} />
      </span>
      <span className="ob-act-tile__label">{name}</span>
      {selected && (
        <motion.span
          className="ob-act-tile__check"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          aria-hidden="true"
        >
          <Check size={13} strokeWidth={3} />
        </motion.span>
      )}
    </motion.button>
  );
}
