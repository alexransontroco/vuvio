import { getOwnCreatorProfile } from './profileService.js';

export function getCurrentUser() {
  return Promise.resolve(getOwnCreatorProfile());
}
