import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Sparkle } from 'lucide-react';
import { ACTIVITY_CATEGORIES } from '../../../data/activityCategories.js';
import ActivityTile from '../components/ActivityTile.jsx';
import SearchBar from '../components/SearchBar.jsx';

// Build the full universe of activities with provenance.
function buildActivityUniverse(selectedCategoryIds, customActivities) {
  const out = [];
  const seen = new Set();
  // Selected-category subcategories first (prioritized).
  for (const cat of ACTIVITY_CATEGORIES) {
    if (!selectedCategoryIds.includes(cat.id)) continue;
    for (const sub of cat.subcategories) {
      const key = sub.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: sub, icon: cat.icon, color: cat.color, categoryId: cat.id });
    }
  }
  // Then rest.
  for (const cat of ACTIVITY_CATEGORIES) {
    if (selectedCategoryIds.includes(cat.id)) continue;
    for (const sub of cat.subcategories) {
      const key = sub.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: sub, icon: cat.icon, color: cat.color, categoryId: cat.id });
    }
  }
  // Custom (user-added) activities last.
  for (const name of customActivities) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, icon: Sparkle, color: 'var(--vuvio-cyan)', categoryId: null, custom: true });
  }
  return out;
}

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function StepActivities({ draft, toggleActivity, addCustomActivity }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const universe = useMemo(
    () => buildActivityUniverse(draft.selectedCategories, draft.customActivities),
    [draft.selectedCategories, draft.customActivities],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return universe;
    const q = normalize(query);
    return universe.filter((a) => normalize(a.name).includes(q));
  }, [universe, query]);

  const canAddFree = query.trim().length >= 2
    && !universe.some((a) => normalize(a.name) === normalize(query));

  return (
    <div className="ob-step">
      <header className="ob-step__header">
        <p className="ob-step__eyebrow">{t('onboarding.stepLabel', { n: 2 })}</p>
        <h2 className="ob-step__title">{t('onboarding.activities.title')}</h2>
        <p className="ob-step__sub">{t('onboarding.activities.subtitle')}</p>
      </header>

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder={t('onboarding.activities.searchPlaceholder')}
      />

      {canAddFree && (
        <button
          type="button"
          className="ob-act-add-free"
          onClick={() => {
            addCustomActivity(query.trim());
            setQuery('');
          }}
        >
          <Plus size={14} strokeWidth={2.5} />
          {t('onboarding.activities.addFree', { name: query.trim() })}
        </button>
      )}

      {filtered.length === 0 && !canAddFree ? (
        <p className="ob-step__empty">{t('onboarding.activities.noResults')}</p>
      ) : (
        <div className="ob-act-grid">
          {filtered.map((a) => (
            <ActivityTile
              key={a.name}
              name={a.name}
              icon={a.icon}
              color={a.color}
              selected={draft.activities.includes(a.name)}
              onToggle={toggleActivity}
              custom={a.custom}
            />
          ))}
        </div>
      )}

      {draft.activities.length > 0 && (
        <p className="ob-step__footnote" aria-live="polite">
          {t('onboarding.activities.selectedCount', { count: draft.activities.length })}
        </p>
      )}
    </div>
  );
}
