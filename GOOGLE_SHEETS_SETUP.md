# Financial dashboard: Google Sheets access

The admin dashboard reads the private [Vuvio financial workbook](https://docs.google.com/spreadsheets/d/1EUZoBWJPwiBJ0jwYGgRBHcXwvurTz24-Uhb-RYM1c74/edit) through the Cloud Functions API. The source tabs are `Dashboard`, `Hypothèses`, `Prévisionnel`, `Coûts unitaires`, and `Trésorerie`. The three forecast years are columns in those tabs.

## Required cloud setup

1. In Google Cloud project `vuvio-bf328`, enable the Google Sheets API.
2. Create a service account for the financial sync. A project-wide Editor role is unnecessary.
3. Share the workbook with the service account email as **Viewer**.
4. Create a JSON key for that service account and store the JSON in the Firebase Functions secret named `GOOGLE_SHEETS_CREDENTIALS`. Keep the key outside this repository.
5. Deploy the `api` function after the secret exists. The function binds this secret in `functions/src/index.ts`.

The `googleapis` package is declared in `functions/package.json` and locked in `functions/package-lock.json`. Do not put credentials in a `VITE_` variable or in Firestore.

## Verification

1. Sign in as an admin and open `/admin/business`.
2. Select **Sync Now**. The API should fetch the workbook and write the result to `adminFinancialData/forecast` through the Admin SDK.
3. Reload the page. The GET endpoint should return the cached forecast and its last sync time.

Both endpoints verify a Firebase ID token and an explicit admin email. Client Firestore rules do not grant access to the cache collection.
