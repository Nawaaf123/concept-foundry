-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own shops or admins view all" ON public.shops;

-- Create new policy allowing all authenticated users to view shops
CREATE POLICY "Authenticated users can view all shops" 
ON public.shops 
FOR SELECT 
USING (auth.uid() IS NOT NULL);