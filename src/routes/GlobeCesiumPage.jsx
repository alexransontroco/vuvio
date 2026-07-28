import CesiumGlobe from '../components/globe/CesiumGlobe.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives } from '../services/createdLiveService.js';

export default function GlobeCesiumPage() {
  return <CesiumGlobe streams={[...getCreatedLives(), ...mapStreams]} />;
}
