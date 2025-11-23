# Testing Documentation

Comprehensive regression and integration testing for the Tax Filing System Backend API.

## Table of Contents

- [Setup](#setup)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Test Suites](#test-suites)
- [Writing Tests](#writing-tests)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (or test database)
- All dependencies installed

### Install Test Dependencies

```bash
npm install
```

The following test packages are included:
- `jest` - Testing framework
- `supertest` - HTTP testing library
- `@types/jest` - TypeScript definitions
- `@types/supertest` - TypeScript definitions

### Test Environment

Create a `.env.test` file for test-specific configuration:

```bash
cp .env.example .env.test
```

Update with test database credentials and test-specific settings.

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Tests with Verbose Output

```bash
npm run test:verbose
```

### Run Specific Test File

```bash
npm test -- src/__tests__/auth.test.js
```

### Run Tests Matching Pattern

```bash
npm test -- --testNamePattern="login"
```

## Test Coverage

Test coverage reports are generated in the `coverage/` directory.

### View Coverage Report

```bash
npm run test:coverage
```

Open `coverage/lcov-report/index.html` in your browser.

### Coverage Goals

- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

## Test Suites

### 1. Health Check Tests (`health.test.js`)

Tests the `/health` endpoint:

- ✅ Returns healthy status
- ✅ Valid timestamp format
- ✅ Positive uptime
- ✅ JSON content type
- ✅ CORS headers present

### 2. Authentication Tests (`auth.test.js`)

Tests authentication endpoints:

**Login Tests:**
- ✅ Successful login with valid credentials
- ✅ Fail login with invalid password
- ✅ Fail login with non-existent user
- ✅ Fail login with missing email
- ✅ Fail login with missing password

**Profile Tests:**
- ✅ Get profile with valid token
- ✅ Fail without token
- ✅ Fail with invalid token

### 3. Dashboard Tests (`dashboard.test.js`)

Tests dashboard endpoints for all roles:

**Taxpayer Dashboard:**
- ✅ Get dashboard with valid token
- ✅ Fail without authentication
- ✅ Require taxpayer_id parameter

**Admin Dashboard:**
- ✅ Get dashboard with admin token
- ✅ Fail without admin privileges

**Tax Professional Dashboard:**
- ✅ Get dashboard with tax pro token
- ✅ Return client data

## Writing Tests

### Test Structure

```javascript
import request from 'supertest';
import app from '../server.js';

describe('Feature Name', () => {
  describe('Endpoint Description', () => {
    test('should do something specific', async () => {
      const response = await request(app)
        .get('/api/v1/endpoint')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });
});
```

### Best Practices

1. **Describe blocks:** Group related tests
2. **Test names:** Use descriptive "should" statements
3. **Setup/Teardown:** Use `beforeAll`, `afterAll`, `beforeEach`, `afterEach`
4. **Assertions:** Be specific and test one thing at a time
5. **Mocking:** Mock external services (database, APIs)
6. **Isolation:** Tests should not depend on each other

### Common Assertions

```javascript
// Status codes
expect(response.status).toBe(200);

// Response body
expect(response.body).toHaveProperty('data');
expect(response.body.data).toBeInstanceOf(Array);

// Headers
expect(response.headers['content-type']).toMatch(/json/);

// Values
expect(value).toBe('expected');
expect(value).toEqual(expectedObject);
expect(value).toBeGreaterThan(0);
expect(value).toBeDefined();
expect(value).toBeNull();
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

See `.github/workflows/test.yml` for configuration.

### Workflow Steps

1. **Checkout code**
2. **Setup Node.js**
3. **Install dependencies**
4. **Start PostgreSQL service**
5. **Run migrations**
6. **Seed test data**
7. **Run tests**
8. **Generate coverage report**
9. **Upload coverage to Codecov**

### Status Badges

Add to README.md:

```markdown
![Tests](https://github.com/crispcleaninc-dot/tax-filing-backend/actions/workflows/test.yml/badge.svg)
[![codecov](https://codecov.io/gh/crispcleaninc-dot/tax-filing-backend/branch/main/graph/badge.svg)](https://codecov.io/gh/crispcleaninc-dot/tax-filing-backend)
```

## Test Data

### Test Users

The seed script creates these test users:

```javascript
{
  email: 'taxpayer@tax.com',
  password: 'taxpayer123',
  role: 'taxpayer'
}

{
  email: 'preparer@tax.com',
  password: 'preparer123',
  role: 'tax_professional'
}

{
  email: 'admin@tax.com',
  password: 'admin123',
  role: 'admin'
}
```

### Test Database

Use a separate test database to avoid affecting development data:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/tax_app_test
```

## Regression Testing

### What is Regression Testing?

Regression testing ensures that new code changes don't break existing functionality.

### How We Implement It

1. **Comprehensive Test Suite:** Cover all API endpoints
2. **Automated Tests:** Run on every commit/PR
3. **CI/CD Pipeline:** Block merges if tests fail
4. **Coverage Reports:** Monitor test coverage over time

### Running Regression Tests

```bash
# Run full regression suite
npm test

# Run with coverage
npm run test:coverage
```

### Adding New Tests

When adding new features:

1. Write tests FIRST (TDD approach)
2. Ensure tests fail before implementation
3. Implement feature
4. Ensure tests pass
5. Add to CI/CD pipeline

## Debugging Tests

### Run Single Test in Debug Mode

```bash
node --inspect-brk node_modules/.bin/jest src/__tests__/auth.test.js
```

Then open Chrome DevTools: `chrome://inspect`

### Console Logging

```javascript
test('should do something', async () => {
  console.log('Debug info:', response.body);
  expect(response.status).toBe(200);
});
```

### Verbose Output

```bash
npm run test:verbose
```

## Performance Testing

### Response Time Benchmarks

- Health endpoint: < 50ms
- Login endpoint: < 500ms
- Dashboard endpoints: < 1000ms

### Load Testing

Use tools like:
- Apache JMeter
- k6
- Artillery

Example with k6:

```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 100,
  duration: '30s',
};

export default function () {
  let res = http.get('http://localhost:3001/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
  });
}
```

## Maintenance

### Keeping Tests Updated

- Review tests when updating dependencies
- Update tests when changing API contracts
- Remove obsolete tests
- Keep test data current

### Test Review Checklist

- [ ] Tests cover new functionality
- [ ] Tests pass locally
- [ ] Tests pass in CI/CD
- [ ] Coverage meets threshold
- [ ] No flaky tests
- [ ] Test data is clean

## Troubleshooting

### Tests Failing Locally

1. Check database connection
2. Ensure migrations are run
3. Verify test data is seeded
4. Check environment variables

### Tests Passing Locally but Failing in CI

1. Check CI environment variables
2. Verify database service is running
3. Check Node.js version
4. Review CI logs

### Slow Tests

1. Use `--runInBand` to run serially
2. Mock external services
3. Optimize database queries
4. Use test database with minimal data

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)

---

**Last Updated:** 2025-11-23
