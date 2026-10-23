-- GENERATED module; execute through 00_install_empty.sql, not by itself.
CREATE TABLE IF NOT EXISTS "booking"."ob_clinics" (
    "tenant_id" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "notice" "text" DEFAULT '預約需由醫院確認；急症請直接聯絡醫院。'::"text" NOT NULL,
    CONSTRAINT "ob_clinics_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 100))),
    CONSTRAINT "ob_clinics_notice_check" CHECK (("length"("notice") <= 1000)),
    CONSTRAINT "ob_clinics_slug_check" CHECK (("slug" ~ '^[a-z0-9-]{3,60}$'::"text"))
);

ALTER TABLE "booking"."ob_clinics" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "booking"."ob_closed_days_v60" (
    "tenant_id" "text" NOT NULL,
    "day" "date" NOT NULL
);

ALTER TABLE "booking"."ob_closed_days_v60" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "booking"."ob_requests" (
    "id" "uuid" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "slot_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "pet_name" "text" NOT NULL,
    "species" "text" NOT NULL,
    "reason" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "appointment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "registered_hint" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "ob_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);

ALTER TABLE "booking"."ob_requests" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "booking"."ob_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "capacity" integer NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "generated_v60" boolean DEFAULT false NOT NULL,
    "closed_v60" boolean DEFAULT false NOT NULL,
    CONSTRAINT "ob_slots_capacity_check" CHECK ((("capacity" >= 1) AND ("capacity" <= 20)))
);

ALTER TABLE "booking"."ob_slots" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "booking"."ob_weekly_v60" (
    "tenant_id" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "capacity" integer DEFAULT 1 NOT NULL,
    "rules" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ob_weekly_v60_capacity_check" CHECK ((("capacity" >= 1) AND ("capacity" <= 20)))
);

ALTER TABLE "booking"."ob_weekly_v60" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."clinic_multidoctor_settings_v51" (
    "tenant_id" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL
);

ALTER TABLE "private"."clinic_multidoctor_settings_v51" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."clinic_visit_claims_v51" (
    "claim_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "appointment_id" "uuid",
    "clinician_id" "uuid" NOT NULL,
    "clinician_name" "text" NOT NULL,
    "claimed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "private"."clinic_visit_claims_v51" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "private"."medical_amendments_v53" (
    "request_id" "uuid" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "medical_record_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "actor_name" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "previous_version" bigint NOT NULL,
    "saved_version" bigint NOT NULL,
    "previous_chief" "text",
    "next_chief" "text",
    "previous_payload" "jsonb",
    "next_payload" "jsonb",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "private"."medical_amendments_v53" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "appointment_time" timestamp with time zone,
    "session" "text" DEFAULT '上午診'::"text" NOT NULL,
    "doctor" "text",
    "status" "text" DEFAULT '已預約'::"text" NOT NULL,
    "check_in_time" timestamp with time zone,
    "notes" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "checked_in_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancel_reason" "text",
    "completed_at" timestamp with time zone,
    "assigned_doctor_id" "uuid",
    "clinician_id_v57" "uuid",
    "clinician_name_v57" "text",
    "clinical_record_v57" boolean DEFAULT false NOT NULL,
    "is_emergency_v925" boolean DEFAULT false NOT NULL,
    "emergency_fee_v925" numeric(10,2) DEFAULT 0 NOT NULL,
    "night_pricing_v93" "jsonb",
    CONSTRAINT "appointments_emergency_fee_v925_check" CHECK (("emergency_fee_v925" >= (0)::numeric))
);

