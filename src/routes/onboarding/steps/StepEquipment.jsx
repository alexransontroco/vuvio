import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import SearchBar from '../components/SearchBar.jsx';
import EquipmentSuggestionCard from '../components/EquipmentSuggestionCard.jsx';
import MyEquipmentStrip from '../components/MyEquipmentStrip.jsx';
import InlineManualGearForm from '../components/InlineManualGearForm.jsx';
import { UNIVERSAL_TABS, matchesUniversalTab } from '../data/universalEquipmentTabs.js';
import { getSuggestions } from '../data/gearSuggestions.js';
import { inferEquipmentVisualCategory } from '../data/equipmentIcons.js';
import { searchLocalProducts, searchProducts } from '../../../services/productSearchService.js';
import EquipmentVisual from '../../../components/equipment/EquipmentVisual.jsx';
import { persistentEquipmentImage } from '../../../data/equipmentVisual.js';

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function StepEquipment({ draft, addEquipment, removeEquipment, hasEquipment }) {
  const { t } = useTranslation();
  const [activityTab, setActivityTab] = useState('all');
  const [universalTab, setUniversalTab] = useState('all');
  const [manualOpen, setManualOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [inventoryFilter, setInventoryFilter] = useState('all');
  const abortRef = useRef(null);

  const activeActivities = useMemo(() => {
    if (activityTab === 'all') return draft.activities;
    return [activityTab];
  }, [activityTab, draft.activities]);

  // Priority 1: activity-matched suggestions. No match → no fake fallback.
  const suggestions = useMemo(() => {
    const raw = getSuggestions(activeActivities);
    if (universalTab === 'all') return raw;
    return raw.filter((s) => matchesUniversalTab(s, universalTab));
  }, [activeActivities, universalTab]);

  const inventoryCategories = useMemo(() => [...new Set([
    ...draft.selectedEquipment.map(inferEquipmentVisualCategory),
    ...draft.selectedEquipment.map((item) => item.associatedActivity).filter(Boolean),
  ])], [draft.selectedEquipment]);
  const visibleInventory = useMemo(() => draft.selectedEquipment.filter((item) =>
    inventoryFilter === 'all' || inferEquipmentVisualCategory(item) === inventoryFilter || item.associatedActivity === inventoryFilter
  ), [draft.selectedEquipment, inventoryFilter]);

  useEffect(() => {
    if (inventoryFilter !== 'all' && !inventoryCategories.includes(inventoryFilter)) setInventoryFilter('all');
  }, [inventoryCategories, inventoryFilter]);

  // Debounced universal product search.
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const local = searchLocalProducts(query, { limit: 10 });
    setSearchResults(local);
    setSearchError(false);
    if (query.trim().length < 3) {
      setSearching(false);
      return () => controller.abort();
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchProducts(query, { signal: controller.signal, limit: 10 });
        if (!controller.signal.aborted) setSearchResults(results);
      } catch {
        if (!controller.signal.aborted) { setSearchResults(local); setSearchError(true); }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const addFromProduct = (p) => {
    const already = hasEquipment(p.brand, p.name || p.model);
    if (already) return;
    setInventoryFilter('all');
    addEquipment({
      brand: p.brand || '',
      model: p.name || p.model || '',
      displayName: `${p.brand || ''} ${p.name || p.model || ''}`.trim(),
      category: p.category || 'activity',
      equipmentType: p.equipmentType || p.subcategory || p.type || 'Equipment',
      visualCategory: inferEquipmentVisualCategory(p),
      productId: p.id,
      sourceProductId: p.externalId || null,
      provider: p.provider || 'product-catalog',
      identificationStatus: 'identified',
      enrichmentStatus: p.provider === 'icecat' || p.enrichedBy === 'icecat' ? 'provider-data' : 'none',
      ...persistentEquipmentImage(p),
      associatedActivity: activityTab !== 'all' ? activityTab : null,
    });
    setQuery('');
  };

  const addFromSuggestion = (s) => {
    if (hasEquipment(s.brand, s.model)) return;
    setInventoryFilter('all');
    addEquipment({
      brand: s.brand,
      model: s.model,
      displayName: `${s.brand} ${s.model}`.trim(),
      category: s.category,
      equipmentType: s.equipmentType,
      visualCategory: inferEquipmentVisualCategory(s),
      associatedActivity: activityTab !== 'all' ? activityTab : s.activities?.find((activity) => draft.activities.includes(activity)) || null,
      provider: 'user',
      identificationStatus: 'manual',
    });
  };

  const toggleFromSuggestion = (s) => {
    if (hasEquipment(s.brand, s.model)) {
      const existing = draft.selectedEquipment.find(
        (e) => normalize(e.brand) === normalize(s.brand) && normalize(e.model) === normalize(s.model),
      );
      if (existing) removeEquipment(existing.id);
      return;
    }
    addFromSuggestion(s);
  };

  const handleManualSubmit = (payload) => {
    setInventoryFilter('all');
    addEquipment(payload);
    setManualOpen(false);
  };

  const showEmptySuggestions = suggestions.length === 0 && !query.trim();

  return (
    <div className="ob-step">
      <header className="ob-step__header">
        <p className="ob-step__eyebrow">{t('onboarding.stepLabel', { n: 3 })}</p>
        <h2 className="ob-step__title">{t('onboarding.equipment.title')}</h2>
        <p className="ob-step__sub">{t('onboarding.equipment.subtitle')}</p>
      </header>

      {draft.activities.length >= 2 && (
        <div className="ob-eq-tabs" role="tablist" aria-label={t('onboarding.equipment.activitiesTabsLabel')}>
          <button
            type="button"
            role="tab"
            aria-selected={activityTab === 'all'}
            className={`ob-eq-tab${activityTab === 'all' ? ' is-active' : ''}`}
            onClick={() => { setActivityTab('all'); setUniversalTab('all'); }}
          >
            {t('onboarding.equipment.tabAll')}
          </button>
          {draft.activities.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={activityTab === name}
              className={`ob-eq-tab${activityTab === name ? ' is-active' : ''}`}
              onClick={() => { setActivityTab(name); setUniversalTab('all'); }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder={t('onboarding.equipment.searchPlaceholder')}
      />

      {query.trim() && (
        <div className="ob-eq-search-results" role="listbox" aria-label={t('onboarding.equipment.searchResultsLabel')}>
          {searching && searchResults.length === 0 && (
            <p className="ob-step__empty">{t('common.loading')}</p>
          )}
          {!searching && searchResults.length === 0 && (
            <p className="ob-step__empty">{t('onboarding.equipment.searchEmpty')}</p>
          )}
          {searchError && <p className="ob-step__empty" role="status">{t('onboarding.equipment.searchUnavailable')}</p>}
          {searchResults.map((p) => {
            const added = hasEquipment(p.brand, p.name || p.model);
            return (
              <button
                key={p.id}
                type="button"
                className={`ob-eq-result${added ? ' is-added' : ''}`}
                onClick={() => addFromProduct(p)}
                role="option"
                aria-selected={added}
              >
                <div className="ob-eq-result__icon" aria-hidden="true">
                  <EquipmentVisual equipment={p} size={20} usage="search-preview" />
                </div>
                <div className="ob-eq-result__body">
                  {p.brand ? <p className="ob-eq-result__brand">{p.brand}</p> : null}
                  <p className="ob-eq-result__name">{p.name || p.model}</p>
                </div>
                <span className="ob-eq-result__add" aria-hidden="true">
                  <Plus size={16} strokeWidth={2.5} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="ob-eq-univ-tabs" role="tablist" aria-label={t('onboarding.equipment.categoriesTabsLabel')}>
        <button
          type="button"
          role="tab"
          aria-selected={universalTab === 'all'}
          className={`ob-eq-univ-tab${universalTab === 'all' ? ' is-active' : ''}`}
          onClick={() => setUniversalTab('all')}
        >
          {t('onboarding.equipment.universalTabs.all')}
        </button>
        {UNIVERSAL_TABS.filter((tab) => getSuggestions(activeActivities).some((item) => matchesUniversalTab(item, tab.id))).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={universalTab === tab.id}
              className={`ob-eq-univ-tab${universalTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setUniversalTab(tab.id)}
            >
              <Icon size={14} strokeWidth={2} />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {suggestions.length > 0 && (
        <section className="ob-eq-section">
          <h3 className="ob-eq-section__title">
            {activeActivities.length > 0 && activeActivities.length <= 3
              ? t('onboarding.equipment.suggestionsFor', { activities: activeActivities.join(', ') })
              : t('onboarding.equipment.suggestionsHeader')}
          </h3>
          <div className="ob-eq-grid">
            {suggestions.map((s) => (
              <EquipmentSuggestionCard
                key={s.id}
                item={s}
                added={hasEquipment(s.brand, s.model)}
                onToggle={() => toggleFromSuggestion(s)}
              />
            ))}
          </div>
        </section>
      )}

      {showEmptySuggestions && (
        <section className="ob-eq-empty">
          <p className="ob-eq-empty__title">{t('onboarding.equipment.emptyTitle')}</p>
          <p className="ob-eq-empty__sub">{t('onboarding.equipment.emptySub')}</p>
        </section>
      )}

      <section className="ob-eq-section ob-eq-section--mine">
        <h3 className="ob-eq-section__title">
          {t('onboarding.equipment.myEquipmentHeader', { count: draft.selectedEquipment.length })}
        </h3>
        {inventoryCategories.length > 1 && (
          <div className="ob-eq-inventory-filters" role="group" aria-label={t('onboarding.equipment.categoriesTabsLabel')}>
            {['all', ...inventoryCategories].map((id) => (
              <button key={id} type="button" className={inventoryFilter === id ? 'is-active' : ''} onClick={() => setInventoryFilter(id)}>
                {id === 'all' ? t('onboarding.equipment.tabAll') : id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>
        )}
        <MyEquipmentStrip items={visibleInventory} allItems={draft.selectedEquipment} onRemove={removeEquipment} onAdd={() => {
          setManualOpen(true);
          requestAnimationFrame(() => document.querySelector('.ob-eq-manual')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
        }} />
      </section>

      <InlineManualGearForm
        open={manualOpen}
        onToggle={() => setManualOpen((o) => !o)}
        onSubmit={handleManualSubmit}
        activities={draft.activities}
        defaultActivity={activityTab !== 'all' ? activityTab : ''}
      />
    </div>
  );
}
