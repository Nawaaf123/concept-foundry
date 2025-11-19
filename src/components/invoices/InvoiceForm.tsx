import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

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
}

export const InvoiceForm = ({ invoice, onSuccess, onCancel }: InvoiceFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [shopId, setShopId] = useState(invoice?.shop_id || "");
  const [notes, setNotes] = useState(invoice?.notes || "");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "partial" | "unpaid">(invoice?.payment_status || "unpaid");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [cashAmount, setCashAmount] = useState("");
  const [checkAmount, setCheckAmount] = useState("");

  const { data: shops } = useQuery({
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

  const addItem = () => {
    setItems([
      ...items,
      {
        product_id: "",
        product_name: "",
        quantity: 1,
        unit_price: 0,
        subtotal: 0,
      },
    ]);
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
      toast({
        title: "Success",
        description: "Invoice created successfully",
      });
      onSuccess();
    },
    onError: (error: any) => {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="shop">Shop *</Label>
          <Select value={shopId} onValueChange={setShopId} required>
            <SelectTrigger>
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
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-start p-4 border rounded-lg">
                  <div className="flex-1 grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Product</Label>
                      <Select
                        value={item.product_id}
                        onValueChange={(value) => updateItem(index, "product_id", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((product) => (
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
                    className="mt-6"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating..." : "Create Invoice"}
        </Button>
      </div>
    </form>
  );
};
