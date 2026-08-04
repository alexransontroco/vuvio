export type ApiErrorCode =
  | 'bad_request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'server_error';

const statusByCode: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  server_error: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = statusByCode[code];
    this.details = details;
  }
}

export function sendError(res: { status: (status: number) => { json: (body: unknown) => void } }, error: unknown) {
  if (error instanceof ApiError) {
    res.status(error.status).json({ code: error.code, message: error.message, details: error.details });
    return;
  }

  console.error('[api] Unexpected error', error instanceof Error ? error.message : error);
  res.status(500).json({ code: 'server_error', message: 'Internal server error' });
}
