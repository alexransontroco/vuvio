import {
  BatteryCharging,
  Bike,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Info,
  Mic,
  MoreHorizontal,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { searchProducts, resolveAffiliateOffers } from '../../services/productSearchService.js';
import { GearThumbnail, GearItemRow } from '../gear/index.js';
import { AlertCircle } from 'lucide-react';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_OWNERSHIP, SUBCATEGORY_EQUIPMENT_TYPES, getCategoryIcon } from '../../data/equipmentModel.js';
import { equipmentLabel, groupEquipmentByCategory } from '../../services/equipmentService.js';
import { openOffer } from '../../services/affiliateService.js';

export const categoryIcons = {
  recording: Camera,
  audio: Mic,
  activity: Bike,
  streaming: Radio,
  power_accessories: BatteryCharging,
};

export function EquipmentIcon({ category, size = 19 }) {
  const Icon = categoryIcons[category] ?? Camera;
  return <Icon size={size} strokeWidth={1.8} />;
}

function EquipmentThumbnail({ imageUrl, category, label }) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="equipment-item-row__icon">
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt={label}
          className="equipment-item-row__img"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="equipment-item-row__icon-emoji" aria-hidden="true">
          {getCategoryIcon(category)}
        </span>
      )}
    </div>
  );
}

export function ownershipLabel(value) {
  return EQUIPMENT_OWNERSHIP.find((item) => item.id === value)?.label ?? 'Owned';
}

export function EquipmentBadge({ item }) {
  if (!item?.ownership || item.ownership === 'owned') return null;
  return <span className="equipment-status-badge">{ownershipLabel(item.ownership)}</span>;
}

export function EquipmentCategoryCard({ category, count, onClick }) {
  return (
    <button type="button" className="equipment-category-card" onClick={onClick} aria-label={`Open ${category.label}`}>
      <span className="equipment-category-card__icon">
        <EquipmentIcon category={category.id} />
      </span>
      <span className="equipment-category-card__copy">
        <strong>{category.label}</strong>
        <small>{category.description}</small>
      </span>
      <span className="equipment-category-card__count">
        <strong>{count}</strong>
        <small>{count === 1 ? 'item' : 'items'}</small>
      </span>
      <ChevronRight size={18} strokeWidth={1.8} />
    </button>
  );
}

export function EquipmentItemRow({ item, selectable = false, selected = false, onToggle, onOpen, actions, compact = false }) {
  const thumbnailUrl = item.thumbnailUrl || item.product?.thumbnailUrl || item.imageUrl || null;
  const content = (
    <>
      <EquipmentThumbnail
        imageUrl={thumbnailUrl}
        category={item.category}
        label={equipmentLabel(item)}
      />
      <span className="equipment-item-row__copy">
        <strong>{equipmentLabel(item)}</strong>
        <small>{item.equipmentType || 'Equipment'}</small>
        <EquipmentBadge item={item} />
      </span>
      {item.offers?.length > 0 ? <span className="equipment-affiliate-pill">Affiliate link</span> : null}
      {actions ? actions : selectable ? <span className={selected ? 'equipment-check is-selected' : 'equipment-check'} aria-hidden="true" /> : <ChevronRight size={17} strokeWidth={1.8} />}
    </>
  );

  if (selectable) {
    return (
      <button type="button" className={selected ? 'equipment-item-row is-selected' : 'equipment-item-row'} onClick={() => onToggle?.(item.id)} aria-pressed={selected}>
        {content}
      </button>
    );
  }

  // Use div instead of button when actions are present to avoid nested buttons
  if (actions) {
    return (
      <div className={compact ? 'equipment-item-row is-compact' : 'equipment-item-row'}>
        {content}
      </div>
    );
  }

  return (
    <button type="button" className={compact ? 'equipment-item-row is-compact' : 'equipment-item-row'} onClick={onOpen} aria-label={`Open ${equipmentLabel(item)}`}>
      {content}
    </button>
  );
}

