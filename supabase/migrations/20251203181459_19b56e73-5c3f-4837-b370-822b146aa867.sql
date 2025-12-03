-- Create user_locations table for tracking salesperson locations
CREATE TABLE public.user_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Sales users can update their own location
CREATE POLICY "Users can upsert their own location"
ON public.user_locations
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can view all locations
CREATE POLICY "Admins can view all locations"
ON public.user_locations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;