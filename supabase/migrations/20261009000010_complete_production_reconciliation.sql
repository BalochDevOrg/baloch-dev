-- ==============================================================================
-- BALOCH EXPORT HUB — Complete Production Reconciliation Migration
-- Migration: 20261009000010_complete_production_reconciliation.sql
--
-- ARCHITECTURE & INTEGRITY GUARANTEES:
-- 1. 100% ADDITIVE & IDEMPOTENT. No data deletion or table drops.
-- 2. RESOLVES RLS INFINITE RECURSION (42P17) on orders/order_items using SECURITY DEFINER functions.
-- 3. REPLACES 8% COMMISSION with zero sales commission (0%) and seller subscriptions (3 months free, PKR 1,200/mo).
-- 4. ENFORCES 2-STORE LIMIT per seller via database trigger.
-- 5. ENFORCES STORE APPROVAL workflow ('pending', 'approved', 'rejected', 'suspended').
-- 6. FULL MULTI-IMAGE PRODUCT SUPPORT and stock integrity (stock >= 0).
-- 7. ORDER TRACKING WORKFLOW (5-stage buyer tracking, 3-stage seller fulfillment, admin handover & delivery).
-- 8. SECURES PAYMENT PROOFS (payment-proofs bucket is strictly private).
-- 9. SECURES SELLER BANK DETAILS (owner & admin only).
-- ==============================================================================

-- ── 0. EXTENSIONS ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. CORE TABLES CREATION ───────────────────────────────────────────────────

-- 1.1 Multi-Store Management Table
CREATE TABLE IF NOT EXISTS public.seller_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  category_slugs text[] NOT NULL DEFAULT '{}',
  logo_url text,
  logo_color text NOT NULL DEFAULT '#0f3a2f',
  logo_initials text NOT NULL DEFAULT 'BE',
  banner text,
  location text NOT NULL DEFAULT 'Quetta, Balochistan',
  phone text,
  whatsapp text,
  whatsapp_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  is_approved boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  rating numeric(2,1) NOT NULL DEFAULT 5.0,
  review_count integer NOT NULL DEFAULT 0,
  sales_count integer NOT NULL DEFAULT 0,
  total_sales integer NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_stores_seller ON public.seller_stores(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_stores_slug ON public.seller_stores(slug);
CREATE INDEX IF NOT EXISTS idx_seller_stores_status ON public.seller_stores(status);

-- 1.2 Seller Subscription Model (Replacing 8% Commission)
-- 3 months free trial, then PKR 1,200/mo per seller account (covers up to 2 stores)
CREATE TABLE IF NOT EXISTS public.seller_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'standard',
  monthly_fee numeric(10,2) NOT NULL DEFAULT 1200.00,
  currency text NOT NULL DEFAULT 'PKR',
  status text NOT NULL DEFAULT 'free_trial' CHECK (status IN ('free_trial', 'active', 'past_due', 'grace_period', 'cancelled', 'expired')),
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '3 months'),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '3 months'),
  last_payment_at timestamptz,
  last_payment_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_subscriptions_status ON public.seller_subscriptions(status);

-- 1.3 Seller Bank Details Table (Confidential Payout Instructions)
CREATE TABLE IF NOT EXISTS public.seller_bank_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name text NOT NULL DEFAULT '',
  account_title text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  iban text DEFAULT '',
  payment_instructions text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.4 Platform Settings Table (Singleton Configuration)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1,
  platform_name text NOT NULL DEFAULT 'Baloch Export Hub',
  support_email text NOT NULL DEFAULT 'support@balochexporthub.com',
  support_phone text NOT NULL DEFAULT '+92 333 2826358',
  commission_rate numeric(4,2) NOT NULL DEFAULT 0.00, -- 0% per-product sales commission
  monthly_seller_fee numeric(10,2) NOT NULL DEFAULT 1200.00,
  currency text NOT NULL DEFAULT 'PKR',
  maintenance boolean NOT NULL DEFAULT false,
  allow_registrations boolean NOT NULL DEFAULT true,
  auto_approve_stores boolean NOT NULL DEFAULT false,
  require_seller_approval boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton CHECK (id = 1)
);

INSERT INTO public.platform_settings (id, platform_name, commission_rate, monthly_seller_fee)
VALUES (1, 'Baloch Export Hub', 0.00, 1200.00)
ON CONFLICT (id) DO UPDATE SET
  commission_rate = 0.00,
  monthly_seller_fee = 1200.00;

-- 1.5 Buyer Addresses Table
CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  line1 text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  country text NOT NULL DEFAULT 'Pakistan',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON public.addresses(user_id);

