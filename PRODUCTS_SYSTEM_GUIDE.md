# Vuvio Product Thumbnails System

Complete guide for the product image thumbnail system for Vuvio.

## Overview

This system manages product data and thumbnails for use throughout Vuvio. It handles:
- Product data management (recording equipment, audio gear, activity gear, streaming setup, power/accessories)
- Image processing and thumbnail generation (160px, 320px, 640px)
- Firestore storage with localStorage caching
- Frontend UI components for product selection and search

## Architecture

### 1. Data Model (`src/data/productModel.js`)

Defines product structure and demo data.

**Product Structure:**
```javascript
{
  id: string,              // Unique identifier
  brand: string,           // Brand/manufacturer
  name: string,            // Product name
  category: string,        // Category ID
  description?: string,    // Product description
  productUrl?: string,     // Official product page
  affiliateUrl?: string,   // Affiliate link
  images?: string[],       // Image URLs
  imageStatus?: {
    status: 'pending' | 'processing' | 'ready' | 'failed',
    urls?: {
      small: string,       // 160px thumbnail
      medium: string,      // 320px thumbnail
      large: string        // 640px thumbnail
    },
    error?: string,        // Error message
    sourceUrl?: string     // Original image URL
  },
  createdAt: number,
  updatedAt: number
}
```

**Categories:**
- `recording` - Cameras, lenses, mounts
- `audio` - Microphones, headphones
- `activity` - Vehicles, tools, clothing
- `streaming` - Apps, encoders, connectivity
- `power_accessories` - Batteries, mounts, accessories

**Demo Products:**
Pre-populated collection includes GoPro, DJI, RODE, Canyon, POC, LiveU, etc.

### 2. Product Service (`src/services/productService.js`)

Backend integration with Firestore and localStorage caching.

**Key Methods:**

```javascript
// Get single product
const product = await getProduct(productId)

// Get products by category
const products = await getProductsByCategory(categoryId)

// Search products
const results = await searchProducts('GoPro')

// Create new product
const newProduct = await createProduct({
  brand: 'Sony',
  name: 'A6700',
  category: 'recording',
  description: '...',
  productUrl: '...'
})

// Update image processing status
await updateProductImageStatus(productId, 'ready', {
  small: 'https://...',
  medium: 'https://...',
  large: 'https://...'
})

// Get image from Storage
const bytes = await getProductImageFromStorage('products/product-id/thumbnail-160.webp')

// Clear cache
clearProductCache()

// Preload category
const products = await preloadProductCategory('recording')

// Get category counts
const counts = await getProductCategoriesWithCounts()
```

**Caching Strategy:**
- localStorage cache with 1-hour TTL
- Automatic fallback to Firestore
- Demo products as ultimate fallback

### 3. Image Processing Service (`src/services/imageProcessingService.js`)

Frontend image validation and download utilities.

**Key Methods:**

```javascript
// Validate URL before processing
const validation = validateImageUrl(url, checkDomain)
// Returns: { valid: boolean, error?: string }

// Download image with timeout
const blob = await downloadImage(url, timeout, maxSize)
// timeout: ms (default 10000)
// maxSize: bytes (default 50MB)

// Validate image blob by magic bytes
const validation = await validateImageBlob(blob)
// Returns: { valid: boolean, mimeType: string, error?: string }

// Get image dimensions
const { width, height } = await getImageDimensions(blob)

// Generate canvas-based thumbnail
const thumbBlob = await generateThumbnailCanvas(blob, width, height)

// Trigger cloud function processing
await triggerImageProcessing(productId, imageUrl)

// Monitor processing status with polling
const result = await monitorImageProcessing(productId)

// Complete flow: validate → download → process
const urls = await processProductImage(productId, imageUrl)
```

**Allowed Domains:**
- `images.unsplash.com`
- `cdn.shopify.com`
- `images.pexels.com`
- `images.pixabay.com`
- (Easily extensible in `ALLOWED_DOMAINS`)

### 4. Frontend Components

#### ProductThumbnail.jsx

Wrapper around existing GearThumbnail component with product-specific logic.

```jsx
import { ProductThumbnail } from '@/components/product/ProductThumbnail'

<ProductThumbnail
  product={productData}
  size="md"              // sm | md | lg
  priority={false}       // Preload image
  selected={false}       // Selection state
  onClick={() => {}}     // Click handler
  onError={() => {}}     // Error handler
/>
```

