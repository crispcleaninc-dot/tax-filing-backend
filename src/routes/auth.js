import express from 'express';
import { register, login, getProfile } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/v1/auth/register
 * @desc Register new taxpayer
 * @access Public
 */
router.post('/register', register);

/**
 * @route POST /api/v1/auth/login
 * @desc Login taxpayer
 * @access Public
 */
router.post('/login', login);

/**
 * @route GET /api/v1/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get('/profile', authenticateToken, getProfile);

export default router;
