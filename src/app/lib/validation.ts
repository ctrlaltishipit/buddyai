/** Client-side form checks shared by sign-in and signup (mirrors the backend limits). */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enter your email.";
  if (!EMAIL_RE.test(v)) return "That doesn't look like an email address.";
  return null;
}

/** `emptyMessage` lets sign-in say "Enter" while signup says "Choose". */
export function validatePassword(value: string, emptyMessage = "Enter your password."): string | null {
  if (!value) return emptyMessage;
  if (value.length < MIN_PASSWORD) return `Passwords are at least ${MIN_PASSWORD} characters.`;
  return null;
}
