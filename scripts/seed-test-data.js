import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper to encrypt SSN (simplified version)
function encryptSSN(ssn) {
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex').slice(0, 32),
    Buffer.alloc(16, 0)
  );
  let encrypted = cipher.update(ssn, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

async function seedTestData() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🌱 Seeding test data...\n');

    // 1. Create test taxpayers with roles
    console.log('👤 Creating taxpayers...');
    const taxpayerResult = await client.query(`
      INSERT INTO taxpayers (taxpayer_id, ssn_encrypted, first_name, last_name, dob, email, phone, filing_status, kyc_status, role)
      VALUES
        ('11111111-1111-1111-1111-111111111111', $1, 'Admin', 'User', '1980-01-01', 'admin@tax.com', '555-0100', 'single', 'verified', 'admin'),
        ('22222222-2222-2222-2222-222222222222', $2, 'Tax', 'Preparer', '1985-05-15', 'preparer@tax.com', '555-0200', 'married', 'verified', 'tax_professional'),
        ('33333333-3333-3333-3333-333333333333', $3, 'John', 'Taxpayer', '1990-08-20', 'taxpayer@tax.com', '555-0300', 'single', 'verified', 'taxpayer')
      ON CONFLICT (taxpayer_id) DO NOTHING
      RETURNING taxpayer_id
    `, [encryptSSN('111-11-1111'), encryptSSN('222-22-2222'), encryptSSN('333-33-3333')]);

    console.log(`   ✅ Created ${taxpayerResult.rowCount} taxpayers`);

    // 2. Create test businesses
    console.log('🏢 Creating businesses...');
    const businessResult = await client.query(`
      INSERT INTO businesses (business_id, legal_name, dba, ein, entity_type, naics_code, city, state, zip)
      VALUES
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Corporation', 'Acme Corp', '12-3456789', 'C-Corp', '541511', 'San Francisco', 'CA', '94102'),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Beta Technologies LLC', 'Beta Tech', '98-7654321', 'LLC', '541512', 'Austin', 'TX', '78701')
      ON CONFLICT (business_id) DO NOTHING
      RETURNING business_id
    `);

    console.log(`   ✅ Created ${businessResult.rowCount} businesses`);

    // 3. Create test connections
    console.log('🔗 Creating Finch connections...');
    const connectionResult = await client.query(`
      INSERT INTO connections (connection_id, taxpayer_id, business_id, provider, provider_company_id, status, scopes, metadata)
      VALUES
        ('cccccccc-cccc-cccc-cccc-cccccccccccc',
         '33333333-3333-3333-3333-333333333333',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
         'finch',
         'finch_company_123',
         'active',
         ARRAY['company', 'directory', 'individual', 'employment', 'payment'],
         '{"company_name": "Acme Corporation", "connected_at": "2024-01-15T10:00:00Z"}'::jsonb)
      ON CONFLICT (connection_id) DO NOTHING
      RETURNING connection_id
    `);

    console.log(`   ✅ Created ${connectionResult.rowCount} connections`);

    // 4. Create test employees
    console.log('👥 Creating employees...');
    const employeeResult = await client.query(`
      INSERT INTO employees (employee_id, connection_id, business_id, provider_employee_id, first_name, last_name, email, hire_date, employment_status, compensation_type)
      VALUES
        ('e1111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'finch_emp_001', 'Alice', 'Johnson', 'alice@acme.com', '2023-01-15', 'active', 'salary'),
        ('e2222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'finch_emp_002', 'Bob', 'Smith', 'bob@acme.com', '2023-03-01', 'active', 'salary'),
        ('e3333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'finch_emp_003', 'Carol', 'Williams', 'carol@acme.com', '2023-06-15', 'active', 'hourly')
      ON CONFLICT (connection_id, provider_employee_id) DO NOTHING
      RETURNING employee_id
    `);

    console.log(`   ✅ Created ${employeeResult.rowCount} employees`);

    // 5. Create test pay runs
    console.log('💰 Creating pay runs...');
    const payRunResult = await client.query(`
      INSERT INTO pay_runs (payrun_id, connection_id, business_id, provider_payrun_id, pay_period_start, pay_period_end, check_date, payrun_type, status)
      VALUES
        ('00001111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'finch_pr_001', '2024-01-01', '2024-01-15', '2024-01-20', 'regular', 'paid'),
        ('00002222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'finch_pr_002', '2024-01-16', '2024-01-31', '2024-02-05', 'regular', 'paid'),
        ('00003333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'finch_pr_003', '2024-02-01', '2024-02-15', '2024-02-20', 'regular', 'paid')
      ON CONFLICT (connection_id, provider_payrun_id) DO NOTHING
      RETURNING payrun_id
    `);

    console.log(`   ✅ Created ${payRunResult.rowCount} pay runs`);

    // 6. Create pay run details
    console.log('📊 Creating pay run details...');
    const payRunDetailsResult = await client.query(`
      INSERT INTO pay_run_details (payrun_id, employee_id, gross_pay, net_pay, federal_withholding, state_withholding, fica_employee, medicare_employee, fica_employer, medicare_employer, futa, suta, retirement_pretax)
      VALUES
        -- Alice Johnson - Pay Run 1
        ('00001111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 5000.00, 3850.00, 750.00, 250.00, 310.00, 72.50, 310.00, 72.50, 30.00, 135.00, 250.00),
        -- Bob Smith - Pay Run 1
        ('00001111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 6000.00, 4620.00, 900.00, 300.00, 372.00, 87.00, 372.00, 87.00, 36.00, 162.00, 300.00),
        -- Carol Williams - Pay Run 1
        ('00001111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333', 3000.00, 2400.00, 350.00, 150.00, 186.00, 43.50, 186.00, 43.50, 18.00, 81.00, 100.00),
        -- Alice Johnson - Pay Run 2
        ('00002222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 5000.00, 3850.00, 750.00, 250.00, 310.00, 72.50, 310.00, 72.50, 30.00, 135.00, 250.00),
        -- Bob Smith - Pay Run 2
        ('00002222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 6000.00, 4620.00, 900.00, 300.00, 372.00, 87.00, 372.00, 87.00, 36.00, 162.00, 300.00),
        -- Carol Williams - Pay Run 2
        ('00002222-2222-2222-2222-222222222222', 'e3333333-3333-3333-3333-333333333333', 3000.00, 2400.00, 350.00, 150.00, 186.00, 43.50, 186.00, 43.50, 18.00, 81.00, 100.00)
      RETURNING detail_id
    `);

    console.log(`   ✅ Created ${payRunDetailsResult.rowCount} pay run details`);

    // 7. Create W-2 forms
    console.log('📄 Creating W-2 forms...');
    const w2Result = await client.query(`
      INSERT INTO w2_forms (employee_id, business_id, tax_year, box_1_wages, box_2_federal_tax, box_3_ss_wages, box_4_ss_tax, box_5_medicare_wages, box_6_medicare_tax)
      VALUES
        ('e1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2024, 60000.00, 9000.00, 60000.00, 3720.00, 60000.00, 870.00),
        ('e2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2024, 72000.00, 10800.00, 72000.00, 4464.00, 72000.00, 1044.00),
        ('e3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2024, 36000.00, 4200.00, 36000.00, 2232.00, 36000.00, 522.00)
      ON CONFLICT (employee_id, tax_year) DO NOTHING
      RETURNING w2_id
    `);

    console.log(`   ✅ Created ${w2Result.rowCount} W-2 forms`);

    // 8. Create audit logs
    console.log('📝 Creating audit logs...');
    const auditResult = await client.query(`
      INSERT INTO audit_logs (event_type, actor_id, entity_type, entity_id, action, metadata)
      VALUES
        ('integration.connected', '33333333-3333-3333-3333-333333333333', 'connection', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'create', '{"provider": "finch", "timestamp": "2024-01-15T10:00:00Z"}'::jsonb),
        ('sync.completed', '33333333-3333-3333-3333-333333333333', 'sync_job', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'complete', '{"records_synced": 3, "timestamp": "2024-01-15T10:05:00Z"}'::jsonb)
      RETURNING log_id
    `);

    console.log(`   ✅ Created ${auditResult.rowCount} audit log entries`);

    await client.query('COMMIT');

    console.log('\n✅ Test data seeding completed successfully!\n');

    // Print summary
    console.log('📊 Summary:');
    console.log('   - Taxpayers: 3');
    console.log('   - Businesses: 2');
    console.log('   - Connections: 1 (Finch)');
    console.log('   - Employees: 3');
    console.log('   - Pay Runs: 3');
    console.log('   - Pay Run Details: 6');
    console.log('   - W-2 Forms: 3');
    console.log('   - Audit Logs: 2\n');

    console.log('🔐 Test Login Credentials:');
    console.log('   Admin: admin@tax.com / admin123');
    console.log('   Preparer: preparer@tax.com / preparer123');
    console.log('   Taxpayer: taxpayer@tax.com / taxpayer123\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed function
seedTestData()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
