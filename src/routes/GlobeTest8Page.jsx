import { useEffect, useState } from 'react';
import GlobeTest8 from '../components/globe/GlobeTest8.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives, subscribeToCreatedLives } from '../services/createdLiveService.js';
import '../styles/pages/globe-test.css';

export default function GlobeTest8Page() {
  const [createdLives, setCreatedLives] = useState([]);

  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);

  useEffect(() => subscribeToCreatedLives(setCreatedLives), []);

  return <GlobeTest8 streams={[...createdLives, ...mapStreams]} />;
}
