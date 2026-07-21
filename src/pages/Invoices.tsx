import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus, FileDown, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { InvoiceDialog } from "@/components/invoices/InvoiceDialog";
import { InvoiceFilters } from "@/components/invoices/InvoiceFilters";
import { AddOldBalanceDialog } from "@/components/invoices/AddOldBalanceDialog";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { exportInvoicesToExcel } from "@/lib/excelGenerator";

const Invoices = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isOldBalanceDialogOpen, setIsOldBalanceDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [shopFilter, setShopFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const { user } = useAuth();
  const { toast } = useToast();

  // Reset to first page whenever filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, statusFilter, shopFilter, sortBy, dateFrom, dateTo]);

  const { data: shops } = useQuery({
    queryKey: ["shops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shops")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: userRole } = useQuery({
    queryKey: ["userRole", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .single();
      
      if (error) throw error;
      return data?.role;
    },
    enabled: !!user?.id,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const isAdmin = userRole === "admin";
  const isSrour = userRole === "srour";
  const canEditAll = isAdmin || isSrour;

  const { data: invoiceData, isLoading, refetch } = useQuery({
    queryKey: ["invoices", searchQuery, statusFilter, shopFilter, sortBy, dateFrom, dateTo, page],
    queryFn: async () => {
      // If searching, first find shop IDs that match the query in name/city/state/address
      let matchingShopIds: string[] | null = null;
      if (searchQuery) {
        const { data: matchedShops } = await supabase
          .from("shops")
          .select("id")
          .or(
            `name.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,state.ilike.%${searchQuery}%,street_address.ilike.%${searchQuery}%,street_address_line_2.ilike.%${searchQuery}%,zip_code.ilike.%${searchQuery}%`
          );
        matchingShopIds = (matchedShops || []).map((s) => s.id);
      }

      let query = supabase
        .from("invoices")
        .select(`
          *,
          shops (
            name,
            owner_name,
            phone,
            street_address,
            city,
            state,
            zip_code
          )
        `, { count: "exact" });

      // Search filter: invoice number OR any matching shop
      if (searchQuery) {
        const shopIdsList = matchingShopIds && matchingShopIds.length > 0
          ? `(${matchingShopIds.join(",")})`
          : "(00000000-0000-0000-0000-000000000000)";
        query = query.or(
          `invoice_number.ilike.%${searchQuery}%,shop_id.in.${shopIdsList}`
        );
      }

      // Status filter
      if (statusFilter !== "all") {
        query = query.eq("payment_status", statusFilter as "paid" | "partial" | "unpaid");
      }

      // Shop filter
      if (shopFilter !== "all") {
        query = query.eq("shop_id", shopFilter);
      }

      // Date range filter — use local-day boundaries converted to absolute ISO
      // so the user's selected calendar day matches their timezone, not UTC.
      if (dateFrom) {
        const [y, m, d] = dateFrom.split("-").map(Number);
        const fromLocal = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
        query = query.gte("created_at", fromLocal.toISOString());
      }
      if (dateTo) {
        const [y, m, d] = dateTo.split("-").map(Number);
        const toLocal = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
        query = query.lte("created_at", toLocal.toISOString());
      }

      // Sorting
      switch (sortBy) {
        case "date_asc":
          query = query.order("created_at", { ascending: true });
          break;
        case "amount_desc":
          query = query.order("total_amount", { ascending: false });
          break;
        case "amount_asc":
          query = query.order("total_amount", { ascending: true });
          break;
        case "date_desc":
        default:
          query = query.order("created_at", { ascending: false });
          break;
      }

      // Pagination — server-side, avoids downloading thousands of rows at once
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data || [], count: count ?? 0 };
    },
  });

  const invoices = invoiceData?.rows;
  const totalCount = invoiceData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setShopFilter("all");
    setSortBy("date_desc");
    setDateFrom("");
    setDateTo("");
  };

  const handleAddInvoice = () => {
    setEditingInvoice(null);
    setIsDialogOpen(true);
  };

  const handleEditInvoice = (invoice: any) => {
    setEditingInvoice(invoice);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingInvoice(null);
    refetch();
  };

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      await exportInvoicesToExcel();
      toast({
        title: "Success",
        description: "Invoices exported to Excel successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export invoices",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Invoices</h2>
            <p className="text-sm md:text-base text-muted-foreground">Create and manage sales invoices</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={handleExportToExcel}
              disabled={isExporting || !invoices || invoices.length === 0}
              className="w-full sm:w-auto"
            >
              <FileDown className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsOldBalanceDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <History className="mr-2 h-4 w-4" />
              Add Old Balance
            </Button>
            <Button onClick={handleAddInvoice} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </div>
        </div>

        <InvoiceFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          shopFilter={shopFilter}
          onShopChange={setShopFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          shops={shops || []}
          onClearFilters={handleClearFilters}
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading invoices...</p>
          </div>
        ) : (
          <>
            <InvoiceTable
              invoices={invoices || []}
              onEdit={handleEditInvoice}
              isAdmin={canEditAll}
              onRefetch={refetch}
              profiles={profiles || []}
            />

            {totalCount > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}
                  –{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} invoices
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <InvoiceDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          invoice={editingInvoice}
          onSuccess={handleDialogClose}
        />

        <AddOldBalanceDialog
          open={isOldBalanceDialogOpen}
          onOpenChange={setIsOldBalanceDialogOpen}
          onSuccess={refetch}
        />
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
