# AUDIT: Vuvio Financial Dashboard & Admin Security

**Date:** 2026-11-24  
**Scope:** Admin infrastructure, authorization, Firebase configuration, financial data integration  
**Status:** Complete — awaiting user validation before implementation

---

## FINDINGS SUMMARY

### 🔴 CRITICAL: Admin Authorization Inconsistency

**Issue:** Admin email list differs between frontend and Firestore rules.

**Frontend checks** (6 files):
```javascript
isLocalDev
|| userEmail.endsWith('@vuvio.app')
|| 'alexandre.ranson@gmail.com'
|| 'doug.benchetrit@gmail.com'
|| 'cecilia.ranson@outlook.com'
|| 'christophe.ranson@gmail.com'
```

**Firestore rules** (`firestore.rules:238-243`):
```javascript
function isAdmin() {
  return request.auth != null && (
    request.auth.token.email == 'alexandre.ranson@gmail.com' ||
    request.auth.token.email.matches('.*@vuvio\\.app')
  );
}
```

**Impact:** 
- Doug, Cecilia, Christophe can navigate to admin pages (frontend check passes)
- But Firestore denies them read access to admin collections (streamStats, creatorStats, etc.)
- Results in silent failures or errors when viewing analytics

**Recommendation:** Synchronize admin lists between frontend and Firestore rules.

---

### 🟠 HIGH PRIORITY: No Custom Claims Implementation

**Current State:**
- Admin authorization based on hardcoded email list
- Email list duplicated across 6 frontend files AND firestore.rules
- No use of Firebase custom claims
- Scaling to new admins requires code changes in multiple places

**Files requiring updates on each admin addition:**
1. `src/App.jsx:102-107`
2. `src/routes/AdminDocsPage.jsx:1149`
3. `src/routes/AdminMarketingPage.jsx:123`
4. `src/routes/AdminInvestorCrmPage.jsx:128`
5. `src/routes/AnalyticsPage.jsx:438`
6. `src/routes/SettingsPage.jsx:119`
7. `firestore.rules:238-243`

**Recommendation:** Implement Firebase custom claims with admin role set server-side.

---

### 🟡 MEDIUM PRIORITY: Google Sheets Integration - Only Client-Side

**Current Implementation:**
- `FinancialForecastViewer.jsx` - iframe embed with 3-second timeout fallback
- Private Google Sheets cannot be embedded due to Google's security restrictions
- No backend integration with Google Sheets API
- No data extraction or caching

**Missing:**
- Cloud Function to authenticate with Google Sheets API
- Service account credentials (needs setup)
- Data fetching & caching logic (5-min TTL)
- Firestore collection to store financial metrics
- Error handling and sync status tracking

**Recommendation:** Implement Cloud Function + Google Sheets API integration.

---

### 🟢 GOOD: Firebase Cloud Functions Infrastructure

**Strengths:**
- 48+ functions properly organized by domain
- Server-side token verification via `authenticateUser` middleware
- Consistent API patterns using Bearer token authentication
- Error handling with shared `ApiError` class
- Admin SDK properly configured with Node 22 runtime

**Gaps:**
- Authenticates user identity (UID) but doesn't check roles
- No authorization checks for financial data endpoints
- No role-based function access control

---

### 🟢 GOOD: Firestore Rules Correctly Restrict Admin Collections

**Protected Collections** (admin-only read):
- `streamStats`
- `creatorStats`
- `categoryStats`
- `analyticsEvents`
- `websiteStats`
- `visitorActivity`

**Rule Pattern:** Checks `isAdmin()` function before allowing read access.

**Assumption:** Any financial data collection would follow same pattern.

---

### 🟡 MEDIUM PRIORITY: No Charting Library Installed

**Current Approach:** Custom SVG charts in AnalyticsPage.jsx  
**Limitations:** Difficult to maintain, limited interactivity

