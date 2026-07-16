import { Bell, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LiveMap from '../components/map/LiveMap.jsx';
import { mapStreams } from '../data/mapStreams.js';

const filters = [
  { value: 'live', label: 'En direct' },
  { value: 'upcoming', label: 'À venir' },
];

export default function MapPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedLiveId = searchParams.get('live');
  const [activeStatuses, setActiveStatuses] = useState(['live']);
  const [selectedId, setSelectedId] = useState(() => {
    const requested = mapStreams.find((stream) => stream.id === requestedLiveId && stream.status === 'live');
    return requested?.id ?? null;
  });
  const [resetSignal, setResetSignal] = useState(0);
  const [notifications, setNotifications] = useState({ 'surgeon-simulation': true });

  const visibleStreams = useMemo(() => {
    return mapStreams.filter((stream) => activeStatuses.includes(stream.status));
  }, [activeStatuses]);

  const selected = mapStreams.find((stream) => stream.id === selectedId && activeStatuses.includes(stream.status)) ?? null;

  useEffect(() => {
    const requested = mapStreams.find((stream) => stream.id === requestedLiveId && stream.status === 'live');
    if (!requested) return;
    setActiveStatuses((current) => (current.includes('live') ? current : [...current, 'live']));
    setSelectedId(requested.id);
  }, [requestedLiveId]);

  useEffect(() => {
    if (selectedId && !selected) {
      setSelectedId(null);
    }
  }, [selected, selectedId]);

  const selectStream = (id) => {
    setSelectedId(id);
  };

  const toggleStatus = (nextStatus) => {
    setActiveStatuses((current) => {
      if (current.includes(nextStatus)) {
        return current.filter((status) => status !== nextStatus);
      }

      return [...current, nextStatus];
    });
  };

  return (
    <section className="screen map-screen" aria-label="Carte des lives VuVio">
      <LiveMap
        streams={mapStreams}
        activeStatuses={activeStatuses}
        selectedId={selectedId}
        onSelect={selectStream}
        resetSignal={resetSignal}
      />

      <div className="map-filter-bar" role="group" aria-label="Filtrer les lives">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`${activeStatuses.includes(item.value) ? 'is-active' : ''} is-${item.value}`}
            onClick={() => toggleStatus(item.value)}
            aria-pressed={activeStatuses.includes(item.value)}
          >
            <i />
            {item.label}
          </button>
        ))}
      </div>

      {selected ? (
        <aside className="map-bottom-panel" aria-label={selected.status === 'upcoming' ? selected.title : `Live de ${selected.name}`}>
          <button
            type="button"
            className="map-bottom-panel__close"
            onClick={() => {
              setSelectedId(null);
              setResetSignal((value) => value + 1);
            }}
            aria-label="Fermer le live sélectionné"
          >
            <X size={16} strokeWidth={2} />
          </button>
          <div className="map-bottom-panel__image">
            <img src={selected.image} alt={`${selected.job} POV`} />
          </div>
          <div className="map-bottom-panel__content">
            <div>
              <h2>{selected.status === 'upcoming' ? selected.title : selected.name}</h2>
              <p>
                {selected.status === 'upcoming'
                  ? selected.who
                  : `${selected.job} - ${selected.city}, ${selected.country}`}
              </p>
              {selected.status === 'upcoming' ? (
                <time className="map-bottom-panel__time">
                  <small>{selected.day}</small>
                  {selected.time}
                </time>
              ) : (
                <span>{selected.viewers} spectateurs</span>
              )}
            </div>
            {selected.status === 'upcoming' ? (
              <button
                type="button"
                className={notifications[selected.id] ? 'map-notify-button is-active' : 'map-notify-button'}
                onClick={() => setNotifications((state) => ({ ...state, [selected.id]: !state[selected.id] }))}
                aria-label={notifications[selected.id] ? 'Notification active' : 'Activer la notification'}
              >
                <Bell size={17} strokeWidth={1.9} />
                {notifications[selected.id] ? 'Notifié' : 'Me prévenir'}
              </button>
            ) : (
              <button type="button" onClick={() => navigate(`/live?live=${selected.id}`)}>
                Regarder
              </button>
            )}
          </div>
        </aside>
      ) : null}
    </section>
  );
}