ALTER TABLE "public"."appointments" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "operator" character varying(100) NOT NULL,
    "action" "text" NOT NULL,
    "client_ip" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."audit_logs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."breed_images" (
    "tenant_id" "text" NOT NULL,
    "species" "text" NOT NULL,
    "breed_name" "text" NOT NULL,
    "image_data" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "breed_images_breed_name_check" CHECK ((("length"("btrim"("breed_name")) >= 1) AND ("length"("btrim"("breed_name")) <= 100))),
    CONSTRAINT "breed_images_image_data_check" CHECK ((("length"("image_data") <= 140000) AND ("image_data" ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'::"text"))),
    CONSTRAINT "breed_images_species_check" CHECK ((("length"("btrim"("species")) >= 1) AND ("length"("btrim"("species")) <= 30)))
);

ALTER TABLE "public"."breed_images" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."breeds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "species" "text" NOT NULL,
    "breed_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."breeds" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."categories" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."clinic_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "clinic_name" "text" NOT NULL,
    "director" "text",
    "phone" "text",
    "address" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "prescription_routes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "billing_presets_v80" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "google_calendar_v9135" "jsonb",
    "emergency_v925" "jsonb" DEFAULT '{"fee": 0}'::"jsonb" NOT NULL
);

ALTER TABLE "public"."clinic_settings" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."clinic_trials" (
    "tenant_id" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."clinic_trials" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."controlled_drug_counts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "item_kind" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "item_name_snapshot" "text" NOT NULL,
    "lot_id" "uuid",
    "counted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "book_qty" numeric NOT NULL,
    "physical_qty" numeric NOT NULL,
    "difference_qty" numeric GENERATED ALWAYS AS (("physical_qty" - "book_qty")) STORED,
    "reason" "text",
    "document_no" "text",
    "counted_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "controlled_drug_counts_item_kind_check" CHECK (("item_kind" = ANY (ARRAY['medicine'::"text", 'item'::"text"])))
);

ALTER TABLE "public"."controlled_drug_counts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."diagnostic_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "device_type" "text" NOT NULL,
    "manufacturer" "text",
    "model" "text",
    "serial_no" "text",
    "adapter_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "diagnostic_devices_adapter_type_check" CHECK (("adapter_type" = ANY (ARRAY['manual'::"text", 'csv'::"text", 'txt'::"text", 'hl7'::"text", 'astm'::"text", 'api'::"text", 'dicom'::"text", 'folder_watch'::"text", 'other'::"text"]))),
    CONSTRAINT "diagnostic_devices_device_type_check" CHECK (("device_type" = ANY (ARRAY['CBC'::"text", 'BIOCHEM'::"text", 'XRAY'::"text", 'ULTRASOUND'::"text", 'OTHER'::"text"])))
);

ALTER TABLE "public"."diagnostic_devices" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."diagnostic_import_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "device_id" "uuid",
    "pet_id" "uuid",
    "medical_record_id" "uuid",
    "import_kind" "text" NOT NULL,
    "source_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_filename" "text",
    "source_storage_path" "text",
    "source_mime_type" "text",
    "source_hash" "text",
    "raw_text" "text",
    "raw_payload" "jsonb",
    "status" "text" DEFAULT 'received'::"text" NOT NULL,
    "error_message" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parsed_at" timestamp with time zone,
    "committed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "diagnostic_import_jobs_import_kind_check" CHECK (("import_kind" = ANY (ARRAY['CBC'::"text", 'BIOCHEM'::"text", 'XRAY'::"text", 'ULTRASOUND'::"text", 'OTHER'::"text"]))),
    CONSTRAINT "diagnostic_import_jobs_source_type_check" CHECK (("source_type" = ANY (ARRAY['manual'::"text", 'csv'::"text", 'txt'::"text", 'hl7'::"text", 'astm'::"text", 'api'::"text", 'dicom'::"text", 'folder_watch'::"text", 'other'::"text"]))),
    CONSTRAINT "diagnostic_import_jobs_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'parsed'::"text", 'matched'::"text", 'committed'::"text", 'error'::"text", 'cancelled'::"text"])))
);

