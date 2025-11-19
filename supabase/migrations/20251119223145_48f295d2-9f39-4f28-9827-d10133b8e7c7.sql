-- Add subcategory column to products table
ALTER TABLE public.products 
ADD COLUMN subcategory text;

-- Add comment for clarity
COMMENT ON COLUMN public.products.subcategory IS 'Product subcategory for additional classification';