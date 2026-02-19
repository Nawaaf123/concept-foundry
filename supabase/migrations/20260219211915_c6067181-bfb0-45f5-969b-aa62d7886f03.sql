CREATE UNIQUE INDEX unique_shop_name_address 
ON public.shops (LOWER(name), LOWER(COALESCE(street_address, '')), LOWER(COALESCE(city, '')), LOWER(COALESCE(state, '')));