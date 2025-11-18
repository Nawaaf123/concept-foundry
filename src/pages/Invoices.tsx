import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { InvoiceDialog } from "@/components/invoices/InvoiceDialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

const Invoices = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { user } = useAuth();

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

  const isAdmin = userRole === "admin";

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ["invoices", searchQuery, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select(`
          *,
          shops (
            name,
            owner_name,
            phone
          )
        `)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`invoice_number.ilike.%${searchQuery}%,shops.name.ilike.%${searchQuery}%`);
      }

      if (statusFilter !== "all") {
        query = query.eq("payment_status", statusFilter as "paid" | "partial" | "unpaid");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
            <p className="text-muted-foreground">Create and manage sales invoices</p>
          </div>
          <Button onClick={handleAddInvoice}>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <Input
            placeholder="Search by invoice # or shop name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
          />
        )}

        <InvoiceDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          invoice={editingInvoice}
          onSuccess={handleDialogClose}
        />
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
