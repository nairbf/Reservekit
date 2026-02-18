export function sanitizeString(value: unknown, maxLength = 500): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function isValidPhone(phone: string): boolean {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function sanitizeHtml(value: string): string {
  return String(value || "").replace(/[<>]/g, "");
}
