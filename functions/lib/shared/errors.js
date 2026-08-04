const statusByCode = {
    bad_request: 400,
    unauthenticated: 401,
    forbidden: 403,
    not_found: 404,
    conflict: 409,
    server_error: 500,
};
export class ApiError extends Error {
    code;
    status;
    details;
    constructor(code, message, details) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.status = statusByCode[code];
        this.details = details;
    }
}
export function sendError(res, error) {
    if (error instanceof ApiError) {
        res.status(error.status).json({ code: error.code, message: error.message, details: error.details });
        return;
    }
    console.error('[api] Unexpected error', error instanceof Error ? error.message : error);
    res.status(500).json({ code: 'server_error', message: 'Internal server error' });
}
