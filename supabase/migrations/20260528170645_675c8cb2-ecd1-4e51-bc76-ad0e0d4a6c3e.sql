CREATE OR REPLACE FUNCTION public.get_top_shops(p_user_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 5)
 RETURNS TABLE(shop_name text, total_revenue numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.name as shop_name, SUM(i.total_amount) as total_revenue
  FROM invoices i
  JOIN shops s ON s.id = i.shop_id
  WHERE (p_user_id IS NULL OR i.created_by = p_user_id)
    AND s.is_frozen = false
  GROUP BY s.name
  ORDER BY total_revenue DESC
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_by_category()
 RETURNS TABLE(category text, product_name text, total_quantity bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.category, ii.product_name, SUM(ii.quantity)::bigint as total_quantity
  FROM invoice_items ii
  JOIN products p ON p.id = ii.product_id
  JOIN invoices i ON i.id = ii.invoice_id
  JOIN shops s ON s.id = i.shop_id
  WHERE s.is_frozen = false
  GROUP BY p.category, ii.product_name
  ORDER BY p.category, total_quantity DESC;
$function$;