
-- Allow srour to view all invoices
DROP POLICY IF EXISTS "Sales can view their own invoices" ON public.invoices;
CREATE POLICY "Sales can view their own invoices" ON public.invoices
FOR SELECT TO authenticated
USING (
  auth.uid() = created_by 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'srour'::app_role)
);

-- Allow srour to update all invoices
CREATE POLICY "Srour can update invoices" ON public.invoices
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'srour'::app_role));

-- Allow srour to view all invoice items
DROP POLICY IF EXISTS "Users can view invoice items for their invoices" ON public.invoice_items;
CREATE POLICY "Users can view invoice items for their invoices" ON public.invoice_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND (
      invoices.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'srour'::app_role)
    )
  )
);

-- Allow srour to update invoice items
CREATE POLICY "Srour can update invoice items" ON public.invoice_items
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND has_role(auth.uid(), 'srour'::app_role)
  )
);

-- Allow srour to view payments for all invoices
DROP POLICY IF EXISTS "Users can view payments for their invoices" ON public.payments;
CREATE POLICY "Users can view payments for their invoices" ON public.payments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = payments.invoice_id
    AND (
      invoices.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'srour'::app_role)
    )
  )
);

-- Allow srour to create payments
DROP POLICY IF EXISTS "Users can create payments" ON public.payments;
CREATE POLICY "Users can create payments" ON public.payments
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = payments.invoice_id
    AND (
      invoices.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'srour'::app_role)
    )
  )
);
