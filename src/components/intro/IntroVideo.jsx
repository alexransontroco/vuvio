import { useEffect, useRef, useState } from 'react';

/**
 * <IntroVideo> — resilient autoplay <video> for the intro.
 * - Muted, playsInline, loop (optional) to satisfy mobile autoplay policies
 * - Falls back to a styled gradient if the video can't play
 * - Accepts className, poster, src, loop, playbackRate, muted overrides
 */
export default function IntroVideo({
  src,
  poster,
  className,
  style,
  loop = false,
  autoPlay = true,
  playbackRate = 1,
  onEnded,
  fallbackClassName = 'intro-video-fallback',
}) {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.muted = true;
    video.playbackRate = playbackRate;
    if (!autoPlay) return undefined;
    // Kick off playback; browsers may still reject if unprivileged
    const tryPlay = async () => {
      try {
        await video.play();
      } catch {
        // one more retry after a tick
        setTimeout(() => {
          video.play().catch(() => setFailed(true));
        }, 150);
      }
    };
    tryPlay();
    return undefined;
  }, [src, autoPlay, playbackRate]);

  if (failed) {
    return <div className={fallbackClassName || 'intro-video-fallback'} style={style} />;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className={className}
      style={style}
      muted
      playsInline
      autoPlay={autoPlay}
      loop={loop}
      preload="auto"
      onEnded={onEnded}
      onError={() => setFailed(true)}
      // iOS-specific attributes
      webkit-playsinline="true"
      disablePictureInPicture
      disableRemotePlayback
    />
  );
}
