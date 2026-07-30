import { Activity, Box, Eye, HeartPulse, Play, Radio, RefreshCcw, Search, Square } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  attachGearToStream,
  createStream,
  endStream,
  getGlobeStreams,
  getLiveStreams,
  getStreamApiBase,
  getStream,
  getStreamGear,
  sendStreamHeartbeat,
  startStream,
  trackStreamEvent,
} from '../services/streamApi.ts';

const initialDraft = {
  title: 'Baker morning prep',
  description: 'Testing the Vuvio backend stream lifecycle.',
  category: 'Food',
  subcategories: 'Baking, Craft',
  environment: 'urban',
  visibility: 'public',
  city: 'Paris',
  countryCode: 'FR',
  latitude: '48.8566',
  longitude: '2.3522',
  languages: 'en, fr',
  gearIds: '',
};

function JsonBlock({ value }) {
  return <pre className="internal-stream-admin__json">{JSON.stringify(value, null, 2)}</pre>;
}

export default function InternalStreamAdminPage() {
  const { user, authLoading } = useAuth();
  const [draft, setDraft] = useState(initialDraft);
  const [streamId, setStreamId] = useState('');
  const [viewerCount, setViewerCount] = useState('3');
  const [eventType, setEventType] = useState('stream_impression');
  const [loading, setLoading] = useState('');
  const [log, setLog] = useState([]);
  const [appState, setAppState] = useState(null);

  const payload = useMemo(() => ({
    title: draft.title,
    description: draft.description,
    category: draft.category,
    subcategories: draft.subcategories.split(',').map((item) => item.trim()).filter(Boolean),
    environment: draft.environment,
    visibility: draft.visibility,
    city: draft.city,
    countryCode: draft.countryCode,
    approximateLocation: {
      latitude: Number(draft.latitude),
      longitude: Number(draft.longitude),
    },
    languages: draft.languages.split(',').map((item) => item.trim()).filter(Boolean),
    gearIds: draft.gearIds.split(',').map((item) => item.trim()).filter(Boolean),
  }), [draft]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const pushLog = (label, value, isError = false) => {
    setLog((current) => [{ id: `${Date.now()}-${label}`, label, value, isError }, ...current].slice(0, 12));
  };

  const run = async (label, fn) => {
    setLoading(label);
    try {
      const result = await fn();
      pushLog(label, result);
      return result;
    } catch (error) {
      pushLog(label, { code: error.code, status: error.status, message: error.message }, true);
      return null;
    } finally {
      setLoading('');
    }
  };

  const create = async () => {
    const result = await run('createStream', () => createStream(payload));
    if (result?.stream?.id) setStreamId(result.stream.id);
  };

  const refreshAppState = async () => {
    await run('refreshAppState', async () => {
      const [selectedStream, liveStreams, globeStreams] = await Promise.all([
        streamId ? getStream(streamId).catch((error) => ({ error: error.message })) : Promise.resolve(null),
        getLiveStreams({ limit: 10 }),
        getGlobeStreams(),
      ]);
      const nextState = {
        refreshedAt: new Date().toISOString(),
        currentUser: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        },
        apiBase: getStreamApiBase(),
        selectedStreamId: streamId || null,
        selectedStream,
        liveStreams,
        globeStreams,
      };
      setAppState(nextState);
      return nextState;
    });
  };

  return (
    <section className="screen-scroll internal-stream-admin" aria-label="Internal stream admin">
      <header className="internal-stream-admin__header">
        <div>
          <p>Internal</p>
          <h1>Stream lifecycle admin</h1>
        </div>
        <button type="button" onClick={() => setLog([])}>
          <RefreshCcw size={16} strokeWidth={1.9} />
          Clear
        </button>
      </header>

      <section className="internal-stream-admin__panel">
        <h2>Create stream</h2>
        <div className="internal-stream-admin__grid">
          {Object.keys(initialDraft).map((key) => (
            <label key={key}>
              <span>{key}</span>
              <input value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
            </label>
          ))}
        </div>
        <JsonBlock value={payload} />
        <button type="button" className="internal-stream-admin__primary" onClick={create} disabled={loading === 'createStream'}>
          <Radio size={17} strokeWidth={1.9} />
          Create stream
        </button>
      </section>

      <section className="internal-stream-admin__panel">
        <h2>Operate stream</h2>
        <label>
          <span>streamId</span>
          <input value={streamId} onChange={(event) => setStreamId(event.target.value)} placeholder="streams document id" />
        </label>
        <div className="internal-stream-admin__actions">
          <button type="button" onClick={() => run('startStream', () => startStream(streamId))} disabled={!streamId || Boolean(loading)}>
            <Play size={16} /> Start
          </button>
          <button type="button" onClick={() => run('heartbeat', () => sendStreamHeartbeat(streamId, { networkStatus: 'good', viewerCount: Number(viewerCount) }))} disabled={!streamId || Boolean(loading)}>
            <HeartPulse size={16} /> Heartbeat
          </button>
          <button type="button" onClick={() => run('endStream', () => endStream(streamId))} disabled={!streamId || Boolean(loading)}>
            <Square size={14} fill="currentColor" /> End
          </button>
          <button type="button" onClick={() => run('getStream', () => getStream(streamId))} disabled={!streamId || Boolean(loading)}>
            <Search size={16} /> Read
          </button>
        </div>
        <label>
          <span>viewerCount for heartbeat</span>
          <input value={viewerCount} onChange={(event) => setViewerCount(event.target.value)} />
        </label>
      </section>

      <section className="internal-stream-admin__panel">
        <h2>Gear and analytics</h2>
        <div className="internal-stream-admin__actions">
          <button type="button" onClick={() => run('attachGear', () => attachGearToStream(streamId, payload.gearIds))} disabled={!streamId || Boolean(loading)}>
            <Box size={16} /> Attach gear
          </button>
          <button type="button" onClick={() => run('getGear', () => getStreamGear(streamId))} disabled={!streamId || Boolean(loading)}>
            <Box size={16} /> Read gear
          </button>
        </div>
        <label>
          <span>event type</span>
          <input value={eventType} onChange={(event) => setEventType(event.target.value)} />
        </label>
        <button type="button" className="internal-stream-admin__primary" onClick={() => run('trackEvent', () => trackStreamEvent(streamId, { type: eventType, source: 'direct', eventId: `${eventType}-${Date.now()}`, anonymousSessionId: 'internal-test' }))} disabled={!streamId || Boolean(loading)}>
          <Activity size={17} strokeWidth={1.9} />
          Track event
        </button>
      </section>

      <section className="internal-stream-admin__panel">
        <h2>Public reads</h2>
        <div className="internal-stream-admin__actions">
          <button type="button" onClick={() => run('getLiveStreams', () => getLiveStreams({ limit: 10 }))} disabled={Boolean(loading)}>Live list</button>
          <button type="button" onClick={() => run('getGlobeStreams', () => getGlobeStreams())} disabled={Boolean(loading)}>Globe list</button>
        </div>
      </section>

      <section className="internal-stream-admin__panel">
        <h2>App state</h2>
        <p className="internal-stream-admin__note">
          Text view for the current backend state: signed-in user, selected stream, live feed and globe feed.
        </p>
        <button type="button" className="internal-stream-admin__primary" onClick={refreshAppState} disabled={Boolean(loading)}>
          <Eye size={17} strokeWidth={1.9} />
          Refresh app state
        </button>
        {appState ? <JsonBlock value={appState} /> : null}
      </section>

      <section className="internal-stream-admin__panel">
        <h2>Operation log</h2>
        {loading ? <p className="internal-stream-admin__loading">Running {loading}...</p> : null}
        {log.map((item) => (
          <article key={item.id} className={item.isError ? 'internal-stream-admin__log is-error' : 'internal-stream-admin__log'}>
            <strong>{item.label}</strong>
            <JsonBlock value={item.value} />
          </article>
        ))}
      </section>
    </section>
  );
}