**Options:**
1. **Lightweight:** visx (Visx + D3, composable, 50KB gzipped)
2. **Batteries-included:** recharts (React components, 20KB gzipped)
3. **Continue custom:** Use existing AnalyticsPage pattern for consistency

**Recommendation:** Avoid adding library dependency unless necessary. Use custom SVG for consistency with AnalyticsPage.

---

## PART 3: ADMIN SECURITY AUDIT

### Current Authorization Pattern

| Layer | Implementation | Security Level |
|-------|---|---|
| **Frontend Route Guard** | `AdminRoute` wrapper in App.jsx | Low — user can navigate but Firestore denies access |
| **Firestore Rules** | `isAdmin()` function checks email | Medium — but email list not synced with frontend |
| **Cloud Functions** | `authenticateUser()` verifies token | Medium — verifies UID, doesn't check roles |
| **API Endpoints** | Stream API client adds Bearer token | Medium — no authorization checks |

### Recommendation: Three-Phase Security Hardening

#### Phase 1: Fix Immediate Authorization Inconsistency ✅
- Synchronize admin email list in firestore.rules with frontend
- Remove OR keep `@vuvio.app` wildcard based on user decision

#### Phase 2: Implement Custom Claims System (Optional)
- Requires: Google Cloud Console setup (Firebase Admin SDK)
- Benefits: Centralized permission management, scalable
- Effort: Medium (new Cloud Function to set claims, update Firestore rules)

#### Phase 3: Harden Financial Endpoint Authorization
- Ensure financial data endpoints verify admin status server-side
- Use either email-based checks OR custom claims (consistent approach)

---

## PART 2: GOOGLE SHEETS SYNCHRONIZATION ARCHITECTURE

### Proposed Architecture

```
┌─────────────────────────────┐
│   Google Sheets (Private)    │
│ 1EUZoBWJPwiBJ0jwYGgRBHcXw... │
└──────────────┬──────────────┘
               │
               ↓
┌──────────────────────────────────────────┐
│  Cloud Function (Authenticated)          │
│  POST /api/admin/financial/sync          │
│  - Verifies admin via custom claims      │
│  - Calls Google Sheets API v4            │
│  - Extracts cell values (Dashboard, 2027, 2028, 2029)
│  - Caches in Firestore                   │
│  - Returns last_sync timestamp           │
└──────────────┬───────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────┐
│  Firestore Collection (Admin-Only)       │
│  /financialData/{year}/                  │
│  - metrics: { users, revenue, ... }      │
│  - raw_data: { ... }                     │
│  - last_sync: timestamp                  │
│  - sync_status: "success" | "error"      │
└──────────────┬───────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────┐
│  Admin React Dashboard                   │
│  /admin/business/financial               │
│  - Fetches from Firestore (admin-only)   │
│  - Displays 2027/2028/2029 metrics       │
│  - Charts: revenue, expenses, cash flow  │
│  - Button: "Sync Now" or "Open Sheet"    │
└──────────────────────────────────────────┘
```

### Implementation Checklist

**Prerequisites:**
1. Google Cloud Project with Sheets API enabled
2. Service account with minimal read access to specific sheet
3. Service account key stored in Firebase (Firestore encrypted field OR Cloud Secret Manager)
4. Service account email added to Google Sheets Share list

**Backend (Cloud Functions):**
1. Create `functions/src/admin/syncFinancialData.ts`
   - Endpoint: `POST /api/admin/financial/sync`
   - Verify admin status (custom claims OR email list)
   - Load service account credentials
   - Call Google Sheets API v4: Sheets::Spreadsheets.values.get()
   - Parse cell ranges: Dashboard, Hypothèses, 2027, 2028, 2029
   - Validate data structure
   - Cache in Firestore `/financialData/{year}`
   - Return { success, timestamp, next_sync }

2. Create `functions/src/admin/getFinancialData.ts`
   - Endpoint: `GET /api/admin/financial/data`
   - Verify admin status
   - Fetch from Firestore cache
   - Return if cache valid (< 5 min old)
   - Return { metrics, last_sync, next_sync, cache_valid }

