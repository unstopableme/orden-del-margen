'use strict';

const Organization = require('./models/Organization');
const PropertyOpportunity = require('./models/PropertyOpportunity');

const MAX_POSTGRES_INTEGER = 2_147_483_647;

class InvalidOrganizationIdError extends TypeError {
  constructor() {
    super('organizationId must be a positive integer');
    this.name = 'InvalidOrganizationIdError';
    this.code = 'INVALID_ORGANIZATION_ID';
  }
}

function normalizeOrganizationId(value) {
  const isIntegerString = typeof value === 'string' && /^\d+$/.test(value);
  const organizationId = typeof value === 'number'
    ? value
    : isIntegerString
      ? Number(value)
      : Number.NaN;

  if (
    !Number.isSafeInteger(organizationId)
    || organizationId <= 0
    || organizationId > MAX_POSTGRES_INTEGER
  ) {
    throw new InvalidOrganizationIdError();
  }

  return organizationId;
}

function safeOrganization(organization) {
  return {
    id: organization.id,
    name: organization.name,
    legal_entity_name: organization.legal_entity_name,
    created_at: organization.created_at
  };
}

function safeOpportunity(opportunity) {
  return {
    id: opportunity.id,
    property_address: opportunity.property_address,
    property_type: opportunity.property_type,
    property_size_sqft: opportunity.property_size_sqft,
    property_units: opportunity.property_units,
    list_price: opportunity.list_price,
    status: opportunity.status,
    property_condition: opportunity.property_condition
  };
}

/**
 * Fetch an organization profile using an explicit response allowlist.
 * Sensitive tax and seller/broker contact fields are not returned.
 *
 * @param {{ query: Function }} db PostgreSQL pool or client
 * @param {number|string} organizationId
 * @returns {Promise<Object|null>}
 */
async function getOrganizationProfile(db, organizationId) {
  const id = normalizeOrganizationId(organizationId);
  const organization = await Organization.findById(db, id);

  if (!organization) {
    return null;
  }

  const opportunities = await PropertyOpportunity.findByOrganization(db, id);
  return {
    ...safeOrganization(organization),
    opportunities: opportunities.map(safeOpportunity)
  };
}

module.exports = { getOrganizationProfile, normalizeOrganizationId };
