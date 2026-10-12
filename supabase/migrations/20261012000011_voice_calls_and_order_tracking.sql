-- ============================================================================
-- Baloch Export Hub — Voice Calling & Order Tracking Migration
-- Migration: 20261012000011_voice_calls_and_order_tracking.sql
-- ============================================================================

-- 0. Ensure notification_outbox status constraint supports all valid pipeline states
ALTER TABLE public.notification_outbox 
  DROP CONSTRAINT IF EXISTS notification_outbox_status_check;

ALTER TABLE public.notification_outbox 
  ADD CONSTRAINT notification_outbox_status_check 
  CHECK (status IN ('pending', 'queued', 'processing', 'processed', 'sent', 'failed', 'skipped_no_provider'));

ALTER TABLE public.notification_outbox 
  ALTER COLUMN status SET DEFAULT 'pending';

-- Safety check: Ensure legacy trigger does not duplicate or fail outbox
CREATE OR REPLACE FUNCTION public.on_order_created_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- 1. Add tracking_token to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS tracking_token text DEFAULT encode(gen_random_bytes(16), 'hex');

-- Backfill any existing orders that don't have tracking_token
UPDATE public.orders 
SET tracking_token = encode(gen_random_bytes(16), 'hex') 
WHERE tracking_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_tracking_token ON public.orders(tracking_token);

-- 2. Create call_sessions table for WebRTC voice calling
CREATE TABLE IF NOT EXISTS public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'calling' CHECK (status IN ('calling', 'ringing', 'connected', 'rejected', 'missed', 'ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_conversation ON public.call_sessions(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sessions_callee ON public.call_sessions(callee_id, status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_caller ON public.call_sessions(caller_id, status);

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_sessions_parties" ON public.call_sessions;
CREATE POLICY "call_sessions_parties" ON public.call_sessions
  FOR ALL TO authenticated
  USING (
    caller_id = auth.uid() OR callee_id = auth.uid() OR public.is_admin()
  )
  WITH CHECK (
    caller_id = auth.uid() OR callee_id = auth.uid() OR public.is_admin()
  );

-- Add call_sessions to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'call_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- publication might already include all tables or fail gracefully
  NULL;
END $$;

-- 3. Public Order Tracking RPC (securely accessible with token or buyer auth)
CREATE OR REPLACE FUNCTION public.get_public_order_tracking(
  p_identifier text,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_is_owner boolean := false;
  v_is_seller boolean := false;
  v_is_admin boolean := false;
  v_token_valid boolean := false;
  v_items jsonb;
  v_history jsonb;
  v_result jsonb;
BEGIN
  -- Lookup order by UUID or code
  IF p_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_order FROM public.orders WHERE id = p_identifier::uuid;
  ELSE
    SELECT * INTO v_order FROM public.orders WHERE code = p_identifier;
  END IF;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;

  -- Check authentication / permissions
  IF v_uid IS NOT NULL THEN
    v_is_admin := EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND role = 'admin');
    v_is_owner := (v_order.buyer_id = v_uid);
    v_is_seller := EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi.order_id = v_order.id AND (oi.seller_id = v_uid OR EXISTS (
        SELECT 1 FROM public.seller_stores ss WHERE ss.id = oi.store_id AND ss.seller_id = v_uid
      ))
    );
  END IF;

  v_token_valid := (p_token IS NOT NULL AND (p_token = v_order.tracking_token OR p_token = v_order.id::text));

  -- If not owner, seller, admin, or holding valid tracking token, still allow limited tracking without PII
  -- Gather items with seller store info
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', oi.id,
    'product_id', oi.product_id,
    'product_name', oi.product_name,
    'price', oi.price,
    'quantity', oi.quantity,
    'status', oi.status,
    'tracking_code', oi.tracking_code,
    'courier', oi.courier,
    'estimated_delivery', oi.estimated_delivery,
    'image', p.image,
    'store_id', ss.id,
    'store_name', ss.name,
    'store_slug', ss.slug
  )), '[]'::jsonb) INTO v_items
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  LEFT JOIN public.seller_stores ss ON ss.id = oi.store_id
  WHERE oi.order_id = v_order.id;

  -- Gather status history
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', osh.id,
    'from_status', osh.from_status,
    'to_status', osh.to_status,
    'note', osh.note,
    'created_at', osh.created_at
  ) ORDER BY osh.created_at ASC), '[]'::jsonb) INTO v_history
  FROM public.order_status_history osh
  WHERE osh.order_id = v_order.id;

  -- Build safe response payload
  v_result := jsonb_build_object(
    'id', v_order.id,
    'code', v_order.code,
    'status', v_order.status,
    'total', v_order.total,
    'subtotal', v_order.subtotal,
    'shipping', v_order.shipping,
    'payment_method', v_order.payment_method,
    'payment', v_order.payment,
    'created_at', v_order.created_at,
    'items', v_items,
    'history', v_history,
    'destination', jsonb_build_object(
      'city', COALESCE(v_order.address->>'city', v_order.city, 'Quetta'),
      'state', COALESCE(v_order.address->>'state', 'Balochistan'),
      'country', COALESCE(v_order.address->>'country', v_order.country, 'Pakistan')
    )
  );

  -- Only include full recipient PII (phone, full street line) if owner, seller, admin, or matching tracking token
  IF v_is_owner OR v_is_seller OR v_is_admin OR v_token_valid THEN
    v_result := v_result || jsonb_build_object(
      'recipient_name', v_order.full_name,
      'is_authorized_viewer', true,
      'address_summary', jsonb_build_object(
        'full_name', v_order.full_name,
        'line1', CASE WHEN v_is_owner OR v_is_admin THEN v_order.address->>'line1' ELSE NULL END,
        'city', COALESCE(v_order.address->>'city', v_order.city),
        'state', COALESCE(v_order.address->>'state', 'Balochistan'),
        'country', COALESCE(v_order.address->>'country', v_order.country)
      )
    );
  ELSE
    v_result := v_result || jsonb_build_object(
      'recipient_name', substr(COALESCE(v_order.full_name, 'Buyer'), 1, 1) || '***',
      'is_authorized_viewer', false
    );
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_order_tracking(text, text) TO anon, authenticated;

-- 4. Update place_order function to record buyer confirmation email in notification_outbox
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
  v_tracking_token text;
  v_method text := lower(trim(coalesce(p_payment_method, 'cod')));
  v_seller_ids uuid[] := '{}';
  v_sid uuid;
  v_first_store record;
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
  v_tracking_token := encode(gen_random_bytes(16), 'hex');

  -- Insert Order with ZERO platform commission and unique tracking token
  INSERT INTO public.orders (
    code, buyer_id, full_name, email, phone, address, city, country,
    subtotal, shipping, total, commission, payment, payment_method, payment_reference, status,
    tracking_token
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
    'submitted',
    v_tracking_token
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

  -- Notify Sellers
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

  -- Fetch primary seller store information for the email confirmation
  SELECT ss.name as store_name, ss.slug as store_slug
  INTO v_first_store
  FROM public.order_items oi
  JOIN public.seller_stores ss ON ss.id = oi.store_id
  WHERE oi.order_id = v_order.id
  LIMIT 1;

  -- 1) Insert Automatic Buyer Gmail Order Confirmation into notification_outbox
  BEGIN
    INSERT INTO public.notification_outbox (kind, payload, status)
    VALUES (
      'order_buyer_confirmation',
      jsonb_build_object(
        'order_id', v_order.id,
        'order_code', v_code,
        'buyer_id', v_buyer,
        'buyer_email', coalesce(v_order.email, v_buyer_profile.email),
        'buyer_name', coalesce(v_order.full_name, v_buyer_profile.full_name),
        'total', v_total,
        'subtotal', v_subtotal,
        'shipping', v_shipping,
        'payment_method', v_method,
        'status', 'submitted',
        'tracking_token', v_tracking_token,
        'store_name', COALESCE(v_first_store.store_name, 'Baloch Export Hub Artisan Store'),
        'store_slug', COALESCE(v_first_store.store_slug, 'sellers'),
        'address', jsonb_build_object(
          'full_name', v_order.full_name,
          'city', COALESCE(v_order.address->>'city', 'Quetta'),
          'state', COALESCE(v_order.address->>'state', 'Balochistan'),
          'country', COALESCE(v_order.address->>'country', 'Pakistan')
        ),
        'items', (
          SELECT jsonb_agg(jsonb_build_object(
            'name', oi.product_name,
            'qty', oi.quantity,
            'price', oi.price,
            'total', oi.price * oi.quantity,
            'image', p.image,
            'tracking_code', oi.tracking_code,
            'store_name', COALESCE(ss.name, 'Artisan Studio'),
            'store_slug', COALESCE(ss.slug, '')
          ))
          FROM public.order_items oi
          LEFT JOIN public.products p ON p.id = oi.product_id
          LEFT JOIN public.seller_stores ss ON ss.id = oi.store_id
          WHERE oi.order_id = v_order.id
        )
      ),
      'pending'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to queue order_buyer_confirmation outbox: %', SQLERRM;
  END;

  -- 2) Notify Admin in outbox
  BEGIN
    INSERT INTO public.notification_outbox (kind, payload, status)
    VALUES (
      'new_order',
      jsonb_build_object(
        'order_id', v_order.id,
        'code', v_code,
        'total', v_total,
        'buyer_name', v_order.full_name,
        'buyer_email', v_order.email
      ),
      'pending'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to queue new_order outbox: %', SQLERRM;
  END;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text) TO authenticated;
