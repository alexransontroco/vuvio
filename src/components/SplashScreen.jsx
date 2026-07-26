import BrandMark from './BrandMark.jsx';

export default function SplashScreen({ leaving = false }) {
  return (
    <div className={leaving ? 'splash-screen is-leaving' : 'splash-screen'} aria-label="Loading Vuvio" role="status">
      <div className="splash-screen__glow" />
      <div className="splash-screen__logo">
        <BrandMark size={72} showName />
      </div>
      <span className="splash-screen__pulse" />
    </div>
  );
}
