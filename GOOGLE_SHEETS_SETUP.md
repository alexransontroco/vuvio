# Google Sheets API Setup — Financial Dashboard Integration

**Status:** ⚠️ Configuration Required  
**Type:** Manual setup (must be done in Google Cloud Console)

## Overview

To read the financial forecast from the private Google Sheet, Cloud Functions need to authenticate with Google Sheets API v4.

**Current State:**
- ✅ Google Sheets URL configured: `1EUZoBWJPwiBJ0jwYGgRBHcXwvurTz24-Uhb-RYM1c74`
- ❌ Service account not yet created
- ❌ Credentials not stored

---

## Setup Steps (Manual — External to this Repo)

### Step 1: Create Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **vuvio-bf328**
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Click **Create Service Account**
   - **Service account name:** `vuvio-financial-sync`
   - **Service account email:** Will be auto-generated (note it)
   - Description: "Read financial forecast from Google Sheets"
   - Click **Create and Continue**

### Step 2: Grant Permissions

1. After creation, navigate to the service account
2. Click **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** format
5. Click **Create** (downloads JSON file locally)

**Keep this file secure — do NOT commit to git**

### Step 3: Share Google Sheet with Service Account

1. Open the financial forecast Google Sheet:
   https://docs.google.com/spreadsheets/d/1EUZoBWJPwiBJ0jwYGgRBHcXwvurTz24-Uhb-RYM1c74/edit

2. Click **Share** (top right)
3. Paste the service account email (from Step 1)
4. Set permission to **Viewer** (read-only)
5. Click **Share**

### Step 4: Store Credentials in Firebase

#### Option A: Cloud Secret Manager (Recommended — More Secure)

```bash
# 1. Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# 2. Create secret from service account JSON
gcloud secrets create GOOGLE_SHEETS_CREDENTIALS \
  --data-file=/path/to/service-account-key.json

# 3. Grant Cloud Functions role access
gcloud secrets add-iam-policy-binding GOOGLE_SHEETS_CREDENTIALS \
  --member=serviceAccount:vuvio-bf328@appspot.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

Then in functions, reference as: `defineSecret('GOOGLE_SHEETS_CREDENTIALS')`

#### Option B: Firebase Params (Simpler)

Add to `functions/src/config/env.ts`:
```typescript
import { defineSecret } from 'firebase-functions/params';

export const googleSheetsCredentials = defineSecret('GOOGLE_SHEETS_CREDENTIALS');
```

Then set via Firebase CLI:
```bash
firebase functions:config:set \
  google_sheets.credentials="$(cat /path/to/service-account-key.json)"
```

---

## Implementation Code (Ready Once Credentials Exist)

### Backend: Cloud Function

**File:** `functions/src/admin/syncFinancialData.ts` (not yet created)

```typescript
import { onRequest } from 'firebase-functions/v2/https';
import { google } from 'googleapis';
import { googleSheetsCredentials } from '../config/env.js';
import { authenticateUser } from '../middleware/authenticateUser.js';

export const syncFinancialDataHandler = onRequest(async (req, res) => {
  // 1. Authenticate user
  const { email } = await authenticateUser(req);
  
  // 2. Check admin status
  const ADMIN_EMAILS = [
    'alexandre.ranson@gmail.com',
    'doug.benchetrit@gmail.com',
    'cecilia.ranson@outlook.com',
    'christophe.ranson@gmail.com',
  ];
  if (!ADMIN_EMAILS.includes(email)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  // 3. Load Google Sheets credentials
  const credentials = JSON.parse(googleSheetsCredentials.value());
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  // 4. Fetch data from Google Sheets
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: '1EUZoBWJPwiBJ0jwYGgRBHcXwvurTz24-Uhb-RYM1c74',
    ranges: [
      'Dashboard!A1:Z100',
      'Prévisionnel 2027!A1:Z100',
      'Prévisionnel 2028!A1:Z100',
      'Prévisionnel 2029!A1:Z100',
    ],
  });

  // 5. Parse and cache in Firestore
  const data = {
    dashboard: response.data.valueRanges[0].values || [],
    forecast_2027: response.data.valueRanges[1].values || [],
    forecast_2028: response.data.valueRanges[2].values || [],
    forecast_2029: response.data.valueRanges[3].values || [],
    last_sync: new Date().toISOString(),
    sync_status: 'success',
  };

  // Cache for 5 minutes
  res.json({
    success: true,
    data,
    next_sync_in_seconds: 300,
  });
});
```

### Frontend: React Component

**File:** `src/routes/AdminBusinessPage.jsx` (not yet created)

```jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { isAdminEmail } from '../constants/adminEmails.js';
import { Navigate } from 'react-router-dom';

export default function AdminBusinessPage() {
  const { user, authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const isLocalDev = import.meta.env.DEV;
  const isAdmin = isLocalDev || isAdminEmail(user?.email);

  if (!user || !isAdmin) return <Navigate to="/watch" replace />;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/financial/sync', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error);
        setData(result.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) return <div>Loading financial data...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No data available</div>;

  return (
    <div className="admin-business-page">
      <h1>Financial Dashboard</h1>
      {/* Charts and metrics here */}
    </div>
  );
}
```

---

## Verification Checklist

Before implementation can be tested:

- [ ] Service account created in Google Cloud Console
- [ ] Service account email noted
- [ ] Google Sheet shared with service account (Viewer role)
- [ ] Service account key JSON downloaded locally
- [ ] `googleapis` package installed: `npm install googleapis --save`
- [ ] Credentials stored in Firebase (Secret Manager OR Params)
- [ ] Firebase CLI configured for your GCP project

---

## Deployment Notes

**Cloud Functions will fail on deployment if:**
- Credentials not provided via Firebase Params/Secret Manager
- Google Sheets API not enabled in Google Cloud Project
- Service account doesn't have read access to sheet

**First deployment will show error:** 
```
Error: Unable to get credentials (GOOGLE_SHEETS_CREDENTIALS undefined)
```

This is expected until credentials are configured.

---

## Security Notes

✅ Credentials never exposed in frontend  
✅ Credentials stored in Secret Manager (not in .env or repo)  
✅ Service account has read-only access  
✅ Function verifies admin status before returning data  
✅ Token-based authentication required  

---

## Next Steps (After Credentials Setup)

1. Create the Cloud Function code (ready above)
2. Add `googleapis` dependency to functions/package.json
3. Update functions/src/index.ts to export syncFinancialDataHandler
4. Deploy functions: `firebase deploy --only functions`
5. Create AdminBusinessPage component
6. Test data sync via API
7. Build UI with charts and metrics

