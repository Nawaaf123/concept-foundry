import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export const exportInvoicesToExcel = async () => {
  try {
    // Fetch all invoices with related data
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        *,
        shops (
          name,
          owner_name,
          phone,
          email,
          street_address,
          city,
          state,
          zip_code
        )
      `)
      .order('created_at', { ascending: false });

    if (invoicesError) throw invoicesError;

    // Fetch all profiles for creator names
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name');

    if (profilesError) throw profilesError;

    if (!invoices || invoices.length === 0) {
      throw new Error('No invoices found to export');
    }

    // Fetch all invoice items for all invoices
    const invoiceIds = invoices.map(inv => inv.id);
    const { data: allItems, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .in('invoice_id', invoiceIds);

    if (itemsError) throw itemsError;

    // Fetch all payments for all invoices
    const { data: allPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .in('invoice_id', invoiceIds);

    if (paymentsError) throw paymentsError;

    // Create Invoice Summary Sheet
    const summaryData = invoices.map(invoice => {
      const payments = allPayments?.filter(p => p.invoice_id === invoice.id) || [];
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const cashPaid = payments
        .filter(p => p.payment_method === 'cash')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const checkPaid = payments
        .filter(p => p.payment_method === 'check')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      
      const creator = profiles?.find(p => p.id === invoice.created_by);
      const location = [
        invoice.shops?.city,
        invoice.shops?.state,
        invoice.shops?.zip_code,
      ].filter(Boolean).join(', ') || 'N/A';

      return {
        'Invoice Number': invoice.invoice_number,
        'Shop Name': invoice.shops?.name || 'N/A',
        'Location': location,
        'Owner Name': invoice.shops?.owner_name || 'N/A',
        'Phone': invoice.shops?.phone || 'N/A',
        'Email': invoice.shops?.email || 'N/A',
        'Date': new Date(invoice.created_at).toLocaleDateString(),
        'Created By': creator?.full_name || 'Unknown',
        'Total Amount': Number(invoice.total_amount).toFixed(2),
        'Payment Status': invoice.payment_status.toUpperCase(),
        'Total Paid': totalPaid.toFixed(2),
        'Cash Paid': cashPaid.toFixed(2),
        'Check Paid': checkPaid.toFixed(2),
        'Remaining': (Number(invoice.total_amount) - totalPaid).toFixed(2),
        'Notes': invoice.notes || '',
      };
    });

    // Create Invoice Details Sheet (with items)
    const detailsData: any[] = [];
    invoices.forEach(invoice => {
      const items = allItems?.filter(item => item.invoice_id === invoice.id) || [];
      items.forEach(item => {
        detailsData.push({
          'Invoice Number': invoice.invoice_number,
          'Shop Name': invoice.shops?.name || 'N/A',
          'Date': new Date(invoice.created_at).toLocaleDateString(),
          'Product Name': item.product_name,
          'Quantity': item.quantity,
          'Unit Price': Number(item.unit_price).toFixed(2),
          'Subtotal': Number(item.subtotal).toFixed(2),
          'Invoice Total': Number(invoice.total_amount).toFixed(2),
          'Payment Status': invoice.payment_status.toUpperCase(),
        });
      });
    });

    // Create Payments Sheet
    const paymentsData = allPayments?.map(payment => {
      const invoice = invoices.find(inv => inv.id === payment.invoice_id);
      return {
        'Invoice Number': invoice?.invoice_number || 'N/A',
        'Shop Name': invoice?.shops?.name || 'N/A',
        'Payment Date': new Date(payment.payment_date).toLocaleDateString(),
        'Amount': Number(payment.amount).toFixed(2),
        'Payment Method': payment.payment_method.toUpperCase(),
        'Check Number': payment.check_number || 'N/A',
        'Notes': payment.notes || '',
      };
    }) || [];

    // Create workbook and sheets
    const wb = XLSX.utils.book_new();
    
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Invoice Summary');
    
    const detailsWs = XLSX.utils.json_to_sheet(detailsData);
    XLSX.utils.book_append_sheet(wb, detailsWs, 'Invoice Details');
    
    if (paymentsData.length > 0) {
      const paymentsWs = XLSX.utils.json_to_sheet(paymentsData);
      XLSX.utils.book_append_sheet(wb, paymentsWs, 'Payments');
    }

    // Auto-size columns
    [summaryWs, detailsWs].forEach(ws => {
      const cols: any[] = [];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxWidth = 10;
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[cellAddress];
          if (cell && cell.v) {
            const cellLength = cell.v.toString().length;
            maxWidth = Math.max(maxWidth, cellLength);
          }
        }
        cols.push({ wch: Math.min(maxWidth + 2, 50) });
      }
      ws['!cols'] = cols;
    });

    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0];
    const filename = `MR_FOG_Invoices_${today}.xlsx`;

    // Write file
    XLSX.writeFile(wb, filename);

    return { success: true, filename };
  } catch (error) {
    console.error('Error exporting invoices:', error);
    throw error;
  }
};