ALTER TABLE "public"."diagnostic_import_jobs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."diagnostic_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "import_job_id" "uuid",
    "device_id" "uuid",
    "pet_id" "uuid" NOT NULL,
    "medical_record_id" "uuid",
    "test_group" "text" NOT NULL,
    "test_code" "text" NOT NULL,
    "test_name" "text" NOT NULL,
    "result_value" "text",
    "numeric_value" numeric,
    "unit" "text",
    "reference_low" numeric,
    "reference_high" numeric,
    "reference_text" "text",
    "abnormal_flag" "text",
    "instrument_flag" "text",
    "measured_at" timestamp with time zone,
    "sequence_no" integer DEFAULT 0 NOT NULL,
    "raw_item" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "diagnostic_results_abnormal_flag_check" CHECK ((("abnormal_flag" IS NULL) OR ("abnormal_flag" = ANY (ARRAY['L'::"text", 'H'::"text", 'LL'::"text", 'HH'::"text", 'A'::"text", 'N'::"text"]))))
);

ALTER TABLE "public"."diagnostic_results" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."imaging_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "study_id" "uuid" NOT NULL,
    "asset_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "preview_storage_path" "text",
    "mime_type" "text",
    "original_filename" "text",
    "dicom_sop_uid" "text",
    "dicom_instance_no" integer,
    "width" integer,
    "height" integer,
    "file_size" bigint,
    "checksum" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "imaging_assets_asset_type_check" CHECK (("asset_type" = ANY (ARRAY['dicom'::"text", 'image'::"text", 'video'::"text", 'pdf'::"text", 'other'::"text"])))
);

ALTER TABLE "public"."imaging_assets" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."imaging_share_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "study_id" "uuid" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(24), 'hex'::"text") NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "allow_interpretation" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_accessed_at" timestamp with time zone
);

ALTER TABLE "public"."imaging_share_tokens" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."imaging_shares_v76" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "asset_ids" "uuid"[] NOT NULL,
    "token_hash" "bytea" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "imaging_shares_v76_asset_ids_check" CHECK ((("cardinality"("asset_ids") >= 1) AND ("cardinality"("asset_ids") <= 20))),
    CONSTRAINT "imaging_shares_v76_check" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "imaging_shares_v76_token_hash_check" CHECK (("octet_length"("token_hash") = 32))
);

ALTER TABLE "public"."imaging_shares_v76" OWNER TO "postgres";

COMMENT ON TABLE "public"."imaging_shares_v76" IS 'v76 capability hashes and selected JPG/PNG assets; public access only through the sharing Edge Function';

CREATE TABLE IF NOT EXISTS "public"."imaging_studies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "medical_record_id" "uuid",
    "device_id" "uuid",
    "modality" "text" NOT NULL,
    "study_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "body_part" "text",
    "views" "text",
    "study_uid" "text",
    "accession_no" "text",
    "clinical_note" "text",
    "interpretation" "text",
    "veterinarian_user_id" "uuid",
    "veterinarian_name" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "imaging_studies_modality_check" CHECK (("modality" = ANY (ARRAY['XRAY'::"text", 'ULTRASOUND'::"text", 'OTHER'::"text"]))),
    CONSTRAINT "imaging_studies_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'ready'::"text", 'final'::"text"])))
);

ALTER TABLE "public"."imaging_studies" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."inpatients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "pet_id" "uuid",
    "admission_date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "discharge_date" timestamp with time zone,
    "reason" "text",
    "daily_rate" numeric DEFAULT 500,
    "status" "text" DEFAULT '住院中'::"text",
    "care_notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."inpatients" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "item_kind" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "change_qty" numeric NOT NULL,
    "qty_before" numeric NOT NULL,
    "qty_after" numeric NOT NULL,
    "reason" "text" NOT NULL,
    "actor_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_movements_change_qty_check" CHECK (("change_qty" <> (0)::numeric)),
    CONSTRAINT "inventory_movements_item_kind_check" CHECK (("item_kind" = ANY (ARRAY['item'::"text", 'medicine'::"text"]))),
    CONSTRAINT "inventory_movements_qty_after_check" CHECK (("qty_after" >= (0)::numeric)),
    CONSTRAINT "inventory_movements_reason_check" CHECK (("length"(TRIM(BOTH FROM "reason")) > 0))
);

