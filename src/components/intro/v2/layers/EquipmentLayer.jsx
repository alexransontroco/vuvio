import { AnimatePresence, motion } from 'framer-motion';
import { Camera, ChefHat, Shirt } from 'lucide-react';
import { useIntroCopy } from '../introCopy.js';

const EASE = [0.22, 1, 0.36, 1];

const ICONS = [Camera, Shirt, ChefHat];

export default function EquipmentLayer({ visible, reducedMotion }) {
  const t = useIntroCopy();
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="introv2-equip"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.2 : 0.35, ease: EASE }}
        >
          {/* Sheet slides up from bottom */}
          <motion.div
            className="introv2-equip__sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: reducedMotion ? 0.25 : 0.6, ease: EASE }}
          >
            <div className="introv2-equip__grabber" />
            <div className="introv2-equip__header">
              <h3>{t.equipment.title}</h3>
              <span>{t.equipment.count}</span>
            </div>
            <ul className="introv2-equip__list">
              {ICONS.map((Icon, i) => (
                <motion.li
                  key={i}
                  className="introv2-equip__item"
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: reducedMotion ? 0 : 1.5 + i * 0.12,
                    duration: 0.45,
                    ease: EASE,
                  }}
                >
                  <div className="introv2-equip__icon">
                    <Icon size={18} strokeWidth={1.8} />
                  </div>
                  <div className="introv2-equip__meta">
                    <div className="introv2-equip__name">{t.equipment.items[i].name}</div>
                    <div className="introv2-equip__sub">{t.equipment.items[i].sub}</div>
                  </div>
                  <button type="button" className="introv2-equip__link">{t.equipment.view}</button>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
