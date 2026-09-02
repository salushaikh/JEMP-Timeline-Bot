import crypto from 'crypto';

/**
 * Generates a cryptographically secure random share token
 * Returns 64-character hexadecimal token (256 bits of entropy)
 */
export function generateShareToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a share token with SHA-256 for secure database storage.
 * The raw token is NEVER stored in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Timing-safe token comparison
 */
export function verifyTokenHash(rawToken: string, storedHash: string): boolean {
  const computedHash = hashToken(rawToken);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
}
