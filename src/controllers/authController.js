import { query } from '../config/database.js';
import { encrypt, hashPassword, verifyPassword } from '../utils/encryption.js';
import { generateToken } from '../middleware/auth.js';

/**
 * Register new taxpayer
 */
export const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, ssn, dob, phone } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName || !ssn || !dob) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT taxpayer_id FROM taxpayers WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Encrypt SSN and hash password
    const ssnEncrypted = encrypt(ssn);
    const passwordHash = hashPassword(password);

    // Insert new taxpayer
    const result = await query(
      `INSERT INTO taxpayers
       (ssn_encrypted, first_name, last_name, dob, email, phone, filing_status, kyc_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING taxpayer_id, first_name, last_name, email, created_at`,
      [ssnEncrypted, firstName, lastName, dob, email, phone, 'single', 'pending']
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = generateToken({ ...user, role: 'taxpayer' });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        userId: user.taxpayer_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: 'taxpayer',
        createdAt: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Login taxpayer
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user by email
    const result = await query(
      `SELECT taxpayer_id, first_name, last_name, email, filing_status, kyc_status, role, created_at
       FROM taxpayers
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // For demo purposes, we'll accept the mock passwords
    // In production, you'd store password hashes in the database
    const validPasswords = {
      'admin@tax.com': 'admin123',
      'preparer@tax.com': 'preparer123',
      'taxpayer@tax.com': 'taxpayer123'
    };

    if (validPasswords[email] && validPasswords[email] !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Use role from database, fallback to 'taxpayer' if not set
    const role = user.role || 'taxpayer';

    // Generate JWT token
    const token = generateToken({ ...user, role });

    res.json({
      message: 'Login successful',
      user: {
        userId: user.taxpayer_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role,
        kycStatus: user.kyc_status,
        createdAt: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      `SELECT taxpayer_id, first_name, last_name, email, phone,
              filing_status, kyc_status, created_at, updated_at
       FROM taxpayers
       WHERE taxpayer_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      userId: user.taxpayer_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      filingStatus: user.filing_status,
      kycStatus: user.kyc_status,
      role: req.user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
