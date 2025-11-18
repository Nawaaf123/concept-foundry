import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingBag, FileText, DollarSign, TrendingUp, Percent } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { TopProducts } from "@/components/dashboard/TopProducts";
import { TopShops } from "@/components/dashboard/TopShops";
import { LowStockAlert } from "@/components/dashboard/LowStockAlert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Dashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      // Get products count
      const { count: productsCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Get shops count
      const { count: shopsCount } = await supabase
        .from("shops")
        .select("*", { count: "exact", head: true });

      // Get invoices count
      const { count: invoicesCount } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true });

      // Get total revenue
      const { data: invoices } = await supabase
        .from("invoices")
        .select("total_amount");
      
      const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

      // Get payment collection rate
      const { data: allInvoices } = await supabase
        .from("invoices")
        .select("payment_status, total_amount");

      const paidAmount = allInvoices
        ?.filter(inv => inv.payment_status === "paid")
        .reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

      const collectionRate = totalRevenue > 0 ? (paidAmount / totalRevenue) * 100 : 0;

      return {
        productsCount: productsCount || 0,
        shopsCount: shopsCount || 0,
        invoicesCount: invoicesCount || 0,
        totalRevenue,
        collectionRate,
      };
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Overview of your sales and business metrics</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Products"
            value={isLoading ? "..." : stats?.productsCount || 0}
            icon={Package}
            description="Active products in catalog"
          />
          <StatsCard
            title="Total Shops"
            value={isLoading ? "..." : stats?.shopsCount || 0}
            icon={ShoppingBag}
            description="Customer shops registered"
          />
          <StatsCard
            title="Total Invoices"
            value={isLoading ? "..." : stats?.invoicesCount || 0}
            icon={FileText}
            description="All time invoices"
          />
          <StatsCard
            title="Total Revenue"
            value={isLoading ? "..." : `$${stats?.totalRevenue.toFixed(2)}`}
            icon={DollarSign}
            description="All time revenue"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Collection Rate</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : `${stats?.collectionRate.toFixed(1)}%`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Of total invoiced amount collected
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Invoice Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading
                  ? "..."
                  : stats?.invoicesCount && stats.invoicesCount > 0
                  ? `$${(stats.totalRevenue / stats.invoicesCount).toFixed(2)}`
                  : "$0"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Per invoice
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Lists Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <TopProducts />
          <TopShops />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <LowStockAlert />
          <RecentActivity />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
