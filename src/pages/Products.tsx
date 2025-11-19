import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductTable } from "@/components/products/ProductTable";
import { ProductForm } from "@/components/products/ProductForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const Products = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [filterValue, setFilterValue] = useState<string>("all");
  const { user } = useAuth();
  const { toast } = useToast();

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

  const { data: allProducts } = useQuery({
    queryKey: ["allProducts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("category, subcategory")
        .order("category");
      
      if (error) throw error;
      return data;
    },
  });

  // Group subcategories by category
  const categoryGroups = allProducts?.reduce((acc, product) => {
    if (!product.category) return acc;
    
    if (!acc[product.category]) {
      acc[product.category] = new Set();
    }
    
    if (product.subcategory) {
      acc[product.category].add(product.subcategory);
    }
    
    return acc;
  }, {} as Record<string, Set<string>>) || {};

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ["products", filterValue],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterValue !== "all") {
        // Check if it's a category-subcategory combination
        if (filterValue.includes("|")) {
          const [category, subcategory] = filterValue.split("|");
          query = query.eq("category", category).eq("subcategory", subcategory);
        } else {
          // It's just a category
          query = query.eq("category", filterValue);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleAddProduct = () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can add products",
        variant: "destructive",
      });
      return;
    }
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleEditProduct = (product: any) => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can edit products",
        variant: "destructive",
      });
      return;
    }
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
    refetch();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Products</h2>
            <p className="text-muted-foreground">Manage your product catalog</p>
          </div>
          {isAdmin && (
            <Button onClick={handleAddProduct}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Select value={filterValue} onValueChange={setFilterValue}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Filter by category & subcategory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {Object.keys(categoryGroups).sort().map((category) => (
                <div key={category}>
                  <SelectItem value={category} className="font-semibold">
                    {category}
                  </SelectItem>
                  {Array.from(categoryGroups[category]).sort().map((subcategory) => (
                    <SelectItem 
                      key={`${category}|${subcategory}`} 
                      value={`${category}|${subcategory}`}
                      className="pl-8"
                    >
                      ↳ {subcategory}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        ) : (
          <ProductTable
            products={products || []}
            onEdit={handleEditProduct}
            isAdmin={isAdmin}
          />
        )}

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Edit Product" : "Add New Product"}
              </DialogTitle>
            </DialogHeader>
            <ProductForm
              product={editingProduct}
              onSuccess={handleFormSuccess}
              onCancel={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Products;
