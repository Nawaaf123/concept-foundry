import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import { CalendarIcon, Download, DollarSign, FileText, Package, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { exportAnalyticsToExcel } from "@/lib/analyticsExcelExport";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type DateRange = { from: Date; to: Date };

const PRESETS: { label: string; value: string; getRange: () => DateRange }[] = [
  { label: "Last 7 days", value: "7d", getRange: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Last 30 days", value: "30d", getRange: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "Last 90 days", value: "90d", getRange: () => ({ from: subDays(new Date(), 89), to: new Date() }) },
  { label: "This month", value: "month", getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "Last 6 months", value: "6m", getRange: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
  { label: "This year", value: "year", getRange: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

const CHART_COLORS = [
  "hsl(var(--primary))",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);

async function fetchAllInvoices(from: Date, to: Date) {
  const PAGE = 1000;
  const all: any[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("invoices")
      .select("id, total_amount, discount_amount, payment_status, shop_id, created_at, created_by, shops!inner(id, is_frozen)")
      .eq("shops.is_frozen", false)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

async function fetchAllPayments(from: Date, to: Date) {
  const PAGE = 1000;
  const all: any[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, payment_method, payment_date, invoice_id")
      .gte("payment_date", from.toISOString())
      .lte("payment_date", to.toISOString())
      .order("payment_date", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

async function fetchInvoiceItemsByIds(invoiceIds: string[]) {
  if (invoiceIds.length === 0) return [] as any[];
  const ID_CHUNK = 100;
  const PAGE = 1000;
  const all: any[] = [];
  for (let i = 0; i < invoiceIds.length; i += ID_CHUNK) {
    const chunk = invoiceIds.slice(i, i + ID_CHUNK);
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("invoice_id, product_id, product_name, quantity, subtotal, unit_price")
        .in("invoice_id", chunk)
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
    }
  }
  return all;
}

const ProductAnalytics = () => {
  const [presetValue, setPresetValue] = useState("30d");
  const [range, setRange] = useState<DateRange>(() => PRESETS[1].getRange());
  const [customOpen, setCustomOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { filename } = await exportAnalyticsToExcel(range);
      toast.success(`Downloaded ${filename}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to export analytics");
    } finally {
      setExporting(false);
    }
  };

  const handlePreset = (val: string) => {
    setPresetValue(val);
    if (val !== "custom") {
      const preset = PRESETS.find((p) => p.value === val);
      if (preset) setRange(preset.getRange());
    }
  };

  const { data: invoices = [], isLoading: loadingInv } = useQuery({
    queryKey: ["analytics-invoices", range.from, range.to],
    queryFn: () => fetchAllInvoices(range.from, range.to),
  });

  const { data: payments = [], isLoading: loadingPay } = useQuery({
    queryKey: ["analytics-payments", range.from, range.to],
    queryFn: () => fetchAllPayments(range.from, range.to),
  });

  const invoiceIds = useMemo(() => invoices.map((i: any) => i.id), [invoices]);

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["analytics-items", invoiceIds],
    queryFn: () => fetchInvoiceItemsByIds(invoiceIds),
    enabled: invoiceIds.length > 0,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["analytics-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, category, subcategory");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: shops = [] } = useQuery({
    queryKey: ["analytics-shops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shops").select("id, name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["analytics-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const productMap = useMemo(() => {
    const m = new Map<string, any>();
    products.forEach((p: any) => m.set(p.id, p));
    return m;
  }, [products]);
  const shopMap = useMemo(() => {
    const m = new Map<string, string>();
    shops.forEach((s: any) => m.set(s.id, s.name));
    return m;
  }, [shops]);
  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p: any) => m.set(p.id, p.full_name));
    return m;
  }, [profiles]);

  // KPIs
  const totals = useMemo(() => {
    const revenue = invoices.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
    const collected = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const outstanding = invoices.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0) - collected;
    const invCount = invoices.length;
    const itemsCount = items.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
    return { revenue, collected, outstanding, invCount, itemsCount };
  }, [invoices, payments, items]);

  // Sales by day
  const salesByDay = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; invoices: number }>();
    invoices.forEach((i: any) => {
      const key = format(new Date(i.created_at), "yyyy-MM-dd");
      const cur = map.get(key) || { date: key, revenue: 0, invoices: 0 };
      cur.revenue += Number(i.total_amount || 0);
      cur.invoices += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [invoices]);

  // Sales by month
  const salesByMonth = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; invoices: number }>();
    invoices.forEach((i: any) => {
      const key = format(new Date(i.created_at), "yyyy-MM");
      const cur = map.get(key) || { month: key, revenue: 0, invoices: 0 };
      cur.revenue += Number(i.total_amount || 0);
      cur.invoices += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [invoices]);

  // Sales by category
  const salesByCategory = useMemo(() => {
    const map = new Map<string, { category: string; revenue: number; quantity: number }>();
    items.forEach((it: any) => {
      const prod = productMap.get(it.product_id);
      const cat = prod?.category || "Uncategorized";
      const cur = map.get(cat) || { category: cat, revenue: 0, quantity: 0 };
      cur.revenue += Number(it.subtotal || 0);
      cur.quantity += Number(it.quantity || 0);
      map.set(cat, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [items, productMap]);

  // Top products
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number }>();
    items.forEach((it: any) => {
      const cur = map.get(it.product_name) || { name: it.product_name, quantity: 0, revenue: 0 };
      cur.quantity += Number(it.quantity || 0);
      cur.revenue += Number(it.subtotal || 0);
      map.set(it.product_name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  }, [items]);

  // Top shops
  const topShops = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; invoices: number }>();
    invoices.forEach((i: any) => {
      const name = shopMap.get(i.shop_id) || "Unknown";
      const cur = map.get(name) || { name, revenue: 0, invoices: 0 };
      cur.revenue += Number(i.total_amount || 0);
      cur.invoices += 1;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  }, [invoices, shopMap]);

  // Sales by staff
  const salesByStaff = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; invoices: number }>();
    invoices.forEach((i: any) => {
      const name = profileMap.get(i.created_by) || "Unknown";
      const cur = map.get(name) || { name, revenue: 0, invoices: 0 };
      cur.revenue += Number(i.total_amount || 0);
      cur.invoices += 1;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [invoices, profileMap]);

  // Payment methods
  const paymentMethods = useMemo(() => {
    const map = new Map<string, { method: string; amount: number; count: number }>();
    payments.forEach((p: any) => {
      const method = p.payment_method || "unknown";
      const cur = map.get(method) || { method, amount: 0, count: 0 };
      cur.amount += Number(p.amount || 0);
      cur.count += 1;
      map.set(method, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [payments]);

  // Payment status breakdown
  const statusBreakdown = useMemo(() => {
    const map = new Map<string, { status: string; count: number; amount: number }>();
    invoices.forEach((i: any) => {
      const s = i.payment_status || "unknown";
      const cur = map.get(s) || { status: s, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(i.total_amount || 0);
      map.set(s, cur);
    });
    return Array.from(map.values());
  }, [invoices]);

  const isLoading = loadingInv || loadingPay || loadingItems;

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Analytics & Reports</h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Insights for {format(range.from, "MMM d, yyyy")} – {format(range.to, "MMM d, yyyy")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={presetValue} onValueChange={handlePreset}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={customOpen} onOpenChange={setCustomOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(range.from, "MMM d")} – {format(range.to, "MMM d")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: range.from, to: range.to }}
                  onSelect={(r: any) => {
                    if (r?.from && r?.to) {
                      setRange({ from: r.from, to: r.to });
                      setPresetValue("custom");
                      setCustomOpen(false);
                    }
                  }}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatsCard title="Revenue" value={currency(totals.revenue)} icon={DollarSign} />
          <StatsCard title="Collected" value={currency(totals.collected)} icon={TrendingUp} />
          <StatsCard title="Outstanding" value={currency(totals.outstanding)} icon={FileText} />
          <StatsCard title="Invoices" value={totals.invCount} icon={ShoppingBag} />
          <StatsCard title="Units sold" value={totals.itemsCount} icon={Package} />
        </div>

        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="trend">Daily</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="category">By Category</TabsTrigger>
            <TabsTrigger value="products">Top Products</TabsTrigger>
            <TabsTrigger value="shops">Top Shops</TabsTrigger>
            <TabsTrigger value="staff">By Staff</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          {/* Daily */}
          <TabsContent value="trend">
            <Card>
              <CardHeader><CardTitle>Sales by Day</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <p className="text-muted-foreground">Loading...</p> : salesByDay.length === 0 ? (
                  <p className="text-muted-foreground">No sales in this period</p>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={salesByDay}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RTooltip formatter={(v: any, n) => (n === "revenue" ? currency(Number(v)) : v)} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="invoices" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monthly */}
          <TabsContent value="monthly">
            <Card>
              <CardHeader><CardTitle>Sales by Month</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <p className="text-muted-foreground">Loading...</p> : salesByMonth.length === 0 ? (
                  <p className="text-muted-foreground">No sales in this period</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={salesByMonth}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RTooltip formatter={(v: any) => currency(Number(v))} />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <Table className="mt-4">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesByMonth.map((m) => (
                          <TableRow key={m.month}>
                            <TableCell>{format(new Date(m.month + "-01"), "MMMM yyyy")}</TableCell>
                            <TableCell className="text-right">{m.invoices}</TableCell>
                            <TableCell className="text-right font-medium">{currency(m.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Category */}
          <TabsContent value="category">
            <Card>
              <CardHeader><CardTitle>Sales by Category</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <p className="text-muted-foreground">Loading...</p> : salesByCategory.length === 0 ? (
                  <p className="text-muted-foreground">No data</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={salesByCategory} dataKey="revenue" nameKey="category" outerRadius={100} label>
                          {salesByCategory.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RTooltip formatter={(v: any) => currency(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesByCategory.map((c) => (
                          <TableRow key={c.category}>
                            <TableCell className="font-medium">{c.category}</TableCell>
                            <TableCell className="text-right">{c.quantity}</TableCell>
                            <TableCell className="text-right">{currency(c.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Products */}
          <TabsContent value="products">
            <Card>
              <CardHeader><CardTitle>Top Products</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <p className="text-muted-foreground">Loading...</p> : topProducts.length === 0 ? (
                  <p className="text-muted-foreground">No data</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty Sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((p, i) => (
                        <TableRow key={p.name}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{p.quantity}</TableCell>
                          <TableCell className="text-right">{currency(p.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Shops */}
          <TabsContent value="shops">
            <Card>
              <CardHeader><CardTitle>Top Shops</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <p className="text-muted-foreground">Loading...</p> : topShops.length === 0 ? (
                  <p className="text-muted-foreground">No data</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Shop</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topShops.map((s, i) => (
                        <TableRow key={s.name}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-right">{s.invoices}</TableCell>
                          <TableCell className="text-right">{currency(s.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Staff */}
          <TabsContent value="staff">
            <Card>
              <CardHeader><CardTitle>Sales by Staff</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <p className="text-muted-foreground">Loading...</p> : salesByStaff.length === 0 ? (
                  <p className="text-muted-foreground">No data</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={salesByStaff} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                        <RTooltip formatter={(v: any) => currency(Number(v))} />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <Table className="mt-4">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesByStaff.map((s) => (
                          <TableRow key={s.name}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="text-right">{s.invoices}</TableCell>
                            <TableCell className="text-right">{currency(s.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
                <CardContent>
                  {paymentMethods.length === 0 ? (
                    <p className="text-muted-foreground">No payments</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie data={paymentMethods} dataKey="amount" nameKey="method" outerRadius={80} label>
                            {paymentMethods.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <RTooltip formatter={(v: any) => currency(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Method</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentMethods.map((m) => (
                            <TableRow key={m.method}>
                              <TableCell className="capitalize font-medium">{m.method}</TableCell>
                              <TableCell className="text-right">{m.count}</TableCell>
                              <TableCell className="text-right">{currency(m.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Invoice Status</CardTitle></CardHeader>
                <CardContent>
                  {statusBreakdown.length === 0 ? (
                    <p className="text-muted-foreground">No invoices</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusBreakdown.map((s) => (
                          <TableRow key={s.status}>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">{s.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{s.count}</TableCell>
                            <TableCell className="text-right">{currency(s.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ProductAnalytics;