ALTER TABLE "public"."inventory_movements" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid",
    "item_name" character varying(150) NOT NULL,
    "quantity" numeric DEFAULT 1,
    "unit_price" numeric(10,2) NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "receipt_visible_v64" boolean DEFAULT true NOT NULL,
    "medicine_group_v64" "text"
);

ALTER TABLE "public"."invoice_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "owner_id" "uuid",
    "checkout_type" character varying(30) NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "discount" numeric(10,2) DEFAULT 0,
    "total_amount" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "pet_id" "uuid",
    "category_type" "text" DEFAULT '一般商品'::"text",
    "category" "text" DEFAULT '一般商品'::"text",
    "voided_at" timestamp with time zone,
    "void_reason" "text",
    "void_actor" "uuid",
    "appointment_id_v57" "uuid",
    "clinician_id_v57" "uuid",
    "clinician_name_v57" "text",
    "cashier_id_v57" "uuid",
    "checkout_request_v57" "uuid",
    "checkout_payload_v57" "jsonb",
    "family_checkout_v74" "uuid",
    "family_checkout_payload_v74" "jsonb",
    "is_emergency_v925" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."invoices" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."item_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."item_categories" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "name" character varying(150) NOT NULL,
    "category" character varying(50) NOT NULL,
    "cost_price" numeric(10,2) DEFAULT 0,
    "sell_price" numeric(10,2) NOT NULL,
    "stock_qty" numeric DEFAULT 0,
    "safety_stock" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "regulatory_class" "text" DEFAULT '一般商品'::"text",
    "reportable" boolean DEFAULT false,
    "report_scheme" "text" DEFAULT 'none'::"text",
    "veterinary_license_no" "text",
    "active_ingredient" "text",
    "strength" "text",
    "dosage_form" "text",
    "manufacturer" "text",
    "smallest_unit" "text",
    "controlled_drug" boolean DEFAULT false,
    "controlled_level" smallint,
    "controlled_registration_no" "text",
    "regulatory_notes" "text",
    "regulatory_updated_at" timestamp with time zone,
    CONSTRAINT "items_controlled_level_chk" CHECK ((("controlled_level" IS NULL) OR (("controlled_level" >= 1) AND ("controlled_level" <= 4))))
);

ALTER TABLE "public"."items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."lab_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "pet_id" "uuid",
    "test_type" "text" NOT NULL,
    "report_data" "jsonb" DEFAULT '{}'::"jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."lab_reports" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."lab_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "pet_id" "uuid",
    "test_category" "text",
    "file_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."lab_tests" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."legacy_medical_histories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "source_pet_no" "text" NOT NULL,
    "medical_rtf" "text" DEFAULT ''::"text" NOT NULL,
    "medical_text" "text" DEFAULT ''::"text" NOT NULL,
    "treatment_rtf" "text" DEFAULT ''::"text" NOT NULL,
    "treatment_text" "text" DEFAULT ''::"text" NOT NULL,
    "med_note" "text" DEFAULT ''::"text" NOT NULL,
    "hospitalization_text" "text" DEFAULT ''::"text" NOT NULL,
    "source_sha256" "text" NOT NULL,
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "legacy_medical_histories_source_sha256_check" CHECK (("source_sha256" ~ '^[0-9a-f]{64}$'::"text"))
);

