import { useEffect, useState } from 'react';
import TestGlobe from '../components/globe/TestGlobe.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives } from '../services/createdLiveService.js';
import '../styles/pages/globe-test.css';

export default function GlobeTestPage({ mode = 'test' }) {
  const [createdLives, setCreatedLives] = useState([]);

  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);

  return <TestGlobe mode={mode} streams={[...createdLives, ...mapStreams]} />;
}
