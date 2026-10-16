'use strict';

module.exports = {
  up: async (db) => {
    await db.query(`
      ALTER TABLE player_equipment
        ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES authenticated_accounts(id) ON DELETE RESTRICT;

      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM player_equipment WHERE account_id IS NULL) THEN
          RAISE EXCEPTION
            'player_equipment contains legacy rows without an authenticated account mapping';
        END IF;
      END;
      $$;

      DROP INDEX IF EXISTS idx_one_item_per_slot;
      ALTER TABLE player_equipment ALTER COLUMN account_id SET NOT NULL;
      ALTER TABLE player_equipment DROP COLUMN IF EXISTS player_id;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_one_equipped_item_per_account_slot
        ON player_equipment(account_id, slot_type) WHERE is_equipped = TRUE;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_player_equipment_id_account
        ON player_equipment(id, account_id);

      CREATE TABLE economy_listings (
        id UUID PRIMARY KEY,
        seller_account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        buyer_account_id UUID REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        equipment_id INTEGER NOT NULL REFERENCES player_equipment(id) ON DELETE RESTRICT,
        currency_type VARCHAR(20) NOT NULL
          CHECK (currency_type IN ('$DONCELLA', '$MARGEN')),
        price BIGINT NOT NULL CHECK (price > 0),
        status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
          CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
        create_idempotency_key VARCHAR(128) NOT NULL
          CHECK (create_idempotency_key ~ '^[A-Za-z0-9._:-]+$'),
        purchase_idempotency_key VARCHAR(128),
        created_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
        updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
        completed_at TIMESTAMPTZ(3),
        UNIQUE (seller_account_id, create_idempotency_key),
        UNIQUE (buyer_account_id, purchase_idempotency_key),
        CHECK ((status = 'ACTIVE' AND buyer_account_id IS NULL
          AND purchase_idempotency_key IS NULL AND completed_at IS NULL)
          OR (status = 'CANCELLED' AND buyer_account_id IS NULL
          AND purchase_idempotency_key IS NULL AND completed_at IS NOT NULL)
          OR (status = 'COMPLETED' AND buyer_account_id IS NOT NULL
          AND purchase_idempotency_key IS NOT NULL AND completed_at IS NOT NULL))
      );
      CREATE UNIQUE INDEX uq_economy_one_active_listing_per_equipment
        ON economy_listings(equipment_id) WHERE status = 'ACTIVE';
      CREATE INDEX idx_economy_active_listings
        ON economy_listings(created_at DESC, id) WHERE status = 'ACTIVE';
      CREATE INDEX idx_economy_seller_listings
        ON economy_listings(seller_account_id, created_at DESC, id);

      CREATE OR REPLACE FUNCTION deny_active_listing_equipment_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM economy_listings
          WHERE equipment_id = OLD.id AND status = 'ACTIVE'
        ) THEN
          RAISE EXCEPTION 'actively listed equipment is held in marketplace escrow';
        END IF;
        RETURN COALESCE(NEW, OLD);
      END;
      $$;
      CREATE TRIGGER escrow_active_equipment
        BEFORE UPDATE OR DELETE ON player_equipment
        FOR EACH ROW EXECUTE FUNCTION deny_active_listing_equipment_mutation();

      CREATE TABLE economy_settlements (
        id UUID PRIMARY KEY,
        listing_id UUID NOT NULL UNIQUE REFERENCES economy_listings(id) ON DELETE RESTRICT,
        buyer_account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        seller_account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        equipment_id INTEGER NOT NULL REFERENCES player_equipment(id) ON DELETE RESTRICT,
        currency_type VARCHAR(20) NOT NULL
          CHECK (currency_type IN ('$DONCELLA', '$MARGEN')),
        amount BIGINT NOT NULL CHECK (amount > 0),
        occurred_at TIMESTAMPTZ(3) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (buyer_account_id <> seller_account_id)
      );

      CREATE OR REPLACE FUNCTION deny_economy_settlement_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'economy settlements are append-only';
      END;
      $$;
      CREATE TRIGGER immutable_economy_settlements
        BEFORE UPDATE OR DELETE ON economy_settlements
        FOR EACH ROW EXECUTE FUNCTION deny_economy_settlement_mutation();
    `);
  },
  down: async () => {
    throw new Error('Marketplace settlements are append-only and cannot be removed');
  }
};
