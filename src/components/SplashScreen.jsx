import { useEffect, useRef } from 'react';
import BrandMark from './BrandMark.jsx';

export default function SplashScreen({ leaving = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = 0.7;
    const playPromise = video.play();
    if (playPromise?.catch) playPromise.catch(() => {});
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
        <source src="/assets/videos/landing-verti.mp4" type="video/mp4" />
      </video>
      <div className="splash-screen__logo">
        <BrandMark size={140} />
        <h1 className="splash-screen__title">vuvio</h1>
      </div>
    </div>
  );
}
