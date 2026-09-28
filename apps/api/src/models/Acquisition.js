// Acquisition model for tracking property purchases

class Acquisition {
  constructor(
    id,
    organizationId,
    propertyAddress,
    offerAmount,
    offerDate,
    status = 'Lead'
  ) {
    this.id = id;
    this.organizationId = organizationId;
    this.propertyAddress = propertyAddress;
    this.offerAmount = offerAmount;
    this.offerDate = offerDate;
    this.status = status; // Lead, Evaluating, Offer, Under Contract, Closing, Acquired
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static async create(db, data) {
    const query = `
      INSERT INTO acquisitions
      (organization_id, opportunity_id, property_address, offer_amount, offer_date, acquisition_status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await db.query(query, [
      data.organizationId,
      data.opportunityId,
      data.propertyAddress,
      data.offerAmount,
      data.offerDate,
      data.status || 'Lead'
    ]);
    return result.rows[0];
  }

  static async findById(db, id) {
    const query = 'SELECT * FROM acquisitions WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findByOrganization(db, organizationId) {
    const query = `
      SELECT * FROM acquisitions
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [organizationId]);
    return result.rows;
  }

  static async updateStatus(db, id, status) {
    const query = `
      UPDATE acquisitions
      SET acquisition_status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [status, id]);
    return result.rows[0];
  }

  static async findByStatus(db, organizationId, status) {
    const query = `
      SELECT * FROM acquisitions
      WHERE organization_id = $1 AND acquisition_status = $2
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [organizationId, status]);
    return result.rows;
  }
}

module.exports = Acquisition;
