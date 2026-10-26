-- Additive: preserve existing vaccine types and historical records/invoices.
-- Existing vaccine_types RLS restricts writes to the clinic administrator.
BEGIN;
ALTER TABLE public.vaccine_types ADD COLUMN IF NOT EXISTS default_fee numeric;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.vaccine_types'::regclass AND conname='vaccine_types_default_fee_valid') THEN
  ALTER TABLE public.vaccine_types ADD CONSTRAINT vaccine_types_default_fee_valid
   CHECK(default_fee IS NULL OR (default_fee>=0 AND default_fee<=99999999.99 AND default_fee=round(default_fee,2)));
 END IF;
END $$;
COMMIT;
