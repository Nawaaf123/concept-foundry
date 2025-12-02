import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ShopTable } from "@/components/shops/ShopTable";
import { ShopForm } from "@/components/shops/ShopForm";
import { BulkUploadDialog } from "@/components/shops/BulkUploadDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

const Shops = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
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

  const { data: shops, isLoading, refetch } = useQuery({
    queryKey: ["shops", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("shops")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,owner_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleAddShop = () => {
    setEditingShop(null);
    setIsFormOpen(true);
  };

  const handleEditShop = (shop: any) => {
    setEditingShop(shop);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingShop(null);
    refetch();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Shops</h2>
            <p className="text-sm md:text-base text-muted-foreground">Manage customer shops</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)} className="flex-1 sm:flex-none">
              <Upload className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Bulk </span>Upload
            </Button>
            <Button onClick={handleAddShop} className="flex-1 sm:flex-none">
              <Plus className="mr-2 h-4 w-4" />
              Add Shop
            </Button>
          </div>
        </div>

        <div>
          <Input
            placeholder="Search shops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-sm"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading shops...</p>
          </div>
        ) : (
          <ShopTable
            shops={shops || []}
            onEdit={handleEditShop}
            isAdmin={isAdmin}
            onRefetch={refetch}
          />
        )}

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingShop ? "Edit Shop" : "Add New Shop"}
              </DialogTitle>
            </DialogHeader>
            <ShopForm
              shop={editingShop}
              onSuccess={handleFormSuccess}
              onCancel={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <BulkUploadDialog
          open={isBulkUploadOpen}
          onOpenChange={setIsBulkUploadOpen}
          onSuccess={refetch}
        />
      </div>
    </DashboardLayout>
  );
};

export default Shops;
