-- Role-Based Access Control Schema
-- Adds support for multiple user roles and permissions

-- Add role column to taxpayers table
ALTER TABLE taxpayers ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'taxpayer';

-- Create index on role for faster queries
CREATE INDEX IF NOT EXISTS idx_taxpayers_role ON taxpayers(role);

-- Create client_assignments table for tax professional-client relationships
CREATE TABLE IF NOT EXISTS client_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES taxpayers(taxpayer_id) ON DELETE CASCADE,
    professional_id UUID REFERENCES taxpayers(taxpayer_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    UNIQUE(client_id, professional_id)
);

CREATE INDEX IF NOT EXISTS idx_client_assignments_client ON client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_professional ON client_assignments(professional_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_status ON client_assignments(status);

-- Create user_entities table for business owner multi-entity access
CREATE TABLE IF NOT EXISTS user_entities (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES taxpayers(taxpayer_id) ON DELETE CASCADE,
    entity_id UUID REFERENCES businesses(business_id) ON DELETE CASCADE,
    role_in_entity VARCHAR(50) DEFAULT 'owner', -- 'owner', 'accountant', 'viewer'
    access_level VARCHAR(50) DEFAULT 'full', -- 'full', 'read_only', 'limited'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_user_entities_user ON user_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_entities_entity ON user_entities(entity_id);

-- Add role column to businesses for entity type classification
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'business_owner';

-- Create roles table for permission management
CREATE TABLE IF NOT EXISTS user_roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default roles
INSERT INTO user_roles (role_name, display_name, permissions) VALUES
('taxpayer', 'Individual Taxpayer', '{
    "view_own_data": true,
    "upload_documents": true,
    "view_tax_returns": true,
    "edit_profile": true
}'::jsonb),
('business_owner', 'Business Owner', '{
    "view_own_data": true,
    "manage_payroll": true,
    "view_employees": true,
    "manage_entities": true,
    "upload_documents": true,
    "view_tax_returns": true,
    "edit_profile": true
}'::jsonb),
('tax_professional', 'Tax Professional / CPA', '{
    "view_client_data": true,
    "edit_client_data": true,
    "file_returns": true,
    "manage_clients": true,
    "view_all_documents": true,
    "generate_reports": true,
    "e_sign": true
}'::jsonb),
('admin', 'System Administrator', '{
    "full_access": true,
    "manage_users": true,
    "manage_integrations": true,
    "view_analytics": true,
    "system_config": true,
    "billing_management": true
}'::jsonb)
ON CONFLICT (role_name) DO NOTHING;

-- Create tasks table for workflow management
CREATE TABLE IF NOT EXISTS tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_to UUID REFERENCES taxpayers(taxpayer_id),
    assigned_by UUID REFERENCES taxpayers(taxpayer_id),
    client_id UUID REFERENCES taxpayers(taxpayer_id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
    due_date DATE,
    completed_at TIMESTAMP,
    estimated_hours DECIMAL(5,2),
    category VARCHAR(50), -- 'document_review', 'client_meeting', 'return_prep', 'filing'
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- Create time_tracking table for billable hours
CREATE TABLE IF NOT EXISTS time_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES taxpayers(taxpayer_id),
    client_id UUID REFERENCES taxpayers(taxpayer_id),
    task_id UUID REFERENCES tasks(task_id),
    description TEXT,
    hours DECIMAL(5,2) NOT NULL,
    billable BOOLEAN DEFAULT true,
    hourly_rate DECIMAL(10,2),
    entry_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client ON time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(entry_date);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES taxpayers(taxpayer_id),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50), -- 'deadline', 'document_uploaded', 'message', 'system'
    priority VARCHAR(20) DEFAULT 'normal', -- 'urgent', 'high', 'normal', 'low'
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Create messages table for client-professional communication
CREATE TABLE IF NOT EXISTS messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES taxpayers(taxpayer_id),
    recipient_id UUID REFERENCES taxpayers(taxpayer_id),
    client_id UUID REFERENCES taxpayers(taxpayer_id), -- For context
    subject VARCHAR(255),
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    parent_message_id UUID REFERENCES messages(message_id), -- For threading
    attachments JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Create system_settings table for feature flags and configuration
CREATE TABLE IF NOT EXISTS system_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES taxpayers(taxpayer_id),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('feature_flags', '{
    "finch_integration": true,
    "qbo_integration": false,
    "plaid_integration": false,
    "ai_recommendations": true,
    "e_filing": false
}'::jsonb, 'Feature toggles for the platform'),
('tax_deadlines', '{
    "federal_individual": "2024-04-15",
    "federal_business": "2024-03-15",
    "q1_estimated": "2024-04-15",
    "q2_estimated": "2024-06-15",
    "q3_estimated": "2024-09-15",
    "q4_estimated": "2025-01-15"
}'::jsonb, 'Important tax deadlines'),
('system_limits', '{
    "max_file_size_mb": 50,
    "max_storage_gb_per_user": 10,
    "max_connections_per_business": 5,
    "rate_limit_requests_per_minute": 100
}'::jsonb, 'System-wide limits and quotas')
ON CONFLICT (setting_key) DO NOTHING;

-- Add completion_percentage column to tax_returns
ALTER TABLE tax_returns ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0;

-- Create view for client overview (for tax professionals)
CREATE OR REPLACE VIEW v_client_overview AS
SELECT
    t.taxpayer_id as client_id,
    t.first_name || ' ' || t.last_name as name,
    t.email,
    t.kyc_status,
    ca.professional_id,
    tr.status as return_status,
    tr.tax_year,
    tr.balance_due,
    tr.refund_amount,
    COUNT(DISTINCT td.document_id) as document_count,
    MAX(tr.updated_at) as last_activity
FROM taxpayers t
LEFT JOIN client_assignments ca ON t.taxpayer_id = ca.client_id
LEFT JOIN tax_returns tr ON t.taxpayer_id = tr.taxpayer_id
LEFT JOIN tax_documents td ON t.taxpayer_id = td.taxpayer_id
GROUP BY t.taxpayer_id, t.first_name, t.last_name, t.email, t.kyc_status,
         ca.professional_id, tr.status, tr.tax_year, tr.balance_due, tr.refund_amount;

-- Create view for business owner multi-entity summary
CREATE OR REPLACE VIEW v_business_owner_entities AS
SELECT
    ue.user_id,
    b.business_id,
    b.legal_name,
    b.dba,
    b.ein,
    b.entity_type,
    ue.role_in_entity,
    ue.access_level,
    COUNT(DISTINCT e.employee_id) as employee_count,
    COUNT(DISTINCT c.connection_id) as connection_count
FROM user_entities ue
JOIN businesses b ON ue.entity_id = b.business_id
LEFT JOIN employees e ON b.business_id = e.business_id
LEFT JOIN connections c ON b.business_id = c.business_id
GROUP BY ue.user_id, b.business_id, b.legal_name, b.dba, b.ein,
         b.entity_type, ue.role_in_entity, ue.access_level;

COMMENT ON TABLE client_assignments IS 'Maps tax professionals to their clients';
COMMENT ON TABLE user_entities IS 'Maps business owners to their business entities';
COMMENT ON TABLE user_roles IS 'Defines user roles and their permissions';
COMMENT ON TABLE tasks IS 'Task and workflow management for tax professionals';
COMMENT ON TABLE time_entries IS 'Time tracking for billable hours';
COMMENT ON TABLE notifications IS 'In-app notifications for users';
COMMENT ON TABLE messages IS 'Direct messaging between clients and professionals';
COMMENT ON TABLE system_settings IS 'System-wide configuration and feature flags';
