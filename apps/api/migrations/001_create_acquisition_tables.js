// Migration: Create acquisition and portfolio tables

module.exports = {
  up: async (db) => {
    // Organizations
    await db.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        legal_entity_name VARCHAR(255),
        ein VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Property Opportunities
    await db.query(`
      CREATE TABLE IF NOT EXISTS property_opportunities (
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
        status VARCHAR(50) DEFAULT 'Lead',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Acquisitions
    await db.query(`
      CREATE TABLE IF NOT EXISTS acquisitions (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id),
        opportunity_id INTEGER REFERENCES property_opportunities(id),
        property_address VARCHAR(255) NOT NULL,
        acquisition_status VARCHAR(50) DEFAULT 'Lead',
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
      )
    `);

    // Properties
    await db.query(`
      CREATE TABLE IF NOT EXISTS properties (
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
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await db.query('CREATE INDEX IF NOT EXISTS idx_acquisitions_organization_id ON acquisitions(organization_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_acquisitions_status ON acquisitions(acquisition_status)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_properties_organization_id ON properties(organization_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_opportunities_status ON property_opportunities(status)');
  },

  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS properties CASCADE');
    await db.query('DROP TABLE IF EXISTS acquisitions CASCADE');
    await db.query('DROP TABLE IF EXISTS property_opportunities CASCADE');
    await db.query('DROP TABLE IF EXISTS organizations CASCADE');
  }
};
