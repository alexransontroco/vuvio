import { useEffect, useState } from 'react';
import GlobeTest4 from '../components/globe/GlobeTest4.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives, subscribeToCreatedLives } from '../services/createdLiveService.js';
import '../styles/pages/globe-test.css';

export default function GlobeTest4Page() {
  const [createdLives, setCreatedLives] = useState([]);

  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);

  useEffect(() => subscribeToCreatedLives(setCreatedLives), []);

  return <GlobeTest4 streams={[...createdLives, ...mapStreams]} />;
}