**Firestore Rules:**
1. Create collection: `/financialData/{year}/`
   - Rule: Only readable by isAdmin()
   - Fields: metrics, raw_data, last_sync, sync_status, error_message

**Frontend (React):**
1. Create `src/routes/AdminBusinessPage.jsx`
   - Navigation: Admin → Business → Financial Dashboard
   - Fetch data via `GET /api/admin/financial/data`
   - Display metrics for 2027, 2028, 2029
   - Year selector & comparison view
   - Charts: revenue, expenses, net income, cash flow, cost breakdown
   - Button: "Sync Now" (calls `POST /api/admin/financial/sync`)
   - Display: last_sync timestamp, cache validity, error messages

2. Update `AdminLayout.jsx`
   - Add "Business" section with Financial Dashboard link

---

## PART 1: FINANCIAL DASHBOARD INTERFACE

### Data Model (from Google Sheets)

**Metrics to extract (by year 2027, 2028, 2029):**

| Metric | GSheet Location | Type | Display |
|--------|---|---|---|
| Utilisateurs actifs mensuels | Dashboard | number | "12,500 users" |
| Chiffre d'affaires | Dashboard | currency | "€2.5M" |
| Charges fixes | Prévisionnel | currency | "€800k" |
| Charges variables | Prévisionnel | currency | "€1.2M" |
| Résultat net | Prévisionnel | currency | "€500k" |
| Trésorerie prévisionnelle | Trésorerie | currency | "€2.1M" |
| Besoin de financement | Trésorerie | currency | "€500k" |
| Rémunération fondateur | Hypothèses | currency | "€50k" |

**Cost breakdown (Coûts unitaires):**

| Metric | Type | Display |
|--------|---|---|
| Coût par spectateur actif | currency/count | "€0.012/viewer" |
| Coût par heure de visionnage | currency/hours | "€0.08/hour" |
| Budget Cloudflare Stream | currency/month | "€8,500/mo" |
| Budget Firebase | currency/month | "€2,100/mo" |
| Coût IA et modération | currency/month | "€3,000/mo" |

### Component Structure

```
AdminBusinessPage.jsx
├── Header (title, year selector)
├── MetricsGrid (4-column layout)
│   ├── BigMetricCard (Users, Revenue, Net Income, Cash Flow)
│   ├── BigMetricCard ...
│   └── BigMetricCard ...
├── ChartsSection
│   ├── Chart: Revenue Evolution (line chart, 36 months)
│   ├── Chart: Revenue vs Expenses (stacked bar chart)
│   ├── Chart: Net Income Trend (area chart)
│   ├── Chart: Cash Flow 36mo (line chart)
│   ├── Chart: Cost Breakdown (pie/donut chart)
│   └── Chart: Cost per User (bar chart, by category)
├── CostUnitariesSection
│   ├── CostCard: Per Viewer
│   ├── CostCard: Per Hour
│   ├── CostCard: Cloudflare Stream
│   ├── CostCard: Firebase
│   ├── CostCard: AI & Moderation
│   └── Note: "Simulated costs based on hypotheses, not official Cloudflare/Firebase pricing"
├── SyncStatus
│   └── "Last synced: 2 hours ago — [Sync Now] [Open in Sheets]"
└── Legend & Notes
    └── "Values from Google Sheets at 1EUZoBWJPwiBJ0jwYGgRBHcXw..."
```

### Design Notes

