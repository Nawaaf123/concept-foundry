-- Create a sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

-- Update the invoice number generation function to use the sequence
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
  invoice_num TEXT;
BEGIN
  -- Use nextval to get the next unique number from the sequence
  next_num := nextval('invoice_number_seq');
  invoice_num := 'INV-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(next_num::TEXT, 6, '0');
  RETURN invoice_num;
END;
$function$;