export function EquipmentDisclosure({ items }) {
  if (!items.some((item) => item.offers?.length > 0)) return null;
  return (
    <section className="equipment-disclosure">
      <Info size={18} strokeWidth={1.8} />
      <div>
        <strong>Some links may be affiliate links.</strong>
        <p>Using them may support the creator at no extra cost to you.</p>
      </div>
      <button type="button">Learn more</button>
    </section>
  );
}

export function GearInLive({ items, onViewLive, compact = false }) {
  if (!items.length) return null;
  const captureItems = items.filter((item) => item.category !== 'activity');
  const activityItems = items.filter((item) => item.category === 'activity');

  function renderItems(group) {
    return group.map((item) => (
      <GearItemRow
        key={item.id ?? item.equipmentId}
        id={item.id ?? item.equipmentId}
        imageUrl={item.thumbnailUrl || item.product?.thumbnailUrl || item.imageUrl}
        category={item.category}
        brand={item.brand}
        model={item.model}
        displayName={item.displayName || `${item.brand} ${item.model}`}
      />
    ));
  }

  return (
    <section className={compact ? 'gear-in-live is-compact' : 'gear-in-live'} aria-label="Gear in this live">
      <header>
        <div>
          <h2>Gear in this live</h2>
          <p>The equipment currently used for this live.</p>
        </div>
        {onViewLive ? (
          <button type="button" onClick={onViewLive}>
            View live
            <ChevronRight size={15} strokeWidth={1.9} />
          </button>
        ) : null}
      </header>
      {captureItems.length > 0 && (
        <div className="gear-in-live__group">
          <span className="gear-in-live__group-label">Captured with</span>
          <div className="gear-in-live__items">{renderItems(captureItems)}</div>
        </div>
      )}
      {activityItems.length > 0 && (
        <div className="gear-in-live__group">
          <span className="gear-in-live__group-label">Activity equipment</span>
          <div className="gear-in-live__items">{renderItems(activityItems)}</div>
        </div>
      )}
    </section>
  );
}

