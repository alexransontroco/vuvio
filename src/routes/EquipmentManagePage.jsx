import { ChevronLeft, Plus, CheckCircle, Loader } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EquipmentItemRow,
  EquipmentManageActions,
} from '../components/equipment/EquipmentKit.jsx';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_OWNERSHIP } from '../data/equipmentModel.js';
import { getGearImageSuggestions } from '../services/gearSnapshotService.js';
import {
  addEquipmentItem,
  groupEquipmentByCategory,
  removeEquipmentItem,
  updateEquipmentItem,
  getEquipmentLibrary,
  fetchMissingEquipmentImages,
} from '../services/equipmentService.js';

const emptyForm = {
  category: 'recording',
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
  const [imageSuggestions, setImageSuggestions] = useState([]);
  const [imageFetching, setImageFetching] = useState(false);

  useEffect(() => {
    if (!value.brand.trim() || !value.model.trim()) {
      setImageSuggestions([]);
      return;
    }

    setImageFetching(true);
    getGearImageSuggestions({
      brand: value.brand,
      model: value.model,
      displayName: `${value.brand} ${value.model}`.trim(),
    })
      .then((result) => {
        if (result.success && result.suggestions?.length > 0) {
          setImageSuggestions(result.suggestions);
          if (!value.imageUrl) {
            onChange({ ...value, imageUrl: result.suggestions[0].url, imageSource: 'auto' });
          }
        } else {
          setImageSuggestions([]);
        }
      })
      .catch(() => setImageSuggestions([]))
      .finally(() => setImageFetching(false));
  }, [value.brand, value.model]);

  return (
    <section className="equipment-private-form" aria-label="Equipment form">
      <label>
        Category
        <select value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value })}>
          {EQUIPMENT_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
      </label>
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

      {imageFetching && (
        <div className="image-fetch-status">
          <Loader size={16} /> Searching for product image...
        </div>
      )}

      {imageSuggestions.length > 0 && (
        <div className="image-suggestions">
          <p>Product image (automatically found):</p>
          <div className="image-suggestions-grid">
            {imageSuggestions.map((img) => (
              <button
                key={img.url}
                type="button"
                className={value.imageUrl === img.url ? 'suggestion is-selected' : 'suggestion'}
                onClick={() => onChange({ ...value, imageUrl: img.url, imageSource: 'auto' })}
                title="Click to select"
              >
                <img src={img.thumb} alt={img.alt} />
                {value.imageUrl === img.url && <CheckCircle size={20} />}
              </button>
            ))}
          </div>
        </div>
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
  const [imageFetching, setImageFetching] = useState(false);
  const groups = useMemo(() => groupEquipmentByCategory(items), [items]);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1600);
  };

  useEffect(() => {
    setImageFetching(true);
    fetchMissingEquipmentImages()
      .then((result) => {
        if (result.updated > 0) {
          setItems(getEquipmentLibrary());
          showToast(`Found images for ${result.updated} equipment`);
        }
      })
      .catch(() => {})
      .finally(() => setImageFetching(false));
  }, [showToast]);

  const saveForm = () => {
    if (!form?.brand.trim() || !form?.model.trim()) return;
    if (editingId) {
      updateEquipmentItem(editingId, form);
      showToast('Equipment updated');
    } else {
      addEquipmentItem(form);
      showToast('Equipment added');
    }
    setItems(getEquipmentLibrary());
    setForm(null);
    setEditingId(null);
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
