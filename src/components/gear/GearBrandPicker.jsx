import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { searchBrands, getPopularBrands } from '../../services/gearService';
import './gear-picker.css';

export function GearBrandPicker({
  categoryId,
  category,
  onSelect,
  onManual,
  onBack,
  onCancel,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const popularBrands = getPopularBrands(categoryId, 6);
  const searchResults = searchQuery.length > 0 ? searchBrands(searchQuery, categoryId) : [];

  const hasSearchQuery = searchQuery.length > 0;
  const brandsToShow = hasSearchQuery ? searchResults : popularBrands;
  const emptyMessage =
    searchQuery.length > 0
      ? `No brands found for "${searchQuery}"`
      : 'Popular brands...';

  return (
    <section className="gear-picker gear-brand-picker" aria-label="Select brand">
      <header className="gear-picker__header">
        <button type="button" className="gear-picker__back" onClick={onBack} aria-label="Back">
          <ChevronLeft size={20} strokeWidth={1.8} />
        </button>
        <div>
          <h2>Choose a brand</h2>
          <p>Find the manufacturer of your {category.label}</p>
        </div>
        <button type="button" className="gear-picker__close" onClick={onCancel} aria-label="Cancel">
          ×
        </button>
      </header>

      <div className="gear-picker__search-container">
        <div className="gear-picker__search">
          <Search size={16} />
          <input
            type="text"
            placeholder={`Search ${category.label} brands...`}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setFocusedIndex(-1); // Reset focus when typing
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocusedIndex((i) => (i < brandsToShow.length - 1 ? i + 1 : i));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocusedIndex((i) => (i > 0 ? i - 1 : -1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (focusedIndex >= 0 && brandsToShow[focusedIndex]) {
                  onSelect(brandsToShow[focusedIndex]);
                }
              } else if (e.key === 'Escape') {
                setSearchQuery('');
                setFocusedIndex(-1);
              }
            }}
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              className="gear-picker__search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Quick dropdown with search results */}
        {hasSearchQuery && brandsToShow.length > 0 && (
          <div className="gear-picker__search-dropdown">
            {brandsToShow.slice(0, 5).map((brand, index) => (
              <button
                key={brand.id}
                type="button"
                className="gear-picker__search-dropdown-item"
                onClick={() => onSelect(brand)}
              >
                {brand.label}
              </button>
            ))}
            {brandsToShow.length > 5 && (
              <div className="gear-picker__search-dropdown-more">
                +{brandsToShow.length - 5} more results
              </div>
            )}
          </div>
        )}
      </div>

      <section className="gear-picker__section">
        {brandsToShow.length > 0 ? (
          <div className="gear-brand-list">
            {brandsToShow.map((brand, index) => (
              <button
                key={brand.id}
                type="button"
                className={`gear-brand-row ${focusedIndex === index ? 'is-focused' : ''}`}
                onClick={() => onSelect(brand)}
                onMouseEnter={() => setFocusedIndex(index)}
                tabIndex={focusedIndex === index ? 0 : -1}
              >
                <span className="gear-brand-row__label">{brand.label}</span>
                <ChevronRight size={16} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        ) : hasSearchQuery ? (
          <div className="gear-picker__empty">
            <p>No brands found for "{searchQuery}"</p>
            <button
              type="button"
              className="gear-picker__add-manual"
              onClick={() => onManual(searchQuery)}
            >
              Add "{searchQuery}" manually
            </button>
          </div>
        ) : null}
      </section>

      <footer className="gear-picker__footer">
        <button type="button" className="gear-picker__other" onClick={() => onManual('')}>
          Other
        </button>
        <button type="button" className="gear-picker__unknown" onClick={() => onManual('')}>
          I don't know
        </button>
      </footer>
    </section>
  );
}

export default GearBrandPicker;
