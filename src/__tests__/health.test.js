import request from 'supertest';
import app from '../server.js';

describe('Health Check API Tests', () => {
  describe('GET /health', () => {
    test('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
    });

    test('should have valid timestamp format', async () => {
      const response = await request(app).get('/health');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });

    test('should have positive uptime', async () => {
      const response = await request(app).get('/health');

      expect(response.body.uptime).toBeGreaterThan(0);
    });

    test('should return JSON content type', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['content-type']).toMatch(/json/);
    });

    test('should have CORS headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});
