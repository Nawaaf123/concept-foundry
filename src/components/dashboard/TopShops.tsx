import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Store } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface TopShopsProps {
  userId?: string;
  isAdmin?: boolean;
}

export const TopShops = ({ userId, isAdmin }: TopShopsProps) => {
  const { data: topShops, isLoading } = useQuery({
    queryKey: ["top-shops", userId, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select(`
          shop_id,
          total_amount,
          shops (name)
        `);
      
      // Filter by user if not admin
      if (!isAdmin && userId) {
        query = query.eq("created_by", userId);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Aggregate by shop
      const shopMap = new Map();
      data.forEach((invoice) => {
        const shopId = invoice.shop_id;
        const existing = shopMap.get(shopId);
        if (existing) {
          existing.total += Number(invoice.total_amount);
        } else {
          shopMap.set(shopId, {
            name: invoice.shops?.name || "Unknown",
            total: Number(invoice.total_amount),
          });
        }
      });

      // Convert to array and sort by total
      const shops = Array.from(shopMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      return shops;
    },
    enabled: !!userId,
  });

  const maxTotal = topShops?.[0]?.total || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isAdmin ? "Top Shops by Revenue" : "My Top Shops"}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : topShops && topShops.length > 0 ? (
          <div className="space-y-4">
            {topShops.map((shop, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{shop.name}</span>
                  </div>
                  <span className="text-sm font-semibold">${shop.total.toFixed(2)}</span>
                </div>
                <Progress value={(shop.total / maxTotal) * 100} className="h-2" />
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
