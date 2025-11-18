import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const TopProducts = () => {
  const { data: topProducts, isLoading } = useQuery({
    queryKey: ["top-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select(`
          product_id,
          product_name,
          quantity
        `);
      
      if (error) throw error;

      // Aggregate by product
      const productMap = new Map();
      data.forEach((item) => {
        const existing = productMap.get(item.product_id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          productMap.set(item.product_id, {
            product_name: item.product_name,
            quantity: item.quantity,
          });
        }
      });

      // Convert to array and sort by quantity
      const products = Array.from(productMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      return products;
    },
  });

  const maxQuantity = topProducts?.[0]?.quantity || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Selling Products</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : topProducts && topProducts.length > 0 ? (
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{product.product_name}</span>
                  </div>
                  <span className="text-sm font-semibold">{product.quantity} units</span>
                </div>
                <Progress value={(product.quantity / maxQuantity) * 100} className="h-2" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No sales data yet</p>
        )}
      </CardContent>
    </Card>
  );
};
