-- Drop the overly permissive policy that allows all authenticated users to view all shops
DROP POLICY IF EXISTS "Authenticated users can view all shops" ON public.shops;

-- Create new policy: Users can only view shops they created, admins can view all
CREATE POLICY "Users can view their own shops or admins view all" 
ON public.shops 
FOR SELECT 
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));