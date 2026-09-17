import { useEffect, useRef } from 'react';

export default function SplashScreen({ leaving = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
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
        loop
        playsInline
        preload="auto"
      >
        <source src="/assets/videos/landing-loop2.mp4" type="video/mp4" />
      </video>
      <div className="splash-screen__overlay" />
      <div className="splash-screen__glow" />
      <div className="splash-screen__logo">
        <img src="/assets/logo/vuvio-logo.png" alt="Vuvio" className="splash-screen__logo-img" />
        <span className="splash-screen__brand-name" aria-hidden="true">Vuvio</span>
      </div>
      <span className="splash-screen__pulse" />
    </div>
  );
}