ALTER TABLE "public"."legacy_medical_histories" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."medicines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "recommended_dose" "text",
    "price" numeric DEFAULT 0,
    "usage_dose" "text",
    "calculated_dose" "text",
    "stock_qty" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "route" "text",
    "category" "text" DEFAULT '一般藥品'::"text",
    "unit" "text" DEFAULT '錠'::"text",
    "cost_price" numeric DEFAULT 0,
    "regulatory_class" "text" DEFAULT '未分類'::"text",
    "reportable" boolean DEFAULT false,
    "report_scheme" "text" DEFAULT 'none'::"text",
    "veterinary_license_no" "text",
    "active_ingredient" "text",
    "strength" "text",
    "dosage_form" "text",
    "manufacturer" "text",
    "smallest_unit" "text",
    "controlled_drug" boolean DEFAULT false,
    "controlled_level" smallint,
    "controlled_registration_no" "text",
    "regulatory_notes" "text",
    "regulatory_updated_at" timestamp with time zone,
    "clinical_profile_v94" "jsonb" DEFAULT '{"cat": "", "dog": "", "other": "", "methods": [], "species": "unset"}'::"jsonb" NOT NULL,
    CONSTRAINT "medicines_controlled_level_chk" CHECK ((("controlled_level" IS NULL) OR (("controlled_level" >= 1) AND ("controlled_level" <= 4))))
);

ALTER TABLE "public"."medicines" OWNER TO "postgres";

COMMENT ON COLUMN "public"."medicines"."clinical_profile_v94" IS 'v94 clinician-entered species references and available preparation methods; no automatic clinical dose inference';

CREATE TABLE IF NOT EXISTS "public"."owner_code_counters" (
    "tenant_id" character varying(50) NOT NULL,
    "next_number" integer NOT NULL,
    CONSTRAINT "owner_code_counters_next_number_check" CHECK (("next_number" >= 2))
);

ALTER TABLE "public"."owner_code_counters" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "name" character varying(100) NOT NULL,
    "phone" character varying(50),
    "mobile" character varying(50) NOT NULL,
    "email" character varying(100),
    "address" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "owner_code" "text",
    "system_code" "text" NOT NULL,
    "legacy_import_key" "text"
);

ALTER TABLE "public"."owners" OWNER TO "postgres";

COMMENT ON COLUMN "public"."owners"."owner_code" IS '管理者輸入的舊紙本病歷號，可跨不同飼主共用';

COMMENT ON COLUMN "public"."owners"."system_code" IS '系統自動產生的新短碼';

COMMENT ON COLUMN "public"."owners"."legacy_import_key" IS '舊資料匯入分組識別，防止重複匯入';

CREATE TABLE IF NOT EXISTS "public"."pets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "owner_id" "uuid",
    "name" character varying(100) NOT NULL,
    "microchip" character varying(50),
    "species" character varying(30) NOT NULL,
    "gender" character varying(30) NOT NULL,
    "birth_date" "date",
    "vaccine_date" "date",
    "last_visit_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "weight" numeric,
    "birthday" "date",
    "breed" "text",
    "legacy_source_no" "text",
    "legacy_species_label" "text",
    "latest_temperature" numeric(5,2),
    "temperature_measured_at" timestamp with time zone,
    "medical_reminder_text" "text" DEFAULT ''::"text" NOT NULL,
    "medical_reminder_active" boolean DEFAULT false NOT NULL,
    CONSTRAINT "pets_latest_temperature_valid" CHECK ((("latest_temperature" IS NULL) OR (("latest_temperature" > (0)::numeric) AND ("latest_temperature" <= (100)::numeric))))
);

ALTER TABLE "public"."pets" OWNER TO "postgres";

COMMENT ON COLUMN "public"."pets"."legacy_source_no" IS '舊系統每隻寵物的原始病歷號碼，供後續病歷銜接';

COMMENT ON COLUMN "public"."pets"."legacy_species_label" IS '來源的原始物種名稱；對應到其他時仍可追查';

COMMENT ON COLUMN "public"."pets"."medical_reminder_text" IS '院內門診持續提醒；已處理後保留文字';

