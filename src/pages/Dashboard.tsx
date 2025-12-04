import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingBag, FileText, DollarSign, TrendingUp, Percent } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { TopProducts } from "@/components/dashboard/TopProducts";
import { TopShops } from "@/components/dashboard/TopShops";
import { LowStockAlert } from "@/components/dashboard/LowStockAlert";
import { PendingPayments } from "@/components/dashboard/PendingPayments";
import { DatabaseStorage } from "@/components/dashboard/DatabaseStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { SalesMap } from "@/components/location/SalesMap";
import { LocationTracker } from "@/components/location/LocationTracker";

const Dashboard = () => {
  const { user } = useAuth();

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      return data || false;
    },
    enabled: !!user?.id,
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", user?.id, isAdmin],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get products count (always show all)
      const { count: productsCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Get shops count (always show all)
      const { count: shopsCount } = await supabase
        .from("shops")
        .select("*", { count: "exact", head: true });

      // Get invoices count - filtered for sales
      let invoicesQuery = supabase
        .from("invoices")
        .select("*", { count: "exact", head: true });
      
      if (!isAdmin) {
        invoicesQuery = invoicesQuery.eq("created_by", user.id);
      }
      
      const { count: invoicesCount } = await invoicesQuery;

      // Get total revenue - filtered for sales
      let revenueQuery = supabase
        .from("invoices")
        .select("total_amount");
      
      if (!isAdmin) {
        revenueQuery = revenueQuery.eq("created_by", user.id);
      }

      const { data: invoices } = await revenueQuery;
      
      const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

      // Get payment collection rate - filtered for sales
      let paymentQuery = supabase
        .from("invoices")
        .select("payment_status, total_amount");
      
      if (!isAdmin) {
        paymentQuery = paymentQuery.eq("created_by", user.id);
      }

      const { data: allInvoices } = await paymentQuery;

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
    enabled: !!user?.id && isAdmin !== undefined,
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            {isAdmin ? "Dashboard" : "My Sales Dashboard"}
          </h2>
          <p className="text-sm md:text-base text-muted-foreground">
            {isAdmin 
              ? "Overview of your sales and business metrics" 
              : "Your personal sales performance and metrics"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className={`grid gap-3 md:gap-4 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
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
            title={isAdmin ? "Total Invoices" : "My Invoices"}
            value={isLoading ? "..." : stats?.invoicesCount || 0}
            icon={FileText}
            description={isAdmin ? "All time invoices" : "Invoices I created"}
          />
          {isAdmin && (
            <StatsCard
              title="Total Revenue"
              value={isLoading ? "..." : `$${stats?.totalRevenue.toFixed(2)}`}
              icon={DollarSign}
              description="All time revenue"
            />
          )}
        </div>

        {/* Secondary Stats - Admin Only */}
        {isAdmin && (
          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Payment Collection Rate
                </CardTitle>
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
            <DatabaseStorage />
          </div>
        )}

        {/* Pending Payments - Admin Only */}
        {isAdmin && <PendingPayments userId={user?.id} isAdmin={isAdmin} />}

        {/* Sales Location Map - Admin Only */}
        {isAdmin && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Sales Team Locations</h3>
            <SalesMap />
          </div>
        )}

        {/* Location Tracker - Sales Only */}
        {!isAdmin && <LocationTracker />}

        {/* Charts and Lists Grid - Admin Only */}
        {isAdmin && (
          <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
            <TopProducts />
            <TopShops userId={user?.id} isAdmin={isAdmin} />
          </div>
        )}

        <div className={`grid gap-3 md:gap-4 grid-cols-1 ${isAdmin ? 'lg:grid-cols-2' : ''}`}>
          <LowStockAlert />
          {isAdmin && <RecentActivity userId={user?.id} isAdmin={isAdmin} />}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
