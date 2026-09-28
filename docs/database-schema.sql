-- Café de la Doncella LLC - Property Acquisition & Portfolio Management Schema

-- Organizations (currently Café de la Doncella LLC)
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    legal_entity_name VARCHAR(255),
    ein VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Property Opportunities
CREATE TABLE property_opportunities (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    property_address VARCHAR(255) NOT NULL,
    property_type VARCHAR(100),
    property_size_sqft INTEGER,
    property_units INTEGER,
    seller_name VARCHAR(255),
    seller_phone VARCHAR(20),
    seller_email VARCHAR(255),
    broker_name VARCHAR(255),
    broker_phone VARCHAR(20),
    broker_email VARCHAR(255),
    list_price DECIMAL(15,2),
    initial_estimate DECIMAL(15,2),
    property_condition VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'Lead', -- Lead, Evaluating, Offer Pending, Rejected, Withdrawn
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Acquisitions
CREATE TABLE acquisitions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    opportunity_id INTEGER REFERENCES property_opportunities(id),
    property_address VARCHAR(255) NOT NULL,
    acquisition_status VARCHAR(50) DEFAULT 'Lead', -- Lead, Evaluating, Offer, Under Contract, Closing, Acquired
    offer_amount DECIMAL(15,2),
    offer_date DATE,
    expected_closing_date DATE,
    earnest_money_amount DECIMAL(15,2),
    inspection_contingency BOOLEAN,
    financing_contingency BOOLEAN,
    expected_appraisal_value DECIMAL(15,2),
    expected_closing_costs DECIMAL(15,2),
    actual_purchase_price DECIMAL(15,2),
    actual_closing_date DATE,
    title_company VARCHAR(255),
    title_policy_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Acquisition Negotiation History
CREATE TABLE acquisition_offers (
    id SERIAL PRIMARY KEY,
    acquisition_id INTEGER NOT NULL REFERENCES acquisitions(id),
    offer_number INTEGER,
    offer_amount DECIMAL(15,2) NOT NULL,
    offer_date DATE NOT NULL,
    offer_type VARCHAR(50), -- Original, Counteroffer
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Properties (Post-Acquisition Portfolio)
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    acquisition_id INTEGER REFERENCES acquisitions(id),
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    property_type VARCHAR(100),
    year_built INTEGER,
    total_sqft INTEGER,
    total_units INTEGER,
    purchase_price DECIMAL(15,2),
    estimated_value DECIMAL(15,2),
    last_valuation_date DATE,
    purchase_date DATE,
    status VARCHAR(50) DEFAULT 'Active', -- Active, Maintenance, Pending Sale, Sold
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Due Diligence Tasks
CREATE TABLE due_diligence_tasks (
    id SERIAL PRIMARY KEY,
    acquisition_id INTEGER NOT NULL REFERENCES acquisitions(id),
    task_type VARCHAR(100), -- Inspection, Appraisal, Title Search, Survey, Environmental, etc.
    task_name VARCHAR(255) NOT NULL,
    assigned_to INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, In Progress, Completed, Issues Found
    due_date DATE,
    completed_date DATE,
    findings TEXT,
    issues_found TEXT,
    critical_issue BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inspection and Appraisal Reports
CREATE TABLE property_inspections (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id),
    acquisition_id INTEGER REFERENCES acquisitions(id),
    inspector_name VARCHAR(255),
    inspector_company VARCHAR(255),
    inspection_date DATE,
    inspection_type VARCHAR(100), -- Home Inspection, Pest Inspection, etc.
    overall_condition VARCHAR(50),
    major_issues TEXT,
    repair_cost_estimate DECIMAL(15,2),
    report_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Financing and Mortgages
CREATE TABLE financing (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id),
    acquisition_id INTEGER REFERENCES acquisitions(id),
    lender_name VARCHAR(255) NOT NULL,
    lender_contact_name VARCHAR(255),
    lender_phone VARCHAR(20),
    lender_email VARCHAR(255),
    loan_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,3),
    loan_term_years INTEGER,
    loan_type VARCHAR(50), -- Fixed, ARM, etc.
    down_payment_amount DECIMAL(15,2),
    down_payment_percent DECIMAL(5,2),
    loan_status VARCHAR(50) DEFAULT 'Pending', -- Pending, Approved, Closed, Paid Off
    loan_start_date DATE,
    loan_maturity_date DATE,
    monthly_payment DECIMAL(15,2),
    closing_costs DECIMAL(15,2),
    points DECIMAL(5,2),
    appraisal_value DECIMAL(15,2),
    ltv_ratio DECIMAL(5,2),
    property_appraisal_waived BOOLEAN DEFAULT FALSE,
    documents_received BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Property Documents
CREATE TABLE property_documents (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id),
    acquisition_id INTEGER REFERENCES acquisitions(id),
    document_type VARCHAR(100), -- Title, Deed, Inspection, Appraisal, Mortgage, Insurance, etc.
    document_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version_number INTEGER DEFAULT 1,
    is_confidential BOOLEAN DEFAULT FALSE,
    access_level VARCHAR(50) DEFAULT 'Internal', -- Internal, Restricted, Public
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Portfolio Performance Tracking
CREATE TABLE portfolio_metrics (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    property_id INTEGER REFERENCES properties(id),
    metric_date DATE,
    total_acquisition_costs DECIMAL(15,2),
    expected_annual_income DECIMAL(15,2),
    expected_annual_expenses DECIMAL(15,2),
    estimated_property_value DECIMAL(15,2),
    roi_percent DECIMAL(7,3),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_acquisitions_organization_id ON acquisitions(organization_id);
CREATE INDEX idx_acquisitions_status ON acquisitions(acquisition_status);
CREATE INDEX idx_properties_organization_id ON properties(organization_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_financing_property_id ON financing(property_id);
CREATE INDEX idx_documents_property_id ON property_documents(property_id);
CREATE INDEX idx_opportunities_status ON property_opportunities(status);
