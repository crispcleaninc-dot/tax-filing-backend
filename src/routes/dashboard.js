import express from 'express';
import {
    getTaxpayerDashboard,
    getBusinessDashboard,
    getTaxProfessionalDashboard,
    getAdminDashboard,
    
    getSystemMetrics
} from '../controllers/dashboardController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/v1/dashboard/taxpayer
 * @desc Get taxpayer dashboard data
 * @access Private (Taxpayer only)
 */
router.get('/taxpayer',
    authenticateToken,
    authorizeRole('taxpayer'),
    getTaxpayerDashboard
);

/**
 * @route GET /api/v1/dashboard/business/:businessId
 * @desc Get business owner dashboard data
 * @access Private (Business Owner, Admin)
 */
router.get('/business/:businessId',
    authenticateToken,
    authorizeRole('business_owner', 'admin'),
    getBusinessDashboard
);

/**
 * @route GET /api/v1/dashboard/professional
 * @desc Get tax professional dashboard data
 * @access Private (Tax Professional, Admin)
 */
router.get('/professional',
    authenticateToken,
    authorizeRole('tax_professional', 'admin'),
    getTaxProfessionalDashboard
);

/**
 * @route GET /api/v1/dashboard/admin
 * @desc Get admin dashboard data
 * @access Private (Admin only)
 */
router.get('/admin',
    authenticateToken,
    authorizeRole('admin'),
    getAdminDashboard
);

/**
 * @route GET /api/v1/dashboard/admin/metrics
 * @desc Get system metrics for a time period
 * @access Private (Admin only)
 */
router.get('/admin/metrics',
    authenticateToken,
    authorizeRole('admin'),
    getSystemMetrics
);

export default router;
