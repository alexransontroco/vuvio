import GlobeTestPremium from './GlobeTestPremium.jsx';

export default function TestGlobe({ streams, mode = 'test' }) {
  return <GlobeTestPremium streams={streams} mode={mode} />;
}
