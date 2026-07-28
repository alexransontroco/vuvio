import { useEffect, useState } from 'react';
import VuvioGlobeLab from '../components/globe/VuvioGlobeLab.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives } from '../services/createdLiveService.js';
import '../styles/pages/globe-lab.css';

export default function GlobeLabPage() {
  const [createdLives, setCreatedLives] = useState([]);

  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);

  return <VuvioGlobeLab streams={[...createdLives, ...mapStreams]} />;
}
