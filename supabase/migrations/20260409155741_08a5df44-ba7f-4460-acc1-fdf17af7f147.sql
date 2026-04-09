
-- Function to get top products by quantity sold
CREATE OR REPLACE FUNCTION public.get_top_products(limit_count integer DEFAULT 5)
RETURNS TABLE(product_name text, total_quantity bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT product_name, SUM(quantity)::bigint as total_quantity
  FROM invoice_items
  GROUP BY product_name
  ORDER BY total_quantity DESC
  LIMIT limit_count;
$$;

-- Function to get top shops by revenue (with optional user filter)
CREATE OR REPLACE FUNCTION public.get_top_shops(p_user_id uuid DEFAULT NULL, p_limit integer DEFAULT 5)
RETURNS TABLE(shop_name text, total_revenue numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT s.name as shop_name, SUM(i.total_amount) as total_revenue
  FROM invoices i
  JOIN shops s ON s.id = i.shop_id
  WHERE (p_user_id IS NULL OR i.created_by = p_user_id)
  GROUP BY s.name
  ORDER BY total_revenue DESC
  LIMIT p_limit;
$$;

-- Function to get sales by category with product breakdown
CREATE OR REPLACE FUNCTION public.get_sales_by_category()
RETURNS TABLE(category text, product_name text, total_quantity bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.category, ii.product_name, SUM(ii.quantity)::bigint as total_quantity
  FROM invoice_items ii
  JOIN products p ON p.id = ii.product_id
  GROUP BY p.category, ii.product_name
  ORDER BY p.category, total_quantity DESC;
$$;
