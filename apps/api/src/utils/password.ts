import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  // Only accept bcrypt hashes — no plaintext fallback
  if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$') && !hash.startsWith('$2y$')) {
    return false;
  }
  return bcrypt.compare(plain, hash);
}
