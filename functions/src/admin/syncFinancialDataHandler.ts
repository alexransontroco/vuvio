/**
 * Cloud Function: Sync financial data from Google Sheets
 * Endpoint: POST /api/admin/financial/sync
 *
 * Uses Application Default Credentials — no JSON key needed.
 * The Cloud Function's service account must have read access to the spreadsheet.
 */

import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { sendError, ApiError } from '../shared/errors.js';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { isAdminEmail } from '../shared/adminEmails.js';
import { fetchFinancialData } from './financialService.js';
import { db } from '../shared/firestore.js';

const financialCache = db.collection('adminFinancialData').doc('forecast');

export async function syncFinancialDataHandler(req: Request, res: Response) {
  try {
    const { token } = await authenticateUser(req);

    if (!isAdminEmail(token.email)) {
      throw new ApiError('forbidden', 'Admin access required');
    }

    const data = await fetchFinancialData();
    await financialCache.set(data);

    res.json({
      success: true,
      data,
      message: 'Financial data synced successfully',
    });
  } catch (error) {
    sendError(res, error);
  }
}

/**
 * Cloud Function: Get cached financial data
 * Endpoint: GET /api/admin/financial/data
 */
export async function getFinancialDataHandler(req: Request, res: Response) {
  try {
    const { token } = await authenticateUser(req);

    if (!isAdminEmail(token.email)) {
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
