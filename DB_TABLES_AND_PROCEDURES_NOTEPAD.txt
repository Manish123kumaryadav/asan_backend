-- Aashanway production DB setup notes
-- Run this manually in PostgreSQL. Backend does not auto-create or sync tables.

CREATE TABLE IF NOT EXISTS tbl_user (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  mobile VARCHAR(30),
  phone VARCHAR(30),
  otp TEXT,
  image TEXT,
  image_path TEXT,
  avatar_url TEXT,
  city VARCHAR(120),
  location TEXT,
  allow_calls BOOLEAN NOT NULL DEFAULT TRUE,
  active_ads INTEGER NOT NULL DEFAULT 0,
  plan VARCHAR(30) NOT NULL DEFAULT 'free',
  role_id INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS allow_calls BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS active_ads INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS plan VARCHAR(30) NOT NULL DEFAULT 'free';
ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS role_id INTEGER NOT NULL DEFAULT 2;

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

CREATE TABLE IF NOT EXISTS tbl_order (
  id BIGSERIAL PRIMARY KEY,
  order_code VARCHAR(40) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES tbl_user(id),
  listing_id BIGINT NOT NULL REFERENCES tbl_listing(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'placed',
  eta VARCHAR(180),
  tracking JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Table count summary:
-- 1. tbl_user
-- 2. tbl_listing
-- 3. tbl_order
-- 4. tbl_notification
-- 5. tbl_subscription_plan
-- 6. tbl_chat_conversation
-- 7. tbl_chat_message
-- 8. tbl_contact_view
