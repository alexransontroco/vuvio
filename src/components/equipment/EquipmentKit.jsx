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
import { useTranslation } from 'react-i18next';
import { searchLocalProducts, searchProducts } from '../../services/productSearchService.js';
import { ProductThumbnail } from '../product/ProductThumbnail.jsx';
import EquipmentVisual from './EquipmentVisual.jsx';
import { getEquipmentVisual, persistentEquipmentImage } from '../../data/equipmentVisual.js';
import { GearThumbnail, GearItemRow } from '../gear/index.js';
import { AlertCircle } from 'lucide-react';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_OWNERSHIP, SUBCATEGORY_EQUIPMENT_TYPES } from '../../data/equipmentModel.js';
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

function EquipmentThumbnail({ item, usage }) {
  return (
    <div className="equipment-item-row__icon">
      <EquipmentVisual equipment={item} size={20} usage={usage} />
    </div>
  );
}

export function ownershipLabel(value) {
  return EQUIPMENT_OWNERSHIP.find((item) => item.id === value)?.label ?? 'Owned';
}

export function EquipmentBadge({ item }) {
  const { t } = useTranslation();
  if (!item?.ownership || item.ownership === 'owned') return null;
  const key = item.ownership === 'brand_provided' ? 'brandProvided' : item.ownership;
  const label = t(`equipment.ownership.${key}`, { defaultValue: ownershipLabel(item.ownership) });
  return <span className="equipment-status-badge">{label}</span>;
}

export function EquipmentCategoryCard({ category, count, onClick }) {
  const { t } = useTranslation();
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
        <small>{t('equipment.item', { count })}</small>
      </span>
      <ChevronRight size={18} strokeWidth={1.8} />
    </button>
  );
}

