import { ChevronLeft, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EquipmentItemRow,
  EquipmentManageActions,
} from '../components/equipment/EquipmentKit.jsx';
import { GearImageUploader } from '../components/gear/index.js';
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
      <label>
        Product link
        <input value={value.productUrl} onChange={(event) => onChange({ ...value, productUrl: event.target.value })} placeholder="https://" />
      </label>
      <label>
        Affiliate link
        <input value={value.affiliateUrl} onChange={(event) => onChange({ ...value, affiliateUrl: event.target.value })} placeholder="https://" />
      </label>
      <GearImageUploader
        imageUrl={value.imageUrl}
        category={value.category}
        displayName={`${value.brand} ${value.model}`.trim() || 'Equipment'}
        onImageChange={(imageData) => onChange({ ...value, ...imageData })}
        onRemoveImage={() => onChange({ ...value, imageUrl: null, imageSource: null, imageStatus: null })}
        showLabel
      />
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
