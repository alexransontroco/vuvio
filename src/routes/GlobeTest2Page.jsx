import { useEffect, useState } from 'react';
import GlobeTest2 from '../components/globe/GlobeTest2.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives } from '../services/createdLiveService.js';
import '../styles/pages/globe-lab.css';
import '../styles/pages/globe-test.css';

export default function GlobeTest2Page() {
  const [createdLives, setCreatedLives] = useState([]);

  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);

  return <GlobeTest2 streams={[...createdLives, ...mapStreams]} />;
}
