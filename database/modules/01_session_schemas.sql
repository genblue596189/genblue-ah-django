-- GENERATED module; execute through 00_install_empty.sql, not by itself.
SET LOCAL statement_timeout = 0;

SET LOCAL lock_timeout = 0;

SET LOCAL idle_in_transaction_session_timeout = 0;

SET LOCAL client_encoding = 'UTF8';

SET LOCAL standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', true);

SET LOCAL check_function_bodies = false;

SET LOCAL xmloption = content;

SET LOCAL client_min_messages = warning;

SET LOCAL row_security = off;

CREATE SCHEMA IF NOT EXISTS "booking";

ALTER SCHEMA "booking" OWNER TO "postgres";

CREATE SCHEMA IF NOT EXISTS "private";

ALTER SCHEMA "private" OWNER TO "postgres";

CREATE SCHEMA IF NOT EXISTS "public";

ALTER SCHEMA "public" OWNER TO "pg_database_owner";

COMMENT ON SCHEMA "public" IS 'standard public schema';
