import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const ProductAnalytics = () => {
  const { data: salesByCategory, isLoading: loadingCategories } = useQuery({
    queryKey: ["salesByCategory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select(`
          quantity,
          product_name,
          products!inner(category)
        `);

      if (error) throw error;

      const categoryMap = new Map<string, { total: number; products: Map<string, number> }>();

      data.forEach((item: any) => {
        const category = item.products.category;
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { total: 0, products: new Map() });
        }

        const catData = categoryMap.get(category)!;
        catData.total += item.quantity;

        const currentQty = catData.products.get(item.product_name) || 0;
        catData.products.set(item.product_name, currentQty + item.quantity);
      });

      return Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        totalSold: data.total,
        products: Array.from(data.products.entries()).map(([name, qty]) => ({
          name,
          quantity: qty,
        })),
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
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Product Analytics</h2>
          <p className="text-muted-foreground">Sales and inventory insights</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCategories ? (
                <p className="text-muted-foreground">Loading sales data...</p>
              ) : !salesByCategory || salesByCategory.length === 0 ? (
                <p className="text-muted-foreground">No sales data available</p>
              ) : (
                <div className="space-y-6">
                  {salesByCategory.map((cat) => (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">{cat.category}</h3>
                        <Badge variant="secondary">
                          Total Sold: {cat.totalSold}
                        </Badge>
                      </div>
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
                              <TableCell className="text-right font-medium">
                                {product.quantity}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {!inventoryStatus || inventoryStatus.length === 0 ? (
                <p className="text-muted-foreground">No low stock items</p>
              ) : (
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
                          <span className="text-destructive font-semibold">
                            {product.stock_quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {product.low_stock_threshold}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProductAnalytics;
