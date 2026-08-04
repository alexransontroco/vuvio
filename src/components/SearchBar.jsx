import { Search, SlidersHorizontal } from 'lucide-react';

export default function SearchBar({ value, onChange, withFilter = false }) {
  return (
    <label className="search-bar">
      <Search size={16} strokeWidth={1.8} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search a craft, a city, a passion..."
      />
      {withFilter ? (
        <button type="button" className="search-bar__filter" aria-label="Open filters">
          <SlidersHorizontal size={19} strokeWidth={1.9} />
        </button>
      ) : null}
    </label>
  );
}
