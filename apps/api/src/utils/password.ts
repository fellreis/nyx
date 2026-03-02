import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return bcrypt.compare(plain, hash);
  }

  // Fallback for legacy plaintext passwords; caller can re-hash after successful login
  return plain === hash;
}
