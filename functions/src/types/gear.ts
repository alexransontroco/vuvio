import type { Timestamp } from 'firebase-admin/firestore';

export interface GearDocument {
  ownerId: string;
  type: string;
  category: string;
  brand: string | null;
  model: string | null;
  displayName: string;
  imageUrl: string | null;
  productUrl: string | null;
  affiliateUrl: string | null;
  visibility: 'public' | 'private';
  verified: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