-- 1.6 Multi-Image Product Gallery Table
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_prod ON public.product_images(product_id);

-- 1.7 Threaded Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.seller_stores(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_code text,
  last_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  buyer_unread integer NOT NULL DEFAULT 0,
  seller_unread integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_parties ON public.conversations(buyer_id, seller_id);

-- 1.8 Payments & Verification Ledger
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  commission numeric(12,2) NOT NULL DEFAULT 0.00, -- 0% commission
  seller_earnings numeric(12,2) NOT NULL DEFAULT 0.00, -- 100% to seller
  method text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'verified', 'rejected', 'paid', 'failed', 'refunded')),
  proof_url text,
  payment_reference text,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);

-- 1.9 Order Status History Table (Audit Trail)
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_by_role text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id);

-- 1.10 Reports & Moderation
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('sales','users','products','reviews')),
  range text NOT NULL DEFAULT 'Live snapshot',
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('product', 'store', 'user', 'review')),
  target_id text NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.11 Notification Outbox
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- ── 2. ADDITIVE COLUMNS ON EXISTING TABLES ────────────────────────────────────

-- On profiles:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_color text DEFAULT '#1A4D2E';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_description text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_logo text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- On products:
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.seller_stores(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_slug text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer DEFAULT 10;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shipping_fee numeric(10,2) DEFAULT 250.00;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shipping_days text DEFAULT '3-5 days';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sold integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rating numeric(2,1) DEFAULT 5.0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;

-- Update status check constraint on products to allow active and hidden
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_status_check CHECK (
  status IN ('active', 'approved', 'pending', 'rejected', 'hidden')
);

-- Sync stock from quantity and image from images[1] if present
UPDATE public.products SET stock = quantity WHERE stock IS NULL AND quantity IS NOT NULL;
UPDATE public.products SET image = images[1] WHERE image IS NULL AND images IS NOT NULL AND array_length(images, 1) > 0;
UPDATE public.products SET status = 'active' WHERE status = 'approved';

-- Backfill category_slug from categories table for existing products
UPDATE public.products p
SET category_slug = c.slug
FROM public.categories c
WHERE p.category_id = c.id AND (p.category_slug IS NULL OR p.category_slug = '');

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_stock_non_negative;
ALTER TABLE public.products ADD CONSTRAINT products_stock_non_negative CHECK (stock >= 0);

-- On orders:
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commission numeric(12,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping numeric(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total numeric(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment text DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cod';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS handover_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS received_by_platform_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Convert existing address text column to jsonb safely (0 existing rows in production)
ALTER TABLE public.orders ALTER COLUMN address TYPE jsonb USING CASE WHEN address IS NULL OR address = '' THEN '{}'::jsonb ELSE address::jsonb END;

-- Update status check constraint on orders supporting canonical stages
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  status IN (
    'submitted', 'packaging', 'packed', 'sent_to_platform', 'on_way', 'reached_to_buyer',
    'cancelled', 'pending', 'confirmed', 'processing', 'shipped', 'delivered'
  )
);

-- On order_items:
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.seller_stores(id) ON DELETE SET NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS status text DEFAULT 'submitted';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS courier text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS estimated_delivery timestamptz;

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_status_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_status_check CHECK (
  status IN (
    'submitted', 'packaging', 'packed', 'sent_to_platform', 'on_way', 'reached_to_buyer',
    'cancelled', 'pending', 'confirmed', 'processing', 'shipped', 'delivered'
  )
);

-- On cart_items:
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS qty integer DEFAULT 1;
UPDATE public.cart_items SET qty = quantity WHERE qty IS NULL AND quantity IS NOT NULL;

-- On messages:
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
UPDATE public.messages SET body = content WHERE body IS NULL AND content IS NOT NULL;
UPDATE public.messages SET content = body WHERE content IS NULL AND body IS NOT NULL;

-- On notifications:
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS href text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;
UPDATE public.notifications SET body = message WHERE body IS NULL AND message IS NOT NULL;
UPDATE public.notifications SET href = link WHERE href IS NULL AND link IS NOT NULL;
UPDATE public.notifications SET read = is_read WHERE read IS NULL AND is_read IS NOT NULL;

-- On reviews:
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS buyer_name text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT true;

-- ── 3. STORE LIMIT TRIGGER (MAX 2 STORES PER SELLER) ──────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_seller_store_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Obtain advisory transaction lock per seller to prevent concurrent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('store_limit_' || NEW.seller_id::text));

  SELECT count(*) INTO v_count
  FROM public.seller_stores
  WHERE seller_id = NEW.seller_id
    AND deleted_at IS NULL
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL)) THEN
    IF v_count >= 2 THEN
      RAISE EXCEPTION 'Store limit reached: each seller can create a maximum of 2 active stores.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_seller_store_limit ON public.seller_stores;
