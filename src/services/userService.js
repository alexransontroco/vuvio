import { currentUser } from '../data/mockUser.js';

export function getCurrentUser() {
  return Promise.resolve(currentUser);
}
