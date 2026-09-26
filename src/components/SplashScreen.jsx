import { useEffect, useRef, useState } from 'react';

export default function SplashScreen() {
  const [leaving, setLeaving] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const p = video.play();
      if (p?.catch) p.catch(() => {});
    }
    const t = setTimeout(() => setLeaving(true), 5700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={leaving ? 'splash-anim splash-anim--leave' : 'splash-anim'}
      aria-label="Loading Vuvio"
      role="status"
    >
      {/* Background video */}
      <video
        ref={videoRef}
        className="splash-anim__video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src="/assets/videos/landing-loop2.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay over video */}
      <div className="splash-anim__overlay" />

      {/* Atmospheric glow */}
      <div className="splash-anim__bg-glow" />

      {/* Logo + title centered group */}
      <div className="splash-anim__center">
        <div className="splash-anim__logo">
          <svg
            className="splash-anim__svg"
            viewBox="0 0 96 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="sa-v-grad"
                x1="16" y1="34"
                x2="80" y2="34"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%"   stopColor="#168EF5" />
                <stop offset="48%"  stopColor="#2BD9C8" />
                <stop offset="100%" stopColor="#1EC8BA" />
              </linearGradient>
              <radialGradient id="sa-dot-grad" cx="50%" cy="30%" r="70%">
                <stop offset="0%"   stopColor="#5BB8FF" />
                <stop offset="100%" stopColor="#2F9FF4" />
              </radialGradient>
            </defs>

            <g className="splash-anim__left-v">
              <path
                d="M16 34 L34 66 L48 44"
                stroke="url(#sa-v-grad)"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            <g className="splash-anim__right-v">
              <path
                d="M48 44 L62 66 L80 34"
                stroke="url(#sa-v-grad)"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            <g className="splash-anim__dot">
              <circle cx="48" cy="24" r="8" fill="url(#sa-dot-grad)" />
            </g>
          </svg>

          <div className="splash-anim__logo-glow" />
        </div>
        <div className="splash-anim__title">Vuvio</div>
      </div>
    </div>
  );
}