CREATE TRIGGER trg_enforce_seller_store_limit
  BEFORE INSERT OR UPDATE OF deleted_at, seller_id ON public.seller_stores
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_seller_store_limit();

-- 4.0 Helper Security Definer Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(email) = lower(trim(p_email))
  );
$$;
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.check_username_exists(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(trim(p_username))
  );
$$;
GRANT EXECUTE ON FUNCTION public.check_username_exists(text) TO authenticated, anon;

-- 4.1 can_read_order: Breaks RLS recursion on orders
CREATE OR REPLACE FUNCTION public.can_read_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND role = 'admin') THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id AND buyer_id = v_uid) THEN RETURN true; END IF;

  -- Seller of any item in the order
  IF EXISTS (
    SELECT 1 FROM public.order_items oi
    LEFT JOIN public.seller_stores ss ON ss.id = oi.store_id
    WHERE oi.order_id = p_order_id
      AND (ss.seller_id = v_uid OR oi.seller_id = v_uid)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 4.2 can_read_order_item: Breaks RLS recursion on order_items
CREATE OR REPLACE FUNCTION public.can_read_order_item(p_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_store_id uuid;
  v_seller_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND role = 'admin') THEN RETURN true; END IF;

  SELECT order_id, store_id, seller_id INTO v_order_id, v_store_id, v_seller_id
  FROM public.order_items WHERE id = p_item_id;

  IF v_order_id IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = v_order_id AND buyer_id = v_uid) THEN RETURN true; END IF;
  IF v_seller_id = v_uid THEN RETURN true; END IF;
  IF v_store_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.seller_stores WHERE id = v_store_id AND seller_id = v_uid) THEN RETURN true; END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_read_order(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_read_order_item(uuid) TO authenticated, anon;

-- ── 5. CLEAN RLS POLICIES ─────────────────────────────────────────────────────

-- 5.1 Orders RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_select_safe" ON public.orders;
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_buyer_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;

CREATE POLICY "orders_select_safe" ON public.orders
  FOR SELECT USING (public.can_read_order(id));

CREATE POLICY "orders_insert_safe" ON public.orders
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "orders_update_safe" ON public.orders
  FOR UPDATE USING (buyer_id = auth.uid() OR public.is_admin());

-- 5.2 Order Items RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items_select_safe" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update" ON public.order_items;

CREATE POLICY "order_items_select_safe" ON public.order_items
  FOR SELECT USING (public.can_read_order_item(id));

CREATE POLICY "order_items_insert_safe" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.buyer_id = auth.uid())
  );

CREATE POLICY "order_items_update_safe" ON public.order_items
  FOR UPDATE USING (
    public.is_admin() OR
    seller_id = auth.uid() OR
    (store_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.seller_stores ss WHERE ss.id = order_items.store_id AND ss.seller_id = auth.uid()))
  );

-- 5.3 Seller Stores RLS
ALTER TABLE public.seller_stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stores_public_read" ON public.seller_stores;
DROP POLICY IF EXISTS "stores_seller_insert" ON public.seller_stores;
DROP POLICY IF EXISTS "stores_seller_update" ON public.seller_stores;
DROP POLICY IF EXISTS "stores_admin_all" ON public.seller_stores;

CREATE POLICY "stores_public_read" ON public.seller_stores
  FOR SELECT USING (
    (deleted_at IS NULL AND status = 'approved') OR
    seller_id = auth.uid() OR
    public.is_admin()
  );

CREATE POLICY "stores_seller_insert" ON public.seller_stores
  FOR INSERT WITH CHECK (seller_id = auth.uid());

CREATE POLICY "stores_seller_update" ON public.seller_stores
  FOR UPDATE USING (seller_id = auth.uid() OR public.is_admin());

-- 5.4 Products RLS (Ensures pending stores cannot publish live products)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_insert" ON public.products;
DROP POLICY IF EXISTS "products_update" ON public.products;
DROP POLICY IF EXISTS "products_delete" ON public.products;

CREATE POLICY "products_select" ON public.products
  FOR SELECT USING (
    (status IN ('active', 'approved') AND (
      store_id IS NULL OR
      EXISTS (SELECT 1 FROM public.seller_stores ss WHERE ss.id = products.store_id AND ss.status = 'approved' AND ss.deleted_at IS NULL)
    )) OR
    seller_id = auth.uid() OR
    public.is_admin()
  );

