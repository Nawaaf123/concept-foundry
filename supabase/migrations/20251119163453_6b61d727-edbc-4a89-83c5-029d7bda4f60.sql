-- Drop existing policy
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Recreate policy with explicit WITH CHECK for INSERT
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));