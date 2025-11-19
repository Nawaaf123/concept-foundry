import { useState } from "react";
import { ChevronDown, ChevronRight, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Edit, Download, Trash2 } from "lucide-react";

interface ShopInvoiceGroupProps {
  shopName: string;
  shopLocation: string;
  invoices: any[];
  allPayments: any[];
  onViewInvoice: (invoice: any) => void;
  onRecordPayment: (invoice: any) => void;
  onUpdateStatus: (invoice: any) => void;
  onExportPDF: (invoice: any) => void;
  onDeleteInvoice: (invoice: any) => void;
  onDistributePayment: (shopName: string, invoices: any[], totalPending: number) => void;
  isAdmin: boolean;
  profiles?: { id: string; full_name: string }[];
}

export const ShopInvoiceGroup = ({
  shopName,
  shopLocation,
  invoices,
  allPayments,
  onViewInvoice,
  onRecordPayment,
  onUpdateStatus,
  onExportPDF,
  onDeleteInvoice,
  onDistributePayment,
  isAdmin,
  profiles,
}: ShopInvoiceGroupProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const getPendingAmount = (invoiceId: string, totalAmount: number) => {
    const invoicePayments = allPayments?.filter(p => p.invoice_id === invoiceId) || [];
    const totalPaid = invoicePayments.reduce((sum, p) => sum + Number(p.amount), 0);
    return totalAmount - totalPaid;
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

  // Calculate totals for this shop
  const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
  const totalPending = invoices.reduce((sum, inv) => {
    return sum + getPendingAmount(inv.id, Number(inv.total_amount));
  }, 0);
  
  // Filter for invoices with pending amounts
  const invoicesWithPending = invoices.filter(inv => 
    getPendingAmount(inv.id, Number(inv.total_amount)) > 0
  );

  return (
    <div className="border rounded-lg mb-4">
      {/* Shop Header */}
      <div className="bg-muted p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <div>
            <h3 className="font-semibold text-lg">{shopName}</h3>
            <p className="text-sm text-muted-foreground">{shopLocation}</p>
          </div>
          <Badge variant="outline" className="ml-2">
            {invoices.length} invoice(s)
          </Badge>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-xl font-bold">${totalAmount.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Pending</p>
            <p className={`text-xl font-bold ${totalPending > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              ${totalPending.toFixed(2)}
            </p>
          </div>
          {totalPending > 0 && (
            <Button
              onClick={() => onDistributePayment(shopName, invoicesWithPending, totalPending)}
              size="sm"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Pay Total
            </Button>
          )}
        </div>
      </div>

      {/* Invoices Table */}
      {isExpanded && (
        <div className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const pendingAmount = getPendingAmount(invoice.id, Number(invoice.total_amount));
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
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
                    <TableCell>
                      {profiles?.find((p) => p.id === invoice.created_by)?.full_name ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewInvoice(invoice)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {invoice.payment_status !== "paid" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRecordPayment(invoice)}
                            title="Record Payment"
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onUpdateStatus(invoice)}
                            title="Update Status"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onExportPDF(invoice)}
                          title="Export PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteInvoice(invoice)}
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
      )}
    </div>
  );
};
