// Property model for owned/managed properties

class Property {
  constructor(
    id,
    organizationId,
    address,
    city,
    state,
    zipCode,
    propertyType,
    purchasePrice,
    purchaseDate,
    status = 'Active'
  ) {
    this.id = id;
    this.organizationId = organizationId;
    this.address = address;
    this.city = city;
    this.state = state;
    this.zipCode = zipCode;
    this.propertyType = propertyType;
    this.purchasePrice = purchasePrice;
    this.purchaseDate = purchaseDate;
    this.status = status; // Active, Maintenance, Pending Sale, Sold
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static async create(db, data) {
    const query = `
      INSERT INTO properties
      (organization_id, acquisition_id, address, city, state, zip_code, property_type,
       purchase_price, purchase_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await db.query(query, [
      data.organizationId,
      data.acquisitionId,
      data.address,
      data.city,
      data.state,
      data.zipCode,
      data.propertyType,
      data.purchasePrice,
      data.purchaseDate,
      data.status || 'Active'
    ]);
    return result.rows[0];
  }

  static async findById(db, id) {
    const query = 'SELECT * FROM properties WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findByOrganization(db, organizationId) {
    const query = `
      SELECT * FROM properties
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [organizationId]);
    return result.rows;
  }

  static async updateStatus(db, id, status) {
    const query = `
      UPDATE properties
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [status, id]);
    return result.rows[0];
  }

  static async getPortfolioMetrics(db, organizationId) {
    const query = `
      SELECT
        COUNT(*) as total_properties,
        SUM(purchase_price) as total_invested,
        AVG(estimated_value) as average_value,
        SUM(estimated_value) as total_portfolio_value
      FROM properties
      WHERE organization_id = $1 AND status = 'Active'
    `;
    const result = await db.query(query, [organizationId]);
    return result.rows[0];
  }
}

module.exports = Property;
