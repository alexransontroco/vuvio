import { google } from 'googleapis';

const SHEET_ID = '1EUZoBWJPwiBJ0jwYGgRBHcXwvurTz24-Uhb-RYM1c74';

const SHEET_RANGES = {
  dashboard: 'Dashboard!A1:E80',
  hypotheses: "'Hypothèses'!A1:E100",
  forecast: "'Prévisionnel'!A1:E100",
  costs: "'Coûts unitaires'!A1:E80",
  cashflow: "'Trésorerie'!A1:J100",
};

export async function fetchFinancialData(credentialsJson: string) {
  try {
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SHEET_ID,
      ranges: Object.values(SHEET_RANGES),
    });

    if (!response.data.valueRanges) {
      throw new Error('No data returned from Google Sheets');
    }

    const data = {
      dashboard: response.data.valueRanges[0]?.values || [],
      hypotheses: response.data.valueRanges[1]?.values || [],
      forecast: response.data.valueRanges[2]?.values || [],
      costs: response.data.valueRanges[3]?.values || [],
      cashflow: response.data.valueRanges[4]?.values || [],
      last_sync: new Date().toISOString(),
      sync_status: 'success' as const,
    };

    return data;
  } catch (error) {
    console.error('Error fetching financial data:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to fetch financial data',
    );
  }
}

export interface FinancialData {
  dashboard: string[][];
  hypotheses: string[][];
  forecast: string[][];
  costs: string[][];
  cashflow: string[][];
  last_sync: string;
  sync_status: 'success' | 'error';
}
