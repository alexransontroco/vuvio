import { useEffect, useRef } from 'react';

export default function SplashTestPage() {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    video.play()
      .then(() => {
        console.log('[SplashTest] autoplay success');
      })
      .catch((error) => {
        console.error('[SplashTest] autoplay failed', {
          name: error.name,
          message: error.message,
        });
      });
  }, []);

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflow: 'hidden',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        loop
        preload="auto"
        controls={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      >
        <source
          src="/assets/videos/landing-loop-mobile.mp4?v=splash-test-1"
          type="video/mp4"
        />
      </video>
    </main>
  );
}
