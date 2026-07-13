require("dotenv").config();
const sequelize = require("../config/database");

const sql = `
ALTER TABLE tbl_order ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) NOT NULL DEFAULT 'cod';
ALTER TABLE tbl_order ADD COLUMN IF NOT EXISTS fulfillment_mode VARCHAR(30) NOT NULL DEFAULT 'meetup';
ALTER TABLE tbl_order ADD COLUMN IF NOT EXISTS delivery_address TEXT;

CREATE TABLE IF NOT EXISTS tbl_transaction_history (
  id BIGSERIAL PRIMARY KEY,
  transaction_id VARCHAR(32) NOT NULL UNIQUE,
  trans_guid VARCHAR(32),
  user_id BIGINT NOT NULL REFERENCES tbl_user(id),
  user_guid VARCHAR(64) NOT NULL,
  user_email_hash VARCHAR(128) NOT NULL,
  user_name VARCHAR(160),
  plan_id VARCHAR(30) REFERENCES tbl_subscription_plan(id),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  provider VARCHAR(40),
  provider_payment_id VARCHAR(160),
  provider_order_id VARCHAR(160),
  provider_signature TEXT,
  payment_method VARCHAR(40),
  upi_intent TEXT,
  qr_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tbl_transaction_history ADD COLUMN IF NOT EXISTS trans_guid VARCHAR(32);
ALTER TABLE tbl_transaction_history ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(160);
ALTER TABLE tbl_transaction_history ADD COLUMN IF NOT EXISTS provider_signature TEXT;
ALTER TABLE tbl_transaction_history ADD COLUMN IF NOT EXISTS payment_method VARCHAR(40);
ALTER TABLE tbl_transaction_history ADD COLUMN IF NOT EXISTS upi_intent TEXT;
ALTER TABLE tbl_transaction_history ADD COLUMN IF NOT EXISTS qr_url TEXT;
CREATE INDEX IF NOT EXISTS idx_tbl_transaction_history_user ON tbl_transaction_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tbl_transaction_history_guid ON tbl_transaction_history(trans_guid);
`;

(async () => {
  try { await sequelize.authenticate(); await sequelize.query(sql); console.log("Order/payment schema is ready."); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await sequelize.close(); }
})();
