-- EMPTY SUPABASE PROJECT ONLY. Never execute this installer on the current production/local database.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $genblue_preflight$
BEGIN
 IF current_setting('server_version_num')::int<170000 THEN
  RAISE EXCEPTION 'PostgreSQL 17+ is required by original MAINTAIN privileges';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','booking','private') AND c.relkind IN ('r','p','v','m','S')) THEN
  RAISE EXCEPTION 'Application relations already exist: use the read-only audit, not this installer';
 END IF;
 IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL
  OR to_regprocedure('auth.uid()') IS NULL THEN
  RAISE EXCEPTION 'Supabase Auth/Storage prerequisites are missing';
 END IF;
 IF EXISTS(SELECT role_name FROM unnest(ARRAY['postgres','pg_database_owner','anon','authenticated','service_role']) role_name
  WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name)) THEN
  RAISE EXCEPTION 'Required Supabase/PostgreSQL roles are missing';
 END IF;
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id IN ('clinic-imaging','genblue'))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname IN ('imaging_v61_cleanup','imaging_v61_read','imaging_v61_upload')) THEN
  RAISE EXCEPTION 'Source Storage buckets or policies already exist: reconcile them before installing';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_stat_statements' AND n.nspname='extensions') THEN RAISE EXCEPTION 'Required source extension/schema missing: pg_stat_statements / extensions'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto' AND n.nspname='extensions') THEN RAISE EXCEPTION 'Required source extension/schema missing: pgcrypto / extensions'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='plpgsql' AND n.nspname='pg_catalog') THEN RAISE EXCEPTION 'Required source extension/schema missing: plpgsql / pg_catalog'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='supabase_vault' AND n.nspname='vault') THEN RAISE EXCEPTION 'Required source extension/schema missing: supabase_vault / vault'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='uuid-ossp' AND n.nspname='extensions') THEN RAISE EXCEPTION 'Required source extension/schema missing: uuid-ossp / extensions'; END IF;
END $genblue_preflight$;
