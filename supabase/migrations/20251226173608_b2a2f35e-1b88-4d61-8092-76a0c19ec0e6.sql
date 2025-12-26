-- Drop existing admin update policy (limited to payment_status only)
DROP POLICY IF EXISTS "Admins can update invoice payment status" ON public.invoices;

-- Create new policy allowing admins to fully update invoices
CREATE POLICY "Admins can update invoices" 
ON public.invoices 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update invoice_items
CREATE POLICY "Admins can update invoice items" 
ON public.invoice_items 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM invoices 
  WHERE invoices.id = invoice_items.invoice_id 
  AND has_role(auth.uid(), 'admin'::app_role)
));

-- Allow admins to delete invoice_items (for editing)
CREATE POLICY "Admins can delete invoice items" 
ON public.invoice_items 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM invoices 
  WHERE invoices.id = invoice_items.invoice_id 
  AND has_role(auth.uid(), 'admin'::app_role)
));