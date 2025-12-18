-- =====================================================
-- COMPLETE MIGRATION SCRIPT FOR EXTERNAL SUPABASE
-- Run this in your external Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: SCHEMA CREATION (Run this first)
-- =====================================================

-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'sales');
CREATE TYPE public.payment_method AS ENUM ('cash', 'check');
CREATE TYPE public.payment_status AS ENUM ('paid', 'partial', 'unpaid');

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 60;

-- =====================================================
-- PRODUCTS TABLE
-- =====================================================
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  subcategory TEXT,
  sub_subcategory TEXT,
  price NUMERIC NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage products" ON public.products
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can view active products" ON public.products
FOR SELECT USING ((is_active = true) OR has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- PROFILES TABLE
-- =====================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- USER_ROLES TABLE
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- SHOPS TABLE
-- =====================================================
CREATE TABLE public.shops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT,
  email TEXT,
  phone TEXT,
  street_address TEXT,
  street_address_line_2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all shops" ON public.shops
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create shops" ON public.shops
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update shops" ON public.shops
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- INVOICES TABLE
-- =====================================================
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id),
  created_by UUID NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  total_amount NUMERIC NOT NULL,
  discount_amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales can view their own invoices" ON public.invoices
FOR SELECT USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sales can create invoices" ON public.invoices
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update invoice payment status" ON public.invoices
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete invoices" ON public.invoices
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- INVOICE_ITEMS TABLE
-- =====================================================
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoice items for their invoices" ON public.invoice_items
FOR SELECT USING (EXISTS (
  SELECT 1 FROM invoices
  WHERE invoices.id = invoice_items.invoice_id
  AND (invoices.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Users can create invoice items" ON public.invoice_items
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM invoices
  WHERE invoices.id = invoice_items.invoice_id
  AND invoices.created_by = auth.uid()
));

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  created_by UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method payment_method NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payments for their invoices" ON public.payments
FOR SELECT USING (EXISTS (
  SELECT 1 FROM invoices
  WHERE invoices.id = payments.invoice_id
  AND (invoices.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Users can create payments" ON public.payments
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM invoices
  WHERE invoices.id = payments.invoice_id
  AND (invoices.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

-- =====================================================
-- USER_LOCATIONS TABLE
-- =====================================================
CREATE TABLE public.user_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can upsert their own location" ON public.user_locations
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own location" ON public.user_locations
FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all locations" ON public.user_locations
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- has_role function (MUST CREATE BEFORE POLICIES USE IT)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Generate invoice number function
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  invoice_num TEXT;
BEGIN
  next_num := nextval('invoice_number_seq');
  invoice_num := 'INV-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(next_num::TEXT, 6, '0');
  RETURN invoice_num;
END;
$$;

-- Update updated_at column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update product stock function
CREATE OR REPLACE FUNCTION public.update_product_stock(p_product_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity + p_quantity,
      updated_at = now()
  WHERE id = p_product_id;
END;
$$;

-- Handle new user function (creates profile on signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User')
  );
  RETURN new;
END;
$$;

-- Cleanup stale locations function
CREATE OR REPLACE FUNCTION public.cleanup_stale_locations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_locations 
  WHERE updated_at < NOW() - INTERVAL '12 hours';
  RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- PART 2: DATA IMPORT (Run after schema creation)
-- =====================================================

-- NOTE: You'll need to create users in Supabase Auth first with these IDs:
-- User 1: 46c7bd8e-dfde-48f8-b79e-021a98d60dc8 (nawaafmohd22@gmail.com - Admin)
-- User 2: 38c75303-84b0-4142-969c-1957c013e4fb (kareem@gmail.com - Sales)
-- User 3: e286335a-7533-4eff-8901-d88f108d5ef3 (srour@gmail.com - Admin)

-- =====================================================
-- PROFILES DATA
-- =====================================================
INSERT INTO public.profiles (id, email, full_name, created_at, updated_at) VALUES
('46c7bd8e-dfde-48f8-b79e-021a98d60dc8', 'nawaafmohd22@gmail.com', 'Nawaaf', '2025-11-18 16:37:13.114108+00', '2025-11-18 16:37:13.114108+00'),
('38c75303-84b0-4142-969c-1957c013e4fb', 'kareem@gmail.com', 'Kareem', '2025-12-12 22:20:53.981976+00', '2025-12-12 22:20:53.981976+00'),
('e286335a-7533-4eff-8901-d88f108d5ef3', 'srour@gmail.com', 'Mohammed Srour', '2025-12-12 22:25:19.298343+00', '2025-12-12 22:25:19.298343+00')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- USER_ROLES DATA
-- =====================================================
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES
('eed6ac5b-b3ae-44b0-a42e-861d36d41132', '46c7bd8e-dfde-48f8-b79e-021a98d60dc8', 'admin', '2025-11-18 22:33:45.820471+00'),
('d0a58640-5fa4-4f02-a24a-3404c178bf69', '38c75303-84b0-4142-969c-1957c013e4fb', 'sales', '2025-12-12 22:20:54.15086+00'),
('b7a340a7-16b2-41fa-862e-29ed90c7cf7d', 'e286335a-7533-4eff-8901-d88f108d5ef3', 'admin', '2025-12-12 22:25:19.465782+00')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- USER_LOCATIONS DATA
-- =====================================================
INSERT INTO public.user_locations (id, user_id, latitude, longitude, accuracy, created_at, updated_at) VALUES
('ec539f55-82bf-4c88-9a29-7f846cd2da44', '38c75303-84b0-4142-969c-1957c013e4fb', 41.7040285729684, -88.3162923091144, 12.5929540356639, '2025-12-18 21:03:22.312614+00', '2025-12-18 22:07:27.03+00'),
('34ce66c0-1fb8-4b3c-b4e1-e7c2689e1401', '46c7bd8e-dfde-48f8-b79e-021a98d60dc8', 41.9689519671667, -87.9446546718196, 58, '2025-12-18 03:45:43.487398+00', '2025-12-18 22:37:37.13+00')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PAYMENTS DATA
-- =====================================================
INSERT INTO public.payments (id, invoice_id, created_by, amount, payment_method, payment_date, check_number, notes, created_at) VALUES
('00ae0e17-5297-4e5c-86a4-cc4ab22de2bb', '76c4f0a9-028e-4d78-815f-3cbe804a7b6e', '38c75303-84b0-4142-969c-1957c013e4fb', 1946.5, 'check', '2025-12-17 21:58:03.957478+00', '5057', 'Check collected', '2025-12-17 21:58:03.957478+00'),
('ff05f98d-f1e2-4d36-b887-36145f3cdaeb', '655e7698-beb3-4042-9572-1c1f5453b5a7', '38c75303-84b0-4142-969c-1957c013e4fb', 1053.5, 'check', '2025-12-17 21:58:04.76605+00', '5057', 'Check collected', '2025-12-17 21:58:04.76605+00'),
('493d3f29-0d57-4c87-bfe2-b8970ed5e687', 'd473a7bc-3d66-4201-8572-d43ef42ee2b0', '38c75303-84b0-4142-969c-1957c013e4fb', 2800, 'cash', '2025-12-18 20:00:46.154436+00', NULL, '$2800 collected today', '2025-12-18 20:00:46.154436+00'),
('2ec18353-73d8-4d09-b0db-f7b837d3ad9c', '16e77b45-e5e3-46e4-b44c-c59df92cb7c2', '38c75303-84b0-4142-969c-1957c013e4fb', 975, 'check', '2025-12-18 22:10:12.419672+00', '698', 'Full amount paid check today', '2025-12-18 22:10:12.419672+00'),
('9adb847b-6168-4056-81f0-ca8402400c42', 'ff29be91-75a3-4e0d-bba2-40e54daf4619', '38c75303-84b0-4142-969c-1957c013e4fb', 540, 'cash', '2025-12-18 23:06:29.501839+00', NULL, 'Amount paid cash today', '2025-12-18 23:06:29.501839+00')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- INVOICES DATA
-- =====================================================
INSERT INTO public.invoices (id, invoice_number, shop_id, created_by, payment_status, total_amount, discount_amount, notes, created_at, updated_at) VALUES
('21e006f1-cedf-4268-b20f-7af3dcd38dea', 'INV-2025-000046', '936f74e5-30fe-41cf-9e35-b85cba9c49af', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 1179.00, 0, '[LEGACY BALANCE] 10/23/25 states $1179 owed', '2025-12-16 23:48:10.93383+00', '2025-12-16 23:48:10.93383+00'),
('f319c656-533b-46b1-ad38-512adb92cbf5', 'INV-2025-000047', '936f74e5-30fe-41cf-9e35-b85cba9c49af', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 979.50, 45.5, 'Discount for adjusted pricing', '2025-12-17 00:11:41.959537+00', '2025-12-17 00:11:41.959537+00'),
('76c4f0a9-028e-4d78-815f-3cbe804a7b6e', 'INV-2025-000048', '6ef2f1e5-7db8-4b58-8e8f-cdea6301b36e', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 1946.50, 0, '[LEGACY BALANCE] Opening balance from previous records', '2025-12-17 18:18:17.339617+00', '2025-12-17 18:18:17.339617+00'),
('a0a1649b-aea6-46d9-bdd1-9e82c6928c57', 'INV-2025-000049', '9a6deb72-7dc2-4905-ada5-ac85c1611332', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 553.50, 0, '[LEGACY BALANCE] 12/11 receipt', '2025-12-17 19:00:54.10245+00', '2025-12-17 19:00:54.10245+00'),
('655e7698-beb3-4042-9572-1c1f5453b5a7', 'INV-2025-000050', '6ef2f1e5-7db8-4b58-8e8f-cdea6301b36e', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 1053.50, 0, '[LEGACY BALANCE] Opening balance from previous records', '2025-12-17 19:13:08.313043+00', '2025-12-17 19:13:08.313043+00'),
('31b10d6c-1656-4f42-af70-5988a5e6fa3c', 'INV-2025-000051', '9a6deb72-7dc2-4905-ada5-ac85c1611332', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 235.00, 10, 'Discount for adjusted pricing', '2025-12-17 19:23:54.41937+00', '2025-12-17 19:23:54.41937+00'),
('768ac215-da74-4ea3-a5a8-456968de84e0', 'INV-2025-000052', '9a6deb72-7dc2-4905-ada5-ac85c1611332', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 1000.00, 50, 'Discount for adjust pricing', '2025-12-17 20:07:40.000396+00', '2025-12-17 20:07:40.000396+00'),
('57bafa08-3901-4fb1-b8fc-e924bb6f6147', 'INV-2025-000053', '7caafee6-7eb1-448a-9e0e-ec2facc13229', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 700.00, 0, '[LEGACY BALANCE] 12/17 receipt', '2025-12-17 21:50:52.594007+00', '2025-12-17 21:50:52.594007+00'),
('f72b7518-4d4e-4c23-8c2b-5e8f425e454e', 'INV-2025-000054', '77ad39f4-0fac-4d1f-84f9-050b07e5d6c3', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 1080.00, 90, 'Discounted to adjust pricing', '2025-12-18 01:16:53.67662+00', '2025-12-18 01:16:53.67662+00'),
('d473a7bc-3d66-4201-8572-d43ef42ee2b0', 'INV-2025-000055', 'd8718fa6-c2de-4fcf-bdc6-1a162c9fc569', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 4002.50, 0, '[LEGACY BALANCE] 11/24/25 receipt', '2025-12-18 19:36:59.892054+00', '2025-12-18 19:36:59.892054+00'),
('7bf66181-740b-462b-b427-ef9499e42a53', 'INV-2025-000056', 'd8718fa6-c2de-4fcf-bdc6-1a162c9fc569', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 3343.50, 121.5, 'Discount due to adjusted pricing', '2025-12-18 19:56:38.282238+00', '2025-12-18 19:56:38.282238+00'),
('16e77b45-e5e3-46e4-b44c-c59df92cb7c2', 'INV-2025-000057', '37b5078d-569a-4706-b246-f074ae6e6a86', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 975.00, 75, 'Discount for adjusted pricing', '2025-12-18 22:09:22.943397+00', '2025-12-18 22:09:22.943397+00'),
('ff29be91-75a3-4e0d-bba2-40e54daf4619', 'INV-2025-000058', 'b24544aa-3259-4652-ae61-a22242a387b0', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 560.00, 0, '[LEGACY BALANCE] 12/12 receipt', '2025-12-18 23:00:56.675436+00', '2025-12-18 23:00:56.675436+00'),
('4c88fe2f-4f8b-4321-aaa1-d1435b0058b6', 'INV-2025-000059', 'b24544aa-3259-4652-ae61-a22242a387b0', '38c75303-84b0-4142-969c-1957c013e4fb', 'unpaid', 540.00, 45, 'Discount for adjusted price', '2025-12-18 23:04:21.527+00', '2025-12-18 23:04:21.527+00')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- NOTE: PRODUCTS, SHOPS, AND INVOICE_ITEMS DATA
-- Due to size, these are in separate files:
-- - PRODUCTS_DATA.sql
-- - SHOPS_DATA.sql  
-- - INVOICE_ITEMS_DATA.sql
-- =====================================================

-- =====================================================
-- IMPORTANT NOTES FOR MIGRATION:
-- =====================================================
-- 1. Create has_role function FIRST before creating any tables with RLS
-- 2. Create users in Supabase Auth with the same emails/passwords
-- 3. Run schema creation section first
-- 4. Then run data import section
-- 5. Products and Shops have large datasets - see separate files
-- =====================================================
