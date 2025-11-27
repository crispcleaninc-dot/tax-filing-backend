import dashboardService from '../services/dashboard.service.js';
import logger from '../utils/logger.js';

class DashboardController {
    async getTaxpayerDashboard(req, res) {
        try {
            const { tax_year } = req.query;
            const taxpayerId = req.user.taxpayer_id;
            const data = await dashboardService.getTaxpayerDashboard(
                taxpayerId,
                tax_year || new Date().getFullYear()
            );
            res.json(data);
        } catch (error) {
            logger.error('Error fetching taxpayer dashboard:', error);
            res.status(500).json({ error: 'Failed to load dashboard' });
        }
    }

    async getBusinessDashboard(req, res) {
        try {
            const { businessId } = req.params;
            const { tax_year } = req.query;

            // Admins can access any business dashboard
            if (req.user.role !== 'admin') {
                const hasAccess = await dashboardService.verifyBusinessAccess(
                    req.user.userId,
                    businessId
                );
                if (!hasAccess) {
                    return res.status(403).json({ error: 'Access denied to this business' });
                }
            }

            const data = await dashboardService.getBusinessDashboard(
                businessId,
                tax_year || new Date().getFullYear()
            );
            res.json(data);
        } catch (error) {
            logger.error('Error fetching business dashboard:', error);
            res.status(500).json({ error: 'Failed to load dashboard' });
        }
    }

    async getTaxProDashboard(req, res) {
        try {
            const taxProId = req.user.user_id;
            const data = await dashboardService.getTaxProDashboard(taxProId);
            res.json(data);
        } catch (error) {
            logger.error('Error fetching tax pro dashboard:', error);
            res.status(500).json({ error: 'Failed to load dashboard' });
        }
    }

    async getAdminDashboard(req, res) {
        try {
            const data = await dashboardService.getAdminDashboard();
            res.json(data);
        } catch (error) {
            logger.error('Error fetching admin dashboard:', error);
            res.status(500).json({ error: 'Failed to load dashboard' });
        }
    }

    async getSystemHealth(req, res) {
        try {
            const health = await dashboardService.getSystemHealth();
            res.json(health);
        } catch (error) {
            logger.error('Error fetching system health:', error);
            res.status(500).json({ error: 'Failed to load system health' });
        }
    }
}

const dashboardController = new DashboardController();

export const getTaxpayerDashboard = dashboardController.getTaxpayerDashboard.bind(dashboardController);
export const getBusinessDashboard = dashboardController.getBusinessDashboard.bind(dashboardController);
export const getTaxProDashboard = dashboardController.getTaxProDashboard.bind(dashboardController);
export const getTaxProfessionalDashboard = dashboardController.getTaxProDashboard.bind(dashboardController);
export const getAdminDashboard = dashboardController.getAdminDashboard.bind(dashboardController);
export const getSystemHealth = dashboardController.getSystemHealth.bind(dashboardController);
export const getSystemMetrics = dashboardController.getSystemHealth.bind(dashboardController);

export default dashboardController;
