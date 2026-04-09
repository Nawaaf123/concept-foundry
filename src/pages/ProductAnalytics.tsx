import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const ProductAnalytics = () => {
  const { data: salesByCategory, isLoading: loadingCategories } = useQuery({
    queryKey: ["salesByCategory"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_by_category");
      if (error) throw error;

      const categoryMap = new Map<string, { total: number; products: { name: string; quantity: number }[] }>();

      (data as { category: string; product_name: string; total_quantity: number }[]).forEach((item) => {
        if (!categoryMap.has(item.category)) {
          categoryMap.set(item.category, { total: 0, products: [] });
        }
        const catData = categoryMap.get(item.category)!;
        catData.total += item.total_quantity;
        catData.products.push({ name: item.product_name, quantity: item.total_quantity });
      });

      return Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        totalSold: data.total,
        products: data.products,
      }));
    },
  });

  const { data: inventoryStatus } = useQuery({
    queryKey: ["inventoryStatus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("stock_quantity", { ascending: true });
      if (error) throw error;
      return data.filter(product => product.stock_quantity <= product.low_stock_threshold);
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Product Analytics</h2>
          <p className="text-sm md:text-base text-muted-foreground">Sales and inventory insights</p>
        </div>

        <div className="grid gap-4 md:gap-6">
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle>Sales by Category</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
              {loadingCategories ? (
                <p className="text-muted-foreground">Loading sales data...</p>
              ) : !salesByCategory || salesByCategory.length === 0 ? (
                <p className="text-muted-foreground">No sales data available</p>
              ) : (
                <div className="space-y-6">
                  {salesByCategory.map((cat) => (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h3 className="text-base md:text-lg font-semibold">{cat.category}</h3>
                        <Badge variant="secondary">Total Sold: {cat.totalSold}</Badge>
                      </div>
                      <div className="md:hidden space-y-2">
                        {cat.products.map((product) => (
                          <div key={product.name} className="flex justify-between items-center p-2 bg-muted rounded">
                            <span className="text-sm truncate flex-1">{product.name}</span>
                            <span className="font-medium ml-2">{product.quantity}</span>
                          </div>
                        ))}
                      </div>
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-right">Quantity Sold</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cat.products.map((product) => (
                              <TableRow key={product.name}>
                                <TableCell>{product.name}</TableCell>
                                <TableCell className="text-right font-medium">{product.quantity}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle>Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
              {!inventoryStatus || inventoryStatus.length === 0 ? (
                <p className="text-muted-foreground">No low stock items</p>
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {inventoryStatus.map((product) => (
                      <div key={product.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">{product.category}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-destructive font-semibold">{product.stock_quantity}</span>
                            <span className="text-muted-foreground"> / {product.low_stock_threshold}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Current Stock</TableHead>
                          <TableHead className="text-right">Threshold</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventoryStatus.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell className="text-right">
                              <span className="text-destructive font-semibold">{product.stock_quantity}</span>
                            </TableCell>
                            <TableCell className="text-right">{product.low_stock_threshold}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProductAnalytics;
