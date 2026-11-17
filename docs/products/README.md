# Products Docs

Product catalog, product thumbnails, Icecat integration, and affiliate/product reference docs.

Status: Current index  
Last reviewed: 2026-11-16
Read before coding: Yes, for product catalog, product images, Icecat, gear-product mapping, or affiliate changes.

## Current Reality

- Product data is used to support creator gear and future monetization.
- Product thumbnails are generated in multiple sizes and cached.
- Icecat integration is documented, but each provider path should be verified against current code before deployment work.
- Affiliate URLs exist, but full click tracking, commission attribution, and reporting remain product/backend work.

## Do Not Regress

- Do not add product images without considering thumbnail generation and fallback behavior.
- Do not introduce a new product provider without documenting dependency and failure behavior.
- Do not commit product API secrets or provider credentials.
- Do not bypass existing product fallback data unless Firestore/API availability is guaranteed.

## Start Here

- [UNIVERSAL_EQUIPMENT_SEARCH.md](./UNIVERSAL_EQUIPMENT_SEARCH.md) — product-database alternatives, tested provider benchmark, recommended architecture, and roadmap.
- [PRODUCTS_QUICKSTART.md](PRODUCTS_QUICKSTART.md) — product system quickstart.
- [PRODUCTS_SYSTEM_GUIDE.md](PRODUCTS_SYSTEM_GUIDE.md) — full product system guide.
- [ICECAT_INTEGRATION.md](ICECAT_INTEGRATION.md) — Icecat integration notes.

## Archived Guides

- [../archive/PRODUCT_THUMBNAILS_GUIDE.md](../archive/PRODUCT_THUMBNAILS_GUIDE.md) — previous thumbnail pipeline guide.
- [../archive/PRODUCTS_IMPLEMENTATION_SUMMARY.md](../archive/PRODUCTS_IMPLEMENTATION_SUMMARY.md) — previous implementation summary.

## Before Done

- `npm run build` passes.
- Product search still works with fallback data.
- Thumbnail rendering handles missing, processing, failed, and ready states.
- Any new backend package is listed in `functions/package.json`.
