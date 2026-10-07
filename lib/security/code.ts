/** Authenticator codes remain ASCII on the wire; accept local numerals when pasted or typed. */
export function normalizeAuthenticatorCode(value: string): string {
  return value.normalize('NFKC').replace(/[٠-٩۰-۹०-९]/g, digit => {
    const point = digit.charCodeAt(0);
    const zero = point >= 0x0966 ? 0x0966 : point >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(point - zero);
  }).replace(/\D/g, '').slice(0, 6);
}
