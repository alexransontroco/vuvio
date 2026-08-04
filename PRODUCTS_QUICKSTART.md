# Product Thumbnails System - Quick Start

Fast-track guide to using the product system in Vuvio.

## 5-Minute Setup

### 1. Get a Product
```javascript
import { getProduct } from '@/services/productService'

const product = await getProduct('gopro-hero13-black')
// Result: { id, brand, name, category, imageStatus, ... }
```

### 2. Display It
```jsx
import { ProductThumbnail } from '@/components/product/ProductThumbnail'

<ProductThumbnail 
  product={product}
  size="md"
/>
```

Done! You now have a product thumbnail with image, loading state, and error fallback.

## 10-Minute Setup: Search Component

```jsx
import { ProductSearch } from '@/components/product/ProductSearch'

<ProductSearch
  onSelect={(product) => {
    console.log('Selected:', product.name)
    // Do something with the product
  }}
  onNotFound={(query) => {
    console.log('User couldn\'t find:', query)
    // Open form to add custom product
  }}
/>
```

That's it for the UI!

## Common Tasks

### List products by category
```javascript
import { getProductsByCategory } from '@/services/productService'

const cameras = await getProductsByCategory('recording')
const mics = await getProductsByCategory('audio')
```

### Search products
```javascript
import { searchProducts } from '@/services/productService'

const results = await searchProducts('Sony')
// Returns array of matching products
```

### Add image to a product
```javascript
import { processProductImage } from '@/services/imageProcessingService'

// This triggers the cloud function to generate thumbnails
const thumbnailUrls = await processProductImage(
  'product-id',
  'https://images.unsplash.com/...'
)
// Result: { small, medium, large } URLs
```

### Check image processing status
```javascript
// After calling processProductImage, the product doc is updated
// You can monitor the status:
const product = await getProduct('product-id')
console.log(product.imageStatus.status) // 'processing' → 'ready' or 'failed'
```

## Component Props

### ProductThumbnail
```tsx
<ProductThumbnail
  product={product}        // Required: Product object
  size="md"                // Optional: 'sm' | 'md' | 'lg'
  priority={false}         // Optional: Preload image eagerly
  selected={false}         // Optional: Selection state
  onClick={() => {}}       // Optional: Click handler
  onError={() => {}}       // Optional: Error callback
/>
```

### ProductSearch
```tsx
<ProductSearch
  onSelect={callback}      // Required: Product selected
  onNotFound={callback}    // Optional: User can't find product
  placeholder="..."        // Optional: Input placeholder
  maxResults={12}          // Optional: Max search results
  open={false}             // Optional: Open state
  onOpenChange={callback}  // Optional: Open state change
/>
```

## Data Flow

```
Firestore Collection: products/
├─ (Millions of products in production)
└─ (Queried with caching)
    ↓
productService.getProduct()
    ↓
localStorage cache (1 hour)
    ↓
ProductThumbnail component
    ↓
Display image or icon + loading state
```

## Image Status States

When a product has images, check `imageStatus.status`:

```javascript
const product = await getProduct('gopro-hero13')
const status = product.imageStatus.status

if (status === 'ready') {
  // Use product.imageStatus.urls.medium
  img.src = product.imageStatus.urls.medium
}

if (status === 'processing') {
  // Show skeleton loader
  showLoader()
}

if (status === 'failed') {
  // Show error icon
  showErrorIcon(product.imageStatus.error)
}

if (status === 'pending') {
  // No image data yet
  showPlaceholder()
}
```

The `ProductThumbnail` component handles all this automatically!

## Debugging

### Not seeing demo products?
```javascript
import { demoProducts } from '@/data/productModel'
console.log(demoProducts) // Should show ~20 demo items
```

### Search returning nothing?
```javascript
import { searchProducts } from '@/services/productService'

const results = await searchProducts('go') // Min 2 chars
console.log(results) // Should include GoPro, etc.
```

### Image not loading?
```javascript
const product = await getProduct('gopro-hero13-black')
console.log('Status:', product.imageStatus.status)
console.log('URLs:', product.imageStatus.urls)
console.log('Error:', product.imageStatus.error)

// If status is 'ready' but image doesn't load:
// - URL might be expired
// - Cloud Function might not have run yet
// - Try re-triggering: processProductImage(id, url)
```

### Cloud Function error?
1. Check Firebase Console → Cloud Functions → Logs
2. Look for `processProductImage` function
3. Common issues:
   - Image URL not in allowlist (check `ALLOWED_DOMAINS`)
   - Image too large (>50MB)
   - Network timeout (>30s)
   - Unsupported image format

## Integration Examples

### Equipment Grid
```jsx
import { getProductsByCategory } from '@/services/productService'
import { ProductThumbnail } from '@/components/product/ProductThumbnail'

export function EquipmentGrid({ category }) {
  const [products, setProducts] = useState([])

  useEffect(() => {
    getProductsByCategory(category).then(setProducts)
  }, [category])

  return (
    <div className="grid">
      {products.map(product => (
        <ProductThumbnail
          key={product.id}
          product={product}
          onClick={() => selectEquipment(product)}
        />
      ))}
    </div>
  )
}
```

### Equipment Selector for Live Stream
```jsx
import { ProductSearch } from '@/components/product/ProductSearch'

export function SelectStreamEquipment() {
  const handleSelect = (product) => {
    // Add to stream
    updateStream({
      equipment: [...stream.equipment, product.id]
    })
  }

  return (
    <div>
      <h3>Add Equipment to Your Stream</h3>
      <ProductSearch onSelect={handleSelect} />
    </div>
  )
}
```

### Equipment Profile Page
```jsx
import { ProductThumbnail } from '@/components/product/ProductThumbnail'

export function CreatorEquipment({ equipmentIds }) {
  const [products, setProducts] = useState({})

  useEffect(() => {
    Promise.all(
      equipmentIds.map(id => getProduct(id))
    ).then(results => {
      const map = {}
      results.forEach(p => map[p.id] = p)
      setProducts(map)
    })
  }, [equipmentIds])

  return (
    <div className="equipment-section">
      {equipmentIds.map(id => (
        <ProductThumbnail
          key={id}
          product={products[id]}
          size="lg"
        />
      ))}
    </div>
  )
}
```

## Next Steps

1. **Add to stream setup:** Use ProductSearch when creating/editing streams
2. **Create equipment cards:** Build a creator equipment profile page
3. **Add image processing UI:** Show progress when user uploads product image
4. **Implement "add custom product":** Form to create products with custom images

See `PRODUCTS_SYSTEM_GUIDE.md` for complete documentation.

## Performance Tips

- Use `preloadProductCategory()` before showing category UI
- Cache product list with sessionStorage
- Lazy-load ProductSearch component
- ProductThumbnail automatically handles image optimization

## API Reference

**Data:**
- `getProduct(id)` → Product
- `getProductsByCategory(categoryId)` → Product[]
- `searchProducts(query)` → Product[]
- `createProduct(data)` → Product

**Images:**
- `processProductImage(id, url)` → {small, medium, large}
- `monitorImageProcessing(id)` → ImageStatus

**Utilities:**
- `validateImageUrl(url)` → {valid, error?}
- `downloadImage(url)` → Blob
- `validateImageBlob(blob)` → {valid, mimeType, error?}
- `getImageDimensions(blob)` → {width, height}

## Questions?

Refer to `PRODUCTS_SYSTEM_GUIDE.md` for:
- Complete architecture overview
- Firestore schema
- Cloud Function details
- Troubleshooting guide
- Future roadmap

---

**Status:** Phase 1 Complete ✓  
**Next Phase:** Production image processing (Cloud Run or external API)
