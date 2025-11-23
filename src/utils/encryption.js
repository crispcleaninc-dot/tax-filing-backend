import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex');
const IV_LENGTH = 16;

/**
 * Encrypt sensitive data (SSN, tokens, etc.)
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text with IV prepended
 */
export function encrypt(text) {
  if (!text) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Prepend IV to encrypted data
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data
 * @param {string} text - Encrypted text with IV prepended
 * @returns {string} - Decrypted plain text
 */
export function decrypt(text) {
  if (!text) return null;

  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Hash password using bcrypt-like approach
 * @param {string} password - Plain text password
 * @returns {string} - Hashed password
 */
export function hashPassword(password) {
  return crypto.pbkdf2Sync(password, 'salt', 100000, 64, 'sha512').toString('hex');
}

/**
 * Verify password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {boolean} - True if password matches
 */
export function verifyPassword(password, hash) {
  const passwordHash = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(passwordHash), Buffer.from(hash));
}

/**
 * Generate correlation ID for request tracking
 * @returns {string} - UUID v4
 */
export function generateCorrelationId() {
  return crypto.randomUUID();
}

/**
 * Mask SSN for logging (show last 4 digits only)
 * @param {string} ssn - Full SSN
 * @returns {string} - Masked SSN (XXX-XX-1234)
 */
export function maskSSN(ssn) {
  if (!ssn || ssn.length < 4) return '***';
  return 'XXX-XX-' + ssn.slice(-4);
}
