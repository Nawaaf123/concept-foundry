
CREATE OR REPLACE FUNCTION public.update_product_stock_batch(
  p_items jsonb,
  p_warehouse text DEFAULT 'A'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF upper(coalesce(p_warehouse, 'A')) = 'B' THEN
    UPDATE public.products p
    SET stock_quantity_b = stock_quantity_b + t.qty,
        updated_at = now()
    FROM (
      SELECT (item->>'product_id')::uuid AS pid,
             (item->>'quantity')::integer AS qty
      FROM jsonb_array_elements(p_items) AS item
    ) t
    WHERE p.id = t.pid;
  ELSE
    UPDATE public.products p
    SET stock_quantity = stock_quantity + t.qty,
        updated_at = now()
    FROM (
      SELECT (item->>'product_id')::uuid AS pid,
             (item->>'quantity')::integer AS qty
      FROM jsonb_array_elements(p_items) AS item
    ) t
    WHERE p.id = t.pid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_product_stock_batch(jsonb, text) TO authenticated;
