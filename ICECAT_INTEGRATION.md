# Icecat Product Integration

This document describes the Icecat integration for importing real product data and images.

## Overview

The Icecat service provides a structured catalog of consumer electronics products with authorized images and specifications. This integration allows Vuvio to:

- Search for real products by brand and model
- Import product data (name, specs, identifiers)
- Use official product images (with proper licensing)
- Avoid duplicate entries via GTIN/EAN/MPN matching
- Fallback to local placeholders if Icecat is unavailable

## Setup

### 1. Icecat Account

Visit https://icecat.biz and create an account.

Options:
- **Free Tier**: Limited search, XML API only
- **Premium**: Full API access, better search results

### 2. Set Firebase Function Secrets

```bash
firebase functions:secrets:set ICECAT_USERNAME
firebase functions:secrets:set ICECAT_API_KEY
```

When prompted, enter your Icecat credentials.

### 3. Environment Variables

In `functions/.env.local`:

```env
ICECAT_LANGUAGE=en
ICECAT_MARKET=GB
```

Supported languages: `en`, `de`, `fr`, `es`, `it`, `nl`, `pt`, `ru`, `ja`, `zh`
Supported markets: `GB`, `US`, `DE`, `FR`, `ES`, `IT`, `NL`, `CH`, `BE`, `AU`, `CA`, `JP`

### 4. Deploy

```bash
cd functions
npm install
firebase deploy --only functions
```

## Architecture

### Backend (`/functions/src/products/`)

- **icecatService.ts**: Icecat API client
  - `searchIcecatProducts()` - Search via XML API
  - `getIcecatProduct()` - Fetch detailed product data
  - `mapIcecatToVuvioProduct()` - Normalize to Vuvio schema

- **deduplicateProduct.ts**: Prevent duplicate imports
  - Check by GTIN, EAN, MPN
  - Check by name + brand
  - Check by Icecat ID

- **icecatRoutes.ts**: HTTP endpoints
  - `POST /api/products/search-icecat` - Search
  - `POST /api/products/import-icecat` - Import single product

### Frontend (`/src/services/`)

- **icecatClient.js**: API client
  - `searchIcecatProducts()` - Call backend search
  - `importIcecatProduct()` - Import product
  - `categorizeIcecatProduct()` - Auto-detect category

## API Endpoints

### Search

```bash
POST /api/products/search-icecat

Request:
{
  "query": "GoPro HERO13",
  "limit": 20
}

Response:
{
  "success": true,
  "source": "icecat" | "local",
  "count": 5,
  "results": [
    {
      "source": "icecat",
      "sourceProductId": "12345",
      "brand": "GoPro",
      "name": "HERO13 Black",
      "canImport": true
    }
  ]
}
```

### Import

```bash
POST /api/products/import-icecat
Headers:
  Authorization: Bearer <firebase-id-token>

Request:
{
  "productId": "12345",
  "category": "recording"
}

Response:
{
  "success": true,
  "productId": "abc123xyz",
  "isUpdate": false,
  "conflictField": null
}
```

## Product Data Schema

When importing from Icecat, products include:

```typescript
{
  // Standard fields
  id: string;
  brand: string;
  name: string;
  category: string;
  description?: string;
  searchTerms: string[];

  // Images
  thumbnailUrl?: string;        // For product cards
  originalImageUrl?: string;    // Full-size image

  // Source tracking
  source: 'icecat' | 'manual' | 'placeholder';
  sourceProductId: string;      // Icecat ID
  sourceProductUrl: string;     // Link to product on icecat.biz
  sourceImageUrl: string;       // Original image URL

  // Identifiers (for deduplication)
  gtin?: string;
  ean?: string;
  mpn?: string;

  // Image rights
  imageSource: 'official' | 'partner' | 'uploaded' | 'placeholder';
  imageStatus: 'pending' | 'ready' | 'failed';
  imageRights?: string;         // License info from Icecat

  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

## Deduplication Logic

Before importing, the system checks if a product already exists:

1. **GTIN Match**: Exact match on Global Trade Item Number
2. **EAN Match**: Exact match on European Article Number
3. **MPN + Brand**: Exact match on Manufacturer Part Number + brand
4. **Name + Brand**: Normalized string match
5. **Icecat ID**: Already imported from this product

If a match is found, the product is **merged** (not duplicated):
- Updates external identifiers
- Preserves user-added data
- Adds new images if available

## Image Handling

### Icecat Image URLs

Icecat provides images with usage rights. The integration:

- ✅ Stores the remote URL if allowed
- ✅ Downloads and caches if needed
- ❌ Never violates image licensing terms

### Fallback Strategy

If Icecat image fails:

1. Try cached version
2. Use placeholder (category icon)
3. No broken image shown

### ProductThumbnail Component

The frontend component automatically:

- Displays real images when available
- Shows placeholders gracefully
- Indicates placeholder with dashed border (dev mode)
- Logs errors in console

## Testing

### Test Products

Try importing these from Icecat:

```
GoPro HERO13 Black
DJI Mic 2
Canyon Grail 7
POC Omne Air
Five Ten Freerider Pro
```

Each should:
1. Appear in search results
2. Have a real image
3. Import without duplicates
4. Display in "My Equipment"

### Validation

```javascript
// In browser console
import { searchIcecatProducts, importIcecatProduct } from './services/icecatClient.js';

// Search
const results = await searchIcecatProducts('GoPro');
console.log('Results:', results);

// Import first result
if (results.length > 0) {
  const imported = await importIcecatProduct(
    results[0].sourceProductId,
    'recording'
  );
  console.log('Imported:', imported);
}
```

## Troubleshooting

### No Icecat Results

**Cause**: Icecat service not configured or API unavailable

**Solution**:
- Verify ICECAT_USERNAME and ICECAT_API_KEY are set
- Check Firebase Function logs: `firebase functions:log`
- Fallback uses local products

### Duplicate Products

**Cause**: Same product imported twice

**Solution**:
- Check deduplication logic in function logs
- Clear Firestore collection (dev only)
- Use GTIN/EAN/MPN for reliable matching

### Image Not Loading

**Cause**: Icecat image URL changed or access denied

**Solution**:
- Check image URL in Firestore
- Verify HTTPS (not HTTP)
- Use category placeholder as fallback

### API Rate Limiting

**Cause**: Too many requests to Icecat

**Solution**:
- Implement caching (already done in dedup)
- Increase timeout in `icecatService.ts`
- Use batch imports during off-hours

## Security Considerations

### Credentials

- Stored as Firebase Function secrets (not in code)
- Never exposed to frontend
- Rotated via `firebase functions:secrets:set`

### SSRF Protection

- Icecat domain whitelist: `icecat.biz` only
- All fetches use HTTPS
- No localhost or private IP addresses
- 30-second timeout on requests

### Data Validation

- Product IDs validated
- Image URLs verified before storing
- MIME types checked
- Size limits enforced

## Future Enhancements

- [ ] Batch import (multiple products at once)
- [ ] Auto-update existing products weekly
- [ ] Use Icecat's advanced search (commercial API)
- [ ] Support local image caching on CDN
- [ ] Category mapping improvements
- [ ] Specs extraction and display

## References

- Icecat Documentation: https://icecat.biz/en/publish/xml-p-datasheet
- Icecat API: https://icecat.biz/en/api
- Product Schema: See `types/product.ts`