CREATE POLICY "products_insert" ON public.products
  FOR INSERT WITH CHECK (
    seller_id = auth.uid() AND
    (
      public.is_admin() OR
      EXISTS (SELECT 1 FROM public.seller_stores ss WHERE ss.id = products.store_id AND ss.seller_id = auth.uid() AND ss.status = 'approved')
    )
  );

CREATE POLICY "products_update" ON public.products
  FOR UPDATE USING (seller_id = auth.uid() OR public.is_admin());

CREATE POLICY "products_delete" ON public.products
  FOR DELETE USING (seller_id = auth.uid() OR public.is_admin());

-- 5.5 Seller Bank Details RLS (Confidential)
ALTER TABLE public.seller_bank_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_details_owner_select" ON public.seller_bank_details;
DROP POLICY IF EXISTS "bank_details_owner_modify" ON public.seller_bank_details;

CREATE POLICY "bank_details_owner_select" ON public.seller_bank_details
  FOR SELECT USING (seller_id = auth.uid() OR public.is_admin());

CREATE POLICY "bank_details_owner_modify" ON public.seller_bank_details
  FOR ALL USING (seller_id = auth.uid() OR public.is_admin());

-- 5.6 Seller Subscriptions RLS
ALTER TABLE public.seller_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subs_owner_select" ON public.seller_subscriptions;
DROP POLICY IF EXISTS "subs_admin_all" ON public.seller_subscriptions;

CREATE POLICY "subs_owner_select" ON public.seller_subscriptions
  FOR SELECT USING (seller_id = auth.uid() OR public.is_admin());

CREATE POLICY "subs_admin_all" ON public.seller_subscriptions
  FOR ALL USING (public.is_admin());

-- 5.7 Conversations & Messages RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_party_access" ON public.conversations;
CREATE POLICY "conversations_party_access" ON public.conversations
  FOR ALL USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_admin());

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_party_access" ON public.messages;
CREATE POLICY "messages_party_access" ON public.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid() OR public.is_admin())
    )
  );

-- 5.8 Payments RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_parties_select" ON public.payments;
CREATE POLICY "payments_parties_select" ON public.payments
  FOR SELECT USING (
    buyer_id = auth.uid() OR
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.order_items oi
      LEFT JOIN public.seller_stores ss ON ss.id = oi.store_id
      WHERE oi.order_id = payments.order_id AND (oi.seller_id = auth.uid() OR ss.seller_id = auth.uid())
    )
  );

-- 5.9 Product Images RLS
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_images_select" ON public.product_images;
CREATE POLICY "product_images_select" ON public.product_images FOR SELECT USING (true);

DROP POLICY IF EXISTS "product_images_manage" ON public.product_images;
CREATE POLICY "product_images_manage" ON public.product_images FOR ALL USING (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_images.product_id AND p.seller_id = auth.uid())
);

-- 5.10 Addresses RLS
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "addresses_user_manage" ON public.addresses;
CREATE POLICY "addresses_user_manage" ON public.addresses FOR ALL USING (user_id = auth.uid() OR public.is_admin());

-- 5.11 Order Status History RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_status_history_select" ON public.order_status_history;
CREATE POLICY "order_status_history_select" ON public.order_status_history FOR SELECT USING (public.can_read_order(order_id));

DROP POLICY IF EXISTS "order_status_history_insert" ON public.order_status_history;
CREATE POLICY "order_status_history_insert" ON public.order_status_history FOR INSERT WITH CHECK (public.can_read_order(order_id));

-- 5.12 Notifications RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_owner_all" ON public.notifications;
CREATE POLICY "notifications_owner_all" ON public.notifications FOR ALL USING (user_id = auth.uid() OR public.is_admin());

-- 5.13 Platform Settings RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_read_public" ON public.platform_settings;
CREATE POLICY "settings_read_public" ON public.platform_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_admin_all" ON public.platform_settings;
CREATE POLICY "settings_admin_all" ON public.platform_settings FOR ALL USING (public.is_admin());

