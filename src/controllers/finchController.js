import axios from 'axios';
import { query, transaction } from '../config/database.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import dotenv from 'dotenv';

dotenv.config();

const FINCH_API_URL = process.env.FINCH_SANDBOX_MODE === 'true'
  ? 'https://sandbox.tryfinch.com/api'
  : 'https://api.tryfinch.com/api';

const FINCH_AUTH_URL = process.env.FINCH_SANDBOX_MODE === 'true'
  ? 'https://connect.tryfinch.com/authorize'
  : 'https://connect.tryfinch.com/authorize';

/**
 * Initiate Finch OAuth flow
 */
export const initiateFinchConnect = async (req, res) => {
  try {
    const { taxpayerId, businessId } = req.body;

    if (!taxpayerId && !businessId) {
      return res.status(400).json({ error: 'taxpayerId or businessId required' });
    }

    // Generate state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({
      taxpayerId,
      businessId,
      timestamp: Date.now(),
      correlationId: req.correlationId
    })).toString('base64');

    const authUrl = new URL(FINCH_AUTH_URL);
    authUrl.searchParams.append('client_id', process.env.FINCH_CLIENT_ID);
    authUrl.searchParams.append('products', 'company,directory,individual,employment,payment,pay_statement');
    authUrl.searchParams.append('redirect_uri', process.env.FINCH_REDIRECT_URI);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('sandbox', process.env.FINCH_SANDBOX_MODE || 'true');

    res.json({
      authorizationUrl: authUrl.toString(),
      state
    });

  } catch (error) {
    console.error('Finch connect initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate Finch connection' });
  }
};

/**
 * Handle Finch OAuth callback
 */
export const handleFinchCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing authorization code or state' });
    }

    // Decode state parameter
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { taxpayerId, businessId, correlationId } = stateData;

    // Exchange authorization code for access token
    const tokenResponse = await axios.post('https://api.tryfinch.com/auth/token', {
      client_id: process.env.FINCH_CLIENT_ID,
      client_secret: process.env.FINCH_CLIENT_SECRET,
      code,
      redirect_uri: process.env.FINCH_REDIRECT_URI
    });

    const { access_token, company_id } = tokenResponse.data;

    // Fetch company information
    const companyResponse = await axios.get(`${FINCH_API_URL}/employer/company`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const companyData = companyResponse.data;

    // Store connection in database
    await transaction(async (client) => {
      // Encrypt tokens before storage
      const accessTokenEncrypted = encrypt(access_token);

      const connectionResult = await client.query(
        `INSERT INTO connections
         (taxpayer_id, business_id, provider, provider_company_id,
          access_token_encrypted, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING connection_id, created_at`,
        [
          taxpayerId,
          businessId,
          'finch',
          company_id,
          accessTokenEncrypted,
          'active',
          JSON.stringify({
            company_name: companyData.legal_name,
            ein: companyData.ein,
            correlationId
          })
        ]
      );

      const connection = connectionResult.rows[0];

      // Log audit event
      await client.query(
        `INSERT INTO audit_logs
         (event_type, actor_id, entity_type, entity_id, action, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'integration.connected',
          taxpayerId,
          'connection',
          connection.connection_id,
          'create',
          JSON.stringify({
            provider: 'finch',
            companyId: company_id,
            correlationId
          })
        ]
      );
    });

    res.json({
      success: true,
      message: 'Finch connection established successfully',
      company: {
        name: companyData.legal_name,
        ein: companyData.ein,
        id: company_id
      }
    });

  } catch (error) {
    console.error('Finch callback error:', error);
    res.status(500).json({ error: 'Failed to complete Finch connection' });
  }
};

/**
 * Sync payroll data from Finch
 */
export const syncFinchData = async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Get connection details
    const connectionResult = await query(
      `SELECT connection_id, taxpayer_id, business_id,
              access_token_encrypted, provider_company_id, metadata
       FROM connections
       WHERE connection_id = $1 AND provider = 'finch' AND status = 'active'`,
      [connectionId]
    );

    if (connectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Finch connection not found' });
    }

    const connection = connectionResult.rows[0];
    const accessToken = decrypt(connection.access_token_encrypted);

    // Create sync job
    const jobResult = await query(
      `INSERT INTO sync_jobs (connection_id, job_type, status, started_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING job_id`,
      [connectionId, 'finch_payroll_sync', 'processing']
    );

    const jobId = jobResult.rows[0].job_id;

    // Sync in background (simplified for demo)
    syncFinchPayrollData(connectionId, accessToken, jobId).catch(err => {
      console.error('Background sync error:', err);
    });

    res.json({
      success: true,
      message: 'Payroll sync started',
      jobId
    });

  } catch (error) {
    console.error('Sync initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate sync' });
  }
};

/**
 * Background function to sync payroll data
 */
async function syncFinchPayrollData(connectionId, accessToken, jobId) {
  try {
    let recordsProcessed = 0;
    let recordsFailed = 0;

    // Fetch directory (employees)
    const directoryResponse = await axios.get(`${FINCH_API_URL}/employer/directory`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const individuals = directoryResponse.data.individuals || [];

    // Fetch individual details for each employee
    for (const individual of individuals) {
      try {
        const individualResponse = await axios.post(
          `${FINCH_API_URL}/employer/individual`,
          { requests: [{ individual_id: individual.id }] },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const employeeData = individualResponse.data.responses[0].body;

        // Store employee in database
        await query(
          `INSERT INTO employees
           (connection_id, provider_employee_id, first_name, last_name,
            email, hire_date, employment_status, source_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (connection_id, provider_employee_id)
           DO UPDATE SET
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             email = EXCLUDED.email,
             employment_status = EXCLUDED.employment_status,
             updated_at = NOW()`,
          [
            connectionId,
            individual.id,
            employeeData.first_name,
            employeeData.last_name,
            employeeData.emails?.[0]?.data,
            employeeData.hire_date,
            employeeData.employment?.type,
            JSON.stringify(employeeData)
          ]
        );

        recordsProcessed++;
      } catch (err) {
        console.error(`Failed to sync employee ${individual.id}:`, err);
        recordsFailed++;
      }
    }

    // Update sync job status
    await query(
      `UPDATE sync_jobs
       SET status = 'completed',
           completed_at = NOW(),
           records_processed = $1,
           records_failed = $2
       WHERE job_id = $3`,
      [recordsProcessed, recordsFailed, jobId]
    );

    // Update connection last_sync_at
    await query(
      `UPDATE connections
       SET last_sync_at = NOW()
       WHERE connection_id = $1`,
      [connectionId]
    );

  } catch (error) {
    console.error('Payroll sync background error:', error);

    // Mark job as failed
    await query(
      `UPDATE sync_jobs
       SET status = 'failed',
           completed_at = NOW(),
           error_message = $1
       WHERE job_id = $2`,
      [error.message, jobId]
    );
  }
}

/**
 * Get connections for a taxpayer
 */
export const getConnections = async (req, res) => {
  try {
    const taxpayerId = req.user.userId;

    const result = await query(
      `SELECT connection_id, provider, status, last_sync_at,
              created_at, metadata
       FROM connections
       WHERE taxpayer_id = $1
       ORDER BY created_at DESC`,
      [taxpayerId]
    );

    const connections = result.rows.map(conn => ({
      id: conn.connection_id,
      provider: conn.provider,
      status: conn.status,
      lastSyncAt: conn.last_sync_at,
      createdAt: conn.created_at,
      metadata: conn.metadata
    }));

    res.json({ connections });

  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
};
