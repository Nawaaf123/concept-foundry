import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Eye, ShoppingCart, UserCheck } from "lucide-react";
import { format } from "date-fns";

type OrderRow = {
  id: string;
  status: string;
  total_amount: number;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  invoice_id: string | null;
  shop: { id: string; name: string; city: string | null; phone: string | null } | null;
  items: { id: string; product_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number }[];
};

type SignupRequest = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  requested_shop_name: string;
  message: string | null;
  status: string;
  created_at: string;
};

const Orders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [viewOrder, setViewOrder] = useState<OrderRow | null>(null);
  const [approveWarehouse, setApproveWarehouse] = useState<"A" | "B">("A");
  const [reviewSignup, setReviewSignup] = useState<SignupRequest | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string>("");

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["orders-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, status, total_amount, notes, admin_notes, created_at, invoice_id,
          shop:shops(id, name, city, phone),
          items:order_items(id, product_id, product_name, quantity, unit_price, subtotal)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const { data: signupRequests = [] } = useQuery({
    queryKey: ["retailer-signup-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_signup_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SignupRequest[];
    },
  });

  const { data: shops = [] } = useQuery({
    queryKey: ["shops-for-link"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shops")
        .select("id, name, city, retailer_user_id")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Approve order → convert to invoice
  const approveOrder = useMutation({
    mutationFn: async (order: OrderRow) => {
      if (!order.shop || !user) throw new Error("Missing shop or user");

      // Generate invoice number
      const { data: invNum, error: numErr } = await supabase.rpc("generate_invoice_number");
      if (numErr) throw numErr;

      // Insert invoice
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .insert({
          shop_id: order.shop.id,
          invoice_number: invNum as string,
          total_amount: order.total_amount,
          payment_status: "unpaid",
          created_by: user.id,
          notes: order.notes ?? `Converted from order ${order.id.slice(0, 8)}`,
        })
        .select()
        .single();
      if (invErr) throw invErr;

      // Insert items
      const items = order.items.map((it) => ({
        invoice_id: invoice.id,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        subtotal: it.subtotal,
      }));
      const { error: itemsErr } = await supabase.from("invoice_items").insert(items);
      if (itemsErr) throw itemsErr;

      // Deduct stock
      for (const it of order.items) {
        await supabase.rpc("update_product_stock", { p_product_id: it.product_id, p_quantity: -it.quantity });
      }

      // Mark order converted
      const { error: updErr } = await supabase
        .from("orders")
        .update({
          status: "converted",
          invoice_id: invoice.id,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast({ title: "Order approved", description: "Invoice created and stock updated." });
      qc.invalidateQueries({ queryKey: ["orders-admin"] });
      setViewOrder(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "rejected", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Order rejected" });
      qc.invalidateQueries({ queryKey: ["orders-admin"] });
      setViewOrder(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveSignup = useMutation({
    mutationFn: async ({ requestId, shopId }: { requestId: string; shopId: string }) => {
      const { error } = await supabase.rpc("approve_retailer_signup", {
        p_request_id: requestId,
        p_shop_id: shopId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Retailer approved", description: "They can now log in and place orders." });
      qc.invalidateQueries({ queryKey: ["retailer-signup-requests"] });
      setReviewSignup(null);
      setSelectedShopId("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectSignup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("retailer_signup_requests")
        .update({ status: "rejected", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Request rejected" });
      qc.invalidateQueries({ queryKey: ["retailer-signup-requests"] });
      setReviewSignup(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      converted: "default",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] ?? "outline"}>{status}</Badge>;
  };

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const pendingSignups = signupRequests.filter((r) => r.status === "pending");
  const availableShops = shops.filter((s) => !s.retailer_user_id);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Retailer Orders</h1>
          <p className="text-muted-foreground">Review orders and signup requests from your retailer app</p>
        </div>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Orders {pendingOrders.length > 0 && <Badge variant="secondary" className="ml-1">{pendingOrders.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="signups" className="gap-2">
              <UserCheck className="h-4 w-4" />
              Signup Requests {pendingSignups.length > 0 && <Badge variant="secondary" className="ml-1">{pendingSignups.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>All Orders</CardTitle>
                <CardDescription>Approve to convert to an invoice and deduct stock</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingOrders ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : orders.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No orders yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Shop</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="text-sm">{format(new Date(o.created_at), "MMM d, yyyy")}</TableCell>
                            <TableCell>
                              <div className="font-medium">{o.shop?.name ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">{o.shop?.city}</div>
                            </TableCell>
                            <TableCell>{o.items.length}</TableCell>
                            <TableCell className="font-medium">${o.total_amount.toFixed(2)}</TableCell>
                            <TableCell>{statusBadge(o.status)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => setViewOrder(o)}>
                                <Eye className="h-4 w-4 mr-1" /> View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signups">
            <Card>
              <CardHeader>
                <CardTitle>Retailer Signup Requests</CardTitle>
                <CardDescription>Approve requests by linking them to an existing shop</CardDescription>
              </CardHeader>
              <CardContent>
                {signupRequests.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No requests yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Requested Shop</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {signupRequests.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-sm">{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                            <TableCell className="font-medium">{r.full_name}</TableCell>
                            <TableCell className="text-sm">{r.email}</TableCell>
                            <TableCell>{r.requested_shop_name}</TableCell>
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => setReviewSignup(r)}>
                                <Eye className="h-4 w-4 mr-1" /> Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Order detail dialog */}
        <Dialog open={!!viewOrder} onOpenChange={(o) => !o && setViewOrder(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
              <DialogDescription>
                {viewOrder?.shop?.name} • {viewOrder && format(new Date(viewOrder.created_at), "PPP")}
              </DialogDescription>
            </DialogHeader>
            {viewOrder && (
              <div className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewOrder.items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell>{it.product_name}</TableCell>
                          <TableCell className="text-right">{it.quantity}</TableCell>
                          <TableCell className="text-right">${it.unit_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right">${it.subtotal.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total</span>
                  <span>${viewOrder.total_amount.toFixed(2)}</span>
                </div>
                {viewOrder.notes && (
                  <div className="text-sm">
                    <span className="font-medium">Note from retailer: </span>
                    <span className="text-muted-foreground">{viewOrder.notes}</span>
                  </div>
                )}
              </div>
            )}
            {viewOrder?.status === "pending" && (
              <DialogFooter className="gap-2">
                <Button variant="destructive" onClick={() => rejectOrder.mutate(viewOrder.id)} disabled={rejectOrder.isPending}>
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button onClick={() => approveOrder.mutate(viewOrder)} disabled={approveOrder.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {approveOrder.isPending ? "Approving..." : "Approve & Create Invoice"}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Signup review dialog */}
        <Dialog open={!!reviewSignup} onOpenChange={(o) => !o && setReviewSignup(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Retailer Request</DialogTitle>
              <DialogDescription>Link this retailer to one of your existing shops</DialogDescription>
            </DialogHeader>
            {reviewSignup && (
              <div className="space-y-3 text-sm">
                <div><span className="font-medium">Name:</span> {reviewSignup.full_name}</div>
                <div><span className="font-medium">Email:</span> {reviewSignup.email}</div>
                {reviewSignup.phone && <div><span className="font-medium">Phone:</span> {reviewSignup.phone}</div>}
                <div><span className="font-medium">Requested shop:</span> {reviewSignup.requested_shop_name}</div>
                {reviewSignup.message && (
                  <div className="pt-2"><span className="font-medium">Message:</span> <span className="text-muted-foreground">{reviewSignup.message}</span></div>
                )}
                {reviewSignup.status === "pending" && (
                  <div className="pt-3 space-y-2">
                    <Label>Link to shop</Label>
                    <Select value={selectedShopId} onValueChange={setSelectedShopId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an unlinked shop..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableShops.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">No unlinked shops available</div>
                        ) : (
                          availableShops.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} {s.city ? `— ${s.city}` : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The retailer must have created an account in the retailer app first. If their user ID is missing, ask them to sign up first.
                    </p>
                  </div>
                )}
              </div>
            )}
            {reviewSignup?.status === "pending" && (
              <DialogFooter className="gap-2">
                <Button variant="destructive" onClick={() => rejectSignup.mutate(reviewSignup.id)} disabled={rejectSignup.isPending}>
                  Reject
                </Button>
                <Button
                  onClick={() => approveSignup.mutate({ requestId: reviewSignup.id, shopId: selectedShopId })}
                  disabled={!selectedShopId || !reviewSignup.user_id || approveSignup.isPending}
                >
                  {approveSignup.isPending ? "Approving..." : "Approve & Link"}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Orders;
