
DROP POLICY IF EXISTS "Anyone can submit a signup request" ON public.retailer_signup_requests;

CREATE POLICY "Authenticated users can submit their own signup request"
  ON public.retailer_signup_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
