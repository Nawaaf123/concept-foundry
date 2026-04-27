-- Fix invoice_items RLS policies so editing invoices works correctly
-- Bug 1: Admin editing a sales-created invoice deleted old items but couldn't insert new ones (invoice became empty)
-- Bug 2: Srour/sales editing couldn't delete old items, so new items duplicated on top

-- Drop old, broken policies
DROP POLICY IF EXISTS "Users can create invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Admins can update invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Admins can delete invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Srour can update invoice items" ON public.invoice_items;

-- INSERT: invoice creator, admin, or srour can add items to an invoice
CREATE POLICY "Authorized users can create invoice items"
ON public.invoice_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = invoice_items.invoice_id
      AND (
        invoices.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'srour'::app_role)
      )
  )
);

-- UPDATE: invoice creator, admin, or srour can update items
CREATE POLICY "Authorized users can update invoice items"
ON public.invoice_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = invoice_items.invoice_id
      AND (
        invoices.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'srour'::app_role)
      )
  )
);

-- DELETE: invoice creator, admin, or srour can remove items
CREATE POLICY "Authorized users can delete invoice items"
ON public.invoice_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = invoice_items.invoice_id
      AND (
        invoices.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'srour'::app_role)
      )
  )
);