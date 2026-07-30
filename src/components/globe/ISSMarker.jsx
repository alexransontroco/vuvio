import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

export function ISSMarker({ map, onISSClick, currentZoom = 1 }) {
  const issMarkerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const setupISS = () => {
      try {
        // Create ISS marker DOM element
        const el = document.createElement('div');
        el.className = 'iss-marker-container';
        el.style.cssText = 'cursor: pointer; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;';
        el.innerHTML = `
          <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(0 0 8px rgba(43, 217, 200, 0.4));">
            <rect x="8" y="22" width="3" height="16" fill="#4B5563" opacity="0.8"/>
            <rect x="5" y="20" width="10" height="2" fill="#3B4252" opacity="0.9"/>
            <rect x="5" y="38" width="10" height="2" fill="#3B4252" opacity="0.9"/>
            <rect x="49" y="22" width="3" height="16" fill="#4B5563" opacity="0.8"/>
            <rect x="45" y="20" width="10" height="2" fill="#3B4252" opacity="0.9"/>
            <rect x="45" y="38" width="10" height="2" fill="#3B4252" opacity="0.9"/>
            <rect x="22" y="18" width="16" height="24" rx="2" fill="#2A3F5F" stroke="#4B5F7F" stroke-width="0.5"/>
            <rect x="28" y="10" width="4" height="40" fill="#1F2D3D" opacity="0.7"/>
            <circle cx="28" cy="26" r="1.5" fill="#2BD9C8" opacity="0.8"/>
            <circle cx="32" cy="26" r="1.5" fill="#2BD9C8" opacity="0.8"/>
            <circle cx="28" cy="34" r="1.5" fill="#6B8FC7" opacity="0.6"/>
            <circle cx="32" cy="34" r="1.5" fill="#6B8FC7" opacity="0.6"/>
          </svg>
        `;

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' });
        // Place ISS at the north pole
        marker.setLngLat([0, 85]);
        marker.addTo(map);
        issMarkerRef.current = marker;
        containerRef.current = el;

        el.addEventListener('click', onISSClick);
      } catch (err) {
        console.error('[ISS] Setup failed:', err);
      }
    };

    if (map.isStyleLoaded()) {
      setupISS();
    } else {
      map.once('load', setupISS);
    }

    return () => {
      if (issMarkerRef.current) {
        issMarkerRef.current.remove();
      }
      if (containerRef.current) {
        containerRef.current.removeEventListener('click', onISSClick);
      }
    };
  }, [map, onISSClick]);

  // Hide/show based on zoom
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.style.opacity = currentZoom > 3.5 ? '0' : '1';
    containerRef.current.style.pointerEvents = currentZoom > 3.5 ? 'none' : 'auto';
  }, [currentZoom]);

  return null;
}
