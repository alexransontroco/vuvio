import { AnimatePresence, motion } from 'framer-motion';
import { Camera, ChefHat, Shirt } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];

const ITEMS = [
  { Icon: Camera, name: 'GoPro Hero 13', sub: 'POV camera' },
  { Icon: Shirt, name: 'Chest mount', sub: 'Hands-free streaming' },
  { Icon: ChefHat, name: 'Chef kit', sub: 'Friday service' },
];

export default function EquipmentLayer({ visible, reducedMotion }) {
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
              <h3>Creator gear</h3>
              <span>3 items</span>
            </div>
            <ul className="introv2-equip__list">
              {ITEMS.map((item, i) => (
                <motion.li
                  key={item.name}
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
                    <item.Icon size={18} strokeWidth={1.8} />
                  </div>
                  <div className="introv2-equip__meta">
                    <div className="introv2-equip__name">{item.name}</div>
                    <div className="introv2-equip__sub">{item.sub}</div>
                  </div>
                  <button type="button" className="introv2-equip__link">View</button>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
