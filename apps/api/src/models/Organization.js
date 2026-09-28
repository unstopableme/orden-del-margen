// Organization model for Café de la Doncella LLC

class Organization {
  constructor(id, name, legalEntityName, ein) {
    this.id = id;
    this.name = name;
    this.legalEntityName = legalEntityName;
    this.ein = ein;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static async create(db, name, legalEntityName, ein) {
    const query = `
      INSERT INTO organizations (name, legal_entity_name, ein)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await db.query(query, [name, legalEntityName, ein]);
    return result.rows[0];
  }

  static async findById(db, id) {
    const query = 'SELECT * FROM organizations WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findAll(db) {
    const query = 'SELECT * FROM organizations ORDER BY created_at DESC';
    const result = await db.query(query);
    return result.rows;
  }

  static async update(db, id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const query = `
      UPDATE organizations
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${fields.length + 1}
      RETURNING *
    `;
    const result = await db.query(query, [...values, id]);
    return result.rows[0];
  }
}

module.exports = Organization;
