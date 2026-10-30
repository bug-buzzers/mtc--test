/** Passwords are not trimmed before hashing. Bcrypt only processes 72 UTF-8 bytes. */
export function isValidAdminPassword(value: string): boolean {
  return Array.from(value).length >= 12 && value.trim().length > 0
    && new TextEncoder().encode(value).length <= 72;
}
