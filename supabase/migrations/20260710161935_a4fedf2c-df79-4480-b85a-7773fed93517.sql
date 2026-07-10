
-- 1. Warehouse enum
DO $$ BEGIN
  CREATE TYPE public.warehouse_code AS ENUM ('A', 'B');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Products: add second warehouse stock column (existing stock_quantity = Warehouse A)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity_b integer NOT NULL DEFAULT 0;

-- 3. Profiles: which warehouse this user sells from
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_warehouse public.warehouse_code NOT NULL DEFAULT 'A';

-- 4. Invoices & orders: track which warehouse fulfilled them
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS warehouse public.warehouse_code;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS warehouse public.warehouse_code;

-- 5. Warehouse-aware stock update (backward compatible: default = A)
CREATE OR REPLACE FUNCTION public.update_product_stock(
  p_product_id uuid,
  p_quantity integer,
  p_warehouse text DEFAULT 'A'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF upper(coalesce(p_warehouse, 'A')) = 'B' THEN
    UPDATE public.products
    SET stock_quantity_b = stock_quantity_b + p_quantity,
        updated_at = now()
    WHERE id = p_product_id;
  ELSE
    UPDATE public.products
    SET stock_quantity = stock_quantity + p_quantity,
        updated_at = now()
    WHERE id = p_product_id;
  END IF;
END;
$$;

-- 6. Allow admins to update a user's assigned warehouse (profiles already has admin update policy from existing setup;
--    this policy is added defensively if missing).
DO $$ BEGIN
  CREATE POLICY "Admins can update any profile"
    ON public.profiles
    FOR UPDATE
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'srour'))
    WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'srour'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
