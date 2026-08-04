import { useEffect, useRef } from 'react';
import './landing-screen.css';

export default function LandingScreen({ onComplete }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 15000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  useEffect(() => {
    if (videoRef.current) {
      // Smooth loop + slower playback (0.8x speed)
      videoRef.current.playbackRate = 0.8;
      videoRef.current.muted = true;
      videoRef.current.autoplay = true;
      videoRef.current.loop = true;

      // Ensure smooth looping
      videoRef.current.addEventListener('ended', () => {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      });
      videoRef.current.play()?.catch?.(() => {});
    }
  }, []);

  return (
    <div className="landing-screen">
      <video
        ref={videoRef}
        className="landing-video"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/assets/videos/landing-loop.mp4" type="video/mp4" />
      </video>
      <div className="landing-overlay" />
      <div className="landing-content">
        <div className="landing-logo">VUV<span>IO</span></div>
      </div>
    </div>
  );
}
