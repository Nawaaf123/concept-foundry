import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, DollarSign, FileText, ShoppingBag, Users, CalendarIcon, Percent } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

type PeriodFilter = "today" | "yesterday" | "this-week" | "last-week" | "this-month" | "last-month" | "custom";

const SalesPerformance = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("this-month");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [commissionRate, setCommissionRate] = useState<number>(10);

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

  const getDateRange = (): { start: Date; end: Date } => {
    const now = new Date();
    
    switch (periodFilter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case "this-week":
        return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
      case "last-week":
        const lastWeek = subWeeks(now, 1);
        return { start: startOfWeek(lastWeek, { weekStartsOn: 0 }), end: endOfWeek(lastWeek, { weekStartsOn: 0 }) };
      case "this-month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last-month":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "custom":
        if (customDateRange?.from && customDateRange?.to) {
          return { start: startOfDay(customDateRange.from), end: endOfDay(customDateRange.to) };
        }
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const dateRange = getDateRange();

  const { data: salesPeople, isLoading } = useQuery({
    queryKey: ["salesPerformance", periodFilter, customDateRange?.from?.toISOString(), customDateRange?.to?.toISOString()],
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

      // Get all invoices for these sales users
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .in("created_by", salesUserIds);

      // Get payments within the date range
      const { data: allPayments } = await supabase
        .from("payments")
        .select("*")
        .gte("payment_date", dateRange.start.toISOString())
        .lte("payment_date", dateRange.end.toISOString());

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

        // Calculate total paid within the date range for this user's invoices
        const userInvoiceIds = userInvoices.map(inv => inv.id);
        const userPayments = allPayments?.filter(p => userInvoiceIds.includes(p.invoice_id)) || [];
        const collectedInPeriod = userPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        
        // Break down by payment method
        const cashCollected = userPayments
          .filter(p => p.payment_method === "cash")
          .reduce((sum, p) => sum + Number(p.amount), 0);
        const checkCollected = userPayments
          .filter(p => p.payment_method === "check")
          .reduce((sum, p) => sum + Number(p.amount), 0);

        return {
          ...profile,
          metrics: {
            totalInvoices,
            totalRevenue,
            collectedInPeriod,
            cashCollected,
            checkCollected,
            totalShops: userShops.length,
            paymentCount: userPayments.length,
          }
        };
      }) || [];
    },
  });

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case "today": return "Today";
      case "yesterday": return "Yesterday";
      case "this-week": return "This Week";
      case "last-week": return "Last Week";
      case "this-month": return "This Month";
      case "last-month": return "Last Month";
      case "custom": 
        if (customDateRange?.from && customDateRange?.to) {
          return `${format(customDateRange.from, "MMM d")} - ${format(customDateRange.to, "MMM d, yyyy")}`;
        }
        return "Custom Range";
      default: return "This Month";
    }
  };

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

  const totalCollected = salesPeople?.reduce((sum, sp) => sum + sp.metrics.collectedInPeriod, 0) || 0;
  const totalCommission = (totalCollected * commissionRate) / 100;

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h1 className="text-2xl md:text-3xl font-bold">Sales Performance</h1>
            <Badge variant="outline" className="text-sm w-fit">
              <Users className="h-3 w-3 mr-1" />
              {salesPeople?.length || 0} Sales People
            </Badge>
          </div>

          {/* Period Filter & Commission Rate */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-wrap">
            <Select value={periodFilter} onValueChange={(value: PeriodFilter) => setPeriodFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="last-week">Last Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {periodFilter === "custom" && (
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">From:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal",
                          !customDateRange?.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange?.from ? (
                          format(customDateRange.from, "MMM dd, y")
                        ) : (
                          <span>Start date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateRange?.from}
                        onSelect={(date) => setCustomDateRange({ ...customDateRange, from: date })}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">To:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal",
                          !customDateRange?.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange?.to ? (
                          format(customDateRange.to, "MMM dd, y")
                        ) : (
                          <span>End date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateRange?.to}
                        onSelect={(date) => setCustomDateRange({ ...customDateRange, to: date })}
                        disabled={(date) => customDateRange?.from ? date < customDateRange.from : false}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              {format(dateRange.start, "MMM d, yyyy")} - {format(dateRange.end, "MMM d, yyyy")}
            </div>

            <div className="flex items-center gap-2 ml-0 sm:ml-auto">
              <Label htmlFor="commission-rate" className="text-sm whitespace-nowrap">Commission %</Label>
              <Input
                id="commission-rate"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={commissionRate}
                onChange={(e) => setCommissionRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="w-20"
              />
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Collected ({getPeriodLabel()})</p>
                    <p className="text-2xl md:text-3xl font-bold text-primary">${totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-primary/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Commission ({commissionRate}%)</p>
                    <p className="text-2xl md:text-3xl font-bold text-green-600">${totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <Percent className="h-8 w-8 text-green-500/50" />
                </div>
              </CardContent>
            </Card>
          </div>
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
                    <Badge variant="secondary" className="text-xs md:text-sm w-fit">
                      {salesperson.metrics.paymentCount} payments
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
                  <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-6">
                    {/* Total Revenue */}
                    <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg bg-muted/50">
                      <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-purple-500/10 flex-shrink-0">
                        <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-muted-foreground">Revenue</p>
                        <p className="text-lg md:text-2xl font-bold truncate">
                          ${salesperson.metrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Amount Collected - Primary metric for commission */}
                    <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-primary/20 flex-shrink-0">
                        <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-muted-foreground">Collected</p>
                        <p className="text-lg md:text-2xl font-bold text-primary">
                          ${salesperson.metrics.collectedInPeriod.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Commission Amount */}
                    <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-green-500/20 flex-shrink-0">
                        <Percent className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-muted-foreground">Commission</p>
                        <p className="text-lg md:text-2xl font-bold text-green-600">
                          ${((salesperson.metrics.collectedInPeriod * commissionRate) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg bg-muted/50">
                      <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-green-500/10 flex-shrink-0">
                        <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-muted-foreground">Cash</p>
                        <p className="text-lg md:text-2xl font-bold truncate">
                          ${salesperson.metrics.cashCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg bg-muted/50">
                      <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-blue-500/10 flex-shrink-0">
                        <FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-muted-foreground">Check</p>
                        <p className="text-lg md:text-2xl font-bold truncate">
                          ${salesperson.metrics.checkCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg bg-muted/50">
                      <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-orange-500/10 flex-shrink-0">
                        <ShoppingBag className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-muted-foreground">Total Shops</p>
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
