import request from 'supertest';
import app from '../server.js';

describe('Dashboard API Tests', () => {
  let taxpayerToken;
  let adminToken;
  let taxProToken;

  beforeAll(async () => {
    // Get taxpayer token
    const taxpayerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'taxpayer@tax.com',
        password: 'taxpayer123'
      });
    taxpayerToken = taxpayerRes.body.token;

    // Get admin token
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@tax.com',
        password: 'admin123'
      });
    adminToken = adminRes.body.token;

    // Get tax professional token
    const taxProRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'preparer@tax.com',
        password: 'preparer123'
      });
    taxProToken = taxProRes.body.token;
  });

  describe('GET /api/v1/dashboard/taxpayer', () => {
    test('should get taxpayer dashboard with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/taxpayer?taxpayer_id=33333333-3333-3333-3333-333333333333&tax_year=2024')
        .set('Authorization', `Bearer ${taxpayerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('taxpayer');
      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('income_sources');
    });

    test('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/taxpayer?taxpayer_id=33333333-3333-3333-3333-333333333333');

      expect(response.status).toBe(401);
    });

    test('should require taxpayer_id parameter', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/taxpayer')
        .set('Authorization', `Bearer ${taxpayerToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/dashboard/admin', () => {
    test('should get admin dashboard with admin token', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('system_stats');
    });

    test('should fail without admin privileges', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/admin')
        .set('Authorization', `Bearer ${taxpayerToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/dashboard/tax-professional', () => {
    test('should get tax professional dashboard', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/tax-professional?tax_professional_id=22222222-2222-2222-2222-222222222222&tax_year=2024')
        .set('Authorization', `Bearer ${taxProToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tax_professional');
      expect(response.body).toHaveProperty('clients');
    });
  });
});
