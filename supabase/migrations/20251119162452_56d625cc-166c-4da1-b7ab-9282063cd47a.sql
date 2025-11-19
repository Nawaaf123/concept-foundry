-- Add delete policy for invoices (admin only)
CREATE POLICY "Admins can delete invoices"
ON public.invoices
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));