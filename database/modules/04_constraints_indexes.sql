-- GENERATED module; execute through 00_install_empty.sql, not by itself.
ALTER TABLE ONLY "booking"."ob_clinics"
    ADD CONSTRAINT "ob_clinics_pkey" PRIMARY KEY ("tenant_id");

ALTER TABLE ONLY "booking"."ob_clinics"
    ADD CONSTRAINT "ob_clinics_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "booking"."ob_closed_days_v60"
    ADD CONSTRAINT "ob_closed_days_v60_pkey" PRIMARY KEY ("tenant_id", "day");

ALTER TABLE ONLY "booking"."ob_requests"
    ADD CONSTRAINT "ob_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "booking"."ob_slots"
    ADD CONSTRAINT "ob_slots_id_tenant_id_key" UNIQUE ("id", "tenant_id");

ALTER TABLE ONLY "booking"."ob_slots"
    ADD CONSTRAINT "ob_slots_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "booking"."ob_slots"
    ADD CONSTRAINT "ob_slots_tenant_id_starts_at_key" UNIQUE ("tenant_id", "starts_at");

ALTER TABLE ONLY "booking"."ob_weekly_v60"
    ADD CONSTRAINT "ob_weekly_v60_pkey" PRIMARY KEY ("tenant_id");

ALTER TABLE ONLY "private"."clinic_multidoctor_settings_v51"
    ADD CONSTRAINT "clinic_multidoctor_settings_v51_pkey" PRIMARY KEY ("tenant_id");

ALTER TABLE ONLY "private"."clinic_visit_claims_v51"
    ADD CONSTRAINT "clinic_visit_claims_v51_claim_id_key" UNIQUE ("claim_id");

ALTER TABLE ONLY "private"."clinic_visit_claims_v51"
    ADD CONSTRAINT "clinic_visit_claims_v51_pkey" PRIMARY KEY ("tenant_id", "pet_id");

ALTER TABLE ONLY "private"."medical_amendments_v53"
    ADD CONSTRAINT "medical_amendments_v53_pkey" PRIMARY KEY ("request_id");

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."breed_images"
    ADD CONSTRAINT "breed_images_pkey" PRIMARY KEY ("tenant_id", "species", "breed_name");

ALTER TABLE ONLY "public"."breeds"
    ADD CONSTRAINT "breeds_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."clinic_settings"
    ADD CONSTRAINT "clinic_settings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."clinic_settings"
    ADD CONSTRAINT "clinic_settings_tenant_id_key" UNIQUE ("tenant_id");

ALTER TABLE ONLY "public"."clinic_trials"
    ADD CONSTRAINT "clinic_trials_pkey" PRIMARY KEY ("tenant_id");

ALTER TABLE ONLY "public"."controlled_drug_counts"
    ADD CONSTRAINT "controlled_drug_counts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."diagnostic_devices"
    ADD CONSTRAINT "diagnostic_devices_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."diagnostic_import_jobs"
    ADD CONSTRAINT "diagnostic_import_jobs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."diagnostic_results"
    ADD CONSTRAINT "diagnostic_results_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."imaging_assets"
    ADD CONSTRAINT "imaging_assets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."imaging_share_tokens"
    ADD CONSTRAINT "imaging_share_tokens_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."imaging_share_tokens"
    ADD CONSTRAINT "imaging_share_tokens_token_key" UNIQUE ("token");

ALTER TABLE ONLY "public"."imaging_shares_v76"
    ADD CONSTRAINT "imaging_shares_v76_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."imaging_shares_v76"
    ADD CONSTRAINT "imaging_shares_v76_token_hash_key" UNIQUE ("token_hash");

ALTER TABLE ONLY "public"."imaging_studies"
    ADD CONSTRAINT "imaging_studies_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."inpatients"
    ADD CONSTRAINT "inpatients_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."item_categories"
    ADD CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."item_categories"
    ADD CONSTRAINT "item_categories_tenant_id_name_key" UNIQUE ("tenant_id", "name");

ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."lab_reports"
    ADD CONSTRAINT "lab_reports_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."lab_tests"
    ADD CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."legacy_medical_histories"
    ADD CONSTRAINT "legacy_medical_histories_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."legacy_medical_histories"
    ADD CONSTRAINT "legacy_medical_histories_tenant_pet_key" UNIQUE ("tenant_id", "pet_id");

ALTER TABLE ONLY "public"."legacy_medical_histories"
    ADD CONSTRAINT "legacy_medical_histories_tenant_source_key" UNIQUE ("tenant_id", "source_pet_no");

ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."medicines"
    ADD CONSTRAINT "medicines_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."owner_code_counters"
    ADD CONSTRAINT "owner_code_counters_pkey" PRIMARY KEY ("tenant_id");

ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_microchip_key" UNIQUE ("microchip");

ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pharmacy_jobs_v9133"
    ADD CONSTRAINT "pharmacy_jobs_v9133_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."platform_operators"
    ADD CONSTRAINT "platform_operators_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."pos_audit_v77"
    ADD CONSTRAINT "pos_audit_v77_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pos_movements_v77"
    ADD CONSTRAINT "pos_movements_v77_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pos_pending_v77"
    ADD CONSTRAINT "pos_pending_v77_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pos_pending_v77"
    ADD CONSTRAINT "pos_pending_v77_tenant_id_appointment_id_key" UNIQUE ("tenant_id", "appointment_id");