**Image Status Handling:**
- `pending` - No image data yet, shows icon
- `processing` - Shows skeleton loader
- `ready` - Shows thumbnail image
- `failed` - Shows error icon

#### ProductSearch.jsx

Autocomplete search component with thumbnail previews.

```jsx
import { ProductSearch } from '@/components/product/ProductSearch'

<ProductSearch
  onSelect={(product) => {}}
  onNotFound={(query) => {}}
  placeholder="Search products..."
  maxResults={12}
  open={false}
  onOpenChange={(open) => {}}
/>
```

**Features:**
- Debounced search (300ms)
- Keyboard navigation (↑↓ Enter Esc)
- Click-outside auto-close
- "Can't find?" action
- Grid layout with 3-12 results

#### Styles

- `gear-thumbnail.css` - GearThumbnail base + product status indicators
- `product-search.css` - Search component with dropdown

### 5. Cloud Function (`functions/src/products/processProductImage.ts`)

Node.js server-side image processing.

**Endpoint:** `POST /api/products/process-image`

**Request:**
```json
{
  "productId": "gopro-hero13",
  "imageUrl": "https://images.unsplash.com/..."
}
```

**Response (200):**
```json
{
  "success": true,
  "productId": "gopro-hero13",
  "imageStatus": {
    "status": "ready",
    "urls": {
      "small": "https://storage.googleapis.com/.../thumbnail-160.webp",
      "medium": "https://storage.googleapis.com/.../thumbnail-320.webp",
      "large": "https://storage.googleapis.com/.../thumbnail-640.webp"
    }
  }
}
```

**Processing Steps:**
1. Validate URL against allowlist
2. Download image (max 50MB, 30s timeout)
3. Validate MIME type by magic bytes
4. Generate 3 thumbnail sizes
5. Upload to Firebase Storage with public access
6. Update product document with URLs
7. Return thumbnail URLs

**Error Handling:**
- Invalid domain → 400
- Invalid URL format → 400
- Download timeout → 400
- Image too large → 400
- Invalid MIME type → 400
- Processing error → 500

**Security:**
- Domain whitelist (extensible)
- Size validation (50MB max)
- Timeout protection (30s)
- MIME type validation
- Magic byte verification

### 6. Firestore Schema

**Collection: `products`**

```
products/
  ├── gopro-hero13-black/
  │   ├── brand: "GoPro"
  │   ├── name: "HERO13 Black"
  │   ├── category: "recording"
  │   ├── description: "..."
  │   ├── productUrl: "..."
  │   ├── images: ["https://..."]
  │   ├── imageStatus: {
  │   │   status: "ready",
  │   │   urls: {
  │   │     small: "https://storage.googleapis.com/.../160.webp",
  │   │     medium: "https://storage.googleapis.com/.../320.webp",
  │   │     large: "https://storage.googleapis.com/.../640.webp"
  │   │   },
  │   │   updatedAt: 1234567890
  │   │ }
  │   ├── createdAt: 1234567890
  │   └── updatedAt: 1234567890
  └── ...
```

**Indexes (Optional):**
- `category` ASC, `brand` ASC (for category listing)

## Usage Examples

### Display Product with Thumbnail

```jsx
import { ProductThumbnail } from '@/components/product/ProductThumbnail'
import { getProduct } from '@/services/productService'

export function EquipmentCard({ productId }) {
  const [product, setProduct] = useState(null)

  useEffect(() => {
    getProduct(productId).then(setProduct)
  }, [productId])

  if (!product) return <div>Loading...</div>

  return (
    <div className="equipment-card">
      <ProductThumbnail
        product={product}
        size="lg"
        onClick={() => console.log('Selected:', product)}
      />
      <h3>{product.brand} {product.name}</h3>
    </div>
  )
}
```

### Add Image Processing to Product

```javascript
import { processProductImage } from '@/services/imageProcessingService'
import { getProduct } from '@/services/productService'

async function addProductImage(productId, imageUrl) {
  try {
    // Trigger processing (updates product document)
    const urls = await processProductImage(productId, imageUrl)
    
    // Verify it's complete
    const product = await getProduct(productId)
    console.log('Thumbnails ready:', product.imageStatus.urls)
  } catch (error) {
    console.error('Image processing failed:', error)
  }
}
```

### Search and Select Product

```jsx
import { ProductSearch } from '@/components/product/ProductSearch'

export function EquipmentSearch() {
  const handleSelect = (product) => {
    console.log('Selected:', product)
    // Add to stream equipment, etc.
  }

  const handleNotFound = (query) => {
    console.log('User couldn\'t find:', query)
    // Open form to add custom product
  }

  return (
    <ProductSearch
      onSelect={handleSelect}
      onNotFound={handleNotFound}
      placeholder="Find your equipment..."
    />
  )
}
```