COMMENT ON COLUMN "public"."pets"."medical_reminder_active" IS 'true 時每次開啟門診自動展開紅字提醒';

CREATE TABLE IF NOT EXISTS "public"."pharmacy_jobs_v9133" (
    "id" "uuid" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "prescription" "jsonb" NOT NULL,
    "chief" "text" DEFAULT ''::"text" NOT NULL,
    "bill" "jsonb" NOT NULL,
    "state" "text" DEFAULT 'waiting'::"text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "doctor_name" "text" NOT NULL,
    "prepared_by" "uuid",
    "prepared_name" "text",
    "reason" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "events" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "pharmacy_jobs_v9133_state_check" CHECK (("state" = ANY (ARRAY['waiting'::"text", 'preparing'::"text", 'returned'::"text", 'ready'::"text", 'handed'::"text", 'cancelled'::"text"])))
);

ALTER TABLE "public"."pharmacy_jobs_v9133" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."platform_operators" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."platform_operators" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pos_audit_v77" (
    "id" bigint NOT NULL,
    "tenant_id" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "before_data" "jsonb",
    "after_data" "jsonb",
    "actor" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."pos_audit_v77" OWNER TO "postgres";

ALTER TABLE "public"."pos_audit_v77" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."pos_audit_v77_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."pos_movements_v77" (
    "id" "uuid" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "method" "text" NOT NULL,
    "reason" "text" DEFAULT ''::"text" NOT NULL,
    "reference" "text",
    "actor" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pos_movements_v77_kind_check" CHECK (("kind" = ANY (ARRAY['payment'::"text", 'refund'::"text", 'in'::"text", 'out'::"text", 'opening_adjust'::"text"])))
);

ALTER TABLE "public"."pos_movements_v77" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pos_pending_v77" (
    "id" "uuid" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "draft" "jsonb" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "state" "text" DEFAULT 'pending'::"text" NOT NULL,
    "dispensing" "text" DEFAULT '未調劑'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_result" "jsonb",
    CONSTRAINT "pos_pending_v77_dispensing_check" CHECK (("dispensing" = ANY (ARRAY['未調劑'::"text", '已調劑'::"text", '已交付'::"text"]))),
    CONSTRAINT "pos_pending_v77_state_check" CHECK (("state" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'cancelled'::"text"])))
);

ALTER TABLE "public"."pos_pending_v77" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pos_requests_v77" (
    "id" "uuid" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "result" "jsonb" NOT NULL,
    "actor" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."pos_requests_v77" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pos_shifts_v77" (
    "id" "uuid" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "opening" numeric(14,2) NOT NULL,
    "opened_by" "uuid" NOT NULL,
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_by" "uuid",
    "closed_at" timestamp with time zone,
    "counted" numeric(14,2),
    "expected" numeric(14,2),
    "difference" numeric(14,2),
    "reason" "text",
    "denominations" "jsonb",
    "night_emergency_v93" boolean DEFAULT false NOT NULL,
    CONSTRAINT "pos_shifts_v77_opening_check" CHECK (("opening" >= (0)::numeric))
);

ALTER TABLE "public"."pos_shifts_v77" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."rapid_test_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "pet_id" "uuid",
    "test_item" character varying(100) NOT NULL,
    "result" "jsonb" NOT NULL,
    "batch_no" character varying(50),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."rapid_test_records" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."rapid_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "name" character varying(100) NOT NULL,
    "target" character varying(20) NOT NULL,
    "sub_items" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "default_fee" numeric(10,2),
    CONSTRAINT "rapid_types_default_fee_valid" CHECK ((("default_fee" IS NULL) OR (("default_fee" >= (0)::numeric) AND ("default_fee" < 'Infinity'::numeric))))
);

