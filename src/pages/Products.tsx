import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductTable } from "@/components/products/ProductTable";
import { ProductForm } from "@/components/products/ProductForm";
import { QuickAddProduct } from "@/components/products/QuickAddProduct";
import { BulkProductUploadDialog } from "@/components/products/BulkProductUploadDialog";
import { AddCategoryDialog } from "@/components/products/AddCategoryDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const Products = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("all");
  const [subSubcategoryFilter, setSubSubcategoryFilter] = useState<string>("all");
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

  const { data: allProducts, refetch: refetchAllProducts } = useQuery({
    queryKey: ["allProducts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("category, subcategory, sub_subcategory")
        .order("category");
      
      if (error) throw error;
      return data;
    },
  });

  const categories = Array.from(
    new Set(allProducts?.map(p => p.category).filter(Boolean) || [])
  );

  // Build subcategories map for AddCategoryDialog
  const subcategoriesMap: Record<string, string[]> = {};
  categories.forEach(cat => {
    subcategoriesMap[cat] = Array.from(
      new Set(
        allProducts
          ?.filter(p => p.category === cat)
          .map(p => p.subcategory)
          .filter(Boolean) || []
      )
    );
  });

  // Get subcategories filtered by selected category
  const subcategories = categoryFilter === "all"
    ? []
    : Array.from(
        new Set(
          allProducts
            ?.filter(p => p.category === categoryFilter)
            .map(p => p.subcategory)
            .filter(Boolean) || []
        )
      );

  // Get sub-subcategories filtered by selected subcategory
  const subSubcategories = subcategoryFilter === "all"
    ? []
    : Array.from(
        new Set(
          allProducts
            ?.filter(p => p.category === categoryFilter && p.subcategory === subcategoryFilter)
            .map(p => p.sub_subcategory)
            .filter(Boolean) || []
        )
      );

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setSubcategoryFilter("all");
    setSubSubcategoryFilter("all");
  };

  const handleSubcategoryChange = (value: string) => {
    setSubcategoryFilter(value);
    setSubSubcategoryFilter("all");
  };

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ["products", categoryFilter, subcategoryFilter, subSubcategoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      if (subcategoryFilter !== "all") {
        query = query.eq("subcategory", subcategoryFilter);
      }

      if (subSubcategoryFilter !== "all") {
        query = query.eq("sub_subcategory", subSubcategoryFilter);
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
    // Pre-fill with current filter selections
    const prefillData = {
      category: categoryFilter !== "all" ? categoryFilter : "",
      subcategory: subcategoryFilter !== "all" ? subcategoryFilter : "",
      sub_subcategory: subSubcategoryFilter !== "all" ? subSubcategoryFilter : "",
    };
    setEditingProduct(prefillData);
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
    refetchAllProducts();
  };

  const handleDeleteCategory = async () => {
    if (!isAdmin || categoryFilter === "all") return;

    try {
      // Determine what level we're deleting
      if (subSubcategoryFilter !== "all") {
        // Delete sub-subcategory: set sub_subcategory to null for matching products
        await supabase
          .from("products")
          .update({ sub_subcategory: null })
          .eq("category", categoryFilter)
          .eq("subcategory", subcategoryFilter)
          .eq("sub_subcategory", subSubcategoryFilter);
        
        toast({
          title: "Sub-subcategory removed",
          description: `"${subSubcategoryFilter}" has been removed from all products`,
        });
        setSubSubcategoryFilter("all");
      } else if (subcategoryFilter !== "all") {
        // Delete subcategory: set subcategory and sub_subcategory to null
        await supabase
          .from("products")
          .update({ subcategory: null, sub_subcategory: null })
          .eq("category", categoryFilter)
          .eq("subcategory", subcategoryFilter);
        
        toast({
          title: "Subcategory removed",
          description: `"${subcategoryFilter}" has been removed from all products`,
        });
        setSubcategoryFilter("all");
      } else {
        // Delete category: set category, subcategory, and sub_subcategory to null
        await supabase
          .from("products")
          .update({ category: "Uncategorized", subcategory: null, sub_subcategory: null })
          .eq("category", categoryFilter);
        
        toast({
          title: "Category removed",
          description: `"${categoryFilter}" has been removed. Products moved to Uncategorized.`,
        });
        setCategoryFilter("all");
      }
      
      refetch();
      refetchAllProducts();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  const getDeleteLabel = () => {
    if (subSubcategoryFilter !== "all") return subSubcategoryFilter;
    if (subcategoryFilter !== "all") return subcategoryFilter;
    if (categoryFilter !== "all") return categoryFilter;
    return "";
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Products</h2>
            <p className="text-sm md:text-base text-muted-foreground">Manage your product catalog</p>
          </div>
          {isAdmin && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <AddCategoryDialog categories={categories} subcategoriesMap={subcategoriesMap} />
              <BulkProductUploadDialog
                categoryFilter={categoryFilter}
                subcategoryFilter={subcategoryFilter}
                subSubcategoryFilter={subSubcategoryFilter}
              />
              <Button onClick={handleAddProduct} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                {categoryFilter !== "all" 
                  ? `Add to ${subSubcategoryFilter !== "all" ? subSubcategoryFilter : subcategoryFilter !== "all" ? subcategoryFilter : categoryFilter}`
                  : "Add Product"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Select value={categoryFilter} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={subcategoryFilter} 
            onValueChange={handleSubcategoryChange}
            disabled={categoryFilter === "all"}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select subcategory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subcategories</SelectItem>
              {subcategories?.map((subcategory) => (
                <SelectItem key={subcategory} value={subcategory}>
                  {subcategory}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={subSubcategoryFilter} 
            onValueChange={setSubSubcategoryFilter}
            disabled={subcategoryFilter === "all"}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select sub-subcategory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sub-subcategories</SelectItem>
              {subSubcategories?.map((subSubcategory) => (
                <SelectItem key={subSubcategory} value={subSubcategory}>
                  {subSubcategory}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && categoryFilter !== "all" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" className="shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{getDeleteLabel()}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the {subSubcategoryFilter !== "all" ? "sub-subcategory" : subcategoryFilter !== "all" ? "subcategory" : "category"} from all products. The products will remain but without this categorization.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteCategory}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {isAdmin && (
          <QuickAddProduct
            categoryFilter={categoryFilter}
            subcategoryFilter={subcategoryFilter}
            subSubcategoryFilter={subSubcategoryFilter}
          />
        )}

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
                {editingProduct?.id ? "Edit Product" : "Add New Product"}
              </DialogTitle>
            </DialogHeader>
            <ProductForm
              product={editingProduct?.id ? editingProduct : null}
              prefillCategories={!editingProduct?.id ? editingProduct : null}
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
