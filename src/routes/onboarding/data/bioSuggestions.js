// Mapping category id → i18n key for a bio suggestion chip.
// Resolved via t(`onboarding.bio.suggestions.${key}`).
export const BIO_SUGGESTION_KEYS_BY_CATEGORY = {
  food: 'food',
  crafts: 'crafts',
  outdoor: 'outdoor',
  cycling: 'cycling',
  aviation: 'aviation',
  sailing: 'sailing',
  watersports: 'watersports',
  fishing: 'fishing',
  music: 'music',
  emergency: 'emergency',
  farming: 'farming',
  transport: 'transport',
  energy: 'energy',
};

export const BIO_FALLBACK_KEYS = ['outdoor', 'music', 'crafts'];

export function suggestionsForCategories(selectedCategories = []) {
  const keys = selectedCategories
    .map((id) => BIO_SUGGESTION_KEYS_BY_CATEGORY[id])
    .filter(Boolean);
  const uniq = [...new Set(keys)];
  if (uniq.length >= 3) return uniq.slice(0, 3);
  for (const fallback of BIO_FALLBACK_KEYS) {
    if (uniq.length >= 3) break;
    if (!uniq.includes(fallback)) uniq.push(fallback);
  }
  return uniq.slice(0, 3);
}
