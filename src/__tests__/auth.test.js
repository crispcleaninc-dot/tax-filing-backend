import request from 'supertest';
import app from '../server.js';

describe('Authentication API Tests', () => {
  describe('POST /api/v1/auth/login', () => {
    test('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'taxpayer@tax.com',
          password: 'taxpayer123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'taxpayer@tax.com');
      expect(response.body.user).toHaveProperty('role', 'taxpayer');
    });

    test('should fail login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'taxpayer@tax.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should fail login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@tax.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should fail login with missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: 'password123'
        });

      expect(response.status).toBe(400);
    });

    test('should fail login with missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'taxpayer@tax.com'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    let authToken;

    beforeAll(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'taxpayer@tax.com',
          password: 'taxpayer123'
        });
      authToken = response.body.token;
    });

    test('should get profile with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('email', 'taxpayer@tax.com');
      expect(response.body).toHaveProperty('role', 'taxpayer');
    });

    test('should fail to get profile without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile');

      expect(response.status).toBe(401);
    });

    test('should fail to get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
