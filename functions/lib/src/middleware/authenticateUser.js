import { adminAuth } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
export async function authenticateUser(req) {
    const header = req.header('authorization') ?? req.header('Authorization') ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match)
        throw new ApiError('unauthenticated', 'Authentication required');
    try {
        const token = await adminAuth.verifyIdToken(match[1]);
        return { uid: token.uid, token };
    }
    catch {
        throw new ApiError('unauthenticated', 'Authentication required');
    }
}
