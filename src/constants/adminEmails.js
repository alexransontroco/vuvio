/**
 * Centralized admin email list
 * This is the single source of truth for admin access
 *
 * Update here, then sync to:
 * - firestore.rules (isAdmin() function)
 * - Cloud Functions (server-side checks)
 * - Frontend auth files
 */
export const ADMIN_EMAILS = [
  'alexandre.ranson@gmail.com',
  'doug.benchetrit@gmail.com',
  'cecilia.ranson@outlook.com',
  'christophe.ranson@gmail.com',
];

/**
 * Check if email is admin
 * Does NOT include @vuvio.app wildcard — only explicit admins
 */
export const isAdminEmail = (email) => {
  return email && ADMIN_EMAILS.includes(email);
};
