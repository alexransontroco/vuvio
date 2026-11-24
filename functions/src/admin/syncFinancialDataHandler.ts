/**
 * Cloud Function: Sync financial data from Google Sheets
 * Endpoint: POST /api/admin/financial/sync
 *
 * Requires:
 * - User authenticated with valid Firebase token
 * - User in ADMIN_EMAILS list
 * - GOOGLE_SHEETS_CREDENTIALS configured in Firebase
 */

import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { sendError, ApiError } from '../shared/errors.js';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { fetchFinancialData } from './financialService.js';
import { googleSheetsCredentials } from '../config/env.js';
import { db } from '../shared/firestore.js';

const financialCache = db.collection('adminFinancialData').doc('forecast');

const ADMIN_EMAILS = [
  'alexandre.ranson@gmail.com',
  'doug.benchetrit@gmail.com',
  'cecilia.ranson@outlook.com',
  'christophe.ranson@gmail.com',
];

export async function syncFinancialDataHandler(req: Request, res: Response) {
  try {
    // 1. Authenticate user
    const { token } = await authenticateUser(req);

    // 2. Check admin status
    if (!token.email || !ADMIN_EMAILS.includes(token.email)) {
      throw new ApiError('forbidden', 'Admin access required');
    }

    // 3. Get credentials from Firebase Params
    let credentials: string;
    try {
      credentials = googleSheetsCredentials.value();
    } catch (err) {
      throw new ApiError(
        'server_error',
        'Google Sheets credentials not configured. ' +
          'See GOOGLE_SHEETS_SETUP.md for configuration steps.',
      );
    }

    if (!credentials) {
      throw new ApiError(
        'server_error',
        'GOOGLE_SHEETS_CREDENTIALS is empty. Configure via Firebase.',
      );
    }

    // 4. Fetch data from Google Sheets
    const data = await fetchFinancialData(credentials);
    await financialCache.set(data);

    // 5. Return success
    res.json({
      success: true,
      data,
      message: 'Financial data synced successfully',
      next_sync_in_seconds: 300,
    });
  } catch (error) {
    sendError(res, error);
  }
}

/**
 * Cloud Function: Get cached financial data
 * Endpoint: GET /api/admin/financial/data
 *
 * Returns cached data or error message if not yet synced
 */
export async function getFinancialDataHandler(req: Request, res: Response) {
  try {
    // 1. Authenticate user
    const { token } = await authenticateUser(req);

    // 2. Check admin status
    if (!token.email || !ADMIN_EMAILS.includes(token.email)) {
      throw new ApiError('forbidden', 'Admin access required');
    }

    const snapshot = await financialCache.get();
    const data = snapshot.exists ? snapshot.data() : null;
    res.json({
      success: true,
      data,
      cached: Boolean(data),
      stale: data?.last_sync ? Date.now() - Date.parse(data.last_sync) > 300_000 : false,
    });
  } catch (error) {
    sendError(res, error);
  }
}
