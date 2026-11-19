import { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { searchLocalProducts, searchProducts } from '../../services/productSearchService.js';
import { ProductThumbnail } from './ProductThumbnail.jsx';
import './product-search.css';

/**
 * ProductSearch - Search and select products with autocomplete
 */
export function ProductSearch({ categoryId, onSelectProduct, onAddManually, disabled = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchInputRef = useRef(null);
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    const controller = new AbortController();
    const local = searchLocalProducts(trimmed, { category: categoryId });
    setResults(local);
    setIsOpen(true);
    setIsLoading(false);
    setSearchError(null);
    if (trimmed.length < 3) return () => controller.abort();
    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const products = await searchProducts(trimmed, { category: categoryId, signal: controller.signal });
        if (!controller.signal.aborted) setResults(products);
      } catch (err) {
        if (!controller.signal.aborted) {
          setSearchError(err.status === 429 ? 'quota' : 'unavailable');
          setResults(local);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(debounceTimer.current);
      controller.abort();
    };
  }, [query, categoryId]);

  const handleSelectProduct = (product) => {
    onSelectProduct(product);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="product-search">
      <div className="product-search__input-wrapper">
        <Search size={18} className="product-search__input-icon" />
        <input
          ref={searchInputRef}
          type="text"
          className="product-search__input"
          placeholder="Search equipment..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          disabled={disabled}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="product-search__clear"
            onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isOpen && (
        <>
          <div className="product-search__backdrop" onClick={() => setIsOpen(false)} />
          <div className="product-search__dropdown">
            {isLoading && results.length === 0 ? (
              <div className="product-search__state">
                <div className="spinner" />
                <span>Searching...</span>
              </div>
            ) : searchError ? (
              <div className="product-search__state product-search__error">
                {searchError === 'quota' && <span>Search limit reached. Try again later or add manually.</span>}
                {searchError === 'unavailable' && (
                  <span>Service temporarily unavailable. Please try again later.</span>
                )}
              </div>
            ) : results.length === 0 ? (
              <div className="product-search__state">
                {query.length < 2 ? (
                  <span>Type at least 2 characters</span>
                ) : (
                  <>
                    <span>No matching products found.</span>
                  </>
                )}
              </div>
            ) : (
              <div className="product-search__results">
                {results.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="product-search__result-item"
                    onClick={() => handleSelectProduct(product)}
                  >
                    <ProductThumbnail product={product} size="sm" />
                    <div className="product-search__result-info">
                      <strong>{product.brand} {product.name}</strong>
                      <small>{product.equipmentType || product.category || 'Equipment'}</small>
                    </div>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            )}
            {onAddManually && (
              <button type="button" className="product-search__not-found-action" onClick={() => { setIsOpen(false); onAddManually(); }}>
                Can't find your equipment? Add manually
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
