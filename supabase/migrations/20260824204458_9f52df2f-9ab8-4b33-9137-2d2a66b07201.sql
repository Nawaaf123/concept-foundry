CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category_sub ON public.products USING btree (category, subcategory, sub_subcategory);
CREATE INDEX IF NOT EXISTS idx_shops_created_at ON public.shops USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shops_name_lower ON public.shops USING btree (lower(name));
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id_date ON public.payments USING btree (invoice_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles USING btree (user_id, role);