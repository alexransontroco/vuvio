import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const popularBrands = getPopularBrands(categoryId, 6);
  const searchResults = searchQuery.length > 0 ? searchBrands(searchQuery, categoryId) : [];

  const hasSearchQuery = searchQuery.length > 0;
  const brandsToShow = hasSearchQuery ? searchResults : popularBrands;
  return (
    <section className="gear-picker gear-brand-picker" aria-label={t('gearManager.selectBrand')}>
      <header className="gear-picker__header">
        <button type="button" className="gear-picker__back" onClick={onBack} aria-label={t('gearManager.back')}>
          <ChevronLeft size={20} strokeWidth={1.8} />
        </button>
        <div>
          <h2>{t('gearManager.brandTitle')}</h2>
          <p>{t('gearManager.brandSubtitle', { category: t(`gearManager.categories.${category.id}`, { defaultValue: category.label }) })}</p>
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
            placeholder={t('gearManager.searchBrands', { category: t(`gearManager.categories.${category.id}`, { defaultValue: category.label }) })}
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
              aria-label={t('gearManager.clearSearch')}
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
            <p>{t('gearManager.noBrands', { query: searchQuery })}</p>
            <button
              type="button"
              className="gear-picker__add-manual"
              onClick={() => onManual(searchQuery)}
            >
              {t('gearManager.addBrandManually', { query: searchQuery })}
            </button>
          </div>
        ) : null}
      </section>

      <footer className="gear-picker__footer">
        <button type="button" className="gear-picker__other" onClick={() => onManual('')}>
          {t('gearManager.other')}
        </button>
        <button type="button" className="gear-picker__unknown" onClick={() => onManual('')}>
          {t('gearManager.unknown')}
        </button>
      </footer>
    </section>
  );
}

export default GearBrandPicker;