ALTER TABLE ONLY "public"."pos_requests_v77"
    ADD CONSTRAINT "pos_requests_v77_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pos_shifts_v77"
    ADD CONSTRAINT "pos_shifts_v77_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."rapid_test_records"
    ADD CONSTRAINT "rapid_test_records_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."rapid_types"
    ADD CONSTRAINT "rapid_types_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."regulated_drug_transactions"
    ADD CONSTRAINT "regulated_drug_transactions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."regulated_lots"
    ADD CONSTRAINT "regulated_lots_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."regulated_lots"
    ADD CONSTRAINT "regulated_lots_tenant_id_item_kind_item_id_lot_no_key" UNIQUE ("tenant_id", "item_kind", "item_id", "lot_no");

ALTER TABLE ONLY "public"."regulatory_report_batch_transactions"
    ADD CONSTRAINT "regulatory_report_batch_transactions_pkey" PRIMARY KEY ("batch_id", "transaction_id");

ALTER TABLE ONLY "public"."regulatory_report_batches"
    ADD CONSTRAINT "regulatory_report_batches_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."report_export_profiles"
    ADD CONSTRAINT "report_export_profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."report_export_profiles"
    ADD CONSTRAINT "report_export_profiles_tenant_id_profile_code_version_key" UNIQUE ("tenant_id", "profile_code", "version");

ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."vaccination_records"
    ADD CONSTRAINT "vaccination_records_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."vaccine_types"
    ADD CONSTRAINT "vaccine_types_pkey" PRIMARY KEY ("id");

CREATE INDEX "ob_requests_slot_status" ON "booking"."ob_requests" USING "btree" ("slot_id", "status");

CREATE INDEX "ob_requests_tenant_created" ON "booking"."ob_requests" USING "btree" ("tenant_id", "created_at" DESC);

CREATE INDEX "ob_requests_tenant_phone_v60" ON "booking"."ob_requests" USING "btree" ("tenant_id", "phone");

CREATE INDEX "appointments_doctor_date_v57" ON "public"."appointments" USING "btree" ("tenant_id", "completed_at", "clinician_id_v57");

CREATE UNIQUE INDEX "clinic_settings_tenant_idx" ON "public"."clinic_settings" USING "btree" ("tenant_id");

CREATE INDEX "diagnostic_devices_tenant_idx" ON "public"."diagnostic_devices" USING "btree" ("tenant_id", "device_type", "is_active");

CREATE INDEX "diagnostic_import_jobs_pet_idx" ON "public"."diagnostic_import_jobs" USING "btree" ("tenant_id", "pet_id", "received_at" DESC);

CREATE INDEX "diagnostic_import_jobs_tenant_idx" ON "public"."diagnostic_import_jobs" USING "btree" ("tenant_id", "received_at" DESC);

CREATE INDEX "diagnostic_results_job_idx" ON "public"."diagnostic_results" USING "btree" ("import_job_id");

CREATE INDEX "diagnostic_results_pet_idx" ON "public"."diagnostic_results" USING "btree" ("tenant_id", "pet_id", "measured_at" DESC);

CREATE INDEX "idx_appointments_pet_id" ON "public"."appointments" USING "btree" ("pet_id");

CREATE INDEX "idx_appointments_tenant_pet" ON "public"."appointments" USING "btree" ("tenant_id", "pet_id");

CREATE INDEX "idx_appointments_tenant_scheduled_at" ON "public"."appointments" USING "btree" ("tenant_id", "scheduled_at");

CREATE INDEX "idx_appointments_tenant_status" ON "public"."appointments" USING "btree" ("tenant_id", "status");

CREATE INDEX "idx_appointments_tenant_time" ON "public"."appointments" USING "btree" ("tenant_id", "appointment_time");

CREATE INDEX "idx_controlled_counts_item" ON "public"."controlled_drug_counts" USING "btree" ("tenant_id", "item_kind", "item_id", "counted_at" DESC);

CREATE INDEX "idx_item_categories_tenant" ON "public"."item_categories" USING "btree" ("tenant_id", "sort_order", "name");

CREATE INDEX "idx_rapid_test_records_pet" ON "public"."rapid_test_records" USING "btree" ("pet_id");

CREATE INDEX "idx_rapid_test_records_tenant" ON "public"."rapid_test_records" USING "btree" ("tenant_id");

CREATE INDEX "idx_reg_tx_controlled" ON "public"."regulated_drug_transactions" USING "btree" ("tenant_id", "controlled_drug", "occurred_at" DESC);

CREATE INDEX "idx_reg_tx_invoice" ON "public"."regulated_drug_transactions" USING "btree" ("invoice_id");

CREATE INDEX "idx_reg_tx_item" ON "public"."regulated_drug_transactions" USING "btree" ("tenant_id", "item_kind", "item_id", "occurred_at" DESC);

