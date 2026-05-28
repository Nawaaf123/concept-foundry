ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_shops_is_frozen ON public.shops(is_frozen);