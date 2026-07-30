import { useEffect, useRef } from 'react';
import BrandMark from './BrandMark.jsx';

export default function SplashScreen({ leaving = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.playbackRate = 0.7;

    const attemptPlay = () => {
      video.play()
        .then(() => {
          console.log('[Splash] autoplay success');
        })
        .catch((error) => {
          console.error('[Splash] autoplay failed', {
            name: error.name,
            message: error.message,
          });
        });
    };

    if (video.readyState >= 2) {
      attemptPlay();
    } else {
      video.addEventListener('canplay', attemptPlay, { once: true });
    }

    return () => {
      video.removeEventListener('canplay', attemptPlay);
    };
  }, []);

  return (
    <div className={leaving ? 'splash-screen is-leaving' : 'splash-screen'} aria-label="Loading Vuvio" role="status">
      <video
        ref={videoRef}
        className="splash-screen__video"
        autoPlay
        muted
        defaultMuted
        playsInline
        loop
        preload="auto"
        controls={false}
        disablePictureInPicture
      >
        <source src="/assets/videos/vuvland.mp4?v=1" type="video/mp4" />
      </video>
      <div className="splash-screen__logo">
        <BrandMark size={72} />
        <h1 className="splash-screen__title">vuvio</h1>
      </div>
    </div>
  );
}
