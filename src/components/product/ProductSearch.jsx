import { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { searchProducts, getProductName } from '../../services/productService.js';
import { ProductThumbnail } from './ProductThumbnail.jsx';
import './product-search.css';

/**
 * ProductSearch - Search and select products with autocomplete
 */
export function ProductSearch({ categoryId, onSelectProduct, disabled = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchInputRef = useRef(null);
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const products = await searchProducts(query, categoryId);
        setResults(products);
        setIsOpen(true);
      } catch (err) {
        console.error('[ProductSearch] Error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);
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
          placeholder="Search by brand or model..."
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
            {isLoading ? (
              <div className="product-search__state">
                <div className="spinner" />
                <span>Searching...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="product-search__state">
                {query.length < 2 ? (
                  <span>Type at least 2 characters</span>
                ) : (
                  <>
                    <span>No products found for "{query}"</span>
                    <button type="button" className="product-search__not-found-action">
                      Can't find your equipment?
                      <ChevronRight size={16} />
                    </button>
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
                      <strong>{getProductName(product)}</strong>
                      <small>{product.description}</small>
                    </div>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
