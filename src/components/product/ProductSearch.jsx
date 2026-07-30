/**
 * Product Search Component
 * Provides autocomplete search with product thumbnails
 * Allows selection of a product or "can't find?" action
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, AlertCircle } from 'lucide-react';
import { searchProducts } from '../../services/productService.js';
import ProductThumbnail from './ProductThumbnail.jsx';
import './product-search.css';

/**
 * Product Search Component with autocomplete
 * @param {Object} props
 * @param {Function} props.onSelect - Called when product is selected
 * @param {Function} [props.onNotFound] - Called when user can't find product
 * @param {string} [props.placeholder='Search products...'] - Input placeholder
 * @param {number} [props.maxResults=12] - Max search results to show
 * @param {boolean} [props.open=false] - Open state (for controlled mode)
 * @param {Function} [props.onOpenChange] - Open state change callback
 * @returns {JSX.Element}
 */
export function ProductSearch({
  onSelect,
  onNotFound,
  placeholder = 'Search products...',
  maxResults = 12,
  open = false,
  onOpenChange,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(open);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Handle open state changes
  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  // Perform search
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedIndex(-1);

    try {
      const searchResults = await searchProducts(searchQuery);
      setResults(searchResults.slice(0, maxResults));
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search products');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [maxResults]);

  // Debounced search
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Handle product selection
  const handleSelectProduct = (product) => {
    onSelect?.(product);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    onOpenChange?.(false);
  };

  // Handle "can't find" action
  const handleNotFound = () => {
    onNotFound?.(query);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    onOpenChange?.(false);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Enter' && query.length > 0) {
        setIsOpen(true);
        onOpenChange?.(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > -1 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectProduct(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        onOpenChange?.(false);
        break;
      default:
        break;
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onOpenChange]);

  return (
    <div className="product-search">
      <div className="product-search__input-wrapper">
        <Search size={20} className="product-search__icon" />
        <input
          ref={inputRef}
          type="text"
          className="product-search__input"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsOpen(true);
            onOpenChange?.(true);
          }}
          autoComplete="off"
        />
        {query && (
          <button
            className="product-search__clear"
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="product-search__dropdown" ref={resultsRef}>
          {loading && (
            <div className="product-search__loading">
              <span>Searching...</span>
            </div>
          )}

          {error && (
            <div className="product-search__error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && results.length > 0 && (
            <div className="product-search__results">
              <div className="product-search__results-grid">
                {results.map((product, index) => (
                  <button
                    key={product.id}
                    className={`product-search__result-item ${
                      index === selectedIndex ? 'is-highlighted' : ''
                    }`}
                    onClick={() => handleSelectProduct(product)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    title={`${product.brand} ${product.name}`}
                  >
                    <ProductThumbnail
                      product={product}
                      size="md"
                      onClick={() => handleSelectProduct(product)}
                    />
                    <div className="product-search__result-label">
                      <div className="product-search__result-brand">{product.brand}</div>
                      <div className="product-search__result-name">{product.name}</div>
                    </div>
                  </button>
                ))}
              </div>

              {query && (
                <div className="product-search__not-found">
                  <button
                    className="product-search__not-found-button"
                    onClick={handleNotFound}
                  >
                    Can't find what you're looking for?
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && !error && results.length === 0 && query && (
            <div className="product-search__empty">
              <p>No products found for "{query}"</p>
              {onNotFound && (
                <button
                  className="product-search__not-found-button"
                  onClick={handleNotFound}
                >
                  Can't find what you're looking for?
                </button>
              )}
            </div>
          )}

          {!loading && !error && results.length === 0 && !query && (
            <div className="product-search__hint">
              <p>Type at least 2 characters to search</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProductSearch;