CREATE INDEX "idx_reg_tx_medical_record" ON "public"."regulated_drug_transactions" USING "btree" ("medical_record_id");

CREATE INDEX "idx_reg_tx_tenant_date" ON "public"."regulated_drug_transactions" USING "btree" ("tenant_id", "occurred_at" DESC);

CREATE INDEX "idx_regulated_lots_expiry" ON "public"."regulated_lots" USING "btree" ("tenant_id", "expiry_date");

CREATE INDEX "idx_regulated_lots_tenant_item" ON "public"."regulated_lots" USING "btree" ("tenant_id", "item_kind", "item_id");

CREATE INDEX "idx_report_batches_period" ON "public"."regulatory_report_batches" USING "btree" ("tenant_id", "report_type", "period_start", "period_end");

CREATE INDEX "idx_user_profiles_tenant_id" ON "public"."user_profiles" USING "btree" ("tenant_id");

CREATE INDEX "imaging_assets_study_idx" ON "public"."imaging_assets" USING "btree" ("study_id", "dicom_instance_no", "created_at");

CREATE INDEX "imaging_share_tokens_study_idx" ON "public"."imaging_share_tokens" USING "btree" ("tenant_id", "study_id", "created_at" DESC);

CREATE INDEX "imaging_shares_v76_pet_idx" ON "public"."imaging_shares_v76" USING "btree" ("tenant_id", "pet_id", "created_at" DESC);

CREATE INDEX "imaging_studies_pet_idx" ON "public"."imaging_studies" USING "btree" ("tenant_id", "pet_id", "study_date" DESC);

CREATE INDEX "inventory_movements_tenant_date" ON "public"."inventory_movements" USING "btree" ("tenant_id", "created_at" DESC);

CREATE INDEX "invoice_items_invoice_id_idx" ON "public"."invoice_items" USING "btree" ("invoice_id");

CREATE INDEX "invoices_doctor_date_v57" ON "public"."invoices" USING "btree" ("tenant_id", "created_at", "clinician_id_v57");

CREATE INDEX "invoices_family_checkout_v74_idx" ON "public"."invoices" USING "btree" ("tenant_id", "family_checkout_v74") WHERE ("family_checkout_v74" IS NOT NULL);

CREATE UNIQUE INDEX "invoices_request_v57" ON "public"."invoices" USING "btree" ("tenant_id", "checkout_request_v57") WHERE ("checkout_request_v57" IS NOT NULL);

CREATE INDEX "invoices_tenant_date_idx" ON "public"."invoices" USING "btree" ("tenant_id", "created_at" DESC);

CREATE INDEX "items_tenant_idx" ON "public"."items" USING "btree" ("tenant_id");

CREATE INDEX "legacy_medical_histories_pet_idx" ON "public"."legacy_medical_histories" USING "btree" ("tenant_id", "pet_id");

CREATE INDEX "medical_records_created_at_idx" ON "public"."medical_records" USING "btree" ("created_at" DESC);

CREATE INDEX "medical_records_tenant_pet_idx" ON "public"."medical_records" USING "btree" ("tenant_id", "pet_id");

CREATE INDEX "medicines_tenant_idx" ON "public"."medicines" USING "btree" ("tenant_id");

CREATE INDEX "ob_calendar_appointments_v60" ON "public"."appointments" USING "btree" ("tenant_id", "scheduled_at") WHERE ("status" <> '已取消'::"text");

CREATE INDEX "owners_search_idx" ON "public"."owners" USING "btree" ("name", "mobile");

CREATE INDEX "owners_tenant_idx" ON "public"."owners" USING "btree" ("tenant_id");

CREATE UNIQUE INDEX "owners_tenant_legacy_import_key_uidx" ON "public"."owners" USING "btree" ("tenant_id", "legacy_import_key");

CREATE UNIQUE INDEX "owners_tenant_system_code_uidx" ON "public"."owners" USING "btree" ("tenant_id", "system_code");

CREATE INDEX "pets_microchip_idx" ON "public"."pets" USING "btree" ("microchip");

CREATE INDEX "pets_tenant_idx" ON "public"."pets" USING "btree" ("tenant_id");

CREATE UNIQUE INDEX "pets_tenant_legacy_source_no_uidx" ON "public"."pets" USING "btree" ("tenant_id", "legacy_source_no");

CREATE UNIQUE INDEX "pharmacy_one_visit_v9133" ON "public"."pharmacy_jobs_v9133" USING "btree" ("tenant_id", "appointment_id") WHERE ("state" <> 'cancelled'::"text");

CREATE INDEX "pharmacy_queue_v9133" ON "public"."pharmacy_jobs_v9133" USING "btree" ("tenant_id", "state", "created_at");

CREATE UNIQUE INDEX "pos_one_open_shift_v77" ON "public"."pos_shifts_v77" USING "btree" ("tenant_id") WHERE ("closed_at" IS NULL);

CREATE UNIQUE INDEX "reg_product_source_movement_unique" ON "public"."regulated_drug_transactions" USING "btree" ("source_inventory_movement_id") WHERE ("source_inventory_movement_id" IS NOT NULL);