ALTER TABLE "public"."rapid_types" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."regulated_drug_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "transaction_type" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "reason_code" "text",
    "reason_text" "text",
    "item_kind" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "regulatory_class" "text",
    "report_scheme" "text" DEFAULT 'none'::"text",
    "reportable" boolean DEFAULT false NOT NULL,
    "veterinary_license_no" "text",
    "active_ingredient" "text",
    "strength" "text",
    "dosage_form" "text",
    "manufacturer" "text",
    "controlled_drug" boolean DEFAULT false NOT NULL,
    "controlled_level" smallint,
    "smallest_unit" "text" NOT NULL,
    "quantity" numeric NOT NULL,
    "lot_id" "uuid",
    "lot_no" "text",
    "expiry_date" "date",
    "balance_after" numeric,
    "owner_id" "uuid",
    "pet_id" "uuid",
    "medical_record_id" "uuid",
    "invoice_id" "uuid",
    "invoice_item_id" "uuid",
    "veterinarian_user_id" "uuid",
    "veterinarian_name" "text",
    "counterparty_name" "text",
    "counterparty_registration_no" "text",
    "document_no" "text",
    "notes" "text",
    "reversal_of" "uuid",
    "correction_of" "uuid",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_inventory_movement_id" "uuid",
    CONSTRAINT "regulated_drug_transactions_direction_check" CHECK (("direction" = ANY (ARRAY['IN'::"text", 'OUT'::"text", 'ADJUST'::"text"]))),
    CONSTRAINT "regulated_drug_transactions_item_kind_check" CHECK (("item_kind" = ANY (ARRAY['medicine'::"text", 'item'::"text"]))),
    CONSTRAINT "regulated_drug_transactions_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "regulated_tx_controlled_level_chk" CHECK ((("controlled_level" IS NULL) OR (("controlled_level" >= 1) AND ("controlled_level" <= 4))))
);

ALTER TABLE "public"."regulated_drug_transactions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."regulated_lots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "item_kind" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "item_name_snapshot" "text" NOT NULL,
    "lot_no" "text" NOT NULL,
    "expiry_date" "date",
    "manufacture_date" "date",
    "supplier_name" "text",
    "supplier_registration_no" "text",
    "received_at" timestamp with time zone,
    "qty_received" numeric DEFAULT 0 NOT NULL,
    "qty_on_hand" numeric DEFAULT 0 NOT NULL,
    "smallest_unit" "text",
    "purchase_document_no" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "regulated_lots_item_kind_check" CHECK (("item_kind" = ANY (ARRAY['medicine'::"text", 'item'::"text"]))),
    CONSTRAINT "regulated_lots_qty_on_hand_check" CHECK (("qty_on_hand" >= (0)::numeric)),
    CONSTRAINT "regulated_lots_qty_received_check" CHECK (("qty_received" >= (0)::numeric))
);

ALTER TABLE "public"."regulated_lots" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."regulatory_report_batch_transactions" (
    "batch_id" "uuid" NOT NULL,
    "transaction_id" "uuid" NOT NULL
);

ALTER TABLE "public"."regulatory_report_batch_transactions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."regulatory_report_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "report_type" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "export_profile_id" "uuid",
    "file_name" "text",
    "file_format" "text",
    "row_count" integer DEFAULT 0 NOT NULL,
    "exported_rows" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_hash" "text",
    "generated_by" "uuid",
    "generated_at" timestamp with time zone,
    "submitted_by" "uuid",
    "submitted_at" timestamp with time zone,
    "correction_of" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "regulatory_report_batches_row_count_check" CHECK (("row_count" >= 0)),
    CONSTRAINT "regulatory_report_batches_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'generated'::"text", 'submitted'::"text", 'corrected'::"text", 'cancelled'::"text"])))
);

