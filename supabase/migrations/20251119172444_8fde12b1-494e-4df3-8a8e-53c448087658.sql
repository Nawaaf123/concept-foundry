DO $$
DECLARE
  max_num integer;
BEGIN
  -- Find the highest numeric part of existing invoice numbers like 'INV-YYYY-XXXXXX'
  SELECT COALESCE(MAX(CAST(split_part(invoice_number, '-', 3) AS integer)), 0)
  INTO max_num
  FROM public.invoices
  WHERE invoice_number ~ '^INV-[0-9]{4}-[0-9]+$';

  -- Set the sequence to that max value so the next value is unique
  PERFORM setval('invoice_number_seq', max_num);
END;
$$;