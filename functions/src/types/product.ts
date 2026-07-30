/**
 * Product Type Definitions
 */

export interface ProductImageStatus {
  status: 'pending' | 'processing' | 'ready' | 'failed';
  urls?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  error?: string;
  sourceUrl?: string;
  updatedAt?: number | any;
}

export interface ProductDocument {
  id: string;
  brand: string;
  name: string;
  category: string;
  description?: string;
  productUrl?: string;
  affiliateUrl?: string;
  images?: string[];
  imageStatus?: ProductImageStatus;
  createdAt: number | any;
  updatedAt: number | any;
}

export interface CreateProductInput {
  brand: string;
  name: string;
  category: string;
  description?: string;
  productUrl?: string;
  affiliateUrl?: string;
  images?: string[];
}
