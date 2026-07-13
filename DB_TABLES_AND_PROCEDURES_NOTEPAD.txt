-- Aashanway production DB setup notes
-- Run this manually in PostgreSQL. This is the single canonical schema file.
-- Backend has a safety auto-create path for tbl_transaction_history only, but full DB setup belongs here.
--
-- Supabase Storage env for media uploads:
-- SUPABASE_URL=https://scajleccziwsqbgamzuo.supabase.co
-- SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
-- SUPABASE_ADD_BUCKET=Add_pic
-- SUPABASE_PROFILE_BUCKET=Profile_PIc
-- Product images upload to Add_pic/{user_guid}/{user_guid}-{timestamp}.jpg
-- Profile images upload to Profile_PIc/{user_guid}/{user_guid}-{timestamp}.jpg
-- tbl_listing.image_path stores either an old single image path or a JSON array of up to 5 product image paths.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tbl_user (
  id BIGSERIAL PRIMARY KEY,
  guid CHAR(32) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  name VARCHAR(160) NOT NULL,
  email_hash CHAR(64) UNIQUE,
  password TEXT NOT NULL,
  mobile VARCHAR(30),
  country_code VARCHAR(8) NOT NULL DEFAULT '+91',
  otp TEXT,
  avatar_url TEXT,
  city VARCHAR(120),
  location TEXT,
  allow_calls BOOLEAN NOT NULL DEFAULT TRUE,
  show_online_status BOOLEAN NOT NULL DEFAULT TRUE,
  active_ads INTEGER NOT NULL DEFAULT 0,
  plan VARCHAR(30) NOT NULL DEFAULT 'free',
  role_id INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  is_otp_verified SMALLINT NOT NULL DEFAULT 0
);

ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS guid CHAR(32);
UPDATE tbl_user SET guid = encode(gen_random_bytes(16), 'hex') WHERE guid IS NULL OR guid = '';
ALTER TABLE tbl_user ALTER COLUMN guid SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_user_guid ON tbl_user(guid);
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS email_hash CHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_user_email_hash ON tbl_user(email_hash);
CREATE TABLE IF NOT EXISTS subscriberdashboardguid (
  uid VARCHAR(32) PRIMARY KEY,
  emailid VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT unique_email UNIQUE (emailid)
);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tbl_user' AND column_name='email'
  ) THEN
    EXECUTE $sql$
      INSERT INTO subscriberdashboardguid (uid, emailid, updated_at, is_active)
      SELECT guid, lower(trim(email)), NOW(), TRUE
      FROM tbl_user
      WHERE email LIKE '%@%' AND guid IS NOT NULL AND guid <> ''
      ON CONFLICT (uid) DO UPDATE SET emailid=EXCLUDED.emailid, updated_at=NOW(), is_active=TRUE
    $sql$;
    EXECUTE $sql$
      UPDATE tbl_user
      SET email_hash = encode(digest(lower(trim(email)), 'sha256'), 'hex')
      WHERE email LIKE '%@%'
    $sql$;
  END IF;
END $$;
ALTER TABLE tbl_user DROP COLUMN IF EXISTS email;
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS mobile VARCHAR(30);
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS country_code VARCHAR(8) NOT NULL DEFAULT '+91';
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS allow_calls BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS active_ads INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS plan VARCHAR(30) NOT NULL DEFAULT 'free';
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS role_id INTEGER NOT NULL DEFAULT 2;
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS is_otp_verified SMALLINT NOT NULL DEFAULT 0;

-- Normalize old user columns. Run before deploying backend that reads numeric flags.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tbl_user' AND column_name='phone'
  ) THEN
    EXECUTE $sql$
      UPDATE tbl_user
      SET mobile = COALESCE(NULLIF(mobile,''), NULLIF(phone,''))
      WHERE COALESCE(mobile,'') = '' AND COALESCE(phone,'') <> ''
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tbl_user' AND column_name='image_path'
  ) THEN
    EXECUTE $sql$
      UPDATE tbl_user
      SET avatar_url = COALESCE(NULLIF(avatar_url,''), NULLIF(image_path,''))
      WHERE COALESCE(avatar_url,'') = '' AND COALESCE(image_path,'') <> ''
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tbl_user' AND column_name='image'
  ) THEN
    EXECUTE $sql$
      UPDATE tbl_user
      SET avatar_url = COALESCE(NULLIF(avatar_url,''), NULLIF(image,''))
      WHERE COALESCE(avatar_url,'') = '' AND COALESCE(image,'') <> ''
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tbl_user' AND column_name='is_deleted'
      AND data_type='boolean'
  ) THEN
    ALTER TABLE tbl_user
      ALTER COLUMN is_deleted DROP DEFAULT,
      ALTER COLUMN is_deleted TYPE SMALLINT USING CASE WHEN is_deleted THEN 1 ELSE 0 END,
      ALTER COLUMN is_deleted SET DEFAULT 0;
  END IF;
