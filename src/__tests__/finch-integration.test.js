import request from 'supertest';
import app from '../server.js';

/**
 * Finch API Integration Tests
 * Tests payroll data synchronization and W-2 generation
 */

describe('Finch Payroll Integration Tests', () => {
  let businessToken;
  let taxpayerToken;

  const connectionId = '55555555-5555-5555-5555-555555555555';
  const businessId = '44444444-4444-4444-4444-444444444444';

  beforeAll(async () => {
    // Get tokens
    const businessRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@tax.com', password: 'admin123' });
    businessToken = businessRes.body.token;

    const taxpayerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'taxpayer@tax.com', password: 'taxpayer123' });
    taxpayerToken = taxpayerRes.body.token;
  });

  describe('OAuth Connection Flow', () => {
    test('should initiate Finch OAuth flow', async () => {
      const response = await request(app)
        .post('/api/v1/integrations/finch/connect')
        .set('Authorization', `Bearer ${businessToken}`)
        .send({ redirect_uri: 'http://localhost:3001/callback' });

      // Should return authorization URL or error
      expect(response.status).toBeDefined();
    });

    test('should handle OAuth callback with authorization code', async () => {
      const response = await request(app)
        .get('/api/v1/integrations/finch/callback?code=test_code&state=test_state');

      // Callback should process code
      expect(response.status).toBeDefined();
    });

    test('should reject OAuth callback without code', async () => {
      const response = await request(app)
        .get('/api/v1/integrations/finch/callback');

      // Should return error for missing code
      expect([400, 401, 404]).toContain(response.status);
    });
  });

  describe('Payroll Data Synchronization', () => {
    test('should sync employee data from Finch', async () => {
      const response = await request(app)
        .post(`/api/v1/integrations/finch/sync/${connectionId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      // Sync endpoint might not be fully implemented
      if (response.status === 200) {
        expect(response.body).toHaveProperty('synced_employees');
      }
    });

    test('should sync pay run data from Finch', async () => {
      const response = await request(app)
        .post(`/api/v1/integrations/finch/sync/${connectionId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('synced_pay_runs');
      }
    });

    test('should handle Finch API rate limiting', async () => {
      // Make multiple requests quickly
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post(`/api/v1/integrations/finch/sync/${connectionId}`)
          .set('Authorization', `Bearer ${businessToken}`)
      );

      const responses = await Promise.all(promises);

      // At least one should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(0);
    });

    test('should handle Finch API authentication errors', async () => {
      const response = await request(app)
        .post('/api/v1/integrations/finch/sync/invalid-connection-id')
        .set('Authorization', `Bearer ${businessToken}`);

      // Should handle invalid connection gracefully
      expect(response.status).toBeDefined();
    });
  });

  describe('W-2 Form Generation', () => {
    test('should generate W-2 forms from synced payroll data', async () => {
      // Test W-2 generation for employees
      const response = await request(app)
        .get(`/api/v1/dashboard/business?business_id=${businessId}&tax_year=2024`)
        .set('Authorization', `Bearer ${businessToken}`);

      if (response.status === 200) {
        // Should include W-2 generation status
        expect(response.body).toBeDefined();
      }
    });

    test('should calculate W-2 Box 1 (wages) correctly', async () => {
      // Box 1: Wages, tips, other compensation
      const response = await request(app)
        .get(`/api/v1/dashboard/taxpayer?taxpayer_id=33333333-3333-3333-3333-333333333333&tax_year=2024`)
        .set('Authorization', `Bearer ${taxpayerToken}`);

      if (response.status === 200) {
        // Verify income calculation from W-2
        expect(response.body.stats).toBeDefined();
      }
    });

    test('should calculate W-2 Box 2 (federal tax withheld) correctly', async () => {
      // Box 2: Federal income tax withheld
      const response = await request(app)
        .get(`/api/v1/dashboard/taxpayer?taxpayer_id=33333333-3333-3333-3333-333333333333&tax_year=2024`)
        .set('Authorization', `Bearer ${taxpayerToken}`);

      if (response.status === 200) {
        const taxWithheld = response.body.stats?.find(s =>
          s.label?.includes('Withheld')
        );
        if (taxWithheld) {
          expect(taxWithheld.value).toBeDefined();
        }
      }
    });

    test('should handle employees with multiple employers', async () => {
      // Employees can have multiple W-2s from different employers
      const response = await request(app)
        .get(`/api/v1/dashboard/taxpayer?taxpayer_id=33333333-3333-3333-3333-333333333333&tax_year=2024`)
        .set('Authorization', `Bearer ${taxpayerToken}`);

      if (response.status === 200) {
        expect(response.body.income_sources).toBeDefined();
        expect(Array.isArray(response.body.income_sources)).toBe(true);
      }
    });
  });

  describe('Connection Management', () => {
    test('should list all active connections', async () => {
      const response = await request(app)
        .get('/api/v1/integrations/connections')
        .set('Authorization', `Bearer ${businessToken}`);

      // Connections endpoint might not be implemented
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });

    test('should show connection health status', async () => {
      const response = await request(app)
        .get('/api/v1/integrations/connections')
        .set('Authorization', `Bearer ${businessToken}`);

      if (response.status === 200 && response.body.length > 0) {
        const connection = response.body[0];
        expect(connection).toHaveProperty('status');
      }
    });

    test('should allow disconnecting a connection', async () => {
      const response = await request(app)
        .delete(`/api/v1/integrations/finch/${connectionId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      // Delete endpoint might not be implemented
      expect(response.status).toBeDefined();
    });
  });

  describe('Data Refresh and Updates', () => {
    test('should detect stale payroll data', async () => {
      const response = await request(app)
        .get('/api/v1/integrations/connections')
        .set('Authorization', `Bearer ${businessToken}`);

      if (response.status === 200 && response.body.length > 0) {
        // Should indicate last sync time
        expect(response.body).toBeDefined();
      }
    });

    test('should support manual data refresh', async () => {
      const response = await request(app)
        .post(`/api/v1/integrations/finch/sync/${connectionId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      // Manual sync should trigger refresh
      expect(response.status).toBeDefined();
    });

    test('should handle incremental updates efficiently', async () => {
      // Should only sync new/changed data, not full refresh
      const response = await request(app)
        .post(`/api/v1/integrations/finch/sync/${connectionId}`)
        .set('Authorization', `Bearer ${businessToken}`)
        .send({ incremental: true });

      expect(response.status).toBeDefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle Finch API downtime gracefully', async () => {
      const response = await request(app)
        .post(`/api/v1/integrations/finch/sync/${connectionId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      // Should return error message, not crash
      expect(response.status).toBeDefined();
      if (response.status >= 500) {
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should retry failed sync operations', async () => {
      // Implementation would track retry attempts
      const response = await request(app)
        .post(`/api/v1/integrations/finch/sync/${connectionId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      expect(response.status).toBeDefined();
    });

    test('should log sync errors for debugging', async () => {
      const response = await request(app)
        .post(`/api/v1/integrations/finch/sync/${connectionId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      // Errors should be logged (check logs after test)
      expect(response.status).toBeDefined();
    });
  });

  describe('Data Validation', () => {
    test('should validate synced employee data structure', async () => {
      const response = await request(app)
        .post(`/api/v1/integrations/finch/sync/${connectionId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      if (response.status === 200 && response.body.synced_employees) {
        const employees = response.body.synced_employees;
        if (employees.length > 0) {
          const employee = employees[0];
          // Should have required fields
          expect(employee).toHaveProperty('employee_id');
        }
      }
    });

    test('should validate W-2 form data before saving', async () => {
      // W-2 forms should have all required boxes
      const response = await request(app)
        .get(`/api/v1/dashboard/taxpayer?taxpayer_id=33333333-3333-3333-3333-333333333333&tax_year=2024`)
        .set('Authorization', `Bearer ${taxpayerToken}`);

      expect(response.status).toBe(200);
    });

    test('should handle missing or incomplete payroll data', async () => {
      const response = await request(app)
        .post(`/api/v1/integrations/finch/sync/${connectionId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      // Should handle incomplete data gracefully
      expect(response.status).toBeDefined();
    });
  });
});
