import TestGlobe from '../components/globe/TestGlobe.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives } from '../services/createdLiveService.js';
import '../styles/pages/globe-test.css';

export default function GlobeTestPage({ mode = 'test' }) {
  return <TestGlobe mode={mode} streams={[...getCreatedLives(), ...mapStreams]} />;
}
