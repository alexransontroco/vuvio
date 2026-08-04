import { ChevronRight } from 'lucide-react';
import { GearThumbnail } from './GearThumbnail.jsx';
import './gear-item-row.css';

/**
 * Reusable gear item row component
 * Displays gear with thumbnail, name, category, and actions
 */
export function GearItemRow({
  id,
  imageUrl,
  category,
  brand,
  model,
  displayName,
  selected = false,
  liveStatus = null,
  loading = false,
  error = false,
  onClick,
  showChevron = false,
  subtitle = null,
  onRemove = null,
}) {
  const fullName = displayName || `${brand} ${model}`;

  return (
    <div className={`gear-item-row ${selected ? 'is-selected' : ''} ${error ? 'has-error' : ''}`}>
      <button
        type="button"
        className="gear-item-row__button"
        onClick={onClick}
        aria-label={fullName}
      >
        <div className="gear-item-row__thumbnail">
          <GearThumbnail
            imageUrl={imageUrl}
            category={category}
            displayName={fullName}
            size="md"
            loading={loading}
            error={error}
          />
        </div>

        <div className="gear-item-row__content">
          <div className="gear-item-row__header">
            <div className="gear-item-row__name">{fullName}</div>
            {liveStatus && <div className="gear-item-row__live-badge">{liveStatus}</div>}
          </div>

          <div className="gear-item-row__meta">
            <span className="gear-item-row__category">{category}</span>
            {subtitle && <span className="gear-item-row__subtitle">{subtitle}</span>}
          </div>
        </div>

        {showChevron && <ChevronRight size={18} strokeWidth={1.8} className="gear-item-row__chevron" />}
      </button>

      {onRemove && (
        <button
          type="button"
          className="gear-item-row__remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          aria-label={`Remove ${fullName}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
