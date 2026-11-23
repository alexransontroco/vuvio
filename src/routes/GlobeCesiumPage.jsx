import { useEffect, useState } from 'react';
import CesiumGlobe from '../components/globe/CesiumGlobe.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives } from '../services/createdLiveService.js';

export default function GlobeCesiumPage() {
  const [createdLives, setCreatedLives] = useState([]);

  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);

  return <CesiumGlobe streams={[...createdLives, ...mapStreams]} />;
}
