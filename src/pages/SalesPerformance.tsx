import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, FileText, ShoppingBag, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";

const SalesPerformance = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: userRole } = useQuery({
    queryKey: ["userRole", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.role || null;
    },
    enabled: !!user?.id,
  });

  // Redirect non-admin users
  if (userRole && userRole !== "admin") {
    navigate("/dashboard");
    return null;
  }

  const { data: salesPeople, isLoading } = useQuery({
    queryKey: ["salesPerformance"],
    queryFn: async () => {
      // Get all sales users
      const { data: salesRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "sales");

      if (!salesRoles || salesRoles.length === 0) return [];

      const salesUserIds = salesRoles.map(r => r.user_id);

      // Get profiles for sales users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", salesUserIds);

      // Get all invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .in("created_by", salesUserIds);

      // Get all payments
      const { data: allPayments } = await supabase
        .from("payments")
        .select("*");

      // Get all shops
      const { data: shops } = await supabase
        .from("shops")
        .select("*")
        .in("created_by", salesUserIds);

      // Calculate metrics for each sales person
      return profiles?.map(profile => {
        const userInvoices = invoices?.filter(inv => inv.created_by === profile.id) || [];
        const userShops = shops?.filter(shop => shop.created_by === profile.id) || [];
        
        const totalRevenue = userInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
        const totalInvoices = userInvoices.length;

        // Calculate total paid for this user's invoices
        const userInvoiceIds = userInvoices.map(inv => inv.id);
        const userPayments = allPayments?.filter(p => userInvoiceIds.includes(p.invoice_id)) || [];
        const totalPaid = userPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        
        const collectionRate = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;

        return {
          ...profile,
          metrics: {
            totalInvoices,
            totalRevenue,
            totalPaid,
            collectionRate,
            totalShops: userShops.length,
          }
        };
      }) || [];
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Sales Performance</h1>
          <p>Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-2xl md:text-3xl font-bold">Sales Performance</h1>
          <Badge variant="outline" className="text-sm w-fit">
            <Users className="h-3 w-3 mr-1" />
            {salesPeople?.length || 0} Sales People
          </Badge>
        </div>

        {salesPeople && salesPeople.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No sales users found in the system.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:gap-6">
            {salesPeople?.map((salesperson) => (
              <Card key={salesperson.id}>
                <CardHeader className="p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg md:text-xl">{salesperson.full_name}</CardTitle>
                      <p className="text-xs md:text-sm text-muted-foreground mt-1 truncate">{salesperson.email}</p>
                    </div>
                    <Badge 
                      variant={salesperson.metrics.collectionRate >= 80 ? "default" : "secondary"}
                      className="text-xs md:text-sm w-fit"
                    >
                      {salesperson.metrics.collectionRate.toFixed(1)}% Collection
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
                  <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
                    <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg bg-muted/50">
                      <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                        <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-muted-foreground">Invoices</p>
                        <p className="text-lg md:text-2xl font-bold">{salesperson.metrics.totalInvoices}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg bg-muted/50">
                      <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-green-500/10 flex-shrink-0">
                        <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-muted-foreground">Revenue</p>
                        <p className="text-lg md:text-2xl font-bold truncate">${salesperson.metrics.totalRevenue.toFixed(0)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg bg-muted/50">
                      <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-blue-500/10 flex-shrink-0">
                        <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-muted-foreground">Collected</p>
                        <p className="text-lg md:text-2xl font-bold truncate">${salesperson.metrics.totalPaid.toFixed(0)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg bg-muted/50">
                      <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-orange-500/10 flex-shrink-0">
                        <ShoppingBag className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-muted-foreground">Shops</p>
                        <p className="text-lg md:text-2xl font-bold">{salesperson.metrics.totalShops}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SalesPerformance;
