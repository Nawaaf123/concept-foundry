-- Create a function to clean up stale location data (older than 12 hours)
CREATE OR REPLACE FUNCTION public.cleanup_stale_locations()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete any location records older than 12 hours
  DELETE FROM public.user_locations 
  WHERE updated_at < NOW() - INTERVAL '12 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger cleanup on each location update
DROP TRIGGER IF EXISTS trigger_cleanup_stale_locations ON public.user_locations;
CREATE TRIGGER trigger_cleanup_stale_locations
AFTER INSERT OR UPDATE ON public.user_locations
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_stale_locations();

-- Add RLS policy for users to delete their own location
DROP POLICY IF EXISTS "Users can delete their own location" ON public.user_locations;
CREATE POLICY "Users can delete their own location"
ON public.user_locations
FOR DELETE
USING (auth.uid() = user_id);