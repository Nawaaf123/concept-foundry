import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Database } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DatabaseStorage = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["database-stats"],
    queryFn: async () => {
      // Get counts from each table to estimate usage
      const [products, shops, invoices, invoiceItems, payments] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("shops").select("*", { count: "exact", head: true }),
        supabase.from("invoices").select("*", { count: "exact", head: true }),
        supabase.from("invoice_items").select("*", { count: "exact", head: true }),
        supabase.from("payments").select("*", { count: "exact", head: true }),
      ]);

      return {
        products: products.count || 0,
        shops: shops.count || 0,
        invoices: invoices.count || 0,
        invoiceItems: invoiceItems.count || 0,
        payments: payments.count || 0,
      };
    },
  });

  const totalRecords = stats 
    ? stats.products + stats.shops + stats.invoices + stats.invoiceItems + stats.payments 
    : 0;
  
  // Estimate: ~1KB per record average, 500MB limit for free tier
  const estimatedUsageMB = (totalRecords * 1) / 1024;
  const maxStorageMB = 500;
  const usagePercent = Math.min((estimatedUsageMB / maxStorageMB) * 100, 100);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Database Storage</CardTitle>
        <Database className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {isLoading ? "..." : `~${estimatedUsageMB.toFixed(2)} MB`}
          </span>
          <span className="text-muted-foreground">{maxStorageMB} MB</span>
        </div>
        <Progress value={isLoading ? 0 : usagePercent} className="h-2" />
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2">
          <div>Products: {stats?.products || 0}</div>
          <div>Shops: {stats?.shops || 0}</div>
          <div>Invoices: {stats?.invoices || 0}</div>
          <div>Payments: {stats?.payments || 0}</div>
        </div>
      </CardContent>
    </Card>
  );
};
