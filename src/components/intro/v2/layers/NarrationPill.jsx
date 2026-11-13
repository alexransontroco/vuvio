import { AnimatePresence, motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1];

// A short caption that fades in ~500ms after phase start and fades before phase ends.
export default function NarrationPill({ text, phaseId }) {
  return (
    <div className="introv2-narration" aria-live="polite">
      <AnimatePresence mode="wait">
        {text && (
          <motion.div
            key={phaseId}
            className="introv2-narration__pill"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.2 }}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
