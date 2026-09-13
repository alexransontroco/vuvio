import { useEffect, useState } from 'react';
import CurrentGlobe from '../components/globe/CurrentGlobe.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives, subscribeToCreatedLives } from '../services/createdLiveService.js';
import '../styles/pages/globe-test.css';

export default function CurrentGlobePage() {
  const [createdLives, setCreatedLives] = useState([]);

  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);

  useEffect(() => subscribeToCreatedLives(setCreatedLives), []);

  return <CurrentGlobe streams={[...createdLives, ...mapStreams]} />;
}
