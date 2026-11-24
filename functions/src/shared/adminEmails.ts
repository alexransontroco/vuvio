export const ADMIN_EMAILS = [
  'alexandre.ranson@gmail.com',
  'doug.benchetrit@gmail.com',
  'cecilia.ranson@outlook.com',
  'christophe.ranson@gmail.com',
] as const;

export const isAdminEmail = (email: string | null | undefined): boolean =>
  !!email && (ADMIN_EMAILS as readonly string[]).includes(email);
