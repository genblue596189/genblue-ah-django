-- GENERATED module; execute through 00_install_empty.sql, not by itself.
CREATE OR REPLACE TRIGGER "close_approved_slot_v91_24" AFTER INSERT OR UPDATE OF "status" ON "booking"."ob_requests" FOR EACH ROW WHEN (("new"."status" = 'approved'::"text")) EXECUTE FUNCTION "booking"."close_approved_slot_v91_24"();

CREATE OR REPLACE TRIGGER "guard_duplicate_day_v91_25" BEFORE INSERT OR UPDATE OF "status" ON "booking"."ob_requests" FOR EACH ROW WHEN (("new"."status" = ANY (ARRAY['pending'::"text", 'approved'::"text"]))) EXECUTE FUNCTION "booking"."guard_duplicate_day_v91_25"();

CREATE OR REPLACE TRIGGER "guard_submission_hours_v91_27" BEFORE INSERT ON "booking"."ob_requests" FOR EACH ROW WHEN (("new"."status" = 'pending'::"text")) EXECUTE FUNCTION "booking"."guard_submission_hours_v91_27"();

CREATE OR REPLACE TRIGGER "aaa_doctor_capture_v57" BEFORE INSERT OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "private"."capture_doctor_visit_v57"();

CREATE OR REPLACE TRIGGER "clinic_visit_finished_v51" AFTER UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "private"."clear_visit_claim_v51"();

CREATE OR REPLACE TRIGGER "clinic_visit_status_v51" BEFORE INSERT OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "private"."guard_visit_status_v51"();

CREATE OR REPLACE TRIGGER "doctor_record_seen_v57" AFTER INSERT ON "public"."medical_records" FOR EACH ROW EXECUTE FUNCTION "private"."observe_clinical_record_v57"();

CREATE OR REPLACE TRIGGER "emergency_visit_guard_v925" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "private"."emergency_visit_guard_v925"();

CREATE OR REPLACE TRIGGER "guard_family_checkout_metadata_v74" BEFORE INSERT OR UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."guard_family_checkout_metadata_v74"();

CREATE OR REPLACE TRIGGER "guard_google_calendar_v9135" BEFORE INSERT OR UPDATE ON "public"."clinic_settings" FOR EACH ROW EXECUTE FUNCTION "private"."guard_google_calendar_v9135"();

CREATE OR REPLACE TRIGGER "invoice_attribution_v57" BEFORE INSERT OR UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "private"."guard_invoice_attribution_v57"();

CREATE OR REPLACE TRIGGER "medical_visit_owner_v51" BEFORE INSERT OR UPDATE ON "public"."medical_records" FOR EACH ROW EXECUTE FUNCTION "private"."guard_medical_claim_v51"();

CREATE OR REPLACE TRIGGER "owners_assign_system_code" BEFORE INSERT ON "public"."owners" FOR EACH ROW EXECUTE FUNCTION "public"."assign_owner_system_code"();

CREATE OR REPLACE TRIGGER "owners_keep_system_code" BEFORE UPDATE OF "system_code" ON "public"."owners" FOR EACH ROW EXECUTE FUNCTION "public"."keep_owner_system_code"();

CREATE OR REPLACE TRIGGER "pharmacy_delivery_sync_v9133" AFTER UPDATE OF "dispensing" ON "public"."pos_pending_v77" FOR EACH ROW EXECUTE FUNCTION "public"."pharmacy_delivery_sync_v9133"();

CREATE OR REPLACE TRIGGER "pharmacy_invoice_guard_v9133" BEFORE INSERT ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."pharmacy_invoice_guard_v9133"();

CREATE OR REPLACE TRIGGER "pharmacy_mirror_v9133" AFTER INSERT OR UPDATE ON "public"."pharmacy_jobs_v9133" FOR EACH ROW EXECUTE FUNCTION "public"."pharmacy_mirror_v9133"();

CREATE OR REPLACE TRIGGER "pharmacy_pending_guard_v9133" BEFORE UPDATE ON "public"."pos_pending_v77" FOR EACH ROW EXECUTE FUNCTION "public"."pharmacy_pending_guard_v9133"();

CREATE OR REPLACE TRIGGER "pharmacy_visit_guard_v9133" BEFORE UPDATE OF "status" ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."pharmacy_visit_guard_v9133"();

CREATE OR REPLACE TRIGGER "pos_guard_pending_visit_v77" BEFORE UPDATE OF "status" ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."pos_guard_pending_visit_v77"();

CREATE CONSTRAINT TRIGGER "product_sale_ledger_after_checkout" AFTER INSERT ON "public"."inventory_movements" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN ((("new"."tenant_id" = 'GIB-TP-001'::"text") AND ("new"."item_kind" = 'item'::"text"))) EXECUTE FUNCTION "private"."product_sale_ledger_trigger"();

CREATE OR REPLACE TRIGGER "trg_appointments_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_appointments_updated_at"();

CREATE OR REPLACE TRIGGER "zz_emergency_invoice_v925" BEFORE INSERT OR UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "private"."emergency_invoice_v925"();

CREATE OR REPLACE TRIGGER "zz_medical_revision_v53" BEFORE INSERT OR UPDATE ON "public"."medical_records" FOR EACH ROW EXECUTE FUNCTION "private"."medical_revision_guard_v53"();

CREATE OR REPLACE TRIGGER "zz_night_pricing_v93" BEFORE INSERT OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "private"."night_pricing_guard_v93"();