export function EquipmentSelector({
  items, selectedIds, onToggle,
  onUseSuggested, onUsePrevious,
  onAdd, onAddActivity, onSkip,
  subcategory, hasPreviousSetup,
}) {
  const [showAll, setShowAll] = useState(false);

  const compatibleTypes = subcategory ? (SUBCATEGORY_EQUIPMENT_TYPES[subcategory] ?? null) : null;
  const captureItems    = items.filter((item) => item.category !== 'activity');
  const allActivityItems = items.filter((item) => item.category === 'activity');

  const activityItems = compatibleTypes
    ? allActivityItems.filter(
        (item) =>
          compatibleTypes.includes(item.equipmentType) ||
          (item.compatibleActivityIds ?? []).some(
            (id) => id.toLowerCase() === subcategory.toLowerCase(),
          ),
      )
    : allActivityItems;

  const captureGroups  = groupEquipmentByCategory(captureItems).filter((g) => g.items.length && g.id !== 'activity');
  const allGroups      = groupEquipmentByCategory(items).filter((g) => g.items.length);
  const selectedItems  = items.filter((item) => selectedIds.includes(item.id));
  const showActivity   = Boolean(subcategory);

  const hintText = subcategory
    ? hasPreviousSetup
      ? `Used in your previous ${subcategory.toLowerCase()} live`
      : `Suggested from your ${subcategory.toLowerCase()} activity`
    : 'Suggested from your activity';

  return (
    <section className="equipment-selector" aria-label="Gear for this live">
      <header>
        <h2>Gear for this live</h2>
        <p>Review the equipment you'll use before going live.</p>
      </header>

      <div className="equipment-selector__actions">
        <button type="button" className="equipment-selector__action--primary" onClick={onUseSuggested}>
          <Sparkles size={11} strokeWidth={2} aria-hidden="true" />
          Use suggested gear
        </button>
        {hasPreviousSetup ? (
          <button type="button" onClick={onUsePrevious}>Previous setup</button>
        ) : null}
        <button type="button" onClick={() => setShowAll((v) => !v)}>
          {showAll ? <ChevronUp size={11} strokeWidth={2} aria-hidden="true" /> : <ChevronDown size={11} strokeWidth={2} aria-hidden="true" />}
          {showAll ? 'Hide all' : 'View all'}
        </button>
        <button type="button" onClick={onSkip}>Skip</button>
      </div>

      {showAll ? (
        <div className="equipment-selector__section">
          <div className="equipment-selector__section-header">
            <h3>All equipment</h3>
            <p>Your full equipment library.</p>
          </div>
          {allGroups.map((group) => (
            <div key={group.id} className="equipment-selector__group">
              <span className="equipment-selector__group-label">{group.label}</span>
              {group.items.map((item) => (
                <EquipmentItemRow key={item.id} item={item} selectable selected={selectedIds.includes(item.id)} onToggle={onToggle} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="equipment-selector__section">
            <div className="equipment-selector__section-header">
              <h3>Capture setup</h3>
              <p>Equipment used to capture and stream your live.</p>
            </div>
            {captureGroups.map((group) => (
              <div key={group.id} className="equipment-selector__group">
                <span className="equipment-selector__group-label">{group.label}</span>
                {group.items.map((item) => (
                  <EquipmentItemRow key={item.id} item={item} selectable selected={selectedIds.includes(item.id)} onToggle={onToggle} />
                ))}
              </div>
            ))}
            <button type="button" className="equipment-selector__add-btn" onClick={onAdd}>
              <Plus size={13} strokeWidth={2} />
              Add capture equipment
            </button>
          </div>

          {showActivity ? (
            <div className="equipment-selector__section">
              <div className="equipment-selector__section-header">
                <h3>Activity equipment</h3>
                <p>Equipment related to your {subcategory.toLowerCase()} activity.</p>
              </div>
              {activityItems.length > 0 ? (
                <>
                  <span className="equipment-selector__hint">{hintText}</span>
                  {activityItems.map((item) => (
                    <EquipmentItemRow key={item.id} item={item} selectable selected={selectedIds.includes(item.id)} onToggle={onToggle} />
                  ))}
                </>
              ) : (
                <p className="equipment-selector__empty">
                  No {subcategory.toLowerCase()} equipment in your library yet.
                  {compatibleTypes?.length ? (
                    <> Suggested types: {compatibleTypes.slice(0, 3).join(', ')}…</>
                  ) : null}
                </p>
              )}
              <button type="button" className="equipment-selector__add-btn" onClick={onAddActivity}>
                <Plus size={13} strokeWidth={2} />
                Add {subcategory.toLowerCase()} equipment
              </button>
            </div>
          ) : null}
        </>
      )}

      <footer>
        <strong>{selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} selected</strong>
        <small>{selectedItems.slice(0, 4).map(equipmentLabel).join(' · ') || 'You can continue without adding equipment.'}</small>
      </footer>
    </section>
  );
}

export function QuickAddEquipmentForm({ value, onChange, onCancel, onSave, suggestedTypes = [] }) {
  const isActivity = value.category === 'activity';
  const listId = 'equipment-type-list';
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || manualMode) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      const results = await searchProducts(q, { signal: controller.signal });
      setSearching(false);
      setSearchResults(results);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, manualMode]);

  function handleSelectProduct(product) {
    setSelectedProduct(product);
    setSearchResults([]);
    setSearchQuery('');
    onChange({
      ...value,
      brand: product.brand ?? value.brand,
      model: product.name ?? value.model,
      thumbnailUrl: product.thumbnailUrl ?? null,
      imageUrl: product.thumbnailUrl ?? null,
      imageSource: product.imageSource ?? 'product-catalog',
      productId: product.externalId ?? null,
    });
    resolveAffiliateOffers({ brand: product.brand, name: product.name, mpn: product.mpn, gtin: product.gtin, category: value.category })
      .then((offers) => {
        if (offers.length > 0) onChange({ ...value, brand: product.brand ?? value.brand, model: product.name ?? value.model, thumbnailUrl: product.thumbnailUrl ?? null, imageUrl: product.thumbnailUrl ?? null, imageSource: product.imageSource ?? 'product-catalog', productId: product.externalId ?? null, offers });
      });
  }

  const showSearch = !manualMode;

  return (
    <section className="equipment-quick-add" aria-label="Add equipment">
      <header>
        <h2>{isActivity ? 'Add activity equipment' : 'Add equipment'}</h2>
        <p>You can complete the details later from My Equipment.</p>
      </header>

      <label>
        Category
        <select value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value, equipmentType: '' })}>
          {EQUIPMENT_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
      </label>

      {showSearch && (
        <div className="equipment-search-wrap">
          <div className="equipment-search-input-wrap">
            <Search size={14} strokeWidth={2} className="equipment-search-icon" />
            <input
              className="equipment-search-input"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelectedProduct(null); }}
              placeholder="Search by brand or model…"
              autoComplete="off"
            />
            {searching && <span className="equipment-search-spinner" />}
          </div>

          {searchResults.length > 0 && (
            <ul className="equipment-search-results">
              {searchResults.map((p) => (
                <li key={`${p.provider}:${p.externalId}`}>
                  <button type="button" className="equipment-search-result" onClick={() => handleSelectProduct(p)}>
                    {p.thumbnailUrl ? (
                      <img src={p.thumbnailUrl} alt="" className="equipment-search-result__thumb" />
                    ) : (
                      <div className="equipment-search-result__thumb equipment-search-result__thumb--empty" />
                    )}
                    <span className="equipment-search-result__name">
                      <strong>{p.brand}</strong> {p.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedProduct && (
            <div className="equipment-search-selected">
              {selectedProduct.thumbnailUrl && (
                <img src={selectedProduct.thumbnailUrl} alt="" className="equipment-search-result__thumb" />
              )}
              <span>{selectedProduct.brand} {selectedProduct.name}</span>
              <button type="button" className="equipment-search-clear" onClick={() => { setSelectedProduct(null); onChange({ ...value, brand: '', model: '', thumbnailUrl: null, imageUrl: null, productId: null, offers: [] }); }}>
                <X size={12} />
              </button>
            </div>
          )}

          <button type="button" className="equipment-manual-link" onClick={() => setManualMode(true)}>
            Add manually
          </button>
        </div>
      )}

      {(!showSearch || selectedProduct || manualMode) && (
        <>
          {isActivity ? (
            <label>
              Equipment type
              <input
                list={suggestedTypes.length ? listId : undefined}
                value={value.equipmentType ?? ''}
                onChange={(event) => onChange({ ...value, equipmentType: event.target.value })}
                placeholder={suggestedTypes[0] ? `Example: ${suggestedTypes[0]}` : 'Example: Mountain Bike'}
              />
              {suggestedTypes.length ? (
                <datalist id={listId}>
                  {suggestedTypes.map((type) => <option key={type} value={type} />)}
                </datalist>
              ) : null}
            </label>
          ) : null}
          <label>
            Brand
            <input value={value.brand} onChange={(event) => onChange({ ...value, brand: event.target.value })} placeholder="Example: Canyon" />
          </label>
          <label>
            Model
            <input value={value.model} onChange={(event) => onChange({ ...value, model: event.target.value })} placeholder="Example: Spectral CF 8" />
          </label>
        </>
      )}

      <div className="equipment-form-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className="is-primary" onClick={onSave} disabled={!value.brand.trim() || !value.model.trim()}>Add and select</button>
      </div>
    </section>
  );
}

export function EquipmentViewerSheet({ items, onClose, onViewProfile, context = {} }) {
  const activityItems = items.filter((item) => item.category === 'activity');
  const recordingItems = items.filter((item) => item.category !== 'activity');
  const hasAffiliateLinks = items.some((item) => item.offers?.length > 0);
  const mainActivityId = activityItems[0]?.id;
  const mainRecordingId = recordingItems[0]?.id;

  function renderOfferActions(item) {
    const offers = item.offers ?? [];
    if (!offers.length) return null;
    const itemContext = { ...context, equipmentId: item.id, productId: item.productId };
    if (offers.length === 1) {
      return (
        <button
          type="button"
          className="equipment-offer-btn"
          onClick={(e) => { e.stopPropagation(); openOffer(offers[0], itemContext); }}
        >
          View product
          <ExternalLink size={13} strokeWidth={2} />
        </button>
      );
    }
    return (
      <div className="equipment-offers">
        {offers.map((offer, i) => (
          <button
            key={i}
            type="button"
            className="equipment-offer-btn"
            onClick={(e) => { e.stopPropagation(); openOffer(offer, itemContext); }}
          >
            {offer.merchant ?? 'Shop'}
            {offer.country ? ` (${offer.country})` : ''}
            <ExternalLink size={12} strokeWidth={2} />
          </button>
        ))}
      </div>
    );
  }

  function renderItem(item, isMain) {
    return (
      <div key={item.id ?? item.equipmentId} className={isMain ? 'equipment-item-wrapper is-main' : 'equipment-item-wrapper'}>
        {isMain && <span className="equipment-main-badge">Main</span>}
        <EquipmentItemRow
          item={item}
          compact
          actions={renderOfferActions(item)}
        />
      </div>
    );
  }

  const stopProp = (e) => e.stopPropagation();
  return createPortal(
    <div className="equipment-viewer-sheet" role="dialog" aria-modal="true" aria-label="Equipment used in this live" onPointerDown={stopProp} onPointerMove={stopProp} onPointerUp={stopProp} onPointerCancel={stopProp}>
      <button type="button" className="equipment-viewer-sheet__backdrop" onClick={onClose} aria-label="Close" />
      <div className="equipment-viewer-sheet__panel">
        <span className="equipment-viewer-sheet__handle" aria-hidden="true" />
        <header>
          <div>
            <h2>Equipment <span className="equipment-used-highlight">used</span> in this live</h2>
            <p>Everything the creator is using right now.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </header>
        <div className="equipment-viewer-sheet__list">
          {activityItems.length > 0 && (
            <div className="equipment-viewer-sheet__group">
              <div className="equipment-viewer-sheet__group-header">
                <Bike size={14} strokeWidth={1.8} />
                <span className="equipment-viewer-sheet__group-label">Activity equipment</span>
              </div>
              {activityItems.map((item) => renderItem(item, item.id === mainActivityId))}
            </div>
          )}
          {recordingItems.length > 0 && (
            <div className="equipment-viewer-sheet__group">
              <div className="equipment-viewer-sheet__group-header">
                <Camera size={14} strokeWidth={1.8} />
                <span className="equipment-viewer-sheet__group-label">Recording equipment</span>
              </div>
              {recordingItems.map((item) => renderItem(item, item.id === mainRecordingId))}
            </div>
          )}
        </div>
        {hasAffiliateLinks && (
          <div className="equipment-viewer-sheet__disclosure">
            <Sparkles size={12} strokeWidth={2} />
            <small>Some links may be affiliate links.</small>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function EquipmentManageActions({ item, onEdit, onTogglePublic, onToggleDefault, onRemove }) {
  return (
    <span className="equipment-manage-actions">
      <button type="button" onClick={onTogglePublic}>{item.isPublic ? 'Hide from profile' : 'Show on profile'}</button>
      <button type="button" onClick={onToggleDefault}>{item.isDefault ? 'Unset default' : 'Set as default'}</button>
      <button type="button" onClick={onEdit}>
        <MoreHorizontal size={16} strokeWidth={1.8} />
      </button>
      <button type="button" className="is-danger" onClick={onRemove} aria-label={`Remove ${equipmentLabel(item)}`}>
        <Trash2 size={15} strokeWidth={1.9} />
      </button>
    </span>
  );
}

export function PrimaryEquipmentSummary({ items }) {
  const camera = items.find((item) => item.category === 'recording');
  const audio = items.find((item) => item.category === 'audio');
  const activity = items.find((item) => item.category === 'activity');
  const rows = [
    camera ? ['Primary camera', camera] : null,
    audio ? ['Primary microphone', audio] : null,
    activity ? ['Primary activity gear', activity] : null,
  ].filter(Boolean);

  if (!rows.length) return null;
  return (
    <section className="primary-equipment-summary">
      {rows.map(([label, item]) => (
        <article key={label}>
          <ShieldCheck size={15} strokeWidth={1.9} />
          <span>{label}</span>
          <strong>{equipmentLabel(item)}</strong>
        </article>
      ))}
    </section>
  );
}
