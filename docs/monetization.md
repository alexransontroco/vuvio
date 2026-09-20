# Vuvio — Equipment Monetization & Affiliate Strategy

## Purpose & core principle

Equipment monetization is the primary revenue layer for Vuvio. Every piece of gear a creator uses is a natural discovery moment for viewers who want to replicate or understand the experience they're watching. The core principle: **never interrupt the live experience to sell something — surface gear contextually, let curiosity drive clicks**.

Affiliate links attached to equipment are honest by design. A creator shows what they actually use. Vuvio connects that gear to purchase links. No product placement, no paid slots, no curation pressure on creators.

---

## Why equipment is the natural monetization surface

- Viewers already ask "what camera is that?" in chat
- Equipment is visible and credible — it's in use, live, right now
- The creator is the authentic endorser by default (they chose the gear)
- Purchase intent is high at the moment of curiosity (mid-stream or replay)
- Low friction: equipment panel is a single swipe from the live feed
- No editorial risk: affiliate = disclosure + honest link, not a paid review

---

## Monetization models considered

| Model | Risk | Notes |
|---|---|---|
| Affiliate links | Low | Default choice. Commission on purchase, no creator pressure. |
| Sponsored placements | High | Creator would need to display gear they don't use. Authenticity risk. |
| Creator rev-share on affiliates | Medium | Incentivizes creators to fill in their kit; adds complexity. |
| Direct brand partnerships | Medium | High yield but requires sales team, not scalable at launch. |
| Viewer tipping via gear | Low | Future: "buy this creator a new lens" mechanic. |

**Product placement risk note**: allowing brands to pay for inclusion in equipment panels would corrupt the trust signal. A viewer clicking a camera link because the creator uses it has high purchase intent. A viewer clicking a paid placement link has much lower intent and will feel deceived if the product turns out to be sponsored. Avoid paid slots.

---

## Why affiliate is right for launch

1. Zero cost to implement (no sales team)
2. Scales with catalog size, not with BD effort
3. Commission rates 3–10% are acceptable on high-AOV gear
4. Honest by construction — creator lists gear they own
5. Disclosure is simple (single line in equipment panel)
6. Can layer creator rev-share on top later

---

## Technical approach

Two separate systems:

**Product catalog** — what the gear is (brand, model, image, specs). Populated by creator via `QuickAddEquipmentForm`, with search-first UX backed by `/api/products/search`.

**Affiliate offers** — where to buy it and for how much. Resolved separately via `/api/affiliate/resolve`, keyed on brand + model (or MPN/GTIN). Cached 24h in Firestore.

Separation matters: a creator can have a product in their kit without affiliate offers (offer lookup failed, unsupported region, item discontinued). The UI gracefully degrades — equipment still shows, buy links are absent.

---

## Architecture

### Product / offers separation

```
Creator Equipment
  └── item: { brand, model, imageUrl, productId }
              └── offers: AffiliateOffer[]   ← resolved on demand, stored in item
```

`AffiliateOffer`:
```ts
{
  merchant: string       // 'amazon-fr', 'awin-fnac', 'manual'
  affiliateUrl: string   // tracked deep link
  country: string | null // 'FR', 'US', or null = worldwide
  price?: number
  currency?: string
  imageUrl?: string
}
```

### Resolver (`/api/affiliate/resolve`)

Input: `{ brand, name, mpn?, gtin?, productId?, category? }`

Runs all providers in parallel → deduplicates by `merchant:country` → returns ranked list.

**Providers** (priority order):
1. `manualProvider` — Firestore `affiliateLinks` collection, keyword-matched. Highest trust, immediate, no API cost.
2. `amazonProvider` — Amazon PA API v5 with AWS Signature V4. Requires `AMAZON_PA_ACCESS_KEY`, `AMAZON_PA_SECRET_KEY`, `AMAZON_ASSOCIATE_TAG_FR`.
3. `awinProvider` — Awin product datafeed API. Requires `AMAZON_AWIN_API_KEY`, `AWIN_PUBLISHER_ID`.

Cache: `affiliateCache/{brand}:{model}` in Firestore, 24h TTL.

### Click tracking

`affiliateClicks` Firestore collection:
```
{ creatorId, streamId, productId, merchant, country, ts, sessionId }
```

Tracked server-side on redirect (future `/api/affiliate/click?ref=...` endpoint).

### Security

