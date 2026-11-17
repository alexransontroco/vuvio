import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ZoomIn, ZoomOut, Home } from 'lucide-react';
import { APP_MAP_DATA } from '../data/appMapStructure.js';
import '../styles/pages/admin-app-map.css';

export default function AdminAppMapPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredPage, setHoveredPage] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const svgRef = useRef(null);
  const panStartRef = useRef(null);

  // Filtered pages based on search + group
  const filteredPages = useMemo(() => {
    return APP_MAP_DATA.pages.filter((page) => {
      const matchSearch =
        search === '' ||
        page.label.toLowerCase().includes(search.toLowerCase()) ||
        page.path.toLowerCase().includes(search.toLowerCase()) ||
        page.description.toLowerCase().includes(search.toLowerCase());
      const matchGroup = selectedGroup === null || page.group === selectedGroup;
      return matchSearch && matchGroup;
    });
  }, [search, selectedGroup]);

  const filteredPageIds = new Set(filteredPages.map((p) => p.id));
  const filteredEdges = useMemo(
    () =>
      APP_MAP_DATA.edges.filter(
        (e) => filteredPageIds.has(e.from) && filteredPageIds.has(e.to),
      ),
    [filteredPageIds],
  );

  // Zoom controls
  const handleZoom = (direction) => {
    const newScale = direction === 'in' ? scale * 1.2 : scale / 1.2;
    setScale(Math.max(0.5, Math.min(newScale, 3)));
  };

  // Pan on mouse drag
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!panStartRef.current) return;
    setPan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    panStartRef.current = null;
  };

  const handleRecenter = () => {
    setScale(0.8);
    setPan({ x: 100, y: 100 });
  };

  // Navigate to page
  const handleNavigate = (path) => {
    navigate(path);
  };

  // Bounds calculation for paths
  const computedPages = filteredPages.map((page) => ({
    ...page,
    x: page.x + pan.x,
    y: page.y + pan.y,
    r: 40 * scale,
  }));

  return (
    <div className="admin-app-map">
      <div className="admin-app-map__header">
        <h1 className="admin-app-map__title">Vuvio App Architecture Map</h1>
        <div className="admin-app-map__toolbar">
          <div className="admin-app-map__search-box">
            <Search className="admin-app-map__search-icon" size={16} />
            <input
              type="text"
              className="admin-app-map__search-input"
              placeholder="Search pages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="admin-app-map__controls">
            <button
              className="admin-app-map__btn"
              onClick={() => handleZoom('out')}
              title="Zoom out"
            >
              <ZoomOut size={18} />
            </button>
            <span className="admin-app-map__zoom-level">{(scale * 100).toFixed(0)}%</span>
            <button
              className="admin-app-map__btn"
              onClick={() => handleZoom('in')}
              title="Zoom in"
            >
              <ZoomIn size={18} />
            </button>
            <button
              className="admin-app-map__btn"
              onClick={handleRecenter}
              title="Recenter"
            >
              <Home size={18} />
            </button>
          </div>
        </div>

        <div className="admin-app-map__filters">
          <button
            className={`admin-app-map__filter-btn ${selectedGroup === null ? 'active' : ''}`}
            onClick={() => setSelectedGroup(null)}
          >
            All ({filteredPages.length})
          </button>
          {Object.entries(APP_MAP_DATA.groups).map(([key, group]) => (
            <button
              key={key}
              className={`admin-app-map__filter-btn ${selectedGroup === key ? 'active' : ''}`}
              style={
                selectedGroup === key
                  ? { backgroundColor: group.color, color: '#fff' }
                  : {}
              }
              onClick={() => setSelectedGroup(selectedGroup === key ? null : key)}
            >
              {group.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="admin-app-map__canvas-container"
        ref={svgRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg className="admin-app-map__svg" width="100%" height="100%">
          <defs>
            <marker
              id="arrow"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#94A3B8" />
            </marker>
          </defs>

          {/* Edges */}
          {filteredEdges.map((edge, idx) => {
            const from = filteredPages.find((p) => p.id === edge.from);
            const to = filteredPages.find((p) => p.id === edge.to);
            if (!from || !to) return null;

            const x1 = from.x + pan.x;
            const y1 = from.y + pan.y;
            const x2 = to.x + pan.x;
            const y2 = to.y + pan.y;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const r = 40 * scale;

            const startX = x1 + (dx / dist) * r;
            const startY = y1 + (dy / dist) * r;
            const endX = x2 - (dx / dist) * r;
            const endY = y2 - (dy / dist) * r;

            return (
              <g key={`edge-${idx}`}>
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  className="admin-app-map__edge"
                  markerEnd="url(#arrow)"
                />
                {edge.label && (
                  <text
                    x={(startX + endX) / 2}
                    y={(startY + endY) / 2 - 5}
                    className="admin-app-map__edge-label"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {computedPages.map((page) => {
            const group = APP_MAP_DATA.groups[page.group];
            const isHovered = hoveredPage === page.id;
            const r = 40 * scale;

            return (
              <g
                key={page.id}
                className={`admin-app-map__node ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredPage(page.id)}
                onMouseLeave={() => setHoveredPage(null)}
              >
                {/* Circle background */}
                <circle
                  cx={page.x + pan.x}
                  cy={page.y + pan.y}
                  r={r}
                  fill={isHovered ? group.color : '#1F2937'}
                  stroke={group.color}
                  strokeWidth={2}
                  className="admin-app-map__node-circle"
                  onClick={() => handleNavigate(page.path)}
                  style={{ cursor: 'pointer' }}
                />

                {/* Label */}
                <text
                  x={page.x + pan.x}
                  y={page.y + pan.y - 5}
                  textAnchor="middle"
                  className={`admin-app-map__node-label ${isHovered ? 'hovered' : ''}`}
                  onClick={() => handleNavigate(page.path)}
                  style={{ cursor: 'pointer' }}
                >
                  {page.label}
                </text>

                {/* Badge */}
                {page.badge && (
                  <text
                    x={page.x + pan.x}
                    y={page.y + pan.y + 15}
                    textAnchor="middle"
                    className="admin-app-map__node-badge"
                  >
                    {page.badge}
                  </text>
                )}

                {/* Tooltip on hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={page.x + pan.x + r + 10}
                      y={page.y + pan.y - 50}
                      width={220}
                      height={100}
                      fill="#000"
                      stroke={group.color}
                      strokeWidth={1}
                      rx={4}
                      className="admin-app-map__tooltip-bg"
                    />
                    <text
                      x={page.x + pan.x + r + 15}
                      y={page.y + pan.y - 35}
                      className="admin-app-map__tooltip-title"
                    >
                      {page.label}
                    </text>
                    <text
                      x={page.x + pan.x + r + 15}
                      y={page.y + pan.y - 20}
                      className="admin-app-map__tooltip-path"
                    >
                      {page.path}
                    </text>
                    <text
                      x={page.x + pan.x + r + 15}
                      y={page.y + pan.y}
                      className="admin-app-map__tooltip-desc"
                    >
                      {page.description}
                    </text>
                    <text
                      x={page.x + pan.x + r + 15}
                      y={page.y + pan.y + 20}
                      className="admin-app-map__tooltip-access"
                    >
                      {page.access}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="admin-app-map__legend">
        <div className="admin-app-map__legend-title">Legend</div>
        <div className="admin-app-map__legend-items">
          {Object.entries(APP_MAP_DATA.groups).map(([key, group]) => (
            <div key={key} className="admin-app-map__legend-item">
              <div
                className="admin-app-map__legend-color"
                style={{ backgroundColor: group.color }}
              />
              <span>{group.label}</span>
            </div>
          ))}
        </div>
        <div className="admin-app-map__legend-badges">
          <div className="admin-app-map__legend-badge">
            <span className="badge">prod</span> Production
          </div>
          <div className="admin-app-map__legend-badge">
            <span className="badge">prototype</span> Prototype
          </div>
          <div className="admin-app-map__legend-badge">
            <span className="badge">test</span> Test/Experimental
          </div>
          <div className="admin-app-map__legend-badge">
            <span className="badge">entry</span> Entry Point
          </div>
        </div>
      </div>
    </div>
  );
}
