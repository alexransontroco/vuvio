import { Search, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function SearchBar({ value, onChange, withFilter = false }) {
  const { t } = useTranslation();
  return (
    <label className="search-bar">
      <Search size={16} strokeWidth={1.8} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('searchBar.placeholder')}
      />
      {withFilter ? (
        <button type="button" className="search-bar__filter" aria-label={t('searchBar.openFilters')}>
          <SlidersHorizontal size={19} strokeWidth={1.9} />
        </button>
      ) : null}
    </label>
  );
}
