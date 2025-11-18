-- Change product category from enum to text to allow custom categories
ALTER TABLE products ALTER COLUMN category DROP DEFAULT;
ALTER TABLE products ALTER COLUMN category TYPE text;
ALTER TABLE products ALTER COLUMN category SET DEFAULT 'Other';

-- Drop the old enum type (if no other tables use it)
DROP TYPE IF EXISTS product_category;