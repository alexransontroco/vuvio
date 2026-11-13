import { useEffect, useState } from 'react';
import GlobeTest3 from '../components/globe/GlobeTest3.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives, subscribeToCreatedLives } from '../services/createdLiveService.js';
import '../styles/pages/globe-test.css';

export default function GlobeTest3Page() {
  const [createdLives, setCreatedLives] = useState([]);

  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);

  useEffect(() => subscribeToCreatedLives(setCreatedLives), []);

  return <GlobeTest3 streams={[...createdLives, ...mapStreams]} />;
}
