-- OPTIONAL known compatibility migration, not a full schema restore.
-- Already applied in the current local environment. Do not run just because this file exists.
BEGIN;
SET LOCAL lock_timeout='10s';
LOCK TABLE public.user_profiles IN ACCESS EXCLUSIVE MODE;
DO $genblue_role$
DECLARE existing_def text; old_def text; new_def text;
BEGIN
 SELECT regexp_replace(pg_catalog.pg_get_constraintdef(c.oid),'[[:space:]"]','','g') INTO existing_def
 FROM pg_catalog.pg_constraint c
 WHERE c.conrelid=to_regclass('public.user_profiles') AND c.conname='user_profiles_role_check' AND c.contype='c';
 old_def:=regexp_replace($old$CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'vet'::text, 'staff'::text])))$old$,'[[:space:]"]','','g');
 new_def:=regexp_replace($new$CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'vet'::text, 'staff'::text, 'doctor'::text])))$new$,'[[:space:]"]','','g');
 IF existing_def=new_def THEN
  RAISE NOTICE 'doctor role compatibility already applied; nothing changed';
 ELSIF existing_def=old_def THEN
  ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
   CHECK (role IN ('owner','admin','vet','staff','doctor'));
 ELSE
  RAISE EXCEPTION 'Role constraint differs from supplied snapshots; no change applied';
 END IF;
END $genblue_role$;
COMMIT;
