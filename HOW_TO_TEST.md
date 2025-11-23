# How to Test Tax Filing Business Logic

Complete guide to testing all features of the Tax Filing System.

## Table of Contents

1. [Test Setup](#test-setup)
2. [Running Tests](#running-tests)
3. [What to Test](#what-to-test)
4. [Test Categories](#test-categories)
5. [Manual Testing Workflows](#manual-testing-workflows)
6. [Automated Test Writing](#automated-test-writing)
7. [Coverage Goals](#coverage-goals)

---

## Test Setup

### Install Dependencies

```bash
cd backend
npm install
```

### Set Up Test Database

Create a separate test database to avoid affecting development data:

```sql
CREATE DATABASE tax_app_test;
```

Update `.env.test`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/tax_app_test
NODE_ENV=test
```

### Seed Test Data

```bash
npm run migrate
npm run seed
```

---

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Suite

```bash
# Business logic tests
npm test -- business-logic

# Finch integration tests
npm test -- finch-integration

# Authentication tests
npm test -- auth
```

### Watch Mode

```bash
npm run test:watch
```

### With Coverage

```bash
npm run test:coverage
```

---

## What to Test

### ✅ Core Business Logic

**1. W-2 Income Calculations**
- Total W-2 income aggregation
- Multiple employers handling
- Box-by-box calculations (Boxes 1-20)
- State and local tax tracking

**2. Tax Calculations**
- Federal tax liability
- State tax calculations
- Standard vs itemized deductions
- Tax credits (EITC, Child Tax Credit, etc.)
- Estimated refund/payment due

**3. Filing Status Logic**
- Single
- Married filing jointly
- Married filing separately
- Head of household
- Qualifying widow(er)

**4. Deduction Optimization**
- Standard deduction
- Itemized deductions
- Above-the-line deductions
- Tax credit eligibility
- Savings recommendations

### ✅ Payroll Integration (Finch API)

**1. OAuth Connection**
- Authorization flow
- Token exchange
- Token refresh
- Connection management

**2. Data Synchronization**
- Employee data sync
- Pay run data sync
- W-2 form generation
- Incremental updates
- Error handling

**3. W-2 Form Generation**
- All box calculations
- Multi-employer scenarios
- State-specific W-2s
- Corrections and amendments

### ✅ Document Management**

**1. Upload Workflows**
- W-2 upload
- 1099 upload
- Receipt upload
- Document validation

**2. Status Tracking**
- Upload progress
- Processing status
- Error notifications
- Completion tracking

### ✅ Deadline Management**

**1. Important Dates**
- April 15 filing deadline
- Quarterly estimated payments
- Extension deadlines
- State-specific dates

**2. Notifications**
- Upcoming deadlines
- Overdue items
- Reminder system

### ✅ Filing Workflow**

**1. Status Progression**
- Not started
- In progress
- Under review
- Ready to file
- Filed
- Accepted/Rejected

**2. Review Process**
- Tax professional assignment
- Client approval
- Amendments
- Re-filing

---

## Test Categories

### 1. Unit Tests

Test individual functions in isolation:

```javascript
// Example: Test tax calculation function
test('calculateFederalTax should return correct amount for $50,000 income', () => {
  const income = 50000;
  const filingStatus = 'single';
  const tax = calculateFederalTax(income, filingStatus);

  expect(tax).toBe(6307); // 2024 tax brackets
});
```

### 2. Integration Tests

Test multiple components working together:

```javascript
// Example: Test W-2 data flow from Finch to dashboard
test('should sync W-2 data from Finch and display on dashboard', async () => {
  // 1. Trigger Finch sync
  await syncFinchData(connectionId);

  // 2. Check database for new W-2
  const w2Forms = await getW2Forms(employeeId, 2024);
  expect(w2Forms.length).toBeGreaterThan(0);

  // 3. Verify dashboard shows W-2 data
  const dashboard = await getTaxpayerDashboard(taxpayerId, 2024);
  expect(dashboard.income_sources).toContain(w2Forms[0]);
});
```

### 3. End-to-End Tests

Test complete user workflows:

```javascript
// Example: Complete tax filing workflow
test('user can file taxes from start to finish', async () => {
  // 1. User logs in
  const { token } = await login('taxpayer@tax.com', 'password');

  // 2. User connects payroll provider
  await connectFinch(token);

  // 3. System syncs W-2 data
  await waitForSync();

  // 4. User reviews tax summary
  const summary = await getTaxSummary(token);
  expect(summary.refund).toBeDefined();

  // 5. User submits return
  const result = await submitReturn(token);
  expect(result.status).toBe('filed');
});
```

### 4. Performance Tests

Test system under load:

```javascript
// Example: Test 100 concurrent dashboard requests
test('should handle 100 concurrent dashboard requests', async () => {
  const startTime = Date.now();

  const promises = Array(100).fill(null).map(() =>
    request(app).get('/api/v1/dashboard/taxpayer?taxpayer_id=...&tax_year=2024')
  );

  const responses = await Promise.all(promises);
  const endTime = Date.now();

  // All should succeed
  expect(responses.every(r => r.status === 200)).toBe(true);

  // Should complete in reasonable time
  expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
});
```

---

## Manual Testing Workflows

### Workflow 1: Taxpayer Filing Their Taxes

```bash
# 1. Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"taxpayer@tax.com","password":"taxpayer123"}'

# Save the token from response

# 2. View Dashboard
curl http://localhost:3001/api/v1/dashboard/taxpayer?taxpayer_id=33333333-3333-3333-3333-333333333333&tax_year=2024 \
  -H "Authorization: Bearer <token>"

# 3. Check Expected Refund
# Look for "Estimated Refund" in stats array

# 4. Verify W-2 Income
# Check income_sources array for W-2 data
```

### Workflow 2: Business Owner Syncing Payroll

```bash
# 1. Login as business owner
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tax.com","password":"admin123"}'

# 2. Connect Finch (if not connected)
curl -X POST http://localhost:3001/api/v1/integrations/finch/connect \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"redirect_uri":"http://localhost:3001/callback"}'

# 3. Sync Payroll Data
curl -X POST http://localhost:3001/api/v1/integrations/finch/sync/CONNECTION_ID \
  -H "Authorization: Bearer <token>"

# 4. View Business Dashboard
curl http://localhost:3001/api/v1/dashboard/business?business_id=44444444-4444-4444-4444-444444444444&tax_year=2024 \
  -H "Authorization: Bearer <token>"
```

### Workflow 3: Tax Professional Reviewing Returns

```bash
# 1. Login as tax professional
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"preparer@tax.com","password":"preparer123"}'

# 2. View Tax Professional Dashboard
curl http://localhost:3001/api/v1/dashboard/tax-professional?tax_professional_id=22222222-2222-2222-2222-222222222222&tax_year=2024 \
  -H "Authorization: Bearer <token>"

# 3. View Client List
# Check clients array in response

# 4. Review Specific Client
curl http://localhost:3001/api/v1/dashboard/taxpayer?taxpayer_id=CLIENT_ID&tax_year=2024 \
  -H "Authorization: Bearer <token>"
```

---

## Automated Test Writing

### Step 1: Identify Feature to Test

Example: "Calculate total W-2 income from multiple employers"

### Step 2: Write Test Case

```javascript
describe('W-2 Income Calculation', () => {
  test('should sum income from multiple W-2 forms', async () => {
    // Arrange: Set up test data
    const taxpayerId = '33333333-3333-3333-3333-333333333333';
    const token = await getAuthToken('taxpayer@tax.com', 'taxpayer123');

    // Act: Get dashboard data
    const response = await request(app)
      .get(`/api/v1/dashboard/taxpayer?taxpayer_id=${taxpayerId}&tax_year=2024`)
      .set('Authorization', `Bearer ${token}`);

    // Assert: Verify calculation
    expect(response.status).toBe(200);
    expect(response.body.income_sources).toBeDefined();

    const totalIncome = response.body.income_sources.reduce(
      (sum, source) => sum + parseFloat(source.amount || 0),
      0
    );

    expect(totalIncome).toBeGreaterThan(0);
  });
});
```

### Step 3: Run Test

```bash
npm test -- -t "should sum income from multiple W-2 forms"
```

### Step 4: Fix Failures

If test fails:
1. Check API response structure
2. Verify database has test data
3. Check calculation logic
4. Update test expectations if needed

---

## Coverage Goals

### Minimum Coverage Targets

```
Overall:               80%
Business Logic:        90%
API Endpoints:         85%
Finch Integration:     75%
Data Calculations:     95%
```

### What to Prioritize

**High Priority (Must Test):**
- ✅ Tax calculations (federal, state)
- ✅ W-2 income aggregation
- ✅ Deduction calculations
- ✅ Filing status logic
- ✅ Finch OAuth flow
- ✅ W-2 generation from payroll data

**Medium Priority (Should Test):**
- ⚠️ Document upload/validation
- ⚠️ Deadline tracking
- ⚠️ Notification system
- ⚠️ Tax optimization recommendations
- ⚠️ Multi-year data

**Low Priority (Nice to Test):**
- 📝 UI workflows
- 📝 Email notifications
- 📝 Report generation
- 📝 Admin tools

---

## Test Data Management

### Create Realistic Test Data

```javascript
// Good: Realistic test data
const testTaxpayer = {
  income: 75000,
  filingStatus: 'married',
  dependents: 2,
  w2Forms: [
    { employer: 'Acme Corp', wages: 50000, federalWithholding: 7500 },
    { employer: 'Tech Inc', wages: 25000, federalWithholding: 3750 }
  ]
};

// Bad: Unrealistic test data
const testTaxpayer = {
  income: 1,
  filingStatus: 'test',
  dependents: -5
};
```

### Use Test Fixtures

```javascript
// tests/fixtures/taxpayers.js
export const testTaxpayers = {
  single_low_income: {
    taxpayer_id: '...',
    income: 25000,
    filingStatus: 'single'
  },
  married_high_income: {
    taxpayer_id: '...',
    income: 250000,
    filingStatus: 'married'
  }
};
```

---

## Common Test Scenarios

### Scenario 1: First-Time Filer

```javascript
test('first-time filer with single W-2', async () => {
  // User has never filed before
  // Single employer
  // Standard deduction
  // Expecting refund
});
```

### Scenario 2: Self-Employed

```javascript
test('self-employed taxpayer with 1099 income', async () => {
  // Multiple 1099 forms
  // Quarterly estimated payments
  // Business expenses
  // Self-employment tax
});
```

### Scenario 3: Multiple Jobs

```javascript
test('taxpayer with multiple jobs in same year', async () => {
  // 3 different W-2 forms
  // Different withholding amounts
  // Aggregate income calculation
});
```

### Scenario 4: Business with Employees

```javascript
test('business owner with 10 employees', async () => {
  // Payroll sync from Finch
  // W-2 generation for all employees
  // Quarterly 941 forms
  // State unemployment taxes
});
```

---

## Debugging Failed Tests

### Step 1: Read Error Message

```
Expected: 200
Received: 404

expect(response.status).toBe(200)
```

**Diagnosis:** Endpoint not found

### Step 2: Check Logs

```bash
npm test -- --verbose
```

Look for:
- Database errors
- API request/response
- Stack traces

### Step 3: Run Single Test

```bash
npm test -- -t "specific test name"
```

### Step 4: Add Debug Output

```javascript
test('should calculate tax', async () => {
  const response = await getTaxCalculation();

  console.log('Response:', JSON.stringify(response, null, 2));

  expect(response.tax).toBe(1000);
});
```

---

## Best Practices

### ✅ DO

- Test one thing at a time
- Use descriptive test names
- Clean up test data after tests
- Mock external API calls
- Test edge cases
- Keep tests fast (< 1 second each)

### ❌ DON'T

- Test implementation details
- Depend on test execution order
- Use production database for tests
- Hardcode sensitive data
- Skip error scenarios
- Write flaky tests

---

## Next Steps

1. **Run existing tests**: `npm test`
2. **Add business logic tests**: Copy examples above
3. **Achieve 80% coverage**: `npm run test:coverage`
4. **Set up CI/CD**: Tests run on every commit
5. **Monitor test health**: Fix flaky tests immediately

---

**Remember:** Good tests give you confidence to ship code. Bad tests slow you down. Focus on testing behavior, not implementation!
