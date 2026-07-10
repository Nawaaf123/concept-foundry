
ALTER TABLE public.shops ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_created_by_fkey;
ALTER TABLE public.shops
  ADD CONSTRAINT shops_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
