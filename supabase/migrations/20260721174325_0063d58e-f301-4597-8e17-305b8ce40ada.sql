
CREATE OR REPLACE FUNCTION public.update_invoice_atomic(
  p_invoice_id uuid,
  p_shop_id uuid,
  p_total_amount numeric,
  p_discount_amount numeric,
  p_notes text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can boolean;
BEGIN
  -- Authorization: admin, srour, or original creator
  SELECT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'srour')
    OR EXISTS (SELECT 1 FROM public.invoices WHERE id = p_invoice_id AND created_by = auth.uid())
  ) INTO v_can;

  IF NOT v_can THEN
    RAISE EXCEPTION 'Not authorized to edit this invoice';
  END IF;

  UPDATE public.invoices
  SET shop_id = p_shop_id,
      total_amount = p_total_amount,
      discount_amount = p_discount_amount,
      notes = p_notes,
      updated_at = now()
  WHERE id = p_invoice_id;

  DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;

  INSERT INTO public.invoice_items (invoice_id, product_id, product_name, quantity, unit_price, subtotal)
  SELECT p_invoice_id,
         (item->>'product_id')::uuid,
         item->>'product_name',
         (item->>'quantity')::integer,
         (item->>'unit_price')::numeric,
         (item->>'subtotal')::numeric
  FROM jsonb_array_elements(p_items) AS item;

  RETURN p_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_invoice_atomic(uuid, uuid, numeric, numeric, text, jsonb) TO authenticated;
