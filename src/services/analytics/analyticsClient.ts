import { getAuth } from 'firebase/auth';
import { ANALYTICS_CONFIG } from './analyticsConfig';
import type { AnalyticsEventInput, BatchEventResponse } from './analyticsTypes';

export interface SubmitOptions {
  maxRetries?: number;
  timeout?: number;
}

class AnalyticsClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_STREAM_API_BASE || '/api';
  }

  async submitEvents(
    events: AnalyticsEventInput[],
    options: SubmitOptions = {}
  ): Promise<BatchEventResponse> {
    const { maxRetries = ANALYTICS_CONFIG.MAX_RETRIES, timeout = 30000 } = options;

    if (!events || events.length === 0) {
      return { success: true, accepted: 0, deduped: 0 };
    }

    if (events.length > ANALYTICS_CONFIG.BATCH_SIZE) {
      console.warn(`[Analytics] Batch size ${events.length} exceeds max ${ANALYTICS_CONFIG.BATCH_SIZE}`);
    }

    const payload = { events };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(
          `${this.baseUrl}${ANALYTICS_CONFIG.API_ENDPOINT}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(await this.getAuthHeaders()),
            },
            body: JSON.stringify(payload),
          },
          timeout
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as BatchEventResponse & { errors?: unknown };
        const errorCount = typeof data.errors === 'number' ? data.errors : Array.isArray(data.errors) ? data.errors.length : 0;
        const result = {
          ...data,
          success: data.success ?? errorCount === 0,
          errors: Array.isArray(data.errors) ? data.errors : undefined,
        } as BatchEventResponse;
        console.debug(
          `[Analytics] Submitted ${events.length} events (accepted: ${result.accepted}, deduped: ${result.deduped})`
        );
        return result;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const delayMs = Math.min(
          ANALYTICS_CONFIG.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1),
          ANALYTICS_CONFIG.MAX_RETRY_DELAY_MS
        );

        if (isLastAttempt) {
          console.debug('[Analytics] Failed to submit events after retries (queue saved locally)');
          return {
            success: false,
            accepted: 0,
            deduped: 0,
            errors: [{ index: 0, reason: String(error) }],
          };
        }

        console.debug(
          `[Analytics] Submission failed (attempt ${attempt}/${maxRetries}), retrying...`
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return {
      success: false,
      accepted: 0,
      deduped: 0,
      errors: [{ index: 0, reason: 'Max retries exceeded' }],
    };
  }

  async sendBeacon(events: AnalyticsEventInput[]): Promise<boolean> {
    if (!navigator.sendBeacon) {
      return false;
    }

    try {
      const payload = JSON.stringify({ events });
      const url = `${this.baseUrl}${ANALYTICS_CONFIG.API_ENDPOINT}`;
      return navigator.sendBeacon(url, payload);
    } catch (error) {
      console.warn('[Analytics] Failed to send beacon', error);
      return false;
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const auth = getAuth();
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        return { Authorization: `Bearer ${token}` };
      }
    } catch (error) {
      console.warn('[Analytics] Failed to get auth token', error);
    }
    return {};
  }

  private fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    return Promise.race([
      fetch(url, options),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      ),
    ]);
  }
}

export const analyticsClient = new AnalyticsClient();
