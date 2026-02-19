CREATE POLICY "Admins can delete shops"
ON public.shops
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));