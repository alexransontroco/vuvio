import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder, hint, autoFocus, onClear }) {
  return (
    <div className="ob-search">
      <span className="ob-search__icon" aria-hidden="true">
        <Search size={16} strokeWidth={2} />
      </span>
      <input
        type="search"
        className="ob-search__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {value ? (
        <button type="button" className="ob-search__clear" onClick={onClear || (() => onChange(''))} aria-label="Clear search">
          <X size={14} strokeWidth={2.5} />
        </button>
      ) : hint ? (
        <span className="ob-search__hint" aria-hidden="true">{hint}</span>
      ) : null}
    </div>
  );
}