- Use existing Vuvio dark theme colors (cyan #35e3dc, gray, dark background)
- Responsive: 1 column mobile, 2 columns tablet, 4 columns desktop
- Format: EUR with thousand separators (€1.2M, €500k)
- Comparison mode: Side-by-side years 2027 | 2028 | 2029
- Charts: Custom SVG (match AnalyticsPage style) OR lightweight library

---

## REQUIRED SETUP (Before Implementation)

### Google Cloud Setup
1. **Service Account Creation:**
   - Google Cloud Console → IAM & Admin → Service Accounts
   - Create service account: `vuvio-financial-sync@project.iam.gserviceaccount.com`
   - Generate private key (JSON format)
   - Minimal roles: **Editor** (or Sheets API scoped role if available)

2. **Google Sheets Authorization:**
   - Open financial forecast sheet
   - Share → Add service account email
   - Permission level: **Viewer** (read-only)

3. **Firebase Setup:**
   - Store service account JSON securely:
     - Option A: Cloud Secret Manager (more secure, requires auth)
     - Option B: Firestore encrypted field (acceptable for private data)
   - Create `.env.local` entry: `VITE_FINANCIAL_FORECAST_SHEET_ID=1EUZoBWJPwiBJ0jwYGgRBHcXw...`

### Code Structure
```
functions/src/admin/
├── syncFinancialData.ts       (new)
├── getFinancialData.ts        (new)
├── financialService.ts        (new)
└── types.ts                   (new)

src/routes/
└── AdminBusinessPage.jsx      (new)

src/components/admin/
└── FinancialDashboard/
    ├── MetricsGrid.jsx        (new)
    ├── ChartsSection.jsx       (new)
    ├── CostBreakdown.jsx       (new)
    └── SyncStatus.jsx          (new)
```

---

## NEXT STEPS (Awaiting User Approval)

### Decision Points

1. **Admin Authorization:**
   - Option A: Keep email-based system (simpler, requires manual updates)
   - Option B: Implement Firebase custom claims (more scalable, requires GCP setup)
   - **Recommendation:** Option A for MVP, Option B as future upgrade

2. **Google Sheets Access:**
   - Option A: Use Google Cloud service account (recommended)
   - Option B: Use OAuth2 user credential (not suitable for backend)
   - **Recommendation:** Option A (service account)

3. **Data Storage:**
   - Option A: Cache in Firestore (admin-only collection)
   - Option B: Recalculate on every request (slower, no sync state)
   - **Recommendation:** Option A (Firestore cache)

4. **Charting:**
   - Option A: Continue custom SVG (match AnalyticsPage)
   - Option B: Add recharts library (more features)
   - **Recommendation:** Option A (consistency, no dependency)

5. **Deployment Timing:**
   - Deploy security fixes (authorization sync) first?
   - Deploy financial dashboard in separate PR?
   - Or single comprehensive PR?
   - **Recommendation:** Security fixes first, then dashboard

---

## RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Unauthorized access to financial data | High | Server-side authorization checks, Firestore rules, no DEV flag bypass |
| Google Sheets API key exposure | High | Use service account, store in Cloud Secret Manager, never commit key |
| Data inconsistency (GSheets vs Vuvio) | Medium | Implement checksum validation, audit logs, manual verification |
| Sync failures blocking dashboard | Medium | Show cached data + "last synced" timestamp, error messages, manual sync button |
| Performance: Large spreadsheet | Low | Cache results (5 min TTL), pagination if needed, monitor API quota |
| Breaking changes in GSheets structure | Medium | Document cell references, versioning, alert on schema mismatch |

---

## VALIDATION REQUIRED FROM USER

Before proceeding, please confirm:

1. ✅ Audit findings are accurate?
2. ✅ Security concerns identified correctly?
3. ✅ Architecture approach acceptable?
4. ⚠️ **Decision: Email-based OR custom claims?**
5. ⚠️ **Decision: Proceed with financial dashboard OR security hardening first?**
6. ⚠️ **Decision: Provide Google Cloud service account credentials or shall I document required setup?**

Once approved, I will:
1. Fix admin authorization inconsistency (firestore.rules sync)
2. Implement Google Sheets synchronization (Cloud Function + cache)
3. Build financial dashboard UI
4. Test all authorization checks
5. Document deployment steps

**No code changes will be committed until user validation is received.**