export function EquipmentItemRow({ item, selectable = false, selected = false, onToggle, onOpen, actions, compact = false, usage = 'persistent-gear' }) {
  const { t } = useTranslation();
  const content = (
    <>
      <EquipmentThumbnail item={item} usage={usage} />
      <span className="equipment-item-row__copy">
        <strong>{equipmentLabel(item)}</strong>
        <small>{item.associatedActivity || item.equipmentType || t('equipment.defaultType')}</small>
        <EquipmentBadge item={item} />
      </span>
      {item.offers?.length > 0 ? <span className="equipment-affiliate-pill">{t('equipment.affiliateLink')}</span> : null}
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
  const { t } = useTranslation();
  if (!items.some((item) => item.offers?.length > 0)) return null;
  return (
    <section className="equipment-disclosure">
      <Info size={18} strokeWidth={1.8} />
      <div>
        <strong>{t('equipment.disclosure.title')}</strong>
        <p>{t('equipment.disclosure.body')}</p>
      </div>
      <button type="button">{t('equipment.disclosure.learnMore')}</button>
    </section>
  );
}

export function GearInLive({ items, onViewLive, compact = false }) {
  const { t } = useTranslation();
  if (!items.length) return null;
  const captureItems = items.filter((item) => item.category !== 'activity');
  const activityItems = items.filter((item) => item.category === 'activity');

  function renderItems(group) {
    return group.map((item) => (
      <GearItemRow
        key={item.id ?? item.equipmentId}
        id={item.id ?? item.equipmentId}
        imageUrl={getEquipmentVisual(item, 'public-gear').imageUrl}
        category={item.category}
        brand={item.brand}
        model={item.model}
        displayName={item.displayName || `${item.brand} ${item.model}`}
      />
    ));
  }

  return (
    <section className={compact ? 'gear-in-live is-compact' : 'gear-in-live'} aria-label={t('equipment.gearInLive.title')}>
      <header>
        <div>
          <h2>{t('equipment.gearInLive.title')}</h2>
          <p>{t('equipment.gearInLive.subtitle')}</p>
        </div>
        {onViewLive ? (
          <button type="button" onClick={onViewLive}>
            {t('equipment.gearInLive.viewLive')}
            <ChevronRight size={15} strokeWidth={1.9} />
          </button>
        ) : null}
      </header>
      {captureItems.length > 0 && (
        <div className="gear-in-live__group">
          <span className="gear-in-live__group-label">{t('equipment.gearInLive.capturedWith')}</span>
          <div className="gear-in-live__items">{renderItems(captureItems)}</div>
        </div>
      )}
      {activityItems.length > 0 && (
        <div className="gear-in-live__group">
          <span className="gear-in-live__group-label">{t('equipment.gearInLive.activityGroup')}</span>
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
  const { t } = useTranslation();
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
      ? t('equipment.selector.usedInPrevious', { subcategory: subcategory.toLowerCase() })
      : t('equipment.selector.suggestedFromActivity', { subcategory: subcategory.toLowerCase() })
    : t('equipment.selector.suggestedGeneral');

  return (
    <section className="equipment-selector" aria-label={t('equipment.selector.title')}>
      <header>
        <h2>{t('equipment.selector.title')}</h2>
        <p>{t('equipment.selector.subtitle')}</p>
      </header>

      <div className="equipment-selector__actions">
        <button type="button" className="equipment-selector__action--primary" onClick={onUseSuggested}>
          <Sparkles size={11} strokeWidth={2} aria-hidden="true" />
          {t('equipment.selector.useSuggested')}
        </button>
        {hasPreviousSetup ? (
          <button type="button" onClick={onUsePrevious}>{t('equipment.selector.previousSetup')}</button>
        ) : null}
        <button type="button" onClick={() => setShowAll((v) => !v)}>
          {showAll ? <ChevronUp size={11} strokeWidth={2} aria-hidden="true" /> : <ChevronDown size={11} strokeWidth={2} aria-hidden="true" />}
          {showAll ? t('equipment.selector.hideAll') : t('equipment.selector.viewAll')}
        </button>
        <button type="button" onClick={onSkip}>{t('equipment.selector.skip')}</button>
      </div>

      {showAll ? (
        <div className="equipment-selector__section">
          <div className="equipment-selector__section-header">
            <h3>{t('equipment.selector.allEquipment')}</h3>
            <p>{t('equipment.selector.allEquipmentDesc')}</p>
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
              <h3>{t('equipment.selector.captureSetup')}</h3>
              <p>{t('equipment.selector.captureSetupDesc')}</p>
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
              {t('equipment.selector.addCapture')}
            </button>
          </div>

          {showActivity ? (
            <div className="equipment-selector__section">
              <div className="equipment-selector__section-header">
                <h3>{t('equipment.selector.activityEquipment')}</h3>
                <p>{t('equipment.selector.activityEquipmentDesc', { subcategory: subcategory.toLowerCase() })}</p>
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
                  {t('equipment.selector.noActivity', { subcategory: subcategory.toLowerCase() })}
                  {compatibleTypes?.length ? (
                    <> {t('equipment.selector.suggestedTypes')} {compatibleTypes.slice(0, 3).join(', ')}…</>
                  ) : null}
                </p>
              )}
              <button type="button" className="equipment-selector__add-btn" onClick={onAddActivity}>
                <Plus size={13} strokeWidth={2} />
                {t('equipment.selector.addActivity', { subcategory: subcategory.toLowerCase() })}
              </button>
            </div>
          ) : null}
        </>
      )}

      <footer>
        <strong>{t('equipment.selector.selected', { count: selectedItems.length })}</strong>
        <small>{selectedItems.slice(0, 4).map(equipmentLabel).join(' · ') || t('equipment.selector.noneSelected')}</small>
      </footer>
    </section>
  );
}

export function QuickAddEquipmentForm({ value, onChange, onCancel, onSave, suggestedTypes = [] }) {
  const { t } = useTranslation();
  const isActivity = value.category === 'activity';
  const listId = 'equipment-type-list';
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || manualMode) {
      abortRef.current?.abort();
      setSearchResults([]);
      setSearching(false);
      setSearchError('');
      return;
    }
    const local = searchLocalProducts(q, { category: value.category });
    setSearchResults(local);
    setSearchError('');
    if (q.length < 3) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchProducts(q, { signal: controller.signal, category: value.category });
        if (!controller.signal.aborted) setSearchResults(results);
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearchResults(local);
          setSearchError(error.status === 429 ? 'Search limit reached' : 'Search unavailable');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchQuery, manualMode, value.category]);

  function handleSelectProduct(product) {
    setSelectedProduct(product);
    setSearchResults([]);
    setSearchQuery('');
    onChange({
      ...value,
      brand: product.brand ?? value.brand,
      model: product.name ?? value.model,
      displayName: `${product.brand ?? ''} ${product.name ?? ''}`.trim(),
      category: product.category ?? value.category,
      equipmentType: product.equipmentType ?? value.equipmentType,
      ...persistentEquipmentImage(product),
      productId: product.id ?? null,
      provider: product.provider ?? 'vuvioCatalog',
      offers: [],
    });
  }

  const showSearch = !manualMode;

  return (
    <section className="equipment-quick-add" aria-label={t('equipment.quickAdd.title')}>
      <header>
        <h2>{isActivity ? t('equipment.quickAdd.titleActivity') : t('equipment.quickAdd.title')}</h2>
        <p>{t('equipment.quickAdd.subtitle')}</p>
      </header>

      <label>
        {t('equipment.quickAdd.category')}
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
              placeholder={t('equipment.quickAdd.searchPlaceholder')}
              autoComplete="off"
            />
            {searching && <span className="equipment-search-spinner" />}
          </div>

          {searchResults.length > 0 && (
            <ul className="equipment-search-results">
              {searchResults.map((p) => (
                <li key={`${p.provider}:${p.externalId}`}>
                  <button type="button" className="equipment-search-result" onClick={() => handleSelectProduct(p)}>
                    <ProductThumbnail product={p} size="sm" />
                    <span className="equipment-search-result__name">
                      <strong>{p.brand}</strong> {p.name}
                      <small>{p.equipmentType || p.category || 'Equipment'}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {searchError && <p className="equipment-search-status" role="status">{searchError}. Add manually if needed.</p>}

          {selectedProduct && (
            <div className="equipment-search-selected">
              <ProductThumbnail product={selectedProduct} size="sm" usage="persistent-gear" />
              <span>{selectedProduct.brand} {selectedProduct.name}</span>
              <button type="button" className="equipment-search-clear" onClick={() => { setSelectedProduct(null); onChange({ ...value, brand: '', model: '', displayName: '', thumbnailUrl: null, imageUrl: null, productId: null, offers: [] }); }}>
                <X size={12} />
              </button>
            </div>
          )}

          <button type="button" className="equipment-manual-link" onClick={() => { setManualMode(true); setSelectedProduct(null); onChange({ ...value, productId: null, provider: 'user' }); }}>
            {t('equipment.quickAdd.addManually')}
          </button>
        </div>
      )}

      {(!showSearch || selectedProduct || manualMode) && (
        <>
          {isActivity ? (
            <label>
              {t('equipment.quickAdd.equipmentType')}
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
          {manualMode && (
            <label>
              Equipment name
              <input value={value.displayName ?? ''} onChange={(event) => onChange({ ...value, displayName: event.target.value })} placeholder="Example: Sony A7 IV" />
            </label>
          )}
          <label>
            {t('equipment.quickAdd.brand')} (optional)
            <input value={value.brand} onChange={(event) => onChange({ ...value, brand: event.target.value })} placeholder="Example: Canyon" />
          </label>
          <label>
            {t('equipment.quickAdd.model')} (optional)
            <input value={value.model} onChange={(event) => onChange({ ...value, model: event.target.value })} placeholder="Example: Spectral CF 8" />
          </label>
        </>
      )}

      <div className="equipment-form-actions">
        <button type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="button" className="is-primary" onClick={onSave} disabled={!(value.displayName?.trim() || value.model?.trim())}>{t('equipment.quickAdd.addAndSelect')}</button>
      </div>
    </section>
  );
}

export function EquipmentViewerSheet({ items, onClose, onViewProfile, context = {} }) {
  const { t } = useTranslation();
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
          {t('equipment.viewer.viewProduct')}
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
        {isMain && <span className="equipment-main-badge">{t('equipment.viewer.mainBadge')}</span>}
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
    <div className="equipment-viewer-sheet" role="dialog" aria-modal="true" aria-label={`${t('equipment.viewer.titlePart1')} ${t('equipment.viewer.titleKeyword')} ${t('equipment.viewer.titlePart2')}`} onPointerDown={stopProp} onPointerMove={stopProp} onPointerUp={stopProp} onPointerCancel={stopProp}>
      <button type="button" className="equipment-viewer-sheet__backdrop" onClick={onClose} aria-label={t('common.close')} />
      <div className="equipment-viewer-sheet__panel">
        <span className="equipment-viewer-sheet__handle" aria-hidden="true" />
        <header>
          <div>
            <h2>{t('equipment.viewer.titlePart1')} <span className="equipment-used-highlight">{t('equipment.viewer.titleKeyword')}</span> {t('equipment.viewer.titlePart2')}</h2>
            <p>{t('equipment.viewer.subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} strokeWidth={2} />
          </button>
        </header>
        <div className="equipment-viewer-sheet__list">
          {activityItems.length > 0 && (
            <div className="equipment-viewer-sheet__group">
              <div className="equipment-viewer-sheet__group-header">
                <Bike size={14} strokeWidth={1.8} />
                <span className="equipment-viewer-sheet__group-label">{t('equipment.viewer.activityGroup')}</span>
              </div>
              {activityItems.map((item) => renderItem(item, item.id === mainActivityId))}
            </div>
          )}
          {recordingItems.length > 0 && (
            <div className="equipment-viewer-sheet__group">
              <div className="equipment-viewer-sheet__group-header">
                <Camera size={14} strokeWidth={1.8} />
                <span className="equipment-viewer-sheet__group-label">{t('equipment.viewer.recordingGroup')}</span>
              </div>
              {recordingItems.map((item) => renderItem(item, item.id === mainRecordingId))}
            </div>
          )}
        </div>
        {hasAffiliateLinks && (
          <div className="equipment-viewer-sheet__disclosure">
            <Sparkles size={12} strokeWidth={2} />
            <small>{t('equipment.viewer.affiliateDisclosure')}</small>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function EquipmentManageActions({ item, onEdit, onTogglePublic, onToggleDefault, onRemove }) {
  const { t } = useTranslation();
  return (
    <span className="equipment-manage-actions">
      <button type="button" onClick={onTogglePublic}>{item.isPublic ? t('equipment.manage.hide') : t('equipment.manage.show')}</button>
      <button type="button" onClick={onToggleDefault}>{item.isDefault ? t('equipment.manage.unsetDefault') : t('equipment.manage.setDefault')}</button>
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