### Browse Category

```javascript
import { getProductsByCategory } from '@/services/productService'

const recordingGear = await getProductsByCategory('recording')
const audioGear = await getProductsByCategory('audio')
const bikes = await getProductsByCategory('activity')
```

## Image Processing Pipeline

### Frontend Flow

```
User uploads image URL
    ↓
validateImageUrl()
    ↓
downloadImage()
    ↓
validateImageBlob()
    ↓
getImageDimensions()
    ↓
triggerImageProcessing() [calls Cloud Function]
    ↓
monitorImageProcessing() [polls product doc]
    ↓
Image ready (imageStatus.status = 'ready')
```

### Backend Flow (Cloud Function)

```
Request { productId, imageUrl }
    ↓
validateImageUrl()
    ↓
updateProductImageStatus(status: 'processing')
    ↓
downloadImage()
    ↓
validateImageMimeType()
    ↓
For each size (160, 320, 640):
  ├─ generateThumbnail()
  ├─ uploadToStorage()
  └─ collect URL
    ↓
updateProductImageStatus(status: 'ready', urls)
    ↓
Response with thumbnail URLs
```

## Performance Optimization

### Caching Strategy
- Product data cached in localStorage (1 hour TTL)
- SessionStorage for category preloads
- Demo products as zero-latency fallback

### Image Optimization
- WebP format for thumbnails
- Three sizes (160, 320, 640px) for different UI contexts
- 1-year cache headers in Storage
- Public access with no auth overhead

### Frontend
- Debounced search (300ms)
- Lazy image loading
- Skeleton loaders during processing
- Minimal re-renders with ProductThumbnail

### Backend
- Request timeout: 30 seconds
- Image size limit: 50MB
- Processed images have 1-year cache headers
- Automatic Cloud Storage cleanup (via retention policy)

## Extending the System

### Add New Category

1. Add to `PRODUCT_CATEGORIES` in `productModel.js`:
```javascript
{
  id: 'lighting',
  label: 'Lighting',
  description: 'Lights, modifiers, and stands'
}
```

2. Add icon to `getCategoryIcon()` in `equipmentModel.js`

### Add New Product

1. Direct Firestore insert, or
2. Use `createProduct()` API:
```javascript
await createProduct({
  brand: 'Elgato',
  name: 'Key Light Air',
  category: 'lighting',
  productUrl: 'https://...',
  images: ['https://...']
})
```

### Allow New Image Domain

Add to `ALLOWED_DOMAINS` in:
- `src/services/imageProcessingService.js`
- `functions/src/products/processProductImage.ts`

### Implement Production Thumbnail Generation

Replace `generateThumbnailPlaceholder()` in `processProductImage.ts`:

**Option 1: Cloud Run with Sharp**
```javascript
// Deploy separate Cloud Run service with sharp installed
// Call from processProductImage via fetch
const response = await fetch('https://thumbnail-processor-url/generate', {
  method: 'POST',
  body: JSON.stringify({
    imageUrl,
    sizes: [160, 320, 640]
  })
})
```

**Option 2: Cloudinary/imgix**
```javascript
// Use transformation URLs
const urls = {
  small: `https://res.cloudinary.com/.../w_160/...`,
  medium: `https://res.cloudinary.com/.../w_320/...`,
  large: `https://res.cloudinary.com/.../w_640/...`
}
```

**Option 3: External API**
```javascript
const response = await fetch('https://api.example.com/thumbnail', {
  body: JSON.stringify({ imageUrl, sizes: [160, 320, 640] })
})
```

## Testing

### Test Image Processing

```javascript
// Test with demo product
const testResult = await processProductImage(
  'dji-mic-2',
  'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1'
)
console.log('Generated thumbnails:', testResult)

// Verify product updated
const product = await getProduct('dji-mic-2')
console.log('Product status:', product.imageStatus)
```

### Test Search

```javascript
const results = await searchProducts('GoPro')
console.assert(results.length > 0, 'Should find GoPro products')
console.log('Found:', results.map(p => p.name))
```

### Test Validation

```javascript
// Valid URL
const valid = validateImageUrl('https://images.unsplash.com/photo-123')
console.assert(valid.valid === true)

// Invalid domain (strict mode)
const invalid = validateImageUrl('https://mysite.com/image.jpg', true)
console.assert(invalid.valid === false)
```

## Troubleshooting

### Image Processing Hangs

**Symptom:** `monitorImageProcessing()` times out after 30 seconds

**Causes:**
- Cloud Function not deployed
- Image is too large (>50MB)
- Source URL is slow
- Network timeout

**Solution:**
1. Check Cloud Function logs
2. Verify image size: `await getImageDimensions(blob)`
3. Test download directly: `await downloadImage(url, 5000)` (5s timeout)

### Products Not Found

**Symptom:** Search returns empty results

**Causes:**
- Firestore collection empty
- Product data hasn't synced
- Demo products not loading

**Solution:**
1. Check Firestore console for `products` collection
2. Verify demo products load: `getDemoProductsByCategory('recording')`
3. Check browser cache: `clearProductCache()`

### Thumbnail URLs Missing

**Symptom:** `imageStatus.urls` is undefined

**Causes:**
- Processing not complete (`status` is still `processing`)
- Processing failed (`status` is `failed`)
- Product not found

**Solution:**
1. Check `imageStatus.status` value
2. If failed, check `imageStatus.error`
3. Verify product ID is correct
4. Re-trigger: `await processProductImage(id, url)`

### Image Validation Fails

**Symptom:** "Invalid image format" error

**Causes:**
- File is not actually an image
- Corrupted image file
- Unsupported format (WebP might not work in all contexts)

**Solution:**
1. Test with known good image from allowlist
2. Verify file headers: `await validateImageBlob(blob)`
3. Check browser DevTools Network tab for actual download

## Security Considerations

### URL Validation
- Whitelist trusted domains only
- No data: URIs or local files
- No user-supplied URLs in production initially

### Size Limits
- 50MB max (configurable)
- Prevents memory issues and DOS attacks

### Timeout Protection
- 30s max per download
- Prevents hanging requests

### Storage Access
- Public read access (images are not sensitive)
- Private write access (only Cloud Function)
- 1-year cache headers (immutable)

### Future Enhancements
- Rate limiting per IP/user
- Request signing with HMAC
- Image content analysis (safety checks)
- Virus scanning via VirusTotal API

## Metrics & Monitoring

### Key Metrics
- Products with images ready: `imageStatus.status === 'ready'`
- Processing failures: `imageStatus.status === 'failed'`
- Average processing time: Compare `createdAt` to `imageStatus.updatedAt`
- Cache hit rate: Monitor localStorage hits vs Firestore reads

### Cloud Function Metrics
- Request latency (P50, P95, P99)
- Error rate (4xx, 5xx)
- Image processing time by size
- Storage usage by category

### Frontend Metrics
- Search response time
- Thumbnail load time
- Cache effectiveness

## Roadmap

### Phase 1 (Complete) ✓
- Data model & demo products
- Product service with Firestore/cache
- Frontend components (ProductThumbnail, ProductSearch)
- Image processing service
- Cloud Function skeleton

### Phase 2 (Next)
- [ ] Production thumbnail generation (Cloud Run or external API)
- [ ] Batch image processing
- [ ] Product import tools (CSV/API)
- [ ] Image optimization analytics

### Phase 3
- [ ] User-submitted products (with moderation)
- [ ] Product ratings & reviews
- [ ] Related products suggestions
- [ ] Product pricing history

### Phase 4
- [ ] Affiliate linking & commission tracking
- [ ] Product analytics (most used gear)
- [ ] Inventory integration
- [ ] Multicurrency support

## Files Reference

**Frontend:**
- `/src/data/productModel.js` - Data structure & demo products
- `/src/services/productService.js` - Firestore & localStorage integration
- `/src/services/imageProcessingService.js` - Image validation & download
- `/src/components/product/ProductThumbnail.jsx` - Component
- `/src/components/product/ProductSearch.jsx` - Search component
- `/src/components/gear/gear-thumbnail.css` - Updated styles
- `/src/components/product/product-search.css` - Search styles

**Backend:**
- `/functions/src/products/processProductImage.ts` - Cloud Function
- `/functions/src/products/productHelpers.ts` - Utility functions
- `/functions/src/types/product.ts` - Type definitions
- `/functions/src/index.ts` - Updated with product routes

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review Cloud Function logs in Firebase Console
3. Test components in isolation
4. Verify Firestore schema matches type definitions

---

**Last Updated:** 2026-07-30
**Status:** Phase 1 Complete, Ready for Phase 2 Implementation
