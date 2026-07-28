import { useEffect, useRef } from 'react';
import './mobile-landing-screen.css';

export default function MobileLandingScreen({ onComplete }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 15000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.8;
      videoRef.current.muted = true;
      videoRef.current.autoplay = true;
      videoRef.current.loop = true;

      videoRef.current.addEventListener('ended', () => {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      });
    }
  }, []);

  return (
    <div className="mobile-landing-screen">
      <video
        ref={videoRef}
        className="mobile-landing-video"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/assets/videos/landing-loop.mp4" type="video/mp4" />
      </video>
      <div className="mobile-landing-overlay" />
      <div className="mobile-landing-content">
        <div className="mobile-landing-logo">VUV<span>IO</span></div>
      </div>
    </div>
  );
}
