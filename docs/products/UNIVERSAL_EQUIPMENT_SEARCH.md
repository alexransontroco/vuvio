# Universal Equipment Search

Status: Requires verification — development implementation, not deployed
Last reviewed: 2026-11-16
Read before coding: Yes, for equipment search, product providers, catalog data, or product images.

## Decision

Vuvio's own catalog is the primary source. The existing eBay provider remains the external fallback when the local search is insufficient. ProductGuru, Open Icecat, Open Products Facts, Wikidata, and UPCitemdb were tested but none is suitable as the primary free autocomplete provider for equipment across activities. No new paid service or provider credential was added. Existing user equipment is unchanged.

The six requested models absent from the existing seed catalog were added to a client-side catalog extension, not to `seedProducts.js`. This avoids the existing auth-time seed flow writing new records to production Firestore. The client catalog is available offline in all search surfaces. It is a curated starter set, not a universal product database. Future catalog additions should go through reviewed, licensed data with an explicit publishing path.

## Product Database Alternatives — November 2026

The target is product identification across photography, video, music, cooking, woodworking, cycling, hiking, and crafting. A usable source must return model-level matches, support a search-as-you-type experience at an affordable request rate, and provide clear data and image reuse rights. A marketing claim about catalog size is not evidence of coverage for these activities.

### Open Icecat — candidate complement, not validated for name search