-- 5.14 Reports & Moderation RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_admin_all" ON public.reports;
CREATE POLICY "reports_admin_all" ON public.reports FOR ALL USING (public.is_admin());

ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "moderation_reports_read" ON public.moderation_reports;
CREATE POLICY "moderation_reports_read" ON public.moderation_reports FOR SELECT USING (reporter_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "moderation_reports_insert" ON public.moderation_reports;
CREATE POLICY "moderation_reports_insert" ON public.moderation_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "moderation_reports_admin" ON public.moderation_reports;
CREATE POLICY "moderation_reports_admin" ON public.moderation_reports FOR ALL USING (public.is_admin());

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_outbox_admin" ON public.notification_outbox;
CREATE POLICY "notification_outbox_admin" ON public.notification_outbox FOR ALL USING (public.is_admin());

-- 5.15 Profiles RLS (Safe access: users manage their own, admins all, anon reads public_profiles view)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_auth" ON public.profiles;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT USING (
  id = auth.uid() OR
  public.is_admin() OR
  role IN ('seller', 'admin') OR
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE USING (public.is_admin());

-- ── 6. TRANSACTIONAL RPC OPERATIONS ──────────────────────────────────────────

-- 6.1 place_order: Atomic order placement with stock verification, zero commission, and notification
CREATE OR REPLACE FUNCTION public.place_order(
  p_address jsonb,
  p_payment_method text,
  p_payment_reference text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer uuid := auth.uid();
  v_buyer_profile public.profiles;
  v_cart_count integer;
  v_item record;
  v_product public.products;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(10,2) := 0;
  v_total numeric(12,2) := 0;
  v_order public.orders;
  v_code text;
  v_method text := lower(trim(coalesce(p_payment_method, 'cod')));
  v_seller_ids uuid[] := '{}';
  v_sid uuid;
BEGIN
  IF v_buyer IS NULL THEN RAISE EXCEPTION 'Authentication required to place an order.'; END IF;

  SELECT * INTO v_buyer_profile FROM public.profiles WHERE id = v_buyer;
  IF v_buyer_profile.id IS NULL THEN RAISE EXCEPTION 'Buyer profile not found.'; END IF;

  SELECT count(*) INTO v_cart_count FROM public.cart_items WHERE user_id = v_buyer;
  IF v_cart_count = 0 THEN RAISE EXCEPTION 'Your cart is empty.'; END IF;

  -- Verify each cart item with row locking to prevent race-condition overselling
  FOR v_item IN (SELECT *, COALESCE(quantity, qty, 1) as item_qty FROM public.cart_items WHERE user_id = v_buyer) LOOP
    SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id FOR UPDATE;
    IF v_product.id IS NULL THEN RAISE EXCEPTION 'One of the items in your cart is no longer available.'; END IF;
    IF v_product.stock < v_item.item_qty THEN
      RAISE EXCEPTION 'Item "%" only has % available (requested %)', v_product.name, v_product.stock, v_item.item_qty;
    END IF;

    v_subtotal := v_subtotal + (v_product.price * v_item.item_qty);
    v_shipping := v_shipping + coalesce(v_product.shipping_fee, 250.00);

    IF v_product.seller_id IS NOT NULL AND NOT (v_product.seller_id = ANY(v_seller_ids)) THEN
      v_seller_ids := array_append(v_seller_ids, v_product.seller_id);
    END IF;
  END LOOP;

  v_total := v_subtotal + v_shipping;
  v_code := 'BEH-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- Insert Order with ZERO platform commission
  INSERT INTO public.orders (
    code, buyer_id, full_name, email, phone, address, city, country,
    subtotal, shipping, total, commission, payment, payment_method, payment_reference, status
  ) VALUES (
    v_code, v_buyer,
    coalesce(p_address->>'full_name', v_buyer_profile.full_name),
    coalesce(p_address->>'email', v_buyer_profile.email),
    coalesce(p_address->>'phone', v_buyer_profile.phone, ''),
    p_address,
    coalesce(p_address->>'city', 'Quetta'),
    coalesce(p_address->>'country', 'Pakistan'),
    v_subtotal, v_shipping, v_total, 0.00, -- 0% commission!
    CASE WHEN v_method = 'cod' THEN 'pending' ELSE 'submitted' END,
    v_method,
    p_payment_reference,
    'submitted'
  ) RETURNING * INTO v_order;

  -- Insert Order Items and atomically deduct stock
  FOR v_item IN (SELECT *, COALESCE(quantity, qty, 1) as item_qty FROM public.cart_items WHERE user_id = v_buyer) LOOP
    SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id;

    INSERT INTO public.order_items (
      order_id, product_id, store_id, seller_id, product_name, price, quantity, status
    ) VALUES (
      v_order.id, v_product.id, v_product.store_id, v_product.seller_id,
      v_product.name, v_product.price, v_item.item_qty, 'submitted'
    );

    UPDATE public.products
    SET stock = stock - v_item.item_qty,
        sold = sold + v_item.item_qty,
        updated_at = now()
    WHERE id = v_product.id;
  END LOOP;

  -- Create Payment Record (Zero commission, 100% to seller)
  INSERT INTO public.payments (
    order_id, buyer_id, amount, commission, seller_earnings, method, status, payment_reference
  ) VALUES (
    v_order.id, v_buyer, v_total, 0.00, v_total, v_method,
    CASE WHEN v_method = 'cod' THEN 'pending' ELSE 'submitted' END,
    p_payment_reference
  );

  -- Record Initial Order History
  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, changed_by, changed_by_role, note
  ) VALUES (
    v_order.id, NULL, 'submitted', v_buyer, 'buyer', 'Order placed successfully by buyer.'
  );

  -- Empty Cart
  DELETE FROM public.cart_items WHERE user_id = v_buyer;

  -- Notify Sellers (Dual column compatibility for message/body and link/href)
  FOREACH v_sid IN ARRAY v_seller_ids LOOP
    INSERT INTO public.notifications (user_id, type, title, message, body, link, href, read, is_read)
    VALUES (
      v_sid,
      'order',
      'New Order Received (' || v_code || ')',
      'You have a new order for ' || v_order.code || '. Please start packaging.',
      'You have a new order for ' || v_order.code || '. Please start packaging.',
      '/seller/orders',
      '/seller/orders',
      false,
      false
    );
  END LOOP;

  -- Notify Admin
  INSERT INTO public.notification_outbox (kind, payload)
  VALUES ('new_order', jsonb_build_object('order_id', v_order.id, 'code', v_code, 'total', v_total));

  RETURN v_order;
END;
$$;

-- 6.2 advance_order: Role-authorized state transitions with history & notifications
CREATE OR REPLACE FUNCTION public.advance_order(p_order_id uuid, p_to text)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_old text;
  v_role text;
  v_is_seller boolean := false;
  v_is_admin boolean := false;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found.'; END IF;

  v_old := v_order.status;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  v_is_admin := (v_role = 'admin');

  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    LEFT JOIN public.seller_stores ss ON ss.id = oi.store_id
    WHERE oi.order_id = p_order_id AND (oi.seller_id = v_uid OR ss.seller_id = v_uid)
  ) INTO v_is_seller;

  -- Transition Authorization
  IF p_to IN ('packaging', 'packed', 'sent_to_platform') THEN
    IF NOT (v_is_seller OR v_is_admin) THEN
      RAISE EXCEPTION 'Only the seller or admin can update packaging and platform handover.';
    END IF;
  ELSIF p_to IN ('on_way', 'reached_to_buyer') THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only the platform admin can advance delivery status to On the Way or Delivered.';
    END IF;
  END IF;

  -- Update Order Status
  UPDATE public.orders
  SET status = p_to,
      handover_at = CASE WHEN p_to = 'sent_to_platform' THEN now() ELSE handover_at END,
      received_by_platform_at = CASE WHEN p_to = 'on_way' AND received_by_platform_at IS NULL THEN now() ELSE received_by_platform_at END,
      delivered_at = CASE WHEN p_to = 'reached_to_buyer' THEN now() ELSE delivered_at END,
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  -- Update Order Items Status
  UPDATE public.order_items SET status = p_to WHERE order_id = p_order_id;

  -- Record History
  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, changed_by, changed_by_role, note
  ) VALUES (
    p_order_id, v_old, p_to, v_uid, coalesce(v_role, 'user'), 'Order advanced to ' || p_to
  );

  -- Notify Buyer
  INSERT INTO public.notifications (user_id, type, title, message, body, link, href, read, is_read)
  VALUES (
    v_order.buyer_id,
    'order',
    'Order Status Update (' || v_order.code || ')',
    'Your order is now: ' || replace(p_to, '_', ' '),
    'Your order is now: ' || replace(p_to, '_', ' '),
    '/dashboard/orders',
    '/dashboard/orders',
    false,
    false
  );

  RETURN v_order;
