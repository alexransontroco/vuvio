import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

/**
 * Track an affiliate click in Firestore. Never throws — redirect must not be blocked.
 */
async function trackAffiliateClick({ equipmentId, productId, liveId, streamerId, viewerId, merchant, affiliateUrl }) {
  try {
    await addDoc(collection(db, 'affiliateClicks'), {
      equipmentId: equipmentId ?? null,
      productId: productId ?? null,
      liveId: liveId ?? null,
      streamerId: streamerId ?? null,
      viewerId: viewerId ?? null,
      merchant: merchant ?? null,
      affiliateUrl: affiliateUrl ?? null,
      timestamp: serverTimestamp(),
    });
  } catch {
    // Silently ignore — never block the redirect
  }
}

/**
 * Track then open an affiliate offer in a new tab.
 * context: { equipmentId, productId, liveId, streamerId, viewerId }
 */
export function openOffer(offer, context = {}) {
  const url = offer.affiliateUrl ?? offer.productUrl;
  if (!url) return;
  trackAffiliateClick({
    equipmentId: context.equipmentId,
    productId: context.productId,
    liveId: context.liveId,
    streamerId: context.streamerId,
    viewerId: context.viewerId,
    merchant: offer.merchant ?? null,
    affiliateUrl: url,
  });
  window.open(url, '_blank', 'noreferrer');
}

/**
 * Build a normalized offers array from an equipment item.
 * Supports new `offers` field and legacy `affiliateUrl`/`productUrl`.
 */
export function getItemOffers(item) {
  if (Array.isArray(item?.offers) && item.offers.length > 0) return item.offers;
  const url = item?.affiliateUrl ?? item?.productUrl;
  if (!url) return [];
  return [{ merchant: item.merchant ?? null, affiliateUrl: url, country: item.offerCountry ?? null }];
}
