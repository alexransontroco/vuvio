import { useEffect, useState } from 'react';
import CurrentGlobe from '../components/globe/CurrentGlobe.jsx';
import GlobeMarkerLegend from '../components/globe/GlobeMarkerLegend.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { decorateGlobeTest3Streams } from '../data/globeTest3Data.js';
import { getCreatedLives, subscribeToCreatedLives } from '../services/createdLiveService.js';
import '../styles/pages/globe-lab.css';
import '../styles/pages/globe-test.css';

export default function GlobeTest3Page() {
  const [createdLives, setCreatedLives] = useState([]);

  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);

  useEffect(() => subscribeToCreatedLives(setCreatedLives), []);

  const userContext = {
    center: [0, 0],
    interests: [],
  };

  const streams = decorateGlobeTest3Streams([...createdLives, ...mapStreams], userContext);

  return (
    <>
      <CurrentGlobe streams={streams} variant="test3" />
      <GlobeMarkerLegend />
    </>
  );
}