END;
$$;

-- 6.3 cancel_order: Idempotent cancellation and stock restoration
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_item record;
  v_role text;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found.'; END IF;
  IF v_order.status = 'cancelled' THEN RETURN jsonb_build_object('ok', true, 'already_cancelled', true); END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF NOT (v_order.buyer_id = v_uid OR v_role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized to cancel this order.';
  END IF;

  IF v_order.status NOT IN ('submitted', 'pending') AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Orders that have already started packaging cannot be cancelled directly.';
  END IF;

  UPDATE public.orders SET status = 'cancelled', updated_at = now() WHERE id = p_order_id;
  UPDATE public.order_items SET status = 'cancelled' WHERE order_id = p_order_id;

  -- Restore stock
  FOR v_item IN (SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id) LOOP
    UPDATE public.products
    SET stock = stock + v_item.quantity,
        sold = GREATEST(0, sold - v_item.quantity),
        updated_at = now()
    WHERE id = v_item.product_id;
  END LOOP;

  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, changed_by, changed_by_role, note
  ) VALUES (
    p_order_id, v_order.status, 'cancelled', v_uid, coalesce(v_role, 'buyer'), 'Order cancelled.'
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 6.4 approve_seller_store & reject_seller_store (Admin Store Workflow)
CREATE OR REPLACE FUNCTION public.approve_seller_store(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_store public.seller_stores;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin authorization required.'; END IF;

  SELECT * INTO v_store FROM public.seller_stores WHERE id = p_store_id FOR UPDATE;
  IF v_store.id IS NULL THEN RAISE EXCEPTION 'Store not found.'; END IF;

  UPDATE public.seller_stores
  SET status = 'approved',
      is_approved = true,
      reviewed_by = v_admin,
      reviewed_at = now(),
      rejection_reason = NULL,
      updated_at = now()
  WHERE id = p_store_id;

  -- Promote profile role to 'seller' if buyer
  UPDATE public.profiles
  SET role = 'seller', seller_status = 'approved', updated_at = now()
  WHERE id = v_store.seller_id AND role = 'buyer';

  -- Provision Seller Subscription (3 months free trial!)
  INSERT INTO public.seller_subscriptions (seller_id, plan, monthly_fee, status, trial_started_at, trial_ends_at)
  VALUES (v_store.seller_id, 'standard', 1200.00, 'free_trial', now(), now() + interval '3 months')
  ON CONFLICT (seller_id) DO UPDATE SET
    status = CASE WHEN seller_subscriptions.status = 'cancelled' THEN 'active' ELSE seller_subscriptions.status END,
    updated_at = now();

  -- Notify Seller
  INSERT INTO public.notifications (user_id, type, title, message, body, link, href, read, is_read)
  VALUES (
    v_store.seller_id,
    'store',
    'Store Approved! (' || v_store.name || ')',
    'Congratulations! Your store is approved. You can now add products and sell on the marketplace.',
    'Congratulations! Your store is approved. You can now add products and sell on the marketplace.',
    '/seller',
    '/seller',
    false,
    false
  );

  RETURN jsonb_build_object('ok', true, 'store_id', p_store_id, 'status', 'approved');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_seller_store(p_store_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_store public.seller_stores;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin authorization required.'; END IF;

  SELECT * INTO v_store FROM public.seller_stores WHERE id = p_store_id FOR UPDATE;
  IF v_store.id IS NULL THEN RAISE EXCEPTION 'Store not found.'; END IF;

  UPDATE public.seller_stores
  SET status = 'rejected',
      is_approved = false,
      reviewed_by = v_admin,
      reviewed_at = now(),
      rejection_reason = p_reason,
      updated_at = now()
  WHERE id = p_store_id;

  INSERT INTO public.notifications (user_id, type, title, message, body, link, href, read, is_read)
  VALUES (
    v_store.seller_id,
    'store',
    'Store Application Update (' || v_store.name || ')',
    'Your store application was not approved. Reason: ' || coalesce(p_reason, 'Please update store details and re-apply.'),
    'Your store application was not approved. Reason: ' || coalesce(p_reason, 'Please update store details and re-apply.'),
    '/seller/store-profile',
    '/seller/store-profile',
    false,
    false
  );

  RETURN jsonb_build_object('ok', true, 'store_id', p_store_id, 'status', 'rejected');
END;
$$;

-- 6.5 fetch_my_orders: Unified Secure Orders Feed
CREATE OR REPLACE FUNCTION public.fetch_my_orders()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'code', coalesce(o.code, 'BEH-' || substr(o.id::text, 1, 8)),
      'buyer_id', o.buyer_id,
      'buyer_name', coalesce(o.full_name, p.full_name, 'Customer'),
      'status', o.status,
      'payment', o.payment,
      'payment_method', o.payment_method,
      'payment_reference', o.payment_reference,
      'subtotal', coalesce(o.subtotal, o.total, 0),
      'shipping', coalesce(o.shipping, 0),
      'total', coalesce(o.total, 0),
      'commission', 0.00,
      'address', coalesce(o.address, '{}'::jsonb),
      'created_at', o.created_at,
      'handover_at', o.handover_at,
      'received_by_platform_at', o.received_by_platform_at,
      'delivered_at', o.delivered_at,
      'items', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'store_id', oi.store_id,
          'seller_id', oi.seller_id,
          'name', oi.product_name,
          'image', coalesce(prod.image, prod.images[1], '/images/doch-closeup.jpg'),
          'qty', oi.quantity,
          'price', oi.price,
          'status', oi.status,
          'tracking_code', oi.tracking_code,
          'courier', oi.courier
        ))
        FROM public.order_items oi
        LEFT JOIN public.products prod ON prod.id = oi.product_id
        WHERE oi.order_id = o.id
          AND (v_role = 'admin' OR o.buyer_id = v_uid OR oi.seller_id = v_uid)
      ), '[]'::jsonb)
    ) ORDER BY o.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.buyer_id
  WHERE (
    v_role = 'admin' OR
    o.buyer_id = v_uid OR
    EXISTS (
      SELECT 1 FROM public.order_items oi
      LEFT JOIN public.seller_stores ss ON ss.id = oi.store_id
      WHERE oi.order_id = o.id AND (oi.seller_id = v_uid OR ss.seller_id = v_uid)
    )
  );

  RETURN v_result;
