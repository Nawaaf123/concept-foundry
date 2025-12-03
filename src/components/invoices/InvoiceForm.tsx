import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ShopForm } from "@/components/shops/ShopForm";

interface InvoiceFormProps {
  invoice?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

interface InvoiceItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  categoryFilter?: string;
  subcategoryFilter?: string;
  subSubcategoryFilter?: string;
  isEditing?: boolean;
}

export const InvoiceForm = ({ invoice, onSuccess, onCancel }: InvoiceFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [shopId, setShopId] = useState(invoice?.shop_id || "");
  const [notes, setNotes] = useState(invoice?.notes || "");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "partial" | "unpaid">(invoice?.payment_status || "unpaid");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [cashAmount, setCashAmount] = useState("");
  const [checkAmount, setCheckAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddShopDialog, setShowAddShopDialog] = useState(false);

  const { data: shops, refetch: refetchShops } = useQuery({
    queryKey: ["shops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shops")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (invoice?.id) {
      // Load invoice items if editing
      supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoice.id)
        .then(({ data }) => {
          if (data) {
            setItems(data);
          }
        });
    }
  }, [invoice]);

  // Get unique categories from products
  const categories = Array.from(
    new Set(products?.map(p => p.category).filter(Boolean) || [])
  );

  const getSubcategories = (category: string) => {
    if (!category || category === "all") return [];
    return Array.from(
      new Set(
        products
          ?.filter(p => p.category === category)
          .map(p => p.subcategory)
          .filter(Boolean) || []
      )
    );
  };

  const getSubSubcategories = (category: string, subcategory: string) => {
    if (!category || category === "all" || !subcategory || subcategory === "all") return [];
    return Array.from(
      new Set(
        products
          ?.filter(p => p.category === category && p.subcategory === subcategory)
          .map(p => p.sub_subcategory)
          .filter(Boolean) || []
      )
    );
  };

  const getFilteredProducts = (item: InvoiceItem) => {
    if (!products) return [];
    let filtered = products;
    
    if (item.categoryFilter && item.categoryFilter !== "all") {
      filtered = filtered.filter(p => p.category === item.categoryFilter);
    }
    if (item.subcategoryFilter && item.subcategoryFilter !== "all") {
      filtered = filtered.filter(p => p.subcategory === item.subcategoryFilter);
    }
    if (item.subSubcategoryFilter && item.subSubcategoryFilter !== "all") {
      filtered = filtered.filter(p => p.sub_subcategory === item.subSubcategoryFilter);
    }
    
    return filtered;
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        product_id: "",
        product_name: "",
        quantity: 1,
        unit_price: 0,
        subtotal: 0,
        categoryFilter: "all",
        subcategoryFilter: "all",
        subSubcategoryFilter: "all",
        isEditing: true,
      },
    ]);
  };

  const toggleEditItem = (index: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], isEditing: !newItems[index].isEditing };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === "product_id" && products) {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].product_name = product.name;
        newItems[index].unit_price = product.price;
        // Recalculate subtotal after setting product price
        newItems[index].subtotal = newItems[index].quantity * product.price;
      }
    }

    if (field === "quantity" || field === "unit_price") {
      newItems[index].subtotal = newItems[index].quantity * newItems[index].unit_price;
    }

    setItems(newItems);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isSubmitting) {
        throw new Error("Please wait, invoice is being created");
      }

      setIsSubmitting(true);

      if (!shopId || items.length === 0) {
        throw new Error("Please select a shop and add at least one product");
      }

      // Validate payment amounts if paid or partial
      if (paymentStatus === "paid" || paymentStatus === "partial") {
        const cash = parseFloat(cashAmount) || 0;
        const check = parseFloat(checkAmount) || 0;
        const totalPayment = cash + check;

        if (totalPayment === 0) {
          throw new Error("Please enter payment amounts for cash and/or check");
        }

        // Use tolerance-based comparison to handle floating-point precision issues
        const tolerance = 0.01;
        const difference = Math.abs(totalPayment - totalAmount);

        if (paymentStatus === "paid" && difference > tolerance) {
          throw new Error(`For paid status, total payment ($${totalPayment.toFixed(2)}) must equal invoice total ($${totalAmount.toFixed(2)})`);
        }

        if (paymentStatus === "partial" && totalPayment > totalAmount + tolerance) {
          throw new Error(`Payment amount ($${totalPayment.toFixed(2)}) cannot exceed invoice total ($${totalAmount.toFixed(2)})`);
        }
      }

      // Generate invoice number
      const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");

      // Create invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          shop_id: shopId,
          total_amount: totalAmount,
          payment_status: paymentStatus,
          notes: notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const invoiceItems = items.map((item) => ({
        invoice_id: invoiceData.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      // Create payment records if paid or partial
      if (paymentStatus === "paid" || paymentStatus === "partial") {
        const cash = parseFloat(cashAmount) || 0;
        const check = parseFloat(checkAmount) || 0;

        const paymentRecords = [];
        
        if (cash > 0) {
          paymentRecords.push({
            invoice_id: invoiceData.id,
            amount: cash,
            payment_method: "cash" as const,
            created_by: user?.id,
          });
        }

        if (check > 0) {
          paymentRecords.push({
            invoice_id: invoiceData.id,
            amount: check,
            payment_method: "check" as const,
            created_by: user?.id,
          });
        }

        if (paymentRecords.length > 0) {
          const { error: paymentsError } = await supabase
            .from("payments")
            .insert(paymentRecords);

          if (paymentsError) throw paymentsError;
        }
      }

      // Update product stock
      for (const item of items) {
        const product = products?.find(p => p.id === item.product_id);
        if (product) {
          const { error: stockError } = await supabase
            .from("products")
            .update({ 
              stock_quantity: product.stock_quantity - item.quantity 
            })
            .eq("id", item.product_id);
          if (stockError) console.error("Stock update error:", stockError);
        }
      }

      return invoiceData;
    },
    onSuccess: () => {
      setIsSubmitting(false);
      toast({
        title: "Success",
        description: "Invoice created successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const handleShopCreated = async () => {
    setShowAddShopDialog(false);
    const result = await refetchShops();
    // Select the newly created shop (last one added, sorted by name so we need to find it)
    if (result.data && result.data.length > 0) {
      // Get the most recently created shop
      const newestShop = result.data.reduce((latest, shop) => 
        new Date(shop.created_at) > new Date(latest.created_at) ? shop : latest
      );
      setShopId(newestShop.id);
    }
    queryClient.invalidateQueries({ queryKey: ["shops"] });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="shop">Shop *</Label>
          <div className="flex gap-2">
            <Select value={shopId} onValueChange={setShopId} required>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a shop" />
              </SelectTrigger>
              <SelectContent>
                {shops?.map((shop) => (
                  <SelectItem key={shop.id} value={shop.id}>
                    {shop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddShopDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Shop
            </Button>
          </div>
        </div>

        {shopId && shops && (() => {
          const selectedShop = shops.find(s => s.id === shopId);
          if (!selectedShop) return null;
          
          return (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h3 className="font-semibold text-sm">Customer Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedShop.owner_name && (
                  <div>
                    <span className="text-muted-foreground">Owner:</span>{" "}
                    <span className="font-medium">{selectedShop.owner_name}</span>
                  </div>
                )}
                {selectedShop.phone && (
                  <div>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    <span className="font-medium">{selectedShop.phone}</span>
                  </div>
                )}
                {selectedShop.email && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <span className="font-medium">{selectedShop.email}</span>
                  </div>
                )}
                {(selectedShop.street_address || selectedShop.city || selectedShop.state) && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Location:</span>{" "}
                    <span className="font-medium">
                      {[
                        selectedShop.street_address,
                        selectedShop.street_address_line_2,
                        selectedShop.city,
                        selectedShop.state,
                        selectedShop.zip_code
                      ].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Products *</Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              No products added. Click "Add Product" to start.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="border rounded-lg">
                  {/* Compact View - when product is selected and not editing */}
                  {item.product_id && !item.isEditing ? (
                    <div className="flex items-center justify-between p-3 gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{item.product_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.quantity} × ${item.unit_price.toFixed(2)}
                        </span>
                      </div>
                      <div className="font-semibold text-primary whitespace-nowrap">
                        ${item.subtotal.toFixed(2)}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleEditItem(index)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Full Edit View - when adding or editing */
                    <div className="p-4 space-y-3">
                      {/* Category Filters */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Category</Label>
                          <Select
                            value={item.categoryFilter || "all"}
                            onValueChange={(value) => {
                              const newItems = [...items];
                              newItems[index] = {
                                ...newItems[index],
                                categoryFilter: value,
                                subcategoryFilter: "all",
                                subSubcategoryFilter: "all",
                                product_id: "",
                                product_name: "",
                                unit_price: 0,
                                subtotal: 0,
                              };
                              setItems(newItems);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Subcategory</Label>
                          <Select
                            value={item.subcategoryFilter || "all"}
                            onValueChange={(value) => {
                              const newItems = [...items];
                              newItems[index] = {
                                ...newItems[index],
                                subcategoryFilter: value,
                                subSubcategoryFilter: "all",
                                product_id: "",
                                product_name: "",
                                unit_price: 0,
                                subtotal: 0,
                              };
                              setItems(newItems);
                            }}
                            disabled={!item.categoryFilter || item.categoryFilter === "all"}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All subcategories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Subcategories</SelectItem>
                              {getSubcategories(item.categoryFilter || "").map((sub) => (
                                <SelectItem key={sub} value={sub}>
                                  {sub}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Sub-subcategory</Label>
                          <Select
                            value={item.subSubcategoryFilter || "all"}
                            onValueChange={(value) => {
                              const newItems = [...items];
                              newItems[index] = {
                                ...newItems[index],
                                subSubcategoryFilter: value,
                                product_id: "",
                                product_name: "",
                                unit_price: 0,
                                subtotal: 0,
                              };
                              setItems(newItems);
                            }}
                            disabled={!item.subcategoryFilter || item.subcategoryFilter === "all"}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              {getSubSubcategories(item.categoryFilter || "", item.subcategoryFilter || "").map((subsub) => (
                                <SelectItem key={subsub} value={subsub}>
                                  {subsub}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Product Selection and Quantity */}
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="col-span-2">
                            <Label className="text-xs">Product</Label>
                            <Select
                              value={item.product_id}
                              onValueChange={(value) => {
                                updateItem(index, "product_id", value);
                                // Auto-collapse after selecting product
                                setTimeout(() => {
                                  const newItems = [...items];
                                  newItems[index] = { ...newItems[index], isEditing: false };
                                  setItems(newItems);
                                }, 100);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {getFilteredProducts(item).map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name} - ${product.price}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(index, "quantity", parseInt(e.target.value) || 1)
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Subtotal</Label>
                            <Input value={`$${item.subtotal.toFixed(2)}`} disabled />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="self-end sm:self-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_status">Initial Payment Status *</Label>
          <Select 
            value={paymentStatus} 
            onValueChange={(value: "paid" | "partial" | "unpaid") => {
              setPaymentStatus(value);
              // Reset payment amounts when changing status
              if (value === "unpaid") {
                setCashAmount("");
                setCheckAmount("");
              }
            }} 
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Paid - Full payment received</SelectItem>
              <SelectItem value="partial">Partial - Some payment received</SelectItem>
              <SelectItem value="unpaid">Unpaid - No payment received</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(paymentStatus === "paid" || paymentStatus === "partial") && (
          <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Payment Details</Label>
              {paymentStatus === "paid" && (
                <span className="text-sm text-muted-foreground">
                  Must equal ${totalAmount.toFixed(2)}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cash_amount">Cash Amount</Label>
                <Input
                  id="cash_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="check_amount">Check Amount</Label>
                <Input
                  id="check_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={checkAmount}
                  onChange={(e) => setCheckAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm font-medium">Total Payment:</span>
              <span className="text-lg font-bold text-primary">
                ${((parseFloat(cashAmount) || 0) + (parseFloat(checkAmount) || 0)).toFixed(2)}
              </span>
            </div>

            {paymentStatus === "partial" && (
              <p className="text-xs text-muted-foreground">
                Remaining balance: ${(totalAmount - ((parseFloat(cashAmount) || 0) + (parseFloat(checkAmount) || 0))).toFixed(2)}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Additional notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
          <span className="text-lg font-semibold">Total Amount:</span>
          <span className="text-2xl font-bold text-primary">
            ${totalAmount.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending || isSubmitting}>
          {mutation.isPending || isSubmitting ? "Creating..." : "Create Invoice"}
        </Button>
      </div>

      <Dialog open={showAddShopDialog} onOpenChange={setShowAddShopDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Shop</DialogTitle>
          </DialogHeader>
          <ShopForm
            onSuccess={handleShopCreated}
            onCancel={() => setShowAddShopDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </form>
  );
};
