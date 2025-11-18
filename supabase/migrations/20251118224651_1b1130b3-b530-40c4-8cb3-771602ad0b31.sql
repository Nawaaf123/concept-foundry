-- Add inventory tracking fields to products table
ALTER TABLE products 
ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0,
ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 10;