
CREATE OR REPLACE FUNCTION public.get_database_size()
RETURNS TABLE(total_size text, total_bytes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT pg_size_pretty(pg_database_size(current_database())) as total_size,
         pg_database_size(current_database()) as total_bytes;
$$;
