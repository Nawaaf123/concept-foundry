
CREATE OR REPLACE FUNCTION public.prevent_payment_overpayment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
  v_paid  NUMERIC;
BEGIN
  SELECT COALESCE(total_amount, 0) INTO v_total
  FROM public.invoices WHERE id = NEW.invoice_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.payments
  WHERE invoice_id = NEW.invoice_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF (v_paid + COALESCE(NEW.amount, 0)) > v_total + 0.01 THEN
    RAISE EXCEPTION 'Payment exceeds invoice total. Invoice total: $%, already paid: $%, attempted new payment: $%. Remaining allowed: $%',
      v_total, v_paid, NEW.amount, GREATEST(v_total - v_paid, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_payment_overpayment ON public.payments;
CREATE TRIGGER trg_prevent_payment_overpayment
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_payment_overpayment();
