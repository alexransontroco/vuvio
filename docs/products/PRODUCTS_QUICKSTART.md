# Product System — Quick Start

Status: Product-system quickstart, partially current  
Last reviewed: 2026-09-18  
Read before coding: Use with [PRODUCTS_SYSTEM_GUIDE.md](PRODUCTS_SYSTEM_GUIDE.md) and verify current routes/services.

> Product search and thumbnails should be validated against current fallback behavior. Icecat/provider work requires backend secrets and deployed functions.

---

## Get and display a product

```javascript
import { getProduct } from '@/services/productService'
import { ProductThumbnail } from '@/components/product/ProductThumbnail'

const product = await getProduct('gopro-hero13-black')

<ProductThumbnail product={product} size="md" />
```

## Search component

```jsx
import { ProductSearch } from '@/components/product/ProductSearch'

<ProductSearch
  onSelect={(product) => { /* use product */ }}
  onNotFound={(query) => { /* open custom add form */ }}
/>
```

## Common operations

```javascript
// By category
const cameras = await getProductsByCategory('recording')

// Search
const results = await searchProducts('Sony')

// Trigger thumbnail generation
const urls = await processProductImage('product-id', 'https://images.unsplash.com/...')
// → { small, medium, large } URLs

// Check status
const product = await getProduct('product-id')
product.imageStatus.status  // 'pending' | 'processing' | 'ready' | 'failed'
```

## Component props

```tsx
<ProductThumbnail
  product={product}    // required
  size="md"            // 'sm' | 'md' | 'lg'
  priority={false}     // eager preload
  selected={false}
  onClick={() => {}}
  onError={() => {}}
/>

<ProductSearch
  onSelect={callback}        // required
  onNotFound={callback}
  placeholder="..."
  maxResults={12}
  open={false}
  onOpenChange={callback}
/>
```

## Image status handling

`ProductThumbnail` handles all states automatically. To check manually:

```javascript
const { status, urls, error } = product.imageStatus
// status: 'pending' → placeholder icon
//         'processing' → skeleton loader
//         'ready' → use urls.medium
//         'failed' → error icon
```

## Debugging

```javascript
// Not seeing demo products?
import { demoProducts } from '@/data/productModel'
console.log(demoProducts)

// Search returning nothing?
const results = await searchProducts('go')  // min 2 chars

// Image not loading?
const p = await getProduct('gopro-hero13-black')
console.log(p.imageStatus)
```

## Cloud Function errors

Check Firebase Console → Cloud Functions → Logs → `processProductImage`. Common causes: URL not in `ALLOWED_DOMAINS`, image >50MB, network timeout.

---

## API Reference

```
getProduct(id)
getProductsByCategory(categoryId)
searchProducts(query)
createProduct(data)
processProductImage(id, url)       → {small, medium, large}
monitorImageProcessing(id)         → ImageStatus
validateImageUrl(url)
preloadProductCategory(categoryId)
clearProductCache()
```

See [PRODUCTS_SYSTEM_GUIDE.md](PRODUCTS_SYSTEM_GUIDE.md) for full architecture, Firestore schema, and troubleshooting.
