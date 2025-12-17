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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2, ChevronsUpDown, Check, MapPin, Mail, Loader2, Minus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { generateInvoicePDF } from "@/lib/pdfGenerator";
import { Input } from "@/components/ui/input";
import { ShopForm } from "@/components/shops/ShopForm";
import { cn } from "@/lib/utils";

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
  const queryClient = useQueryClient();
  const [shopId, setShopId] = useState(invoice?.shop_id || "");
  const [notes, setNotes] = useState(invoice?.notes || "");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "partial" | "unpaid">(invoice?.payment_status || "unpaid");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [cashAmount, setCashAmount] = useState("");
  const [checkAmount, setCheckAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState(invoice?.discount_amount?.toString() || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddShopDialog, setShowAddShopDialog] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [useCustomEmail, setUseCustomEmail] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  
  // Quick add product filters
  const [quickAddCategory, setQuickAddCategory] = useState("all");
  const [quickAddSubcategory, setQuickAddSubcategory] = useState("all");
  const [quickAddSubSubcategory, setQuickAddSubSubcategory] = useState("all");
  const getShopLocation = (shop: any) => {
    const parts = [shop.city, shop.state].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

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

  const getQuickFilteredProducts = () => {
    if (!products) return [];
    let filtered = products;
    
    if (quickAddCategory && quickAddCategory !== "all") {
      filtered = filtered.filter(p => p.category === quickAddCategory);
    }
    if (quickAddSubcategory && quickAddSubcategory !== "all") {
      filtered = filtered.filter(p => p.subcategory === quickAddSubcategory);
    }
    if (quickAddSubSubcategory && quickAddSubSubcategory !== "all") {
      filtered = filtered.filter(p => p.sub_subcategory === quickAddSubSubcategory);
    }
    
    return filtered;
  };

  const quickAddProduct = (product: any) => {
    const existingIndex = items.findIndex(item => item.product_id === product.id);
    
    if (existingIndex >= 0) {
      // Product already in cart, increment quantity
      const newItems = [...items];
      newItems[existingIndex].quantity += 1;
      newItems[existingIndex].subtotal = newItems[existingIndex].quantity * newItems[existingIndex].unit_price;
      setItems(newItems);
    } else {
      // Add new product
      const price = Number(product.price) || 0;
      setItems([
        ...items,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: price,
          subtotal: price,
        },
      ]);
    }
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
        const price = Number(product.price) || 0;
        newItems[index].product_name = product.name;
        newItems[index].unit_price = price;
        newItems[index].subtotal = newItems[index].quantity * price;
      }
    }

    if (field === "quantity" || field === "unit_price") {
      newItems[index].subtotal = Number(newItems[index].quantity) * Number(newItems[index].unit_price);
    }

    setItems(newItems);
  };

  const subtotalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = parseFloat(discountAmount) || 0;
  const totalAmount = Math.max(0, subtotalAmount - discount);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isSubmitting) {
        throw new Error("Please wait, invoice is being created");
      }

      setIsSubmitting(true);

      if (!shopId || items.length === 0) {
        throw new Error("Please select a shop and add at least one product");
      }

      // Validate email if sending is enabled
      const selectedShop = shops?.find(s => s.id === shopId);
      if (sendEmail) {
        const emailTo = useCustomEmail || !selectedShop?.email ? customEmail : selectedShop?.email;
        if (!emailTo || !emailTo.includes("@")) {
          throw new Error("Please provide a valid email address to send the invoice");
        }
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

      // Generate invoice number with retry logic
      let invoiceNumber: string | null = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!invoiceNumber && retryCount < maxRetries) {
        const { data, error: rpcError } = await supabase.rpc("generate_invoice_number");
        if (rpcError) {
          console.error("Invoice number generation error:", rpcError);
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          invoiceNumber = data;
        }
      }
      
      if (!invoiceNumber) {
        throw new Error("Failed to generate invoice number. Please try again.");
      }

      // Create invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          shop_id: shopId,
          total_amount: totalAmount,
          discount_amount: discount,
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

      return { invoiceData, invoiceItems };
    },
    onSuccess: async ({ invoiceData, invoiceItems }) => {
      // Send email if enabled
      if (sendEmail) {
        const selectedShop = shops?.find(s => s.id === shopId);
        const emailTo = useCustomEmail || !selectedShop?.email ? customEmail : selectedShop?.email;
        
        if (emailTo && emailTo.includes("@")) {
          try {
            // Calculate payment amounts
            const cash = parseFloat(cashAmount) || 0;
            const check = parseFloat(checkAmount) || 0;
            const totalPaid = cash + check;
            const remainingAmount = totalAmount - totalPaid;

            // Generate PDF
            const doc = generateInvoicePDF(
              {
                invoice_number: invoiceData.invoice_number,
                created_at: invoiceData.created_at,
                total_amount: invoiceData.total_amount,
                discount_amount: discount,
                payment_status: invoiceData.payment_status,
                notes: invoiceData.notes,
                shops: selectedShop || { name: "Unknown" },
                items: invoiceItems.map((item: any) => ({
                  product_name: item.product_name,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  subtotal: item.subtotal,
                })),
                payments: paymentStatus !== "unpaid" ? [
                  ...(cash > 0 ? [{ payment_date: new Date().toISOString(), amount: cash, payment_method: "cash" }] : []),
                  ...(check > 0 ? [{ payment_date: new Date().toISOString(), amount: check, payment_method: "check" }] : []),
                ] : [],
              },
              totalPaid,
              remainingAmount
            );

            // Convert to base64
            const pdfDoc = await doc;
            const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];

            // Send email via edge function
            const { error: emailError } = await supabase.functions.invoke('send-invoice-email', {
              body: {
                to: emailTo,
                invoiceNumber: invoiceData.invoice_number,
                shopName: selectedShop?.name || "Customer",
                totalAmount: Number(invoiceData.total_amount),
                pdfBase64,
              },
            });

            if (emailError) {
              console.error("Email send error:", emailError);
              toast({
                title: "Invoice Created",
                description: `Invoice created but email failed to send: ${emailError.message}`,
                variant: "default",
              });
            } else {
              toast({
                title: "Success",
                description: `Invoice created and sent to ${emailTo}`,
              });
            }
          } catch (emailErr: any) {
            console.error("Email error:", emailErr);
            toast({
              title: "Invoice Created",
              description: "Invoice created but failed to send email",
              variant: "default",
            });
          }
        } else {
          toast({
            title: "Success",
            description: "Invoice created (no valid email to send to)",
          });
        }
      } else {
        toast({
          title: "Success",
          description: "Invoice created successfully",
        });
      }
      
      setIsSubmitting(false);
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
    <form onSubmit={handleSubmit} className="space-y-4 w-full overflow-x-hidden">
      <div className="space-y-4 w-full">
        <div className="space-y-2">
          <Label htmlFor="shop">Shop *</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Popover open={shopOpen} onOpenChange={setShopOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={shopOpen}
                  className="w-full justify-between font-normal h-12"
                >
                  {shopId ? (
                    <div className="flex flex-col items-start text-left overflow-hidden">
                      <span className="truncate w-full">
                        {shops?.find((shop) => shop.id === shopId)?.name}
                      </span>
                      {(() => {
                        const shop = shops?.find((s) => s.id === shopId);
                        const location = shop ? getShopLocation(shop) : null;
                        return location ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {location}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  ) : (
                    "Search or select a shop..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search shops..." />
                  <CommandList>
                    <CommandEmpty>No shop found.</CommandEmpty>
                    <CommandGroup>
                      {shops?.map((shop) => {
                        const location = getShopLocation(shop);
                        return (
                          <CommandItem
                            key={shop.id}
                            value={`${shop.name} ${location || ""}`}
                            onSelect={() => {
                              setShopId(shop.id);
                              setShopOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                shopId === shop.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">{shop.name}</span>
                              {location && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {location}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddShopDialog(true)}
              className="w-full sm:w-auto h-12 shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Shop
            </Button>
          </div>
        </div>

        {shopId && shops && (() => {
          const selectedShop = shops.find(s => s.id === shopId);
          if (!selectedShop) return null;
          
          return (
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="space-y-2">
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

              {/* Email Invoice Section */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="send_email" 
                    checked={sendEmail} 
                    onCheckedChange={(checked) => setSendEmail(checked as boolean)}
                  />
                  <Label htmlFor="send_email" className="flex items-center gap-2 cursor-pointer">
                    <Mail className="h-4 w-4" />
                    Send invoice to customer via email
                  </Label>
                </div>

                {sendEmail && (
                  <div className="ml-6 space-y-3">
                    {selectedShop.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Will send to:</span>
                        <span className="font-medium">{useCustomEmail ? customEmail || "Enter email below" : selectedShop.email}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="use_custom_email" 
                        checked={useCustomEmail || !selectedShop.email} 
                        onCheckedChange={(checked) => setUseCustomEmail(checked as boolean)}
                        disabled={!selectedShop.email}
                      />
                      <Label htmlFor="use_custom_email" className="text-sm cursor-pointer">
                        {selectedShop.email ? "Use a different email address" : "No email on file - enter email below"}
                      </Label>
                    </div>

                    {(useCustomEmail || !selectedShop.email) && (
                      <Input
                        type="email"
                        placeholder="Enter customer email address"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        className="max-w-sm"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <div className="space-y-4">
          <Label>Products *</Label>
          
          {/* Quick Add Product Section - Mobile Friendly */}
          <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select
                value={quickAddCategory}
                onValueChange={(value) => {
                  setQuickAddCategory(value);
                  setQuickAddSubcategory("all");
                  setQuickAddSubSubcategory("all");
                }}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={quickAddSubcategory}
                onValueChange={(value) => {
                  setQuickAddSubcategory(value);
                  setQuickAddSubSubcategory("all");
                }}
                disabled={quickAddCategory === "all"}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Subcategory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subcategories</SelectItem>
                  {getSubcategories(quickAddCategory).map((sub) => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={quickAddSubSubcategory}
                onValueChange={setQuickAddSubSubcategory}
                disabled={quickAddSubcategory === "all"}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Sub-subcategory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {getSubSubcategories(quickAddCategory, quickAddSubcategory).map((subsub) => (
                    <SelectItem key={subsub} value={subsub}>{subsub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Grid - Tap to Add */}
            <div className="max-h-48 overflow-y-auto">
              {getQuickFilteredProducts().length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No products found. Try adjusting filters.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {getQuickFilteredProducts().map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => quickAddProduct(product)}
                      className="p-3 border rounded-lg text-left hover:bg-accent hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <div className="font-medium text-sm truncate">{product.name}</div>
                      <div className="text-xs text-muted-foreground">${Number(product.price).toFixed(2)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Added Items List */}
          {items.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Tap a product above to add it to the invoice
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                {items.length} item{items.length !== 1 ? 's' : ''} added
              </div>
              {items.map((item, index) => (
                <div key={index} className="p-3 border rounded-lg bg-card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{item.product_name}</div>
                      <div className="text-xs text-muted-foreground">${item.unit_price.toFixed(2)} each</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-primary">${item.subtotal.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  {/* Quantity Controls - Full Width on Mobile */}
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      onClick={() => {
                        if (item.quantity > 1) {
                          updateItem(index, "quantity", item.quantity - 1);
                        } else {
                          removeItem(index);
                        }
                      }}
                    >
                      {item.quantity === 1 ? <Trash2 className="h-4 w-4 text-destructive" /> : <Minus className="h-5 w-5" />}
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                      className="h-11 w-16 text-center px-2 font-semibold text-lg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      onClick={() => updateItem(index, "quantity", item.quantity + 1)}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  className="h-12"
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
                  className="h-12"
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

        <div className="space-y-2">
          <Label htmlFor="discount">Discount Amount</Label>
          <Input
            id="discount"
            type="number"
            step="0.01"
            min="0"
            max={subtotalAmount}
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>${subtotalAmount.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between items-center text-sm text-green-600">
              <span>Discount:</span>
              <span>-${discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-lg font-semibold">Total Amount:</span>
            <span className="text-2xl font-bold text-primary">
              ${totalAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending || isSubmitting} className="w-full sm:w-auto">
          {mutation.isPending || isSubmitting ? "Creating..." : "Create Invoice"}
        </Button>
      </div>

      <Dialog open={showAddShopDialog} onOpenChange={setShowAddShopDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
