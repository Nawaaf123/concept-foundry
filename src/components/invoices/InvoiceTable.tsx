import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Edit, DollarSign, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PaymentDialog } from "./PaymentDialog";
import { generateInvoicePDF, saveInvoicePDF } from "@/lib/pdfGenerator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InvoiceTableProps {
  invoices: any[];
  onEdit: (invoice: any) => void;
  isAdmin: boolean;
  onRefetch: () => void;
}

export const InvoiceTable = ({ invoices, onEdit, isAdmin, onRefetch }: InvoiceTableProps) => {
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all payments for all invoices to calculate pending amounts
  const { data: allPayments } = useQuery({
    queryKey: ["all-invoice-payments", invoices.map(inv => inv.id)],
    queryFn: async () => {
      if (!invoices || invoices.length === 0) return [];
      const invoiceIds = invoices.map(inv => inv.id);
      const { data, error } = await supabase
        .from("payments")
        .select("invoice_id, amount")
        .in("invoice_id", invoiceIds);
      if (error) throw error;
      return data || [];
    },
    enabled: invoices && invoices.length > 0,
  });

  // Calculate pending amount for an invoice
  const getPendingAmount = (invoiceId: string, totalAmount: number) => {
    const invoicePayments = allPayments?.filter(p => p.invoice_id === invoiceId) || [];
    const totalPaid = invoicePayments.reduce((sum, p) => sum + Number(p.amount), 0);
    return totalAmount - totalPaid;
  };

  const { data: payments } = useQuery({
    queryKey: ["payments", selectedInvoice?.id],
    queryFn: async () => {
      if (!selectedInvoice?.id) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", selectedInvoice.id)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedInvoice?.id && viewDialogOpen,
  });

  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const remainingAmount = selectedInvoice ? Number(selectedInvoice.total_amount) - totalPaid : 0;

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "paid" | "partial" | "unpaid" }) => {
      const { error } = await supabase
        .from("invoices")
        .update({ payment_status: status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: "Success",
        description: "Payment status updated successfully",
      });
      setPaymentDialogOpen(false);
      onRefetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update payment status",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });
      setDeleteDialogOpen(false);
      setSelectedInvoice(null);
      onRefetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      });
    },
  });

  const handleViewInvoice = async (invoice: any) => {
    const { data: items } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoice.id);

    setSelectedInvoice({ ...invoice, items });
    setViewDialogOpen(true);
  };

  const handleRecordPayment = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentDialogOpen(true);
  };

  const handleUpdateStatus = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentStatus(invoice.payment_status);
    setStatusDialogOpen(true);
  };

  const handleExportPDF = async (invoice: any) => {
    try {
      // Fetch invoice items
      const { data: items } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoice.id);

      // Fetch payments
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("payment_date", { ascending: false });

      const totalPaid = paymentsData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const remainingAmount = Number(invoice.total_amount) - totalPaid;

      saveInvoicePDF(
        {
          ...invoice,
          items: items || [],
          payments: paymentsData || [],
        },
        totalPaid,
        remainingAmount
      );

      toast({
        title: "Success",
        description: "Invoice PDF downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      paid: "default",
      partial: "secondary",
      unpaid: "destructive",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No invoices found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first invoice to get started
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Shop</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const pendingAmount = getPendingAmount(invoice.id, Number(invoice.total_amount));
              return (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                <TableCell>{invoice.shops?.name}</TableCell>
                <TableCell>
                  {new Date(invoice.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-semibold">
                  ${parseFloat(invoice.total_amount).toFixed(2)}
                </TableCell>
                <TableCell>
                  <span className={`font-semibold ${pendingAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    ${pendingAmount.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(invoice.payment_status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewInvoice(invoice)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {invoice.payment_status !== "paid" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRecordPayment(invoice)}
                      title="Record Payment"
                    >
                      <DollarSign className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUpdateStatus(invoice)}
                      title="Update Status"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportPDF(invoice)}
                    title="Export PDF"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setDeleteDialogOpen(true);
                      }}
                      title="Delete Invoice"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* View Invoice Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invoice Details - {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Shop</p>
                  <p className="font-medium">{selectedInvoice.shops?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {new Date(selectedInvoice.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-xl font-bold">${Number(selectedInvoice.total_amount).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <p className="text-xl font-bold text-green-600">${totalPaid.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Remaining</p>
                  <p className="text-xl font-bold text-orange-600">${remainingAmount.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Items</p>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>${parseFloat(item.unit_price).toFixed(2)}</TableCell>
                          <TableCell>${parseFloat(item.subtotal).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {payments && payments.length > 0 && (
                <>
                  {/* Payment Method Breakdown - Admin Only */}
                  {isAdmin && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">Payment Breakdown by Method</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border rounded-lg p-4 bg-muted/50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Cash Payments</span>
                            <Badge variant="outline">
                              {payments.filter(p => p.payment_method === 'cash').length} transaction(s)
                            </Badge>
                          </div>
                          <p className="text-2xl font-bold mt-2 text-green-600">
                            ${payments
                              .filter(p => p.payment_method === 'cash')
                              .reduce((sum, p) => sum + Number(p.amount), 0)
                              .toFixed(2)}
                          </p>
                        </div>
                        <div className="border rounded-lg p-4 bg-muted/50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Check Payments</span>
                            <Badge variant="outline">
                              {payments.filter(p => p.payment_method === 'check').length} transaction(s)
                            </Badge>
                          </div>
                          <p className="text-2xl font-bold mt-2 text-blue-600">
                            ${payments
                              .filter(p => p.payment_method === 'check')
                              .reduce((sum, p) => sum + Number(p.amount), 0)
                              .toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-2">Payment History</p>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Check #</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>
                                {format(new Date(payment.payment_date), "MMM d, yyyy h:mm a")}
                              </TableCell>
                              <TableCell className="font-semibold">
                                ${Number(payment.amount).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {payment.payment_method}
                                </Badge>
                              </TableCell>
                              <TableCell>{payment.check_number || "-"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {payment.notes || "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}

              {selectedInvoice.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedInvoice.notes}</p>
                </div>
              )}

              {remainingAmount > 0 && (
                <div className="flex justify-end gap-2">
                  <Button onClick={() => handleRecordPayment(selectedInvoice)}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>
                </div>
              )}

              <div className="flex justify-between items-center p-4 bg-muted rounded-lg mt-4">
                <span className="font-semibold">Total Amount:</span>
                <span className="text-xl font-bold text-primary">
                  ${parseFloat(selectedInvoice.total_amount).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => handleExportPDF(selectedInvoice)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Payment Status Dialog - Admin Only */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setStatusDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  updatePaymentMutation.mutate({
                    id: selectedInvoice.id,
                    status: paymentStatus as "paid" | "partial" | "unpaid",
                  })
                }
                disabled={updatePaymentMutation.isPending}
              >
                {updatePaymentMutation.isPending ? "Updating..." : "Update Status"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      {selectedInvoice && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={(open) => {
            setPaymentDialogOpen(open);
            if (!open) {
              queryClient.invalidateQueries({ queryKey: ["payments"] });
              onRefetch();
            }
          }}
          invoice={selectedInvoice}
          remainingAmount={remainingAmount}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete invoice {selectedInvoice?.invoice_number}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedInvoice && deleteMutation.mutate(selectedInvoice.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
