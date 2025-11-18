-- Update shops table to match Excel structure
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS street_address TEXT,
ADD COLUMN IF NOT EXISTS street_address_line_2 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- Update existing data: migrate address to street_address
UPDATE public.shops 
SET street_address = address 
WHERE street_address IS NULL AND address IS NOT NULL;

-- Drop old address column
ALTER TABLE public.shops DROP COLUMN IF EXISTS address;