import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Request } from 'firebase-functions/v2/https';
import { adminAuth } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';

export interface AuthenticatedUser {
  uid: string;
  token: DecodedIdToken;
}

export async function authenticateUser(req: Request): Promise<AuthenticatedUser> {
  const header = req.header('authorization') ?? req.header('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError('unauthenticated', 'Authentication required');

  try {
    const token = await adminAuth.verifyIdToken(match[1]);
    return { uid: token.uid, token };
  } catch {
    throw new ApiError('unauthenticated', 'Authentication required');
  }
}