[Open Icecat](https://icecat.com/content-subscription/) offers structured manufacturer data, normalized references, specifications, and images. Its [content-user pricing page](https://icecat.com/pricing-content-users/) advertises a free registered tier covering up to about two million products and 600 sponsoring brands. This is promising for cameras and technology. The free catalog excludes many brands, the full catalog is paid, and content or image rights may depend on brand and reseller status. A usable search endpoint and permission to display each image still need verification with a registered account. The unauthenticated endpoint tested below returned 404.

### Open Products Facts — open candidate, insufficient tested coverage

[Open Products Facts](https://world.openproductsfacts.org/) is a collaborative non-food product database with an API and exports. Quality and exact-model coverage vary. Its data reuse must be reviewed under ODbL, and image rights must be reviewed separately before copying records into Firestore. The tested searches below did not establish useful coverage for Vuvio's specialist gear. It remains a possible source for curated imports after licensing and coverage review.

### ProductGuru — tested, not an equipment-name API

[ProductGuru](https://myproduct.guru/) advertises a large catalog, barcode lookup, name search, brand/category data, and CertaScore. Its [developer API](https://myproduct.guru/developers) is free and keyless, but the documented JSON `/api/v1` endpoints concern product recalls. Its [data guide](https://myproduct.guru/data) labels `/search?q=` as an HTML page. Direct HTTP tests confirmed this for all 12 benchmark names. Barcode lookup returns JSON; no suitable JSON name-search endpoint or reusable image feed was validated. The 60/minute limit and CC-BY terms apply to recall data, not automatically to all underlying product facts or images. **Do not integrate name search by scraping HTML.** ProductGuru can be reconsidered if it publishes a documented JSON name-search API and clear reuse terms.

### Barcode Report — untested fallback candidate

[Barcode Report](https://barcodereport.com/pricing) currently advertises a free tier of 1,000 lookups/month, 60 requests/minute, with a search endpoint and an API key. This could support a small prototype. No direct coverage benchmark, image-quality test, or storage/reuse-rights review was performed for Vuvio. Pricing and terms can change; recheck before implementation. It is **not a validated provider**.

### UPCitemdb — tested complementary source

[UPCitemdb](https://www.upcitemdb.com/wp/docs/main/development/plan/) returns JSON for barcode and name search without signup on its free trial endpoint. Its current plan comparison lists 100 combined calls/day, including at most 20 name searches, plus burst limits. The tested name searches put bundles, batteries, and nearby models ahead of the desired item. It is unsuitable for primary consumer autocomplete; the existing barcode-oriented backend provider may remain useful. Its [rate-limit page](https://www.upcitemdb.com/wp/docs/main/development/api-rate-limits/) conflicts with the plan page on the daily search cap, so confirm the applicable quota before relying on it.

### Wikidata and Wikimedia Commons — supplementary source

[Wikidata](https://www.wikidata.org/wiki/Wikidata%3AData_access/en) offers free structured search and SPARQL access. [Structured Wikidata data are CC0](https://www.wikidata.org/wiki/Wikidata%3ALicensing), but media linked through [Wikimedia Commons](https://commons.wikimedia.org/) have file-specific licenses and attribution requirements. The benchmark found only a few exact or close models, several misses, and 429 responses. It may enrich reviewed records, but cannot serve as the main product search on this evidence.

### Google Shopping and other commercial APIs — deferred

Commercial search services may cover recent products and supply images, but prices, quotas, and use restrictions vary. No specific service was benchmarked here. Do not select one for the free-first MVP without testing its actual API, budget, and content rights.

### eBay Catalog integration — existing temporary fallback

Vuvio already has `EbayCatalogProvider` in `functions/src/products/ebayCatalogProvider.ts`, registered through `ProductRegistry` when credentials are configured. It provides an existing search path and product identity data. Listing-oriented results can contain duplicates, accessories before the main model, uneven activity coverage, and inconsistent images. Preserve the provider and old equipment references while the Vuvio catalog expands. Search UI should identify owned equipment without prices, listings, or merchant links. eBay is a fallback, not the long-term source of truth.

## Recommended Architecture — Vuvio Universal Equipment Catalog

1. **Vuvio Equipment Catalog.** Use the existing Firestore `products` collection for reviewed normalized product identities, with `creatorEquipment` for user-owned items and Live snapshots generated from them. Preserve current `name`/`productId` fields; map model/display name rather than replacing the stored schema. Proposed *additive* fields include `displayName`, `equipmentType`, `source`, `sourceProductId`, `externalReferences`, `dataLicense`, `imageLicense`, `attribution`, and source verification timestamps alongside `brand`, `category`, `thumbnailUrl`, `createdAt`, and `updatedAt`. Add fields only when backed by verified provenance and rights. Never import all external results automatically.
2. **Independent providers.** Keep the `ProductProvider` contract in `functions/src/products/productProvider.ts` and the local-first `ProductRegistry`. eBay and credentialed Icecat stay optional. ProductGuru and Open Products Facts remain candidates only; Barcode Report and Wikidata require further validation. Provider failures and quota errors must leave local/manual entry available.
3. **Normalization and careful deduplication.** Normalize punctuation, spacing, aliases, brand and model. Treat Sony Alpha 7 IV, Sony A7 IV, and manufacturer reference ILCE-7M4 as candidates for one identity only after checking authoritative references. Prefer manufacturer ID, GTIN/EAN, and brand plus MPN when available. Keep genuine variants, bundles, colors, and generations distinct unless a reviewed rule proves equivalence. Do not borrow a photo from a similar model.
4. **Manual creation.** An equipment name and type are sufficient; brand, model, and user photo are optional. The external search must never block saving. Manual photos need a durable Storage path and explicit consent/right handling before their current local-only upload can be considered fully implemented.

### Future activity-aware search

Activity suggestions are a Vuvio taxonomy, independent of product providers. Photography could suggest camera, lens, tripod, microphone, lighting; woodworking drill, saw, sander, measuring tools; cooking knives, cookware, mixer, cooking equipment. Cycling, hiking, music, and crafting should receive curated type sets as usage grows. The activity changes the ranking and suggested types, but does not hide a valid product in another category.

## Benchmark protocol

The fixed set is Sony A7 IV, DJI Mic 2, Fender Stratocaster, Bosch GSR 12V, KitchenAid Artisan, Shimano Ultegra, Makita DHP482, GoPro HERO13, Le Creuset Dutch Oven, Garmin Forerunner 965, Roland FP-30X, and DeWalt DCD796. For every future provider test, record HTTP status and response type, latency, result count, exact brand/model match, image availability and quality, duplicates, ranking, quota behavior, and license/storage terms. Mark a result **not tested** or **not measurable** rather than assuming a match or image from a marketing claim. The measured ProductGuru runs and the limited alternative tests follow below.

## Roadmap

### Phase 1 — Validation

ProductGuru's documented API and all 12 name queries were checked; Open Icecat, Open Products Facts, Wikidata, and UPCitemdb received initial tests; eBay remains the baseline. Barcode Report, image licenses, and a registered Icecat search path still require testing. There is no validated free universal name-search provider yet.

### Phase 2 — MVP

The provider contract, local-first search, client catalog suggestions, deduplication, manual entry, and existing Equipment/Start Live/onboarding integration are present in development. Before release, validate authenticated Firestore saves, profile display, Start Live selection, image rights, and mobile flows on a Firebase emulator; then publish only licensed catalog records. Do not remove eBay until a replacement proves adequate.

### Phase 3 — Intelligence

Add activity-based type suggestions, reviewed catalog enrichment, stronger model-identifier matching, relevance tuning from real search logs, and personalized suggestions. Keep provider choice separate from the equipment type taxonomy and from the RPG onboarding interface.

## ProductGuru benchmark

Official [developer documentation](https://myproduct.guru/developers), [data guide](https://myproduct.guru/data), [terms](https://myproduct.guru/terms), and [OpenAPI schema](https://myproduct.guru/api/v1/openapi.json) were checked. The OpenAPI schema responded `200 application/json` in 246 ms and lists `/recalls`, `/recalls/stats`, `/recalls/{ean}`, `/authorities`, and `/countries`. It does not list a product name search endpoint. `/lookup/3109850018511.json` returned product JSON by barcode in 127 ms, without image data. The name search route `/search?q=` returned `200 text/html`, a web page, for every query below. HTML was not parsed or scraped.

| Query | ProductGuru `/search?q=` | Time | JSON results / exact / brand / image | Vuvio local result |
| --- | --- | ---: | --- | --- |
| Sony A7 IV | 200 HTML | 4562 ms | N/A | Sony Alpha 7 IV |
| DJI Mic 2 | 200 HTML | 3076 ms | N/A | DJI Mic 2 |
| Fender Stratocaster | 200 HTML | 1789 ms | N/A | Fender Stratocaster |
| Bosch GSR 12V | 200 HTML | 4129 ms | N/A | Bosch Professional GSR 12V |
| KitchenAid Artisan | 200 HTML | 2226 ms | N/A | KitchenAid Artisan |
| Shimano Ultegra | 200 HTML | 1889 ms | N/A | Shimano Ultegra R8100 Di2 |
| Makita DHP482 | 200 HTML | 1446 ms | N/A | Makita DHP482 |
| GoPro HERO13 | 200 HTML | 1381 ms | N/A | GoPro HERO13 Black |
| Le Creuset Dutch Oven | 200 HTML | 2355 ms | N/A | Le Creuset Dutch Oven |
| Garmin Forerunner 965 | 200 HTML | 3713 ms | N/A | Garmin Forerunner 965 |
| Roland FP-30X | 200 HTML | 4321 ms | N/A | Roland FP-30X |
| DeWalt DCD796 | 200 HTML | 1451 ms | N/A | DeWalt DCD796 |

N/A means the count, relevance, exact match, brand, and image cannot be measured through a documented JSON name search API. It does not mean zero products exist on the website. The recall API advertises a free tier of 60 requests/minute and CC-BY for recall data; those terms do not grant reuse of arbitrary product images. The [terms](https://myproduct.guru/terms) prohibit systematic scraping/mirroring. ProductGuru was therefore not integrated.

## Other free sources tested

| Source | HTTP test | Coverage / restrictions | Decision |
| --- | --- | --- | --- |
| [Open Icecat](https://icecat.com/content-subscription/) | Existing unauthenticated `live.icecat.biz/api/search?keywords=Sony%20A7%20IV` returned 404 JSON in 77 ms. | Free catalog requires registration; image and content rights vary by brand and subscription. No verified name-search entitlement. | Keep the existing optional credential-based provider; do not make it primary. |
| [Open Products Facts](https://openfoodfacts.github.io/openfoodfacts-server/api/) | `/api/v2/search?search_terms=Sony A7 IV` returned 200 JSON in 228 ms with 49,633 unrelated items because that v2 parameter is not full-text search. Classic `/cgi/search.pl` for Bosch GSR 12V returned 200 JSON, count 0, in 45 ms. | Search API limit is 10 calls/minute/IP; data are ODbL and photos carry separate rights. Poor coverage for specialist gear. | Do not integrate. |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata%3AData_access/en) | `wbsearchentities` returned 200 JSON in about 227–468 ms. Exact or close results for Sony, Fender, Shimano, Garmin; no result for six other sample products; two later queries hit 429. | Structured data are CC0; media have separate licenses. Incomplete model coverage and rate limits. | Possible future complement, not primary. |
| [UPCitemdb](https://www.upcitemdb.com/wp/docs/main/development/plan/) | Trial name search: Sony A7 IV 200 JSON in 412 ms, 5 returned / 621 total, top results were unrelated bundles; Bosch GSR 12V 200 JSON in 405 ms, 5 / 247, top items were batteries/accessories or a different model. | Free trial limit: 100 calls/day combined, 20 name searches/day, 2 searches/30 s. Image reuse rights unclear. | Keep existing barcode-oriented backend provider, not autocomplete. |

## Existing system and implemented flow

The backend already had a `ProductProvider` contract and providers in `functions/src/products/`. `ProductRegistry.search` now queries Firestore `products` through `LocalProductProvider` first. It skips external providers for an exact local match or at least four local matches; otherwise it calls the previously configured providers, including eBay. The `products` collection uses `searchTerms`. No Firestore schema migration is required.

The shared client service `src/services/productSearchService.js` searches the existing `seedProducts` array plus six client-only additions immediately, ranks exact/partial/one-edit matches, then requests `/api/products/search` after the UI's 350 ms debounce when needed. Requests can be aborted; the service times out after 7 seconds. Local results remain usable during external failures. It normalizes fields to the existing `brand`, `name`, `category`, `subcategory`, `productId`/`provider` conventions, removes obvious duplicates, and does not expose prices, offers, descriptions, or merchant URLs in search results. `resolveAffiliateOffers` and the eBay backend remain present for existing flows.

The shared search is used in `ProductSearch` on `EquipmentManagePage`, `QuickAddEquipmentForm` in Start Live, and onboarding `StepEquipment`. Manual entry remains available. New gear still uses `addEquipmentItem` in `src/services/equipmentService.js`; the same `creatorEquipment` Firestore collection and localStorage cache (`vuvio:equipment-library`) feed profile gear and `buildEquipmentSnapshots` for Lives. Legacy eBay equipment keeps its provider/product ID and existing links. No migration or rewrite of old documents was made.

`ProfileGearPage` is a separate, unfinished RPG wizard prototype with an in-memory item list and TODOs for persistence. The active profile equipment link leads to `/profile/equipment`, which uses the shared search. The RPG prototype was left untouched; it can import this UI-independent search service when its storage is unified with `creatorEquipment`.

The search UI uses a product image only when explicit `imageRightsStatus` is `authorized` or `manual-approved`. External marketplace thumbnails otherwise become a type-specific icon. No external image is downloaded or stored automatically. The backend no longer borrows an image from a different provider merely because names match. Existing user images remain visible. `GearImageUploader` still accepts a manual photo, but its current data URL is stripped from Firestore by `toFirestoreDoc`; it survives only in the device's local cache. Durable user photo upload requires a separate Storage-backed change and rules review before production use.

## Files and configuration

- Client: `src/services/productSearchService.js`, `src/components/product/ProductSearch.jsx`, `src/components/product/ProductThumbnail.jsx`, `src/routes/EquipmentManagePage.jsx`, `src/components/equipment/EquipmentKit.jsx`, `src/components/BottomNav.jsx`, `src/routes/onboarding/steps/StepEquipment.jsx`, and their existing CSS files.
- Backend: `functions/src/products/productRegistry.ts`, `localProvider.ts`, `productProvider.ts`, `ebayCatalogProvider.ts`. The eBay search and token calls have 6-second timeouts.
- No new dependency, API key, Firebase collection, environment variable, or production deploy. Existing `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET` and optional Icecat credentials still control existing providers.
- In local development, Vite's `/api` proxy targets the existing API unless `VITE_API_PROXY_TARGET` points to a local Firebase Functions emulator. Use an emulator to validate Firestore writes; do not test writes against production while this change is pending review.

## Verification and limits

Chrome at a 390 × 844 mobile viewport was used for service-level tests: all 12 listed queries returned local matches; `Sony A7` returned partial matches; `Soni A7 IV` returned Sony Alpha 7 IV; a nonexistent item returned none; mocked offline and 429 responses were handled; duplicate and image-rights behavior was inspected; a manual item was saved to localStorage and appeared in a Live snapshot; a legacy eBay item retained its provider and ID. The `ProductSearch` React component was also mounted at that viewport: it displayed Sony Alpha 7 IV immediately, the manual action fired, and the test surface did not overflow horizontally. Backend TypeScript and frontend Vite production builds passed. The Vite build reported unresolved asset references and large chunks in unrelated existing app surfaces.

Firestore persistence, authenticated profile rendering, and full Start Live UI were not exercised against an emulator in this pass. The shared storage and snapshot paths were inspected, but those end-to-end checks remain before release. No production data was changed.

Next steps: validate authenticated flows against Firestore/Storage emulators; add licensed model records to the authoritative Vuvio catalog; secure explicit image rights and a durable upload path; consider Wikidata only as a supplementary source if focused tests improve coverage.
