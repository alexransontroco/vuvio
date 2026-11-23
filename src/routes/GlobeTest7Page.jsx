import { useEffect, useState } from 'react';
import GlobeTest7 from '../components/globe/GlobeTest7.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives, subscribeToCreatedLives } from '../services/createdLiveService.js';
import '../styles/pages/globe-test.css';

export default function GlobeTest7Page() {
  const [createdLives, setCreatedLives] = useState([]);

  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);

  useEffect(() => subscribeToCreatedLives(setCreatedLives), []);

  return <GlobeTest7 streams={[...createdLives, ...mapStreams]} variant="maplibre-test-7" />;
}
