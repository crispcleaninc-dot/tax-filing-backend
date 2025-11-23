import express from 'express';
import {
  initiateFinchConnect,
  handleFinchCallback,
  syncFinchData,
  getConnections
} from '../controllers/finchController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/v1/integrations/finch/connect
 * @desc Initiate Finch OAuth flow
 * @access Private
 */
router.post('/finch/connect', authenticateToken, initiateFinchConnect);

/**
 * @route GET /api/v1/integrations/finch/callback
 * @desc Handle Finch OAuth callback
 * @access Public (callback from Finch)
 */
router.get('/finch/callback', handleFinchCallback);

/**
 * @route POST /api/v1/integrations/finch/sync/:connectionId
 * @desc Sync payroll data from Finch
 * @access Private
 */
router.post('/finch/sync/:connectionId', authenticateToken, syncFinchData);

/**
 * @route GET /api/v1/integrations/connections
 * @desc Get all connections for current user
 * @access Private
 */
router.get('/connections', authenticateToken, getConnections);

export default router;
