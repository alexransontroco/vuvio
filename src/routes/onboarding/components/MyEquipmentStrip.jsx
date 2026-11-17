import { Plus, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import EquipmentVisual from '../../../components/equipment/EquipmentVisual.jsx';
import { inferEquipmentVisualCategory } from '../data/equipmentIcons.js';

export default function MyEquipmentStrip({ items = [], allItems = items, onRemove, onAdd }) {
  const reducedMotion = useReducedMotion();
  const knownIds = useRef(new Set(allItems.map((item) => item.id)));
  const [newestId, setNewestId] = useState(null);
  useEffect(() => {
    const added = allItems.find((item) => !knownIds.current.has(item.id));
    knownIds.current = new Set(allItems.map((item) => item.id));
    if (!added) return;
    setNewestId(added.id);
    const timer = setTimeout(() => setNewestId(null), 1300);
    return () => clearTimeout(timer);
  }, [allItems]);
  return (
    <div className="ob-eq-strip" role="list" aria-label="My Gear">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const primary = item.brand || item.model || item.displayName || '';
          const secondary = item.brand ? (item.model || item.displayName || '') : (item.equipmentType || '');
          const name = item.brand && item.displayName?.toLowerCase().startsWith(`${item.brand.toLowerCase()} `)
            ? (item.model || item.displayName.slice(item.brand.length).trim())
            : (item.displayName || item.model || item.equipmentType || '');
          return (
            <motion.div
              key={item.id}
              className={`ob-eq-strip__item${newestId === item.id ? ' is-new' : ''}`}
              role="listitem"
              layout={!reducedMotion}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.9, y: -14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
            >
              <button
                type="button"
                className="ob-eq-strip__remove"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${primary} ${secondary}`.trim()}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
              <EquipmentVisual equipment={item} className="ob-eq-strip__icon" size={27} />
              {item.brand ? <p className="ob-eq-strip__brand">{item.brand}</p> : null}
              <p className="ob-eq-strip__model">
                {name}
              </p>
              <span className="ob-eq-strip__type">{item.associatedActivity || inferEquipmentVisualCategory(item)}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
      <button type="button" className="ob-eq-strip__add" onClick={onAdd} role="listitem">
        <Plus size={24} strokeWidth={1.8} />
        <span>+ Add gear</span>
      </button>
      <span className="ob-eq-strip__announcement" role="status" aria-live="polite">
        {newestId && <><Sparkles size={14} /> Added to your Gear!</>}
      </span>
    </div>
  );
}
