-- Add discount column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN discount_amount numeric DEFAULT 0;