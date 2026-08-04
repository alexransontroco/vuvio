# Product Thumbnails System - Implementation Guide

## ✅ What's been built

### Phase 1: Data Model & Services (Complete)

#### Data Model (`src/data/productModel.js`)
- Product TypeScript interface with image processing fields
- 25+ demo products across all categories
- Category and subcategory definitions

#### Product Service (`src/services/productService.js`)
- `getProductsByCategory(categoryId)` - Fetch by category
- `getProduct(productId)` - Single product lookup
- `searchProducts(query, categoryId)` - Full-text search with debounce
- `createProduct(data)` - Create new products
- `updateProductImageStatus()` - Update processing status
- `getProductThumbnailUrl(product, size)` - Get appropriate thumbnail size
- `isProductImageReady(product)` - Check if image is ready
- Firestore + localStorage caching with fallback to demo data

#### Image Processing Service (`src/services/imageProcessingService.js`)
- `validateImageUrl(url)` - SSRF protection & domain validation
- `downloadImage(url)` - Secure fetch with timeout & size limits
- `validateMimeType(buffer)` - Magic byte validation for JPEG, PNG, WebP
- `requestImageProcessing(productId, url)` - Initiate Cloud Function
- `updateProductImages(productId, urls)` - Save processed URLs
- `markImageProcessingFailed(productId, error)` - Error handling

### Phase 2: Frontend Components (Complete)

#### ProductThumbnail (`src/components/product/ProductThumbnail.jsx`)
- Wrapper around existing `GearThumbnail`
- Sizes: `xs` (40px), `sm` (56px), `md` (80px), `lg` (120px)`
- States: loading, ready, processing, failed
- Fallback to category emoji icons
- Lazy loading support
- Selection state support

#### ProductSearch (`src/components/product/ProductSearch.jsx`)
- Debounced autocomplete (300ms)
- Visual results with thumbnails
- "Can't find?" action for missing products
- Responsive dropdown with keyboard support
- Loading states

#### Styling
- `product-thumbnail.css` - Thumbnail styles with glass morphism
- `product-search.css` - Search dropdown with theme matching

### Phase 3: Image Processing Pipeline (Complete)

#### Cloud Function (`functions/src/processProductImage.js`)
Two triggers:

1. **HTTP Endpoint** (`/processProductImage`)
   ```bash
   curl -X POST https://.../processProductImage \
     -H "Content-Type: application/json" \
     -d '{"productId": "gopro-hero13", "sourceImageUrl": "https://..."}'
   ```

2. **Firestore Trigger**
   - Listens to `products/{productId}`
   - Auto-processes when `imageStatus.status == "processing"`

**Processing Pipeline:**
- Download from source URL (HTTPS only, <50MB, 30s timeout)
- Validate MIME type via magic bytes
- Auto-rotate based on EXIF
- Generate 3 sizes:
  - `thumbnail` (160×160px) for list views
  - `preview` (320×320px) for retina displays
  - `original` (640×640px) for detail pages
- All with 12% padding, transparent background, WebP format (quality 84)
- Upload to Cloud Storage with immutable cache headers
- Update product document with ready status

## 🚀 Integration Steps

### 1. Update functions/package.json

Add dependencies:
```json
{
  "dependencies": {
    "firebase-admin": "^11.0.0",
    "firebase-functions": "^4.0.0",
    "sharp": "^0.32.0",
    "node-fetch": "^2.6.0",
    "uuid": "^9.0.0"
  }
}
```

Deploy:
```bash
cd functions
npm install
firebase deploy --only functions:processProductImageHttp,functions:processProductImageFirestore
```

### 2. Use ProductSearch in EquipmentManagePage

```jsx
import { ProductSearch } from '../components/product/index.js';

export function EquipmentManagePage() {
  const handleSelectProduct = (product) => {
    // Save product ID to equipment
    saveEquipment({
      productId: product.id,
      brand: product.brand,
      name: product.name,
      category: product.category,
      // Don't duplicate image - fetch from product when needed
    });
  };

  return (
    <ProductSearch
      categoryId={selectedCategory}
      onSelectProduct={handleSelectProduct}
    />
  );
}
```

### 3. Display thumbnails in equipment lists

```jsx
import { ProductThumbnail } from '../components/product/index.js';
import { getProduct } from '../services/productService.js';

export function EquipmentRow({ equipment }) {
  const [product, setProduct] = useState(null);

  useEffect(() => {
    if (equipment.productId) {
      getProduct(equipment.productId).then(setProduct);
    }
  }, [equipment.productId]);

  return (
    <div className="equipment-row">
      {product && (
        <ProductThumbnail product={product} size="md" />
      )}
      <strong>{equipment.brand} {equipment.name}</strong>
    </div>
  );
}
```

### 4. Firestore Security Rules

```firestore
match /products/{productId} {
  allow read: if true; // Public read
  allow create, update: if request.auth != null && request.auth.uid == getAfter(/databases/$(database)/documents/users/$(request.auth.uid)).data.uid;
  allow delete: if false;
}
```

## 📊 Image Processing Flow

```
User selects product with image URL
       ↓
ProductSearch submits product.id + sourceImageUrl
       ↓
imageProcessingService.requestImageProcessing()
       ↓
Product document imageStatus.status = "processing"
       ↓
Cloud Function triggered (Firestore)
       ↓
Download image → Validate → Process → Upload to Storage
       ↓
Update product: imageStatus.status = "ready" + URLs
       ↓
Frontend detects ready status → shows thumbnail
```

## 🎨 Component Usage Examples

### Search and select
```jsx
<ProductSearch
  categoryId="recording"
  onSelectProduct={(product) => console.log(product)}
/>
```

### Display thumbnail
```jsx
<ProductThumbnail
  product={product}
  size="md"
  priority={true}
  selected={isSelected}
  onClick={() => setSelected(!isSelected)}
/>
```

## 🔒 Security Features

✅ SSRF protection - URL validation & domain allowlist
✅ File size limits - Max 50MB
✅ Timeout protection - 30s max download time
✅ MIME type validation - Magic byte checking
✅ HTTPS only - No unencrypted image sources
✅ Immutable CDN cache - 1 year, no stale updates
✅ Firestore permissions - Auth required for create/update

## ⚡ Performance

- Lazy loading images by default
- Srcset support for 1x/2x displays
- WebP compression (84% quality, ~20-30KB per thumbnail)
- Cloud Storage CDN caching (1 year)
- Debounced search (300ms)
- localStorage caching of demo products

## 📝 Next Steps (Optional Enhancements)

1. **Automatic background removal** - Add ML-based background detection
2. **Variation support** - Multiple colors/sizes per product
3. **User-submitted images** - Allow creators to add product photos
4. **Image optimization** - Serve AVIF for modern browsers
5. **Analytics** - Track which products are most used
6. **Bulk import** - CSV/API import for product catalog

## 🐛 Testing

### Test image processing:
```bash
# Manually trigger via HTTP function
curl -X POST https://region-project.cloudfunctions.net/processProductImageHttp \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "test-product-123",
    "sourceImageUrl": "https://images.unsplash.com/photo-1606986628025-35d57e735ae0"
  }'
```

### Check product status:
```
Firebase Console → Firestore → products → Check imageStatus field
```

### View uploaded images:
```
Firebase Console → Storage → products/{productId}/
```

---

**Built with:** React 18, Firebase, Sharp, WebP, Cloud Functions