- Affiliate secrets live in Firebase secrets (`defineSecret`), never in client code
- Resolver endpoint validates input — requires at least one of `brand | name | mpn | gtin`
- No PII in cache keys or click logs

### Affiliate disclosure

Shown in equipment panel header: *"Links may earn a commission."* Single line, always visible when offers exist. No opt-out.

### Streamer UX

- `QuickAddEquipmentForm`: search-first (debounced 400ms, AbortController for stale cancellation) → product results list → click to select → affiliate offers auto-resolved in background
- "Add manually" fallback for gear not found in catalog
- Offers shown in equipment item detail sheet: merchant name, price, "Buy" CTA

---

## Rollout phases

**Phase 1 — Manual only** (current)
- `affiliateLinks` collection in Firestore
- Admin can add manual offers for known gear (brand + modelKeywords matching)
- Frontend equipment panel shows offers if present
- No Amazon or Awin integration needed

**Phase 2 — Amazon PA API**
- Activate `amazonProvider` with FR associate tag
- Auto-resolve offers for any equipment item with brand + model
- Cache in `affiliateCache`, refresh every 24h

**Phase 3 — Awin**
- Add `awinProvider` for French retailers (Fnac, Darty, etc.)
- Broaden offer coverage especially for non-Amazon brands

**Phase 4 — Creator rev-share**
- Allocate X% of affiliate commission to creator
- Requires tracking per-creator attribution in `affiliateClicks`
- Dashboard in Analytics page: clicks, conversions (estimated), earned

**Phase 5 — Catalog & admin tooling**
- Admin catalog page: browse all equipment items across creators
- Manually curate top gear → seed `affiliateLinks` for high-traffic items
- Analytics: top clicked gear, revenue by creator, revenue by category

---

## The rule to preserve

> **Affiliate links follow what creators actually use. Nothing in the system should create pressure on creators to list gear they don't own, or to favor certain brands over others.**

This means:
- No paid placement slots in the equipment panel
- No "featured" badge that brands can buy
- No revenue split that incentivizes listing more gear than a creator actually uses
- Disclosure is always present when affiliate links exist

---

## Current implementation status (as of 2026-09-18)

| Component | Status |
|---|---|
| `QuickAddEquipmentForm` search-first UX | ✅ Done |
| `/api/products/search` endpoint | ✅ Done |
| `/api/affiliate/resolve` endpoint | ✅ Done |
| `manualProvider` (Firestore `affiliateLinks`) | ✅ Done |
| `amazonProvider` (PA API v5) | ✅ Done — awaiting secrets |
| `awinProvider` (datafeed API) | ✅ Done — awaiting secrets |
| 24h Firestore cache (`affiliateCache`) | ✅ Done |
| Click tracking endpoint | ⏳ Phase 4 |
| Creator rev-share dashboard | ⏳ Phase 4 |
| Admin catalog page | ⏳ Phase 5 |

**To activate Amazon/Awin**: set Firebase secrets via `firebase functions:secrets:set AMAZON_PA_ACCESS_KEY` etc.

---

## Long-term model

Affiliate is the floor, not the ceiling. Once attribution is reliable:

- **Brand partnerships**: Vuvio surfaces usage data ("X creators in Y category use this lens") as pitch material for direct brand deals
- **Creator storefronts**: each creator profile becomes a shoppable gear page, discoverable outside of live streams
- **Gear recommendations**: ML model trained on equipment + category → "creators like you also use" cross-sell
- **Gear rental affiliate**: partner with rental platforms for high-AOV items viewers won't buy outright

---

## Creator revenue sharing

Target: creators receive 20–30% of affiliate commission Vuvio earns on clicks from their streams.

Implementation:
- Track `creatorId` in `affiliateClicks`
- Monthly payout via Stripe Connect (future)
- Shown in Analytics page: "Gear earnings this month"
- Creator incentive to keep equipment list accurate and up to date

---

## Admin vision — catalog & analytics

**Catalog dashboard** (Phase 5):
- Table of all equipment items ever added by any creator
- Columns: brand, model, # creators using it, # streams it appeared in, # affiliate clicks
- Actions: manually add/edit `affiliateLinks` offer, mark as "curated"
- Filter by category, brand, date added

**Analytics dashboard** (Phase 5):
- Revenue by creator (estimated, based on click × avg commission rate)
- Revenue by gear category
- Top-clicked items this week / month
- Funnel: equipment panel opens → item taps → affiliate link clicks → (estimated) purchases