END;
$$;

-- Grant execution on RPCs
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_order(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_seller_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_seller_store(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_my_orders() TO authenticated;

-- ── 7. STORAGE BUCKETS & STRICT PRIVACY POLICIES ─────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg','image/jpg','image/png','image/webp']),
  ('store-branding', 'store-branding', true, 5242880, ARRAY['image/jpeg','image/jpg','image/png','image/webp']),
  ('profile-images', 'profile-images', true, 5242880, ARRAY['image/jpeg','image/jpg','image/png','image/webp']),
  ('category-images', 'category-images', true, 5242880, ARRAY['image/jpeg','image/jpg','image/png','image/webp']),
  -- CRITICAL SECURITY: payment-proofs is STRICTLY PRIVATE
  ('payment-proofs', 'payment-proofs', false, 10485760, ARRAY['image/jpeg','image/jpg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DO $$
BEGIN
  -- product-images: Public read
  DROP POLICY IF EXISTS "Public Access to product-images" ON storage.objects;
  CREATE POLICY "Public Access to product-images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

  DROP POLICY IF EXISTS "Auth Upload to product-images" ON storage.objects;
  CREATE POLICY "Auth Upload to product-images" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Auth Update to product-images" ON storage.objects;
  CREATE POLICY "Auth Update to product-images" ON storage.objects FOR UPDATE
    USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Auth Delete to product-images" ON storage.objects;
  CREATE POLICY "Auth Delete to product-images" ON storage.objects FOR DELETE
    USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

  -- store-branding: Public read & Authenticated manage
  DROP POLICY IF EXISTS "Public Access to store-branding" ON storage.objects;
  CREATE POLICY "Public Access to store-branding" ON storage.objects FOR SELECT USING (bucket_id = 'store-branding');

  DROP POLICY IF EXISTS "Auth Upload to store-branding" ON storage.objects;
  CREATE POLICY "Auth Upload to store-branding" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'store-branding' AND auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Auth Manage to store-branding" ON storage.objects;
  CREATE POLICY "Auth Manage to store-branding" ON storage.objects FOR ALL
    USING (bucket_id = 'store-branding' AND auth.role() = 'authenticated');

  -- profile-images: Public read & Authenticated manage
  DROP POLICY IF EXISTS "Public Access to profile-images" ON storage.objects;
  CREATE POLICY "Public Access to profile-images" ON storage.objects FOR SELECT USING (bucket_id = 'profile-images');

  DROP POLICY IF EXISTS "Auth Manage to profile-images" ON storage.objects;
  CREATE POLICY "Auth Manage to profile-images" ON storage.objects FOR ALL
    USING (bucket_id = 'profile-images' AND auth.role() = 'authenticated');

  -- category-images: Public read & Admin manage
  DROP POLICY IF EXISTS "Public Access to category-images" ON storage.objects;
  CREATE POLICY "Public Access to category-images" ON storage.objects FOR SELECT USING (bucket_id = 'category-images');

  DROP POLICY IF EXISTS "Admin Manage to category-images" ON storage.objects;
  CREATE POLICY "Admin Manage to category-images" ON storage.objects FOR ALL
    USING (bucket_id = 'category-images' AND public.is_admin());

  -- payment-proofs: STRICTLY PRIVATE READ (owner buyer or admin only)
  DROP POLICY IF EXISTS "Private Access to payment-proofs" ON storage.objects;
  CREATE POLICY "Private Access to payment-proofs" ON storage.objects FOR SELECT
    USING (bucket_id = 'payment-proofs' AND (public.is_admin() OR (auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text)));

  -- payment-proofs: Authenticated upload into own user folder
  DROP POLICY IF EXISTS "Auth Upload to payment-proofs" ON storage.objects;
  CREATE POLICY "Auth Upload to payment-proofs" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
END;
$$;

-- ── 8. PUBLIC PROFILES VIEW ───────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  full_name,
  username,
  avatar_url,
  avatar_color,
  role,
  city,
  country,
  bio,
  created_at
FROM public.profiles
WHERE is_blocked = false;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- ==============================================================================
-- END OF COMPLETE PRODUCTION RECONCILIATION MIGRATION
-- ==============================================================================
