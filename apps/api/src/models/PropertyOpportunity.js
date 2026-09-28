// Property Opportunity model for tracking leads and potential acquisitions

class PropertyOpportunity {
  constructor(
    id,
    organizationId,
    propertyAddress,
    propertyType,
    propertySize,
    propertyUnits,
    sellerName,
    sellerEmail,
    brokerName,
    listPrice,
    status = 'Lead'
  ) {
    this.id = id;
    this.organizationId = organizationId;
    this.propertyAddress = propertyAddress;
    this.propertyType = propertyType;
    this.propertySize = propertySize;
    this.propertyUnits = propertyUnits;
    this.sellerName = sellerName;
    this.sellerEmail = sellerEmail;
    this.brokerName = brokerName;
    this.listPrice = listPrice;
    this.status = status; // Lead, Evaluating, Offer Pending, Rejected, Withdrawn
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static async create(db, data) {
    const query = `
      INSERT INTO property_opportunities
      (organization_id, property_address, property_type, property_size_sqft, property_units,
       seller_name, seller_email, broker_name, list_price, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await db.query(query, [
      data.organizationId,
      data.propertyAddress,
      data.propertyType,
      data.propertySize,
      data.propertyUnits,
      data.sellerName,
      data.sellerEmail,
      data.brokerName,
      data.listPrice,
      data.status || 'Lead'
    ]);
    return result.rows[0];
  }

  static async findById(db, id) {
    const query = 'SELECT * FROM property_opportunities WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findByOrganization(db, organizationId) {
    const query = `
      SELECT * FROM property_opportunities
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [organizationId]);
    return result.rows;
  }

  static async updateStatus(db, id, status) {
    const query = `
      UPDATE property_opportunities
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [status, id]);
    return result.rows[0];
  }

  static async findByStatus(db, organizationId, status) {
    const query = `
      SELECT * FROM property_opportunities
      WHERE organization_id = $1 AND status = $2
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [organizationId, status]);
    return result.rows;
  }
}

module.exports = PropertyOpportunity;
