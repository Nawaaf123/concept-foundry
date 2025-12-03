-- Add sub_subcategory column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sub_subcategory text;