import { useEffect, useState } from 'react';
import GlobeCinematic from '../components/globe/GlobeCinematic.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives, subscribeToCreatedLives } from '../services/createdLiveService.js';
import '../styles/pages/globe-lab.css';
import '../styles/pages/globe-test.css';

export default function GlobeCinematicPage() {
  const [createdLives, setCreatedLives] = useState([]);

  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);

  useEffect(() => subscribeToCreatedLives(setCreatedLives), []);

  return <GlobeCinematic streams={[...createdLives, ...mapStreams]} />;
}
