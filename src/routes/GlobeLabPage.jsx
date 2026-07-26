import VuvioGlobeLab from '../components/globe/VuvioGlobeLab.jsx';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives } from '../services/createdLiveService.js';
import '../styles/pages/globe-lab.css';

export default function GlobeLabPage() {
  return <VuvioGlobeLab streams={[...getCreatedLives(), ...mapStreams]} />;
}
