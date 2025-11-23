# Tax Filing System - Backend API

A secure, scalable backend API for the Tax Filing System with Finch OAuth integration for payroll data.

## Features

- **RESTful API**: Express.js server with JWT authentication
- **PostgreSQL Database**: Complete CDM (Common Data Model) schema
- **Finch Integration**: OAuth 2.0 flow for 200+ payroll providers
- **Security**: Encryption for sensitive data, rate limiting, CORS, Helmet
- **Observability**: Correlation IDs, structured logging, audit trails
- **Database Migrations**: SQL migration scripts

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ database
- Finch Developer Account (for OAuth credentials)

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Database

Create a PostgreSQL database:

```sql
CREATE DATABASE tax_app_db;
```

### 3. Configure Environment

Copy the example environment file and update with your values:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/tax_app_db
JWT_SECRET=your-super-secret-jwt-key-change-this
ENCRYPTION_KEY=generate-a-64-char-hex-string
FINCH_CLIENT_ID=your-finch-client-id
FINCH_CLIENT_SECRET=your-finch-client-secret
FINCH_REDIRECT_URI=http://localhost:3000/integrations/finch/callback
FINCH_SANDBOX_MODE=true
```

**Generate Encryption Key:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run Database Migrations

```bash
npm run migrate
```

This will create all tables, indexes, and views.

### 5. Seed Test Data (Optional)

```bash
npm run seed
```

This creates:
- 3 test taxpayers (admin, preparer, taxpayer)
- 2 test businesses
- 1 Finch connection
- 3 employees with payroll data
- W-2 forms

### 6. Start the Server

**Development mode:**

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

The server will start on [http://localhost:3001](http://localhost:3001)

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/register` | Register new taxpayer | No |
| POST | `/api/v1/auth/login` | Login taxpayer | No |
| GET | `/api/v1/auth/profile` | Get current user profile | Yes |

### Integrations

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/integrations/finch/connect` | Initiate Finch OAuth | Yes |
| GET | `/api/v1/integrations/finch/callback` | Handle Finch OAuth callback | No |
| POST | `/api/v1/integrations/finch/sync/:id` | Sync payroll data | Yes |
| GET | `/api/v1/integrations/connections` | Get all connections | Yes |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health status |
| GET | `/` | API information |

## Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Login Flow

1. POST to `/api/v1/auth/login` with email and password
2. Receive JWT token in response
3. Include token in Authorization header: `Bearer <token>`

Example:

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"taxpayer@tax.com","password":"taxpayer123"}'
```

Response:

```json
{
  "message": "Login successful",
  "user": {
    "userId": "33333333-3333-3333-3333-333333333333",
    "firstName": "John",
    "lastName": "Taxpayer",
    "email": "taxpayer@tax.com",
    "role": "taxpayer"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Protected Endpoints

Include the JWT token in the Authorization header:

```bash
curl http://localhost:3001/api/v1/auth/profile \
  -H "Authorization: Bearer <your-token>"
```

## Finch Integration

### Setup

1. Create a Finch Developer account at [tryfinch.com](https://tryfinch.com)
2. Create an application in the Finch Dashboard
3. Copy Client ID and Client Secret to `.env`
4. Set redirect URI to `http://localhost:3000/integrations/finch/callback`

### OAuth Flow

1. **Frontend initiates connection:**
   ```javascript
   POST /api/v1/integrations/finch/connect
   // Returns authorization URL
   ```

2. **User authorizes on Finch:**
   - Redirects to Finch Connect
   - User selects payroll provider and logs in
   - Grants permission

3. **Finch redirects back:**
   ```
   GET /api/v1/integrations/finch/callback?code=xxx&state=yyy
   // Backend exchanges code for access token
   // Stores connection in database
   ```

4. **Sync payroll data:**
   ```javascript
   POST /api/v1/integrations/finch/sync/:connectionId
   // Fetches employees, pay runs, W-2 forms
   ```

### Sandbox Mode

In development, use Finch Sandbox mode:

```env
FINCH_SANDBOX_MODE=true
```

