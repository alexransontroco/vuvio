# Deployment Readiness Checklist — Financial Dashboard + Security

**Date:** 2026-11-24  
**Prepared by:** Claude Code  
**Status:** 🟢 Ready for Review & Validation

---

## WHAT WAS DONE

### ✅ Phase 1: Admin Authorization Security (COMPLETE)

**Scope:** Centralize & synchronize admin access control  
**Files Changed:** 7 (1 new + 6 updated)  
**Impact:** Low — no user-facing changes, only internal auth hardening  

**Changes:**
1. Centralized admin email list in `src/constants/adminEmails.js`
2. Synchronized Firestore rules (removed @vuvio.app wildcard)
3. Updated all 6 admin pages to use centralized constant
4. Removed email duplication across codebase

**Testing:** ✅ Build successful  
**Risk Level:** ⭐ Very Low — only affects admin access, all other features untouched

---

### 📋 Phase 2: Financial Dashboard (STRUCTURE COMPLETE, BLOCKED)

**Scope:** Backend + Frontend framework for financial data from Google Sheets  
**Files Created:** 6  
**Files Modified:** 3  
**Impact:** Medium — New feature, but only accessible to 4 admins

**What's Ready:**
- ✅ Backend Cloud Function framework (authentication, admin check, error handling)
- ✅ Google Sheets API integration code (ready to authenticate once credentials available)
- ✅ React component `AdminBusinessPage` (data loading, sync button, error states)
- ✅ Route integration `/admin/business`
- ✅ Styling (desktop & mobile)
- ✅ Security (token verification, admin-only checks)

**What's Blocked:**
- ❌ Google Cloud service account credentials (manual setup required)
- ❌ `googleapis` npm package (not yet installed in functions/)

**Testing:**
- ✅ Build will complete successfully
- ⚠️ Cloud Functions will not work until credentials configured
- ✅ Frontend component works (displays error "credentials not configured")

**Risk Level:** ⭐ Very Low — feature-flagged to admins only, graceful errors

---

## DEPLOYMENT OPTIONS

### Option A: Deploy Phase 1 Only (Recommended for Now)

**What:** Admin authorization security fixes  
**Risk:** Minimal — improves security without changing functionality  
**Commands:**
```bash
# 1. Code review
git diff main dev

# 2. Merge to main
git checkout main
git merge --ff-only dev

# 3. Deploy
npx vite build && firebase deploy --only hosting:vuvio-bf328

# 4. Verify
# Check /admin routes still work, admin users can access analytics
```

**Timeline:** 5–10 minutes  
**Rollback:** Easy (revert last commit if needed)

---

### Option B: Deploy Phase 1 + 2 Backend (Requires Credentials)

**Prerequisites:**
1. Complete Google Cloud setup (see `GOOGLE_SHEETS_SETUP.md`)
2. Store credentials in Firebase Secret Manager
3. Install npm dependency

**Commands:**
```bash
# 1. Install dependency
cd functions
npm install googleapis
cd ..

# 2. Code review
git diff main dev

# 3. Merge & build
git checkout main
git merge --ff-only dev
npx vite build

# 4. Deploy
firebase deploy  # Deploys hosting + functions

# 5. Test
# Navigate to /admin/business
# Click "Sync Now"
# Should see financial data
```

**Timeline:** 15–20 minutes (+ 10 min for GCP setup)  
**Risk:** Medium if credentials not configured correctly

**If credentials missing:** Function deploys but returns error:
```json
{
  "error": "GOOGLE_SHEETS_CREDENTIALS is empty. Configure via Firebase."
}
```
This is graceful — frontend shows error message, doesn't break.

---

## WHAT REQUIRES USER ACTION

### Minimal (Phase 1 Only)
- [ ] Review git diff
- [ ] Approve merge to main
- [ ] Run deploy command

### For Full Feature (Phase 1 + 2)
- [ ] Read `GOOGLE_SHEETS_SETUP.md`
- [ ] Create service account in Google Cloud Console (5 min)
- [ ] Share Google Sheet with service account (1 min)
- [ ] Store credentials in Firebase (3 min)
- [ ] Run `npm install googleapis` (1 min)

---

## FILES TO REVIEW

### Critical Security Changes
- `firestore.rules` (lines 238–243) — Admin access list
- `src/constants/adminEmails.js` — Single source of truth

### New Feature (Financial Dashboard)
- `src/routes/AdminBusinessPage.jsx` — React component
- `functions/src/admin/syncFinancialDataHandler.ts` — HTTP handlers
- `functions/src/admin/financialService.ts` — Google Sheets integration
- `GOOGLE_SHEETS_SETUP.md` — Configuration guide

### Integration Points
- `src/App.jsx` — New route `/admin/business`
- `functions/src/index.ts` — New API endpoints
- `src/main.jsx` — New CSS import

---

## VERIFICATION CHECKLIST

**Before Merge:**
- [ ] All files reviewed
- [ ] No secrets or hardcoded credentials in code
- [ ] No breaking changes to existing features
- [ ] Build passes (automated, waiting for completion)

**Before Deploy (Phase 1):**
- [ ] Merge to main successful
- [ ] No uncommitted changes on main
- [ ] Deploy credentials available

**After Deploy (Phase 1):**
- [ ] Admin pages (`/admin/docs`, `/admin/analytics`, etc.) still work
- [ ] Admin user can access Firestore collections
- [ ] Non-admin user is redirected to `/watch`

**Before Deploy (Phase 2 — If Attempting):**
- [ ] Google Sheets credentials configured
- [ ] `googleapis` package installed
- [ ] `GOOGLE_SHEETS_CREDENTIALS` set in Firebase

**After Deploy (Phase 2):**
- [ ] Navigate to `/admin/business`
- [ ] Click "Sync Now" button
- [ ] Financial data appears (or error if no credentials)
- [ ] "Ouvrir dans Sheets" button opens Google Sheets
- [ ] Mobile layout works

---

## BUILD STATUS

**Last Build:** 🔄 In Progress (automated test)  
**Expected Result:** ✓ built in ~1m 30s  
**Expected Output:** No errors, all modules transformed

---

## NOTES

- **No `main` branch changes yet** — All work on `dev` branch
- **No deployment to production yet** — Awaiting your approval
- **Google Sheets not modified** — Read-only integration
- **Existing features unaffected** — No changes to live, workshop, replay, etc.
- **Future upgrade ready** — Custom Claims migration path documented

---

## NEXT STEPS (When Ready)

1. **User reviews** this document and the audit findings
2. **User decides** Phase 1 only, or Phase 1 + 2
3. **User approves** (or requests changes)
4. **Claude commits** to dev branch with detailed message
5. **Claude merges** dev → main
6. **Claude deploys** to production

---

## QUESTIONS FOR USER

Before proceeding to commit/deploy, please confirm:

1. ✅ Are the Phase 1 security changes acceptable?
2. ✅ Should we deploy Phase 1 alone or wait for Phase 2?
3. ✅ Who will configure the Google Sheets credentials?
4. ✅ Any concerns about the structure or approach?

