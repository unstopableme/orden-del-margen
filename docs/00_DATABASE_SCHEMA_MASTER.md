# 🗄️ 00_DATABASE_SCHEMA_MASTER.md | Authoritative Database Dictionary

This document reflects the production-verified structural definitions of the active database schema. All application queries, APIs, and data mutations must conform strictly to these columns.

---

## 🏢 1. Real Estate & Core Portfolio Management
Manages physical portfolio entries, purchase metrics, and organizational scaling parameters.

### `properties`
* **Purpose:** Stores core geographic and valuation data for corporate physical assets.
* **Fields:**
  * `id` (SERIAL, PRIMARY KEY): Unique property entry identifier.
  * `organization_id` (INTEGER, FOREIGN KEY): Links asset to the managing entity profile.
  * `acquisition_id` (INTEGER, FOREIGN KEY): Reference pointer tracking transaction records.
  * `address` (VARCHAR, NOT NULL): Verified street and location string metadata.
  * `purchase_price` (NUMERIC): Initial financial capital deployed to acquire the asset.
  * `estimated_value` (NUMERIC): Active market valuation estimation metric.

### `acquisitions`
* **Purpose:** Tracks historical transactions and capital outlays for property portfolio changes.

---

## ☕ 2. Social Integration Layer

### `coffee_gifts`
* **Purpose:** Authoritative peer-to-peer social ledger tracking coffee asset transmissions between verified corporate application user account profiles.