CREATE OR REPLACE TRIGGER "zzz_restore_original_v63" BEFORE INSERT ON "public"."medical_records" FOR EACH ROW EXECUTE FUNCTION "private"."restore_original_fields_v63"();

CREATE OR REPLACE TRIGGER "zzz_restore_original_v63" BEFORE INSERT ON "public"."owners" FOR EACH ROW EXECUTE FUNCTION "private"."restore_original_fields_v63"();

ALTER TABLE ONLY "booking"."ob_closed_days_v60"
    ADD CONSTRAINT "ob_closed_days_v60_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "booking"."ob_clinics"("tenant_id");

ALTER TABLE ONLY "booking"."ob_requests"
    ADD CONSTRAINT "ob_requests_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id");

ALTER TABLE ONLY "booking"."ob_requests"
    ADD CONSTRAINT "ob_requests_slot_id_tenant_id_fkey" FOREIGN KEY ("slot_id", "tenant_id") REFERENCES "booking"."ob_slots"("id", "tenant_id");

ALTER TABLE ONLY "booking"."ob_requests"
    ADD CONSTRAINT "ob_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "booking"."ob_clinics"("tenant_id");

ALTER TABLE ONLY "booking"."ob_slots"
    ADD CONSTRAINT "ob_slots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "booking"."ob_clinics"("tenant_id");

ALTER TABLE ONLY "booking"."ob_weekly_v60"
    ADD CONSTRAINT "ob_weekly_v60_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "booking"."ob_clinics"("tenant_id");

ALTER TABLE ONLY "private"."clinic_visit_claims_v51"
    ADD CONSTRAINT "clinic_visit_claims_v51_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "private"."clinic_visit_claims_v51"
    ADD CONSTRAINT "clinic_visit_claims_v51_clinician_id_fkey" FOREIGN KEY ("clinician_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "private"."clinic_visit_claims_v51"
    ADD CONSTRAINT "clinic_visit_claims_v51_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "private"."medical_amendments_v53"
    ADD CONSTRAINT "medical_amendments_v53_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "private"."medical_amendments_v53"
    ADD CONSTRAINT "medical_amendments_v53_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "public"."medical_records"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_assigned_doctor_id_fkey" FOREIGN KEY ("assigned_doctor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."controlled_drug_counts"
    ADD CONSTRAINT "controlled_drug_counts_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."regulated_lots"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."diagnostic_import_jobs"
    ADD CONSTRAINT "diagnostic_import_jobs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."diagnostic_devices"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."diagnostic_results"
    ADD CONSTRAINT "diagnostic_results_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."diagnostic_devices"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."diagnostic_results"
    ADD CONSTRAINT "diagnostic_results_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "public"."diagnostic_import_jobs"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."imaging_assets"
    ADD CONSTRAINT "imaging_assets_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "public"."imaging_studies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."imaging_share_tokens"
    ADD CONSTRAINT "imaging_share_tokens_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "public"."imaging_studies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."imaging_shares_v76"
    ADD CONSTRAINT "imaging_shares_v76_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."imaging_studies"
    ADD CONSTRAINT "imaging_studies_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."diagnostic_devices"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."inpatients"
    ADD CONSTRAINT "inpatients_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id");

ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."lab_reports"
    ADD CONSTRAINT "lab_reports_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."lab_tests"
    ADD CONSTRAINT "lab_tests_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."legacy_medical_histories"
    ADD CONSTRAINT "legacy_medical_histories_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."platform_operators"
    ADD CONSTRAINT "platform_operators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."pos_movements_v77"
    ADD CONSTRAINT "pos_movements_v77_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."pos_shifts_v77"("id");

ALTER TABLE ONLY "public"."rapid_test_records"
    ADD CONSTRAINT "rapid_test_records_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."regulated_drug_transactions"
    ADD CONSTRAINT "regulated_drug_transactions_correction_of_fkey" FOREIGN KEY ("correction_of") REFERENCES "public"."regulated_drug_transactions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."regulated_drug_transactions"
    ADD CONSTRAINT "regulated_drug_transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."regulated_drug_transactions"
    ADD CONSTRAINT "regulated_drug_transactions_invoice_item_id_fkey" FOREIGN KEY ("invoice_item_id") REFERENCES "public"."invoice_items"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."regulated_drug_transactions"
    ADD CONSTRAINT "regulated_drug_transactions_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."regulated_lots"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."regulated_drug_transactions"
    ADD CONSTRAINT "regulated_drug_transactions_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "public"."medical_records"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."regulated_drug_transactions"
    ADD CONSTRAINT "regulated_drug_transactions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."regulated_drug_transactions"
    ADD CONSTRAINT "regulated_drug_transactions_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."regulated_drug_transactions"
    ADD CONSTRAINT "regulated_drug_transactions_reversal_of_fkey" FOREIGN KEY ("reversal_of") REFERENCES "public"."regulated_drug_transactions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."regulatory_report_batch_transactions"
    ADD CONSTRAINT "regulatory_report_batch_transactions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."regulatory_report_batches"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."regulatory_report_batch_transactions"
    ADD CONSTRAINT "regulatory_report_batch_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."regulated_drug_transactions"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."regulatory_report_batches"
    ADD CONSTRAINT "regulatory_report_batches_correction_of_fkey" FOREIGN KEY ("correction_of") REFERENCES "public"."regulatory_report_batches"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."regulatory_report_batches"
    ADD CONSTRAINT "regulatory_report_batches_export_profile_id_fkey" FOREIGN KEY ("export_profile_id") REFERENCES "public"."report_export_profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
