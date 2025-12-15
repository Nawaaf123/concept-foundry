import { useState } from "react";
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
  const { user } = useAuth();
  const { toast } = useToast();

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

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ["invoices", searchQuery, statusFilter, shopFilter, sortBy, dateFrom, dateTo],
    queryFn: async () => {
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
        `);

      // Search filter
      if (searchQuery) {
        query = query.or(`invoice_number.ilike.%${searchQuery}%,shops.name.ilike.%${searchQuery}%`);
      }

      // Status filter
      if (statusFilter !== "all") {
        query = query.eq("payment_status", statusFilter as "paid" | "partial" | "unpaid");
      }

      // Shop filter
      if (shopFilter !== "all") {
        query = query.eq("shop_id", shopFilter);
      }

      // Date range filter
      if (dateFrom) {
        query = query.gte("created_at", `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte("created_at", `${dateTo}T23:59:59.999`);
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

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

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
          <InvoiceTable
            invoices={invoices || []}
            onEdit={handleEditInvoice}
            isAdmin={isAdmin}
            onRefetch={refetch}
            profiles={profiles || []}
          />
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
