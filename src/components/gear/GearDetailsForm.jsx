import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Loader } from 'lucide-react';
import { searchProducts } from '../../services/productService';
import { ProductThumbnail } from '../product/ProductThumbnail';
import './gear-picker.css';

/**
 * Optional details step after model selection
 * Allows adding: year, photo, product link, notes
 * Auto-searches for product image and thumbnail
 */
export function GearDetailsForm({
  initialData = {},
  category,
  onSave,
  onSkip,
  onCancel,
}) {
  const { t } = useTranslation();
  const [year, setYear] = useState(initialData.year || '');
  const [imageUrl, setImageUrl] = useState(initialData.imageUrl || '');
  const [productUrl, setProductUrl] = useState(initialData.productUrl || '');
  const [notes, setNotes] = useState(initialData.notes || '');
  const [suggestedProduct, setSuggestedProduct] = useState(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);

  // Auto-search for product image when component mounts
  useEffect(() => {
    if (initialData.brandName && initialData.modelName) {
      searchForProductImage();
    }
  }, []);

  const searchForProductImage = async () => {
    if (!initialData.brandName || !initialData.modelName) return;

    setIsLoadingProduct(true);
    try {
      const searchQuery = `${initialData.brandName} ${initialData.modelName}`;
      const results = await searchProducts(searchQuery);

      if (results.length > 0) {
        const product = results[0];
        setSuggestedProduct(product);
        // Auto-fill image if not already set
        if (!imageUrl && product.imageStatus?.urls?.medium) {
          setImageUrl(product.imageStatus.urls.medium);
        }
        // Auto-fill product URL if not already set
        if (!productUrl && product.productUrl) {
          setProductUrl(product.productUrl);
        }
      }
    } catch (error) {
      console.warn('Error searching for product:', error);
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleSave = () => {
    onSave({
      year: year ? parseInt(year, 10) : null,
      imageUrl: imageUrl.trim() || null,
      productUrl: productUrl.trim() || null,
      notes: notes.trim() || null,
    });
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i);

  return (
    <section className="gear-picker gear-details-form" aria-label={t('gearManager.detailsAria')}>
      <header className="gear-picker__header">
        <button
          type="button"
          className="gear-picker__back"
          onClick={onSkip}
          aria-label={t('gearManager.skipDetails')}
        >
          <ChevronLeft size={20} strokeWidth={1.8} />
        </button>
        <div>
          <h2>{t('gearManager.detailsTitle')}</h2>
          <p>{t('gearManager.detailsSubtitle', { category: t(`gearManager.categories.${category.id}`, { defaultValue: category.label }) })}</p>
        </div>
        <button type="button" className="gear-picker__close" onClick={onCancel} aria-label={t('gearManager.cancel')}>
          ×
        </button>
      </header>

      <section className="gear-picker__section gear-details-form-content">
        {/* Product Thumbnail Preview */}
        {(suggestedProduct || isLoadingProduct) && (
          <div className="gear-details-product-preview">
            {isLoadingProduct ? (
              <div className="gear-details-product-preview__loading">
                <Loader size={24} className="spinner" />
                <span>{t('gearManager.searchingImage')}</span>
              </div>
            ) : suggestedProduct ? (
              <div className="gear-details-product-preview__content">
                <div className="gear-details-product-preview__thumbnail">
                  <ProductThumbnail product={suggestedProduct} size="md" />
                </div>
                <div className="gear-details-product-preview__info">
                  <strong>{suggestedProduct.brand || initialData.brandName}</strong>
                  <small>{suggestedProduct.name || initialData.modelName}</small>
                  {suggestedProduct.productUrl && (
                    <a
                      href={suggestedProduct.productUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="gear-details-product-preview__link"
                    >
                      {t('gearManager.viewProduct')} →
                    </a>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <label>
          <span className="gear-details-form__label">{t('gearManager.year')}</span>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">{t('gearManager.selectYear')}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="gear-details-form__label">{t('gearManager.imageUrl')}</span>
          <input
            type="url"
            placeholder="https://example.com/image.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          <small>{t('gearManager.imageUrlHint')}</small>
        </label>

        <label>
          <span className="gear-details-form__label">{t('gearManager.productLink')}</span>
          <input
            type="url"
            placeholder="https://example.com/product"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
          />
          <small>{t('gearManager.productLinkHint')}</small>
        </label>

        <label>
          <span className="gear-details-form__label">{t('gearManager.notes')}</span>
          <textarea
            placeholder={t('gearManager.notesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </label>

        <div className="gear-details-form__actions">
          <button
            type="button"
            className="gear-picker__skip"
            onClick={onSkip}
          >
            {t('gearManager.skipDetails')}
          </button>
          <button
            type="button"
            className="gear-picker__continue is-primary"
            onClick={handleSave}
          >
            {t('gearManager.saveContinue')}
          </button>
        </div>
      </section>
    </section>
  );
}

export default GearDetailsForm;
