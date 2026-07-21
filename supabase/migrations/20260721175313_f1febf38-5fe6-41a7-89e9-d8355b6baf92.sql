CREATE INDEX IF NOT EXISTS idx_invoices_created_by_created_at ON public.invoices (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_shop_id_created_at ON public.invoices (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status_created_at ON public.invoices (payment_status, created_at DESC);