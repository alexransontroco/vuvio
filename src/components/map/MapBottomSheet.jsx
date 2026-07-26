import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { EXPERIENCE_FILTERS } from '../../data/experienceTaxonomy.js';
import { ACTIVITY_CATEGORIES, INITIAL_ACTIVITY_COUNT } from '../../data/activityCategories.js';

export default function MapBottomSheet({
  sheetState,
  onSheetStateChange,
  activeFamily,
  onFamilyChange,
  activeActivities,
  onActivitiesChange,
  activeStatuses,
  onStatusChange,
  streamCounts,
}) {
  const sheetRef = useRef(null);
  const dragRef = useRef({ active: false });
  const [search, setSearch] = useState('');
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);

  const activeFilterCount =
    (activeFamily !== 'all' ? 1 : 0) +
    activeActivities.length +
    (activeStatuses.length === 1 && activeStatuses[0] !== 'live' ? 1 : 0);

  const clearAll = () => {
    onFamilyChange('all');
    onActivitiesChange([]);
    onStatusChange(['live']);
    setExpandedCategory(null);
  };

  const toggleActivity = (id) => {
    onActivitiesChange(
      activeActivities.includes(id)
        ? activeActivities.filter((a) => a !== id)
        : [...activeActivities, id],
    );
  };

  const handleCategoryCardClick = (id) => {
    const activity = ACTIVITY_CATEGORIES.find((a) => a.id === id);
    if (activity && activity.subcategories.length > 1) {
      setExpandedCategory(expandedCategory === id ? null : id);
    }
    toggleActivity(id);
  };

  const filteredActivities = search
    ? ACTIVITY_CATEGORIES.filter(
        (a) =>
          a.label.toLowerCase().includes(search.toLowerCase()) ||
          a.subcategories.some((s) => s.toLowerCase().includes(search.toLowerCase())),
      )
    : ACTIVITY_CATEGORIES;

  const visibleActivities =
    showAllActivities || search
      ? filteredActivities
      : filteredActivities.slice(0, INITIAL_ACTIVITY_COUNT);

  const summaryText = () => {
    if (activeFilterCount === 0) return `All live · ${streamCounts.total}`;
    const parts = [];
    if (activeFamily !== 'all') {
      const fam = EXPERIENCE_FILTERS.find((f) => f.id === activeFamily);
      if (fam) parts.push(fam.label);
    }
    activeActivities.forEach((id) => {
      const a = ACTIVITY_CATEGORIES.find((cat) => cat.id === id);
      if (a) parts.push(a.label);
    });
    return `${parts.join(' + ')} · ${streamCounts.total}`;
  };

  const handlePointerDown = useCallback(
    (e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const sheet = sheetRef.current;
      if (!sheet) return;
      const rect = sheet.getBoundingClientRect();
      dragRef.current = {
        active: true,
        startY: e.clientY,
        startTop: rect.top,
        startState: sheetState,
      };
    },
    [sheetState],
  );

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const delta = dragRef.current.startY - e.clientY;
    const sheetH = sheet.offsetHeight;
    const currentVisible = window.innerHeight - dragRef.current.startTop;
    const newVisible = Math.max(34, Math.min(sheetH, currentVisible + delta));
    sheet.style.transform = `translateY(${sheetH - newVisible}px)`;
    sheet.style.transition = 'none';
  }, []);

  const handlePointerUp = useCallback(
    (e) => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      const sheet = sheetRef.current;
      if (!sheet) return;
      sheet.style.transform = '';
      sheet.style.transition = '';

      const delta = dragRef.current.startY - e.clientY;
      const screenH = window.innerHeight;
      const currentVisible = screenH - dragRef.current.startTop;
      const newVisible = currentVisible + delta;

      if (delta < -50 || newVisible < screenH * 0.15) {
        onSheetStateChange(dragRef.current.startState === 'expanded' ? 'half' : 'closed');
      } else if (delta > 50 || newVisible > screenH * 0.68) {
        onSheetStateChange(dragRef.current.startState === 'closed' ? 'half' : 'expanded');
      }
    },
    [onSheetStateChange],
  );

  const handleTriggerClick = () => {
    if (dragRef.current.didDrag) return;
    onSheetStateChange(sheetState === 'closed' ? 'half' : 'closed');
  };

  const activeChips = [
    ...(activeFamily !== 'all'
      ? [{ id: `family-${activeFamily}`, label: EXPERIENCE_FILTERS.find((f) => f.id === activeFamily)?.label ?? activeFamily, onRemove: () => onFamilyChange('all') }]
      : []),
    ...activeActivities.map((id) => {
      const a = ACTIVITY_CATEGORIES.find((cat) => cat.id === id);
      return { id, label: a?.label ?? id, color: a?.color, onRemove: () => toggleActivity(id) };
    }),
    ...(activeStatuses.length === 1 && activeStatuses[0] !== 'live'
      ? [{ id: 'upcoming', label: 'Upcoming', onRemove: () => onStatusChange(['live']) }]
      : []),
  ];

  return (
    <div ref={sheetRef} className="map-bottom-sheet" data-state={sheetState}>
      <div
        className="map-sheet-trigger"
        role="button"
        tabIndex={0}
        aria-expanded={sheetState !== 'closed'}
        aria-label="Toggle map filters"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleTriggerClick}
        onKeyDown={(e) => e.key === 'Enter' && handleTriggerClick()}
      >
        <span className="map-sheet-handle" aria-hidden="true" />
        <div className="map-sheet-summary">
          <SlidersHorizontal size={12} strokeWidth={2} />
          <span>{summaryText()}</span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="map-sheet-summary__clear"
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              aria-label="Clear filters"
            >
              <X size={11} strokeWidth={2.5} />
            </button>
          )}
          <span className="map-sheet-summary__chevron" aria-hidden="true">
            {sheetState === 'closed'
              ? <ChevronUp size={14} strokeWidth={2} />
              : <ChevronDown size={14} strokeWidth={2} />}
          </span>
        </div>
      </div>

      <div className="map-sheet-content" aria-hidden={sheetState === 'closed'}>
        <div className="map-sheet-header">
          <h2>Filters</h2>
          <div className="map-sheet-header__right">
            {activeFilterCount > 0 && (
              <button type="button" className="map-sheet-clear-all" onClick={clearAll}>
                {activeFilterCount} active · Clear
              </button>
            )}
            <button
              type="button"
              className="map-sheet-close"
              onClick={() => onSheetStateChange('closed')}
              aria-label="Close filters"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="map-sheet-active-chips" aria-label="Active filters">
            {activeChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className="map-sheet-active-chip"
                style={chip.color ? { '--chip-color': chip.color } : undefined}
                onClick={chip.onRemove}
                aria-label={`Remove ${chip.label} filter`}
              >
                {chip.label}
                <X size={10} strokeWidth={2.5} />
              </button>
            ))}
          </div>
        )}

        {sheetState === 'expanded' && (
          <div className="map-sheet-search">
            <Search size={13} strokeWidth={2} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs or activities"
              type="search"
              aria-label="Search activities"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}

        <section className="map-sheet-section">
          <h3>Environment</h3>
          <div className="map-sheet-env-row" role="group" aria-label="Filter by environment">
            {EXPERIENCE_FILTERS.map((item) => {
              const isAll = item.id === 'all';
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`map-sheet-env-btn${activeFamily === item.id ? ' is-active' : ''}${isAll ? '' : ` is-${item.id}`}`}
                  style={!isAll ? { '--exp-color': item.color } : undefined}
                  onClick={() => onFamilyChange(item.id)}
                  aria-pressed={activeFamily === item.id}
                >
                  {!isAll && <i />}
                  {item.label}
                  <small>{streamCounts.byFamily?.[item.id] ?? 0}</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="map-sheet-section">
          <h3>Jobs &amp; activities</h3>
          <div className="map-sheet-activity-grid" role="group" aria-label="Filter by activity">
            {visibleActivities.map((activity) => {
              const Icon = activity.icon;
              const isActive = activeActivities.includes(activity.id);
              const count = streamCounts.byActivity?.[activity.id] ?? 0;
              const isExpanded = expandedCategory === activity.id;
              return (
                <div key={activity.id} className={`map-sheet-activity-card-wrap${isExpanded ? ' is-expanded' : ''}`}>
                  <button
                    type="button"
                    className={`map-sheet-activity-card${isActive ? ' is-active' : ''}`}
                    style={{ '--card-color': activity.color }}
                    onClick={() => handleCategoryCardClick(activity.id)}
                    aria-pressed={isActive}
                  >
                    <span className="map-sheet-activity-card__icon">
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="map-sheet-activity-card__label">{activity.label}</span>
                    {count > 0 && <span className="map-sheet-activity-card__count">{count}</span>}
                  </button>
                  {isActive && activity.subcategories.length > 1 && (
                    <div className="map-sheet-subcategory-chips">
                      {activity.subcategories.map((sub) => (
                        <span key={sub} className="map-sheet-subcategory-chip">{sub}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!search && filteredActivities.length > INITIAL_ACTIVITY_COUNT && (
            <button
              type="button"
              className="map-sheet-view-all"
              onClick={() => setShowAllActivities((v) => !v)}
            >
              {showAllActivities
                ? 'Show less'
                : `View all · ${filteredActivities.length}`}
            </button>
          )}
          {search && filteredActivities.length === 0 && (
            <p className="map-sheet-empty">No results for "{search}"</p>
          )}
        </section>

        <section className="map-sheet-section">
          <h3>Live status</h3>
          <div className="map-sheet-env-row" role="group" aria-label="Filter by status">
            {[
              { id: 'live', label: 'Live now' },
              { id: 'upcoming', label: 'Upcoming' },
            ].map((opt) => {
              const isActive = activeStatuses.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`map-sheet-env-btn${isActive ? ' is-active' : ''}`}
                  onClick={() => {
                    const next = isActive
                      ? activeStatuses.filter((s) => s !== opt.id)
                      : [...activeStatuses, opt.id];
                    if (next.length) onStatusChange(next);
                  }}
                  aria-pressed={isActive}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
