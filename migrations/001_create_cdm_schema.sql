-- Core CDM Tables for Tax Middleware
-- PostgreSQL Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PARTIES

CREATE TABLE taxpayers (
    taxpayer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ssn_encrypted TEXT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    dob DATE NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    filing_status VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip VARCHAR(10),
    kyc_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE businesses (
    business_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name VARCHAR(255) NOT NULL,
    dba VARCHAR(255),
    ein VARCHAR(20) NOT NULL,
    entity_type VARCHAR(50),
    naics_code VARCHAR(10),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. INTEGRATIONS & CONNECTIONS

CREATE TABLE connections (
    connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    taxpayer_id UUID REFERENCES taxpayers(taxpayer_id),
    business_id UUID REFERENCES businesses(business_id),
    provider VARCHAR(50) NOT NULL,
    provider_company_id VARCHAR(255),
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    scopes TEXT[],
    status VARCHAR(50) DEFAULT 'active',
    last_sync_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. PAYROLL DATA

CREATE TABLE employees (
    employee_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES connections(connection_id),
    business_id UUID REFERENCES businesses(business_id),
    provider_employee_id VARCHAR(255) NOT NULL,
    ssn_encrypted TEXT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    hire_date DATE,
    termination_date DATE,
    employment_status VARCHAR(50),
    compensation_type VARCHAR(50),
    address JSONB,
    source_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(connection_id, provider_employee_id)
);

CREATE TABLE pay_runs (
    payrun_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES connections(connection_id),
    business_id UUID REFERENCES businesses(business_id),
    provider_payrun_id VARCHAR(255) NOT NULL,
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    check_date DATE NOT NULL,
    payrun_type VARCHAR(50),
    status VARCHAR(50),
    source_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(connection_id, provider_payrun_id)
);

CREATE TABLE pay_run_details (
    detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payrun_id UUID REFERENCES pay_runs(payrun_id),
    employee_id UUID REFERENCES employees(employee_id),
    gross_pay DECIMAL(12,2),
    net_pay DECIMAL(12,2),
    federal_withholding DECIMAL(12,2),
    state_withholding DECIMAL(12,2),
    local_withholding DECIMAL(12,2),
    fica_employee DECIMAL(12,2),
    medicare_employee DECIMAL(12,2),
    fica_employer DECIMAL(12,2),
    medicare_employer DECIMAL(12,2),
    futa DECIMAL(12,2),
    suta DECIMAL(12,2),
    retirement_pretax DECIMAL(12,2),
    retirement_roth DECIMAL(12,2),
    hsa_contribution DECIMAL(12,2),
    earnings JSONB,
    deductions JSONB,
    taxes JSONB,
    source_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE w2_forms (
    w2_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(employee_id),
    business_id UUID REFERENCES businesses(business_id),
    tax_year INTEGER NOT NULL,
    box_1_wages DECIMAL(12,2),
    box_2_federal_tax DECIMAL(12,2),
    box_3_ss_wages DECIMAL(12,2),
    box_4_ss_tax DECIMAL(12,2),
    box_5_medicare_wages DECIMAL(12,2),
    box_6_medicare_tax DECIMAL(12,2),
    box_12_codes JSONB,
    box_14_other JSONB,
    localities JSONB,
    pdf_url TEXT,
    source_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, tax_year)
);

-- 4. ACCOUNTING DATA

CREATE TABLE accounts (
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES connections(connection_id),
    business_id UUID REFERENCES businesses(business_id),
    provider_account_id VARCHAR(255) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(100),
    account_number VARCHAR(50),
    balance DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    parent_account_id UUID REFERENCES accounts(account_id),
    is_active BOOLEAN DEFAULT true,
    source_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(connection_id, provider_account_id)
);

CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES connections(connection_id),
    business_id UUID REFERENCES businesses(business_id),
    account_id UUID REFERENCES accounts(account_id),
    provider_transaction_id VARCHAR(255),
    transaction_date DATE NOT NULL,
    post_date DATE,
    amount DECIMAL(12,2) NOT NULL,
    direction VARCHAR(10),
    description TEXT,
    merchant_name VARCHAR(255),
    category_provider VARCHAR(100),
    category_tax VARCHAR(100),
    is_personal BOOLEAN DEFAULT false,
    receipt_url TEXT,
    source_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. RETIREMENT DATA

CREATE TABLE retirement_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES connections(connection_id),
    business_id UUID REFERENCES businesses(business_id),
    provider_plan_id VARCHAR(255),
    plan_name VARCHAR(255) NOT NULL,
    plan_type VARCHAR(50),
    erisa_plan_id VARCHAR(50),
    match_formula TEXT,
    is_safe_harbor BOOLEAN DEFAULT false,
    source_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(connection_id, provider_plan_id)
);

CREATE TABLE contributions (
    contribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES retirement_plans(plan_id),
    employee_id UUID REFERENCES employees(employee_id),
    taxpayer_id UUID REFERENCES taxpayers(taxpayer_id),
    tax_year INTEGER NOT NULL,
    contribution_date DATE,
    amount DECIMAL(12,2) NOT NULL,
    contribution_type VARCHAR(50),
    source VARCHAR(50),
    source_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. TAX FORMS & RETURNS

CREATE TABLE tax_documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    taxpayer_id UUID REFERENCES taxpayers(taxpayer_id),
    business_id UUID REFERENCES businesses(business_id),
    document_type VARCHAR(50) NOT NULL,
    tax_year INTEGER NOT NULL,
    payer_name VARCHAR(255),
    payer_ein VARCHAR(20),
    recipient_name VARCHAR(255),
    recipient_tin VARCHAR(20),
    amounts JSONB,
    pdf_url TEXT,
    import_status VARCHAR(50) DEFAULT 'pending',
    source_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tax_returns (
    return_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    taxpayer_id UUID REFERENCES taxpayers(taxpayer_id),
    business_id UUID REFERENCES businesses(business_id),
    jurisdiction VARCHAR(50),
    form_type VARCHAR(50),
    tax_year INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    balance_due DECIMAL(12,2),
    refund_amount DECIMAL(12,2),
    form_data JSONB,
    pdf_url TEXT,
    submission_id VARCHAR(255),
    ack_id VARCHAR(255),
    filed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. AUDIT & LOGGING

CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    actor_id UUID,
    entity_type VARCHAR(50),
    entity_id UUID,
    action VARCHAR(50),
    before_hash TEXT,
    after_hash TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 8. INGESTION JOBS

CREATE TABLE sync_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES connections(connection_id),
    job_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    records_processed INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_taxpayers_ssn ON taxpayers(ssn_encrypted);
CREATE INDEX idx_connections_taxpayer ON connections(taxpayer_id);
CREATE INDEX idx_connections_business ON connections(business_id);
CREATE INDEX idx_connections_provider ON connections(provider);
CREATE INDEX idx_employees_business ON employees(business_id);
CREATE INDEX idx_pay_runs_business ON pay_runs(business_id);
CREATE INDEX idx_pay_runs_dates ON pay_runs(pay_period_start, pay_period_end);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_business ON transactions(business_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Create views for common queries
CREATE VIEW v_employee_ytd_summary AS
SELECT
    e.employee_id,
    e.first_name,
    e.last_name,
    e.business_id,
    EXTRACT(YEAR FROM pr.check_date) as tax_year,
    SUM(prd.gross_pay) as ytd_gross,
    SUM(prd.net_pay) as ytd_net,
    SUM(prd.federal_withholding) as ytd_federal_tax,
    SUM(prd.state_withholding) as ytd_state_tax,
    SUM(prd.fica_employee) as ytd_fica,
    SUM(prd.medicare_employee) as ytd_medicare,
    SUM(prd.retirement_pretax) as ytd_401k
FROM employees e
JOIN pay_run_details prd ON e.employee_id = prd.employee_id
JOIN pay_runs pr ON prd.payrun_id = pr.payrun_id
GROUP BY e.employee_id, e.first_name, e.last_name, e.business_id, EXTRACT(YEAR FROM pr.check_date);

COMMENT ON TABLE taxpayers IS 'Individual taxpayers - the end clients';
COMMENT ON TABLE businesses IS 'Business entities owned by taxpayers';
COMMENT ON TABLE connections IS 'OAuth connections to third-party data providers (Finch, QBO, etc)';
COMMENT ON TABLE employees IS 'Employees synced from payroll providers via Finch';
COMMENT ON TABLE pay_runs IS 'Payroll runs with pay period and check date information';
COMMENT ON TABLE pay_run_details IS 'Individual employee payment details within each pay run';
COMMENT ON TABLE w2_forms IS 'Annual W-2 forms for employees';