ALTER TABLE "public"."regulatory_report_batches" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."report_export_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "profile_code" "text" NOT NULL,
    "profile_name" "text" NOT NULL,
    "authority" "text",
    "version" "text",
    "file_format" "text" DEFAULT 'xlsx'::"text" NOT NULL,
    "mapping_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."report_export_profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "display_name" "text",
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "can_checkout" boolean DEFAULT false NOT NULL,
    "permission_clinical" boolean,
    "permission_appointment" boolean,
    "permission_operational" boolean,
    "permission_checkout" boolean,
    "is_consulting_doctor" boolean DEFAULT false NOT NULL,
    "permission_pharmacy" boolean DEFAULT false NOT NULL,
    CONSTRAINT "user_profiles_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'vet'::"text", 'staff'::"text", 'doctor'::"text"])))
);

ALTER TABLE "public"."user_profiles" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_controlled_drug_ledger" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    ("occurred_at")::"date" AS "ledger_date",
    "occurred_at",
    "item_kind",
    "item_id",
    "item_name",
    "active_ingredient",
    "strength",
    "veterinary_license_no",
    "controlled_level",
    "manufacturer",
    "smallest_unit",
    "reason_code",
        CASE
            WHEN ("direction" = 'IN'::"text") THEN "quantity"
            ELSE (0)::numeric
        END AS "income_qty",
        CASE
            WHEN ("direction" = 'OUT'::"text") THEN "quantity"
            ELSE (0)::numeric
        END AS "expense_qty",
    "lot_no",
    "balance_after",
    "owner_id",
    "pet_id",
    "veterinarian_name",
    "counterparty_name",
    "counterparty_registration_no",
    "document_no",
    "notes"
   FROM "public"."regulated_drug_transactions" "t"
  WHERE ("controlled_drug" = true);

ALTER VIEW "public"."v_controlled_drug_ledger" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_regulatory_transactions" WITH ("security_invoker"='true') AS
 SELECT "t"."id",
    "t"."tenant_id",
    "t"."occurred_at",
    "t"."transaction_type",
    "t"."direction",
    "t"."reason_code",
    "t"."item_kind",
    "t"."item_id",
    "t"."item_name",
    "t"."regulatory_class",
    "t"."report_scheme",
    "t"."reportable",
    "t"."veterinary_license_no",
    "t"."active_ingredient",
    "t"."strength",
    "t"."dosage_form",
    "t"."manufacturer",
    "t"."controlled_drug",
    "t"."controlled_level",
    "t"."smallest_unit",
    "t"."quantity",
    "t"."lot_no",
    "t"."expiry_date",
    "t"."balance_after",
    "t"."owner_id",
    "o"."name" AS "owner_name",
    "t"."pet_id",
    "p"."name" AS "pet_name",
    "p"."species" AS "pet_species",
    "t"."medical_record_id",
    "t"."invoice_id",
    "t"."invoice_item_id",
    "t"."veterinarian_user_id",
    "t"."veterinarian_name",
    "t"."counterparty_name",
    "t"."counterparty_registration_no",
    "t"."document_no",
    "t"."notes",
    "t"."reversal_of",
    "t"."correction_of",
    "t"."created_at"
   FROM (("public"."regulated_drug_transactions" "t"
     LEFT JOIN "public"."owners" "o" ON ((("o"."id" = "t"."owner_id") AND (("o"."tenant_id")::"text" = "t"."tenant_id"))))
     LEFT JOIN "public"."pets" "p" ON ((("p"."id" = "t"."pet_id") AND (("p"."tenant_id")::"text" = "t"."tenant_id"))));

ALTER VIEW "public"."v_regulatory_transactions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."vaccination_records" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_date" "date",
    "next_due_date" "date",
    "vaccine_name" "text",
    "notes" "text",
    "pet_id" "uuid",
    "tenant_id" "text",
    "rabies_details" "jsonb"
);

ALTER TABLE "public"."vaccination_records" OWNER TO "postgres";

ALTER TABLE "public"."vaccination_records" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."vaccination_records_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."vaccine_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "target" "text" NOT NULL,
    "interval_days" integer DEFAULT 365,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."vaccine_types" OWNER TO "postgres";
