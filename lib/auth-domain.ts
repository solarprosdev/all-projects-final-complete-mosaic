/** Only this domain may sign in to the portal (OTP + session). */
export const ALLOWED_EMAIL_DOMAIN = "solarpros.io";

/**
 * True if `email` is a normal address whose host is exactly `solarpros.io`
 * (not subdomains like mail.solarpros.io unless you change policy).
 */
export function isAllowedLoginEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return false;
  const domain = e.slice(at + 1);
  return domain === ALLOWED_EMAIL_DOMAIN;
}
