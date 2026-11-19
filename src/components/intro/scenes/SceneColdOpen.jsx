import { motion } from 'framer-motion';
import BrandMark from '../../BrandMark.jsx';
import IntroVideo from '../IntroVideo.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function SceneColdOpen({ reducedMotion }) {
  return (
    <section className="intro-cold" aria-label="Welcome">
      {/* POV video backdrop fades in after the logo */}
      <motion.div
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0.4 : 2.4, delay: reducedMotion ? 0 : 1.2, ease: EASE }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <IntroVideo
          src="/pov/used/povs-montage.mp4"
          poster="/pov/used/povs-poster.jpg"
          className="intro-cold__video"
          loop={false}
        />
        <div className="intro-cold__video-mask" />
      </motion.div>

      {/* Blue halo behind the logo */}
      <motion.div
        className="intro-cold__halo"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.9, 0.7], scale: [0.6, 1.1, 1] }}
        transition={{ duration: reducedMotion ? 0.3 : 2.2, ease: EASE, times: [0, 0.5, 1] }}
      />

      <div className="intro-cold__content">
        {/* Logo pulse-in */}
        <motion.div
          className="intro-cold__logo"
          initial={{ opacity: 0, scale: 0.78, filter: 'blur(14px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: reducedMotion ? 0.3 : 1.4, ease: EASE }}
        >
          <BrandMark size={110} showName useLegacy nameSize={56} gap={20} />
        </motion.div>

        {/* Tagline reveal */}
        <motion.p
          className="intro-cold__tagline"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0.3 : 1.0, delay: reducedMotion ? 0.1 : 0.9, ease: EASE }}
        >
          See the world through their eyes.
        </motion.p>
      </div>
    </section>
  );
}
