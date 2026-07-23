CREATE POLICY "Srour can delete invoices"
ON public.invoices
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'srour'::app_role));