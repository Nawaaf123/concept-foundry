
-- 1. Add 'retailer' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'retailer';

-- 2. Add retailer_user_id to shops
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS retailer_user_id UUID UNIQUE;

-- 3. Order status enum
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending', 'approved', 'rejected', 'converted');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  admin_notes TEXT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 5. Order items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 6. Retailer signup requests
DO $$ BEGIN
  CREATE TYPE public.signup_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.retailer_signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  requested_shop_name TEXT NOT NULL,
  message TEXT,
  status public.signup_request_status NOT NULL DEFAULT 'pending',
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.retailer_signup_requests ENABLE ROW LEVEL SECURITY;

-- 7. Triggers for updated_at
DROP TRIGGER IF EXISTS trg_orders_updated ON public.orders;
CREATE TRIGGER trg_orders_updated
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_signup_requests_updated ON public.retailer_signup_requests;
CREATE TRIGGER trg_signup_requests_updated
  BEFORE UPDATE ON public.retailer_signup_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. RLS policies — orders
CREATE POLICY "Admins and srour can view all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'srour') OR has_role(auth.uid(), 'sales'));

CREATE POLICY "Retailers can view their shop orders"
  ON public.orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = orders.shop_id AND s.retailer_user_id = auth.uid()));

CREATE POLICY "Retailers can create orders for their shop"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = orders.shop_id AND s.retailer_user_id = auth.uid())
  );

CREATE POLICY "Admins and srour can update orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'srour'));

CREATE POLICY "Admins can delete orders"
  ON public.orders FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 9. RLS policies — order_items
CREATE POLICY "View order items if can view order"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (
        has_role(auth.uid(), 'admin')
        OR has_role(auth.uid(), 'srour')
        OR has_role(auth.uid(), 'sales')
        OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = o.shop_id AND s.retailer_user_id = auth.uid())
      )
  ));

CREATE POLICY "Retailers can insert their order items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE o.id = order_items.order_id
      AND s.retailer_user_id = auth.uid()
      AND o.created_by = auth.uid()
  ));

CREATE POLICY "Admins can manage order items"
  ON public.order_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'srour'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'srour'));

-- 10. RLS policies — retailer_signup_requests
CREATE POLICY "Anyone can submit a signup request"
  ON public.retailer_signup_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own request"
  ON public.retailer_signup_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'srour'));

CREATE POLICY "Admins can update signup requests"
  ON public.retailer_signup_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'srour'));

CREATE POLICY "Admins can delete signup requests"
  ON public.retailer_signup_requests FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 11. Approve retailer signup RPC
CREATE OR REPLACE FUNCTION public.approve_retailer_signup(
  p_request_id UUID,
  p_shop_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'srour')) THEN
    RAISE EXCEPTION 'Only admins can approve retailer signups';
  END IF;

  SELECT user_id INTO v_user_id FROM public.retailer_signup_requests WHERE id = p_request_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Signup request has no associated user';
  END IF;

  UPDATE public.shops SET retailer_user_id = v_user_id WHERE id = p_shop_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'retailer')
  ON CONFLICT DO NOTHING;

  UPDATE public.retailer_signup_requests
  SET status = 'approved',
      shop_id = p_shop_id,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_request_id;
END;
$$;