Sandbox credentials: [Finch Sandbox Guide](https://developer.tryfinch.com/docs/reference/docs/development-guides/Test-Finch-API.md)

## Database Schema

The database uses a Common Data Model (CDM) with 8 main categories:

1. **Parties**: taxpayers, businesses
2. **Integrations**: connections (OAuth tokens)
3. **Payroll Data**: employees, pay_runs, pay_run_details, w2_forms
4. **Accounting Data**: accounts, transactions
5. **Retirement Data**: retirement_plans, contributions
6. **Tax Forms**: tax_documents, tax_returns
7. **Audit Logs**: audit_logs
8. **Jobs**: sync_jobs

### Key Tables

- `taxpayers`: Individual taxpayers (SSN encrypted)
- `connections`: OAuth connections to Finch, QBO, etc.
- `employees`: Employee records synced from Finch
- `pay_runs`: Payroll runs with date ranges
- `pay_run_details`: Individual payment details per employee
- `w2_forms`: Annual W-2 tax forms

## Security Features

### Implemented

- **Encryption**: AES-256-CBC for SSN and OAuth tokens
- **JWT Authentication**: 24-hour token expiration
- **Rate Limiting**: 100 requests per 15 minutes
- **CORS**: Whitelist of allowed origins
- **Helmet**: Security headers (CSP, XSS protection)
- **Input Validation**: Request body validation
- **Correlation IDs**: Request tracking across services

### Recommendations for Production

- Use environment-specific secrets (not hardcoded)
- Enable HTTPS only (TLS 1.2+)
- Store JWT tokens in httpOnly cookies (not localStorage)
- Implement CSRF protection
- Add request signing for sensitive operations
- Enable database SSL connections
- Use AWS KMS or similar for key management
- Implement MFA for admin accounts
- Add IP whitelisting for sensitive endpoints

## Project Structure

```
backend/
├── migrations/
│   └── 001_create_cdm_schema.sql    # Database schema
├── scripts/
│   ├── migrate.js                   # Run migrations
│   └── seed-test-data.js            # Seed test data
├── src/
│   ├── config/
│   │   └── database.js              # Database connection
│   ├── controllers/
│   │   ├── authController.js        # Auth logic
│   │   └── finchController.js       # Finch integration
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification
│   │   └── correlation.js           # Request tracking
│   ├── routes/
│   │   ├── auth.js                  # Auth routes
│   │   └── integrations.js          # Integration routes
│   ├── utils/
│   │   └── encryption.js            # Encryption utilities
│   └── server.js                    # Express app
├── .env.example                     # Environment template
├── package.json
└── README.md
```

## Testing

### Manual Testing

Use cURL or Postman to test endpoints:

```bash
# Health check
curl http://localhost:3001/health

# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"taxpayer@tax.com","password":"taxpayer123"}'

# Get profile (with token)
curl http://localhost:3001/api/v1/auth/profile \
  -H "Authorization: Bearer <token>"
```

### Test Credentials

After seeding test data:

| Email | Password | Role |
|-------|----------|------|
| admin@tax.com | admin123 | Administrator |
| preparer@tax.com | preparer123 | Tax Preparer |
| taxpayer@tax.com | taxpayer123 | Individual Taxpayer |

## Troubleshooting

### Database Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:** Ensure PostgreSQL is running and DATABASE_URL is correct.

### Migration Errors

```
Error: relation "taxpayers" already exists
```

**Solution:** Drop the database and recreate it, or skip if tables exist.

### Finch OAuth Not Working

**Solution:**
1. Check FINCH_CLIENT_ID and FINCH_CLIENT_SECRET in `.env`
2. Verify redirect URI matches Finch Dashboard settings
3. Ensure FINCH_SANDBOX_MODE=true for development

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use production PostgreSQL database (not localhost)
- [ ] Generate secure JWT_SECRET (64+ characters)
- [ ] Generate secure ENCRYPTION_KEY (64 hex characters)
- [ ] Update FINCH_SANDBOX_MODE=false
- [ ] Configure production redirect URIs
- [ ] Enable database SSL connections
- [ ] Set up database backups
- [ ] Configure logging (e.g., CloudWatch, Datadog)
- [ ] Enable monitoring and alerts
- [ ] Set up CI/CD pipeline

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "src/server.js"]
```

## License

MIT License

## Support

For issues or questions:
- Check the documentation
- Review error logs with correlation IDs
- Contact the development team

---

**Built for secure and efficient tax data management**
