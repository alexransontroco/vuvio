import { ChevronLeft, Plus, CheckCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EquipmentItemRow,
  EquipmentManageActions,
} from '../components/equipment/EquipmentKit.jsx';
import { GearImageUploader } from '../components/gear/index.js';
import { ProductSearch, ProductThumbnail } from '../components/product/index.js';
import { getProductThumbnailUrl, getProductName } from '../services/productService.js';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_OWNERSHIP } from '../data/equipmentModel.js';
import {
  addEquipmentItem,
  groupEquipmentByCategory,
  removeEquipmentItem,
  updateEquipmentItem,
  getEquipmentLibrary,
} from '../services/equipmentService.js';

const emptyForm = {
  category: 'recording',
  productId: null,
  brand: '',
  model: '',
  equipmentType: '',
  productUrl: '',
  affiliateUrl: '',
  imageUrl: '',
  notes: '',
  ownership: 'owned',
  isPublic: true,
  isDefault: false,
};

function EquipmentForm({ value, onChange, onSave, onCancel, submitLabel = 'Save equipment' }) {
  const [showManualEntry, setShowManualEntry] = useState(!!value.productId === false);

  const handleProductSelect = (product) => {
    // Auto-fill form from selected product
    const thumbnailUrl = getProductThumbnailUrl(product, 'medium');
    onChange({
      ...value,
      productId: product.id,
      brand: product.brand,
      model: product.name,
      equipmentType: product.category,
      imageUrl: thumbnailUrl || '',
      productUrl: product.productUrl || '',
      affiliateUrl: product.affiliateUrl || '',
      imageSource: 'product-catalog',
    });
    setShowManualEntry(false);
  };

  const displayProductName = value.brand && value.model ? `${value.brand} ${value.model}` : 'Equipment';

  return (
    <section className="equipment-private-form" aria-label="Equipment form">
      <label>
        Category
        <select value={value.category} onChange={(event) => {
          onChange({ ...value, category: event.target.value });
        }}>
          {EQUIPMENT_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
      </label>

      {/* Product Search - Primary method */}
      <div className="equipment-form-section">
        <label>Find your product</label>
        <ProductSearch
          categoryId={value.category}
          onSelectProduct={handleProductSelect}
          disabled={false}
        />
      </div>

      {/* Selected Product Display */}
      {value.productId && (
        <div className="equipment-selected-product">
          <div className="equipment-selected-product__thumbnail">
            {value.imageUrl && (
              <img src={value.imageUrl} alt={displayProductName} />
            )}
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
              <label>
                Brand
                <input value={value.brand} onChange={(event) => onChange({ ...value, brand: event.target.value })} placeholder="Example: GoPro" />
              </label>
              <label>
                Model
                <input value={value.model} onChange={(event) => onChange({ ...value, model: event.target.value })} placeholder="Example: HERO13 Black" />
              </label>
              <label>
                Equipment type
                <input value={value.equipmentType} onChange={(event) => onChange({ ...value, equipmentType: event.target.value })} placeholder="Example: Action Camera" />
              </label>

              <GearImageUploader
                imageUrl={value.imageUrl}
                category={value.category}
                displayName={displayProductName}
                onImageChange={(data) => onChange({ ...value, ...data })}
                onRemoveImage={() => onChange({ ...value, imageUrl: '', imageSource: null })}
              />
            </div>
          )}
        </>
      )}

      <label>
        Product link
        <input value={value.productUrl} onChange={(event) => onChange({ ...value, productUrl: event.target.value })} placeholder="https://" />
      </label>
      <label>
        Affiliate link
        <input value={value.affiliateUrl} onChange={(event) => onChange({ ...value, affiliateUrl: event.target.value })} placeholder="https://" />
      </label>
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
        <button type="button" className="is-primary" disabled={!value.brand.trim() || !value.model.trim()} onClick={onSave}>
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

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1600);
  };

  const saveForm = () => {
    if (!form?.brand.trim() || !form?.model.trim()) return;
    try {
      if (editingId) {
        updateEquipmentItem(editingId, form);
        console.log('[EquipmentManagePage] Equipment updated:', editingId);
        showToast('Equipment updated');
      } else {
        const saved = addEquipmentItem(form);
        console.log('[EquipmentManagePage] Equipment added:', saved);
        showToast('Equipment added');
      }
      const updated = getEquipmentLibrary();
      console.log('[EquipmentManagePage] Current library:', updated.length, 'items');
      setItems(updated);
      setForm(null);
      setEditingId(null);
    } catch (err) {
      console.error('[EquipmentManagePage] Save failed:', err);
      showToast('Failed to save equipment');
    }
  };

  return (
    <section className="screen-scroll equipment-manage-screen" aria-label="My Equipment">
      <header className="equipment-manage-header">
        <button type="button" onClick={() => navigate('/profile')} aria-label="Back to profile">
          <ChevronLeft size={19} strokeWidth={1.9} />
        </button>
        <div>
          <h1>My Equipment</h1>
          <p>Manage the gear available for your lives.</p>
        </div>
        <button type="button" onClick={() => { setForm(emptyForm); setEditingId(null); }}>
          <Plus size={16} strokeWidth={2} />
          Add equipment
        </button>
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
          <button type="button" onClick={() => setForm(emptyForm)}>Add equipment</button>
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
                    onTogglePublic={() => {
                      updateEquipmentItem(item.id, { isPublic: !item.isPublic });
                      setItems(getEquipmentLibrary());
                    }}
                    onToggleDefault={() => {
                      updateEquipmentItem(item.id, { isDefault: !item.isDefault });
                      setItems(getEquipmentLibrary());
                    }}
                    onRemove={() => {
                      if (!window.confirm('Remove this equipment? Past live records will remain available.')) return;
                      removeEquipmentItem(item.id);
                      setItems(getEquipmentLibrary());
                      showToast('Equipment removed');
                    }}
                  />
                )}
              />
            ))}
          </section>
        ))}
      </div>

      <section className="equipment-after-live-card">
        <h2>Equipment used</h2>
        <p>Confirm the gear used during this live.</p>
        <button type="button">Confirm</button>
        <button type="button" onClick={() => setForm(emptyForm)}>Edit equipment</button>
      </section>

      {toast ? <div className="profile-toast" role="status">{toast}</div> : null}
    </section>
  );
}
