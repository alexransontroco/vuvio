import { ChevronLeft, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EquipmentItemRow,
  EquipmentManageActions,
} from '../components/equipment/EquipmentKit.jsx';
import { GearImageUploader } from '../components/gear/index.js';
import { ProductSearch, ProductThumbnail } from '../components/product/index.js';
import { inferEquipmentVisualCategory, persistentEquipmentImage } from '../data/equipmentVisual.js';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_OWNERSHIP } from '../data/equipmentModel.js';
import {
  addEquipmentItem,
  groupEquipmentByCategory,
  removeEquipmentItem,
  updateEquipmentItem,
  getEquipmentLibrary,
  getEquipmentLibraryWithProducts,
} from '../services/equipmentService.js';

const emptyForm = {
  category: 'activity',
  visualCategory: null,
  productId: null,
  externalId: null,
  provider: null,
  brand: '',
  model: '',
  displayName: '',
  equipmentType: '',
  productUrl: '',
  affiliateUrl: '',
  thumbnailUrl: null,
  imageUrl: '',
  notes: '',
  ownership: 'owned',
  isPublic: true,
  isDefault: false,
};

function EquipmentForm({ value, onChange, onSave, onCancel, submitLabel = 'Save equipment' }) {
  const [showManualEntry, setShowManualEntry] = useState(!value.productId && !!(value.brand || value.model));
  const [errors, setErrors] = useState({});
  const nameRef = useRef(null);
  const brandRef = useRef(null);

  const handleSave = () => {
    const next = {};
    if (!value.productId && !(value.displayName?.trim() || value.model?.trim())) next.name = 'Equipment name is required';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onSave();
  };

  const handleProductSelect = (product) => {
    const image = persistentEquipmentImage(product);
    onChange({
      ...value,
      productId: product.id,
      externalId: product.externalId || null,
      sourceProductId: product.externalId || null,
      provider: product.provider || null,
      identificationStatus: 'identified',
      enrichmentStatus: product.provider === 'icecat' || product.enrichedBy === 'icecat' ? 'provider-data' : 'none',
      brand: product.brand,
      model: product.name,
      displayName: `${product.brand} ${product.name}`.trim(),
      category: product.category || value.category,
      equipmentType: product.equipmentType || product.subcategory || product.category || '',
      visualCategory: inferEquipmentVisualCategory(product),
      ...image,
      productUrl: '',
      affiliateUrl: '',
    });
    setShowManualEntry(false);
  };

  const displayProductName = value.displayName || [value.brand, value.model].filter(Boolean).join(' ') || 'Equipment';

  return (
    <section className="equipment-private-form" aria-label="Equipment form">
      <label>
        Category
        <select value={value.category} onChange={(event) => {
          const selectedCategory = event.target.value;
          const visualCategory = { recording: 'cameras', audio: 'audio', streaming: 'computing', power_accessories: 'energy' }[selectedCategory] || null;
          onChange({ ...value, category: selectedCategory, visualCategory });
        }}>
          {EQUIPMENT_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
      </label>

      {/* Product Search - Primary method */}
      {!value.productId && (
        <div className="equipment-form-section">
          <label>Find your product</label>
          <ProductSearch
            categoryId={value.category}
            onSelectProduct={handleProductSelect}
            onAddManually={() => setShowManualEntry(true)}
            disabled={false}
          />
        </div>
      )}

      {/* Selected Product Display */}
      {value.productId && (
        <div className="equipment-selected-product">
          <div className="equipment-selected-product__thumbnail">
            <ProductThumbnail
              product={{
                id: value.productId,
                name: value.model,
                brand: value.brand,
                category: value.category,
                thumbnailUrl: value.thumbnailUrl || value.imageUrl || null,
                imageSource: value.imageSource || 'placeholder',
                imageRightsStatus: value.imageRightsStatus || null,
                imageRightsSource: value.imageRightsSource || null,
                imageAllowedUsages: value.imageAllowedUsages || [],
                imageRightsExpiresAt: value.imageRightsExpiresAt || null,
                imageHostingStatus: value.imageHostingStatus || null,
              }}
              size="md"
              usage="persistent-gear"
            />
          </div>
          <div className="equipment-selected-product__info">
            <strong>{value.brand} {value.model}</strong>
            <small>{value.equipmentType || 'Equipment'}</small>
            <button
              type="button"
              className="equipment-selected-product__change"
              onClick={() => {
                onChange({
                  ...value,
                  productId: null,
                  brand: '',
                  model: '',
                  equipmentType: '',
                  imageUrl: '',
                  imageSource: null,
                });
                setShowManualEntry(false);
              }}
            >
              Change product
            </button>
          </div>
        </div>
      )}

      {/* Manual Entry - Fallback */}
      {!value.productId && (
        <>
          {!showManualEntry ? (
            <button
              type="button"
              className="equipment-form-fallback"
              onClick={() => setShowManualEntry(true)}
            >
              Can't find your product? Enter manually
            </button>
          ) : (
            <div className="equipment-manual-entry">
              <label ref={nameRef}>
                Equipment name
                <input value={value.displayName || [value.brand, value.model].filter(Boolean).join(' ')} onChange={(event) => { onChange({ ...value, displayName: event.target.value }); setErrors((e) => ({ ...e, name: '' })); }} placeholder="Example: Sony A7 IV" />
                {errors.name ? <span className="equipment-field-error">{errors.name}</span> : null}
              </label>
              <label ref={brandRef}>
                Brand (optional)
                <input value={value.brand} onChange={(event) => onChange({ ...value, brand: event.target.value })} placeholder="Example: Sony" />
              </label>
              <label>
                Model (optional)
                <input value={value.model} onChange={(event) => onChange({ ...value, model: event.target.value })} placeholder="Example: A7 IV" />
              </label>
              <label>
                Equipment type
                <input value={value.equipmentType} onChange={(event) => onChange({ ...value, equipmentType: event.target.value })} placeholder="Example: Action Camera" />
              </label>

              <GearImageUploader
                imageUrl={value.imageUrl}
                category={value.category}
                displayName={displayProductName}
                onImageChange={(data) => onChange({ ...value, ...data, thumbnailUrl: null, imageRightsStatus: 'unknown', imageRightsSource: 'user-provided', imageAllowedUsages: ['persistent-gear'], imageRightsCheckedAt: null, imageRightsExpiresAt: null, imageProductId: null, imageHostingStatus: null })}
                onRemoveImage={() => onChange({ ...value, imageUrl: '', thumbnailUrl: null, imageSource: null, imageRightsStatus: null, imageRightsSource: null, imageAllowedUsages: [], imageRightsCheckedAt: null, imageRightsExpiresAt: null, imageProductId: null, imageHostingStatus: null })}
              />
            </div>
          )}
        </>
      )}

      {(value.productUrl || value.affiliateUrl) && (
        <>
          <label>
            Product link
            <input value={value.productUrl || ''} onChange={(event) => onChange({ ...value, productUrl: event.target.value })} placeholder="https://" />
          </label>
          <label>
            Affiliate link
            <input value={value.affiliateUrl || ''} onChange={(event) => onChange({ ...value, affiliateUrl: event.target.value })} placeholder="https://" />
          </label>
        </>
      )}
      <label>
        Ownership status
        <select value={value.ownership} onChange={(event) => onChange({ ...value, ownership: event.target.value })}>
          {EQUIPMENT_OWNERSHIP.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      <label>
        Notes
        <textarea value={value.notes} onChange={(event) => onChange({ ...value, notes: event.target.value })} placeholder="Optional notes" rows={3} />
      </label>
      <div className="equipment-private-toggles">
        <button type="button" className={value.isPublic ? 'is-active' : ''} onClick={() => onChange({ ...value, isPublic: !value.isPublic })}>
          {value.isPublic ? 'Show on public profile' : 'Hide from public profile'}
        </button>
        <button type="button" className={value.isDefault ? 'is-active' : ''} onClick={() => onChange({ ...value, isDefault: !value.isDefault })}>
          Set as default
        </button>
      </div>
      <div className="equipment-form-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className="is-primary" onClick={handleSave}>
          {submitLabel}
        </button>
      </div>
    </section>
  );
}

export default function EquipmentManagePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState(() => getEquipmentLibrary());
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState('');
  const groups = useMemo(() => groupEquipmentByCategory(items), [items]);

  const toastTimer = useRef(null);
  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2500);
  };

  const refreshItems = useCallback(async () => {
    const enriched = await getEquipmentLibraryWithProducts();
    setItems(enriched);
    return enriched;
  }, []);

  useEffect(() => {
    let active = true;
    getEquipmentLibraryWithProducts()
      .then((enriched) => {
        if (active) setItems(enriched);
      })
      .catch((err) => {
        console.warn('[EquipmentManagePage] Product enrichment failed:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  const saveForm = async () => {
    try {
      const equipmentName = form?.displayName?.trim() || form?.model?.trim();
      if (!equipmentName) {
        showToast('Please enter an equipment name');
        return;
      }
      const brand = form.brand?.trim() || '';
      const inferredModel = brand && equipmentName.toLowerCase().startsWith(`${brand.toLowerCase()} `)
        ? equipmentName.slice(brand.length).trim()
        : equipmentName;
      const model = form.model?.trim() || inferredModel;
      const nextForm = { ...form, brand, model, displayName: equipmentName, visualCategory: form.visualCategory || inferEquipmentVisualCategory({ ...form, brand, model, displayName: equipmentName }), identificationStatus: form.productId ? 'identified' : 'manual' };
      const isEdit = Boolean(editingId);
      if (isEdit) {
        updateEquipmentItem(editingId, nextForm);
      } else {
        addEquipmentItem(nextForm);
      }
      await refreshItems();
      setForm(null);
      setEditingId(null);
      showToast(isEdit ? 'Equipment updated' : 'Equipment added');
    } catch (err) {
      console.error('[EquipmentManagePage] Save failed:', err);
      showToast('Failed to save equipment');
    }
  };

  return (
    <section className="screen-scroll equipment-manage-screen" aria-label="My Equipment">
      <header className="equipment-manage-header">
        <button type="button" onClick={() => form ? (setForm(null), setEditingId(null)) : navigate('/profile')} aria-label="Back">
          <ChevronLeft size={19} strokeWidth={1.9} />
        </button>
        <div>
          <h1>My Equipment</h1>
          <p>Manage the gear available for your lives.</p>
        </div>
        {!form ? (
          <button type="button" onClick={() => { setForm(emptyForm); setEditingId(null); }}>
            <Plus size={16} strokeWidth={2} />
            Add equipment
          </button>
        ) : <span />}
      </header>

      {form ? (
        <EquipmentForm
          value={form}
          onChange={setForm}
          onSave={saveForm}
          onCancel={() => { setForm(null); setEditingId(null); }}
        />
      ) : null}

      {!form && !items.length ? (
        <div className="profile-empty-state">
          <p>No equipment added yet</p>
          <small>Add the gear you use to create your POV experiences.</small>
        </div>
      ) : null}

      <div className="equipment-manage-list">
        {groups.filter((group) => group.items.length).map((group) => (
          <section key={group.id} className="equipment-manage-group">
            <h2>{group.label}</h2>
            {group.items.map((item) => (
              <EquipmentItemRow
                key={item.id}
                item={item}
                actions={(
                  <EquipmentManageActions
                    item={item}
                    onEdit={() => { setEditingId(item.id); setForm(item); }}
                    onTogglePublic={async () => {
                      updateEquipmentItem(item.id, { isPublic: !item.isPublic });
                      await refreshItems();
                    }}
                    onToggleDefault={async () => {
                      updateEquipmentItem(item.id, { isDefault: !item.isDefault });
                      await refreshItems();
                    }}
                    onRemove={async () => {
                      removeEquipmentItem(item.id);
                      await refreshItems();
                      showToast('Equipment removed');
                    }}
                  />
                )}
              />
            ))}
          </section>
        ))}
      </div>

      {toast ? <div className="profile-toast" role="status">{toast}</div> : null}
    </section>
  );
}
