-- Create enum for payment methods
CREATE TYPE public.payment_method AS ENUM ('cash', 'check');

-- Create payments table to track individual payment transactions
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method payment_method NOT NULL,
  check_number TEXT,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS on payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view payments for invoices they can access
CREATE POLICY "Users can view payments for their invoices"
ON public.payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = payments.invoice_id
    AND (invoices.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Users can create payments for their invoices
CREATE POLICY "Users can create payments"
ON public.payments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = payments.invoice_id
    AND (invoices.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Add index for faster queries
CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX idx_payments_payment_date ON public.payments(payment_date);