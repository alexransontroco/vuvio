import { useCallback, useEffect, useRef, useState } from 'react';
import { persistentEquipmentImage } from '../../data/equipmentVisual.js';

const DRAFT_VERSION = 'v1';
const DRAFT_KEY = (uid) => `vuvio.onboarding.draft.${DRAFT_VERSION}.${uid || 'anon'}`;

const EMPTY = {
  step: 0,
  displayName: '',
  avatarPreview: '',
  avatarDataUrl: '',
  selectedCategories: [],
  activities: [],
  customActivities: [],
  selectedEquipment: [],
  bio: '',
};

function loadDraft(uid) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistDraft(uid, draft) {
  if (typeof window === 'undefined') return;
  try {
    // avatarDataUrl / avatarPreview are heavy; keep them in-memory only.
    const { avatarDataUrl, avatarPreview, ...rest } = draft;
    window.sessionStorage.setItem(DRAFT_KEY(uid), JSON.stringify(rest));
  } catch {
    // Quota or serialization failure — silent, draft remains in-memory.
  }
}

export function clearDraft(uid) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY(uid));
  } catch {
    // ignore
  }
}

function initialFromProfile(user, userProfile) {
  return {
    ...EMPTY,
    displayName: userProfile?.displayName || user?.displayName || '',
    avatarPreview: userProfile?.photoURL || '',
    selectedCategories: Array.isArray(userProfile?.preferredCategories) ? userProfile.preferredCategories : [],
    activities: Array.isArray(userProfile?.preferredActivities) ? userProfile.preferredActivities : [],
    bio: userProfile?.bio || '',
  };
}

export function useOnboardingDraft(user, userProfile) {
  const uid = user?.uid;
  const hydratedRef = useRef(false);
  const [draft, setDraft] = useState(() => initialFromProfile(user, userProfile));

  // Hydrate from sessionStorage once the uid is known.
  useEffect(() => {
    if (!uid || hydratedRef.current) return;
    const persisted = loadDraft(uid);
    if (persisted) {
      setDraft((prev) => ({ ...prev, ...persisted, avatarDataUrl: '' }));
    } else if (userProfile) {
      setDraft(initialFromProfile(user, userProfile));
    }
    hydratedRef.current = true;
  }, [uid, user, userProfile]);

  // Persist on change.
  useEffect(() => {
    if (!uid || !hydratedRef.current) return;
    persistDraft(uid, draft);
  }, [uid, draft]);

  const patch = useCallback((partial) => {
    setDraft((prev) => (typeof partial === 'function' ? partial(prev) : { ...prev, ...partial }));
  }, []);

  const setStep = useCallback((step) => setDraft((prev) => ({ ...prev, step })), []);
  const nextStep = useCallback(() => setDraft((prev) => ({ ...prev, step: Math.min(5, prev.step + 1) })), []);
  const prevStep = useCallback(() => setDraft((prev) => ({ ...prev, step: Math.max(0, prev.step - 1) })), []);

  const toggleCategory = useCallback((id) => {
    setDraft((prev) => {
      const selected = prev.selectedCategories.includes(id)
        ? prev.selectedCategories.filter((x) => x !== id)
        : [...prev.selectedCategories, id];
      return { ...prev, selectedCategories: selected };
    });
  }, []);

  const toggleActivity = useCallback((name) => {
    setDraft((prev) => {
      const selected = prev.activities.includes(name)
        ? prev.activities.filter((x) => x !== name)
        : [...prev.activities, name];
      return { ...prev, activities: selected };
    });
  }, []);

  const addCustomActivity = useCallback((rawName) => {
    const name = String(rawName || '').trim();
    if (!name) return;
    setDraft((prev) => {
      if (prev.activities.includes(name) || prev.customActivities.includes(name)) return prev;
      return {
        ...prev,
        activities: [...prev.activities, name],
        customActivities: [...prev.customActivities, name],
      };
    });
  }, []);

  const addEquipment = useCallback((item) => {
    if (!item) return;
    setDraft((prev) => {
      const key = `${(item.brand || '').toLowerCase()}|${(item.model || item.displayName || '').toLowerCase()}`;
      const exists = prev.selectedEquipment.some((e) => {
        const k = `${(e.brand || '').toLowerCase()}|${(e.model || e.displayName || '').toLowerCase()}`;
        return k === key && key !== '|';
      });
      if (exists) return prev;
      const draftItem = {
        id: item.id || `ob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        brand: item.brand || '',
        model: item.model || item.displayName || item.name || '',
        displayName: item.displayName || item.name || `${item.brand || ''} ${item.model || ''}`.trim(),
        category: item.category || 'activity',
        equipmentType: item.equipmentType || item.category || 'Equipment',
        ...persistentEquipmentImage(item),
        visualCategory: item.visualCategory || null,
        associatedActivity: item.associatedActivity || null,
        productId: item.productId || null,
        sourceProductId: item.sourceProductId || null,
        provider: item.provider || 'user',
        identificationStatus: item.identificationStatus || (item.productId ? 'identified' : 'manual'),
        enrichmentStatus: item.enrichmentStatus || 'none',
      };
      return { ...prev, selectedEquipment: [draftItem, ...prev.selectedEquipment] };
    });
  }, []);

  const removeEquipment = useCallback((id) => {
    setDraft((prev) => ({ ...prev, selectedEquipment: prev.selectedEquipment.filter((e) => e.id !== id) }));
  }, []);

  const hasEquipment = useCallback(
    (brand, model) => {
      const key = `${(brand || '').toLowerCase()}|${(model || '').toLowerCase()}`;
      return draft.selectedEquipment.some((e) => `${(e.brand || '').toLowerCase()}|${(e.model || '').toLowerCase()}` === key);
    },
    [draft.selectedEquipment],
  );

  const reset = useCallback(() => {
    setDraft(EMPTY);
    clearDraft(uid);
  }, [uid]);

  return {
    draft,
    patch,
    setStep,
    nextStep,
    prevStep,
    toggleCategory,
    toggleActivity,
    addCustomActivity,
    addEquipment,
    removeEquipment,
    hasEquipment,
    reset,
  };
}

export const TOTAL_CONTENT_STEPS = 5; // interests, activities, equipment, bio, recap (cover = 0, not counted)