END $$;

UPDATE tbl_user SET is_otp_verified=1 WHERE COALESCE(otp,'')='verified' OR COALESCE(password,'') <> '';
ALTER TABLE tbl_user ALTER COLUMN is_deleted SET NOT NULL;
ALTER TABLE tbl_user ALTER COLUMN is_otp_verified SET NOT NULL;
ALTER TABLE tbl_user DROP COLUMN IF EXISTS phone;
ALTER TABLE tbl_user DROP COLUMN IF EXISTS image;
ALTER TABLE tbl_user DROP COLUMN IF EXISTS image_path;

CREATE TABLE IF NOT EXISTS tbl_listing (
  id BIGSERIAL PRIMARY KEY,
  seller_id BIGINT NOT NULL REFERENCES tbl_user(id),
  title VARCHAR(220) NOT NULL,
  category VARCHAR(120) NOT NULL,
  mode VARCHAR(30) NOT NULL,
  condition VARCHAR(20) NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  rent_unit VARCHAR(20),
  location TEXT NOT NULL,
  available_from VARCHAR(120),
  available_to VARCHAR(120),
  delivery_time VARCHAR(180),
  return_policy VARCHAR(40) NOT NULL DEFAULT 'not-available',
  return_policy_text TEXT,
  description TEXT,
  seller_name VARCHAR(160),
  seller_phone VARCHAR(30),
  seller_rating NUMERIC(3,2) NOT NULL DEFAULT 4.50,
  payment_upi_masked VARCHAR(120),
  payment_upi_encrypted TEXT,
  image_path TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tbl_listing ADD COLUMN IF NOT EXISTS seller_phone VARCHAR(30);
ALTER TABLE tbl_listing ADD COLUMN IF NOT EXISTS payment_upi_encrypted TEXT;

DROP TABLE IF EXISTS tbl_user_otp_history;
DROP TABLE IF EXISTS tbl_user_ad_detail;

CREATE TABLE IF NOT EXISTS tbl_new_ad_detail (
  id BIGSERIAL PRIMARY KEY,
  ad_uid VARCHAR(80) NOT NULL UNIQUE,
  uid VARCHAR(32) NOT NULL,
  listing_id BIGINT NOT NULL UNIQUE REFERENCES tbl_listing(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  category VARCHAR(120),
  type VARCHAR(20) NOT NULL DEFAULT 'sell',
  mode VARCHAR(30) NOT NULL,
  condition VARCHAR(20) NOT NULL DEFAULT 'new',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  location TEXT,
  image_paths TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  is_active SMALLINT NOT NULL DEFAULT 1,
  is_sold_out SMALLINT NOT NULL DEFAULT 0,
  is_coming_soon SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tbl_new_ad_detail_uid_created
ON tbl_new_ad_detail(uid, created_at DESC);

CREATE TABLE IF NOT EXISTS tbl_old_ad_detail (
  id BIGSERIAL PRIMARY KEY,
  ad_uid VARCHAR(80) NOT NULL UNIQUE,
  uid VARCHAR(32) NOT NULL,
  listing_id BIGINT NOT NULL UNIQUE REFERENCES tbl_listing(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  category VARCHAR(120),
  type VARCHAR(20) NOT NULL DEFAULT 'sell',
  mode VARCHAR(30) NOT NULL,
  condition VARCHAR(20) NOT NULL DEFAULT 'old',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  location TEXT,
  image_paths TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  is_active SMALLINT NOT NULL DEFAULT 1,
  is_sold_out SMALLINT NOT NULL DEFAULT 0,
  is_coming_soon SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tbl_old_ad_detail_uid_created
ON tbl_old_ad_detail(uid, created_at DESC);

CREATE TABLE IF NOT EXISTS tbl_order (
  id BIGSERIAL PRIMARY KEY,
  order_code VARCHAR(40) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES tbl_user(id),
  listing_id BIGINT NOT NULL REFERENCES tbl_listing(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'placed',
  eta VARCHAR(180),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'cod',
  fulfillment_mode VARCHAR(30) NOT NULL DEFAULT 'meetup',
  delivery_address TEXT,
  tracking JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tbl_order ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) NOT NULL DEFAULT 'cod';
ALTER TABLE tbl_order ADD COLUMN IF NOT EXISTS fulfillment_mode VARCHAR(30) NOT NULL DEFAULT 'meetup';
ALTER TABLE tbl_order ADD COLUMN IF NOT EXISTS delivery_address TEXT;

CREATE TABLE IF NOT EXISTS tbl_notification (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES tbl_user(id),
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'notifications',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tbl_subscription_plan (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  ads INTEGER NOT NULL DEFAULT 0,
  highlight_days INTEGER NOT NULL DEFAULT 0,
  support VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO tbl_subscription_plan (id, name, price, ads, highlight_days, support, is_active)
VALUES
  ('starter', 'Starter', 199, 15, 3, 'Standard support', TRUE),
  ('growth', 'Growth', 699, 60, 12, 'Priority support', TRUE),
  ('business', 'Business', 999, 120, 30, 'Business verification support', TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  ads = EXCLUDED.ads,
  highlight_days = EXCLUDED.highlight_days,
  support = EXCLUDED.support,
  is_active = EXCLUDED.is_active;

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
UPDATE tbl_transaction_history SET trans_guid=transaction_id WHERE COALESCE(trans_guid,'')='';

CREATE TABLE IF NOT EXISTS tbl_chat_conversation (
  id BIGSERIAL PRIMARY KEY,
  buyer_id BIGINT NOT NULL REFERENCES tbl_user(id),
  seller_id BIGINT REFERENCES tbl_user(id),
  listing_id BIGINT REFERENCES tbl_listing(id),
  title VARCHAR(180),
  avatar_path TEXT,
  last_message TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tbl_chat_message (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES tbl_chat_conversation(id) ON DELETE CASCADE,
  sender_id BIGINT REFERENCES tbl_user(id),
  sender_type VARCHAR(30) NOT NULL DEFAULT 'me',
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tbl_contact_view (
  id BIGSERIAL PRIMARY KEY,
  viewer_id BIGINT NOT NULL REFERENCES tbl_user(id),
  seller_id BIGINT REFERENCES tbl_user(id),
  listing_id BIGINT NOT NULL REFERENCES tbl_listing(id),
  action VARCHAR(30) NOT NULL DEFAULT 'view',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tbl_listing_status_created ON tbl_listing(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tbl_listing_seller ON tbl_listing(seller_id);
CREATE INDEX IF NOT EXISTS idx_tbl_order_user_created ON tbl_order(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tbl_notification_user_created ON tbl_notification(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tbl_chat_conversation_buyer ON tbl_chat_conversation(buyer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tbl_chat_message_conversation ON tbl_chat_message(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_tbl_contact_view_viewer_month ON tbl_contact_view(viewer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tbl_contact_view_listing ON tbl_contact_view(viewer_id, listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tbl_transaction_history_user ON tbl_transaction_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tbl_transaction_history_guid ON tbl_transaction_history(trans_guid);

-- Stored procedure: update user plan safely.
CREATE OR REPLACE PROCEDURE activate_user_plan(p_user_id BIGINT, p_plan_id VARCHAR)
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tbl_subscription_plan WHERE id = p_plan_id AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Invalid subscription plan: %', p_plan_id;
  END IF;

  UPDATE tbl_user
  SET plan = p_plan_id, updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Stored procedure: mark all notifications read.
CREATE OR REPLACE PROCEDURE mark_user_notifications_read(p_user_id BIGINT)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE tbl_notification
  SET is_read = TRUE
  WHERE user_id = p_user_id;
END;
$$;

-- Canonical project table summary:
-- 1. tbl_user
-- 2. subscriberdashboardguid
-- 3. tbl_listing
-- 4. tbl_new_ad_detail
-- 5. tbl_old_ad_detail
-- 6. tbl_order
-- 7. tbl_notification
-- 8. tbl_subscription_plan
-- 9. tbl_transaction_history
-- 10. tbl_chat_conversation
-- 11. tbl_chat_message
-- 12. tbl_contact_view