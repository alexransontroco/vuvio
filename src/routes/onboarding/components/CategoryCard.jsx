import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CategoryCard({ category, selected, onToggle, label }) {
  const Icon = category.icon;
  const color = category.color;

  return (
    <motion.button
      type="button"
      className={`ob-cat-card${selected ? ' is-selected' : ''}`}
      style={{ '--cat-color': color }}
      onClick={() => onToggle(category.id)}
      whileTap={{ scale: 0.97 }}
      aria-pressed={selected}
    >
      <span className="ob-cat-card__icon" aria-hidden="true">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <span className="ob-cat-card__label">{label}</span>
      {selected && (
        <motion.span
          className="ob-cat-card__check"
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
