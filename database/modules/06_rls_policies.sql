-- GENERATED module; execute through 00_install_empty.sql, not by itself.
ALTER TABLE "booking"."ob_clinics" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "booking"."ob_closed_days_v60" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "booking"."ob_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "booking"."ob_slots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "booking"."ob_weekly_v60" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active_clinic_required" ON "public"."audit_logs" AS RESTRICTIVE FOR SELECT TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'read'::"text")));

CREATE POLICY "active_clinic_required" ON "public"."clinic_settings" AS RESTRICTIVE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "active_clinic_required" ON "public"."inventory_movements" AS RESTRICTIVE FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "admin_only_audit_logs" ON "public"."audit_logs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."tenant_id" = ("audit_logs"."tenant_id")::"text") AND ("user_profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."tenant_id" = ("audit_logs"."tenant_id")::"text") AND ("user_profiles"."role" = 'admin'::"text")))));

CREATE POLICY "admin_write_clinic_settings" ON "public"."clinic_settings" TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."tenant_id" = "clinic_settings"."tenant_id") AND ("user_profiles"."role" = 'admin'::"text")))))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."tenant_id" = "clinic_settings"."tenant_id") AND ("user_profiles"."role" = 'admin'::"text"))))));

ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."breed_images" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "breed_images_admin_write" ON "public"."breed_images" TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."tenant_id" = "breed_images"."tenant_id") AND ("p"."role" = 'admin'::"text")))))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."tenant_id" = "breed_images"."tenant_id") AND ("p"."role" = 'admin'::"text"))))));

CREATE POLICY "breed_images_read_tenant" ON "public"."breed_images" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));

ALTER TABLE "public"."breeds" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clinic_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clinic_trials" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."controlled_drug_counts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."diagnostic_devices" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."diagnostic_import_jobs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."diagnostic_results" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."imaging_assets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."imaging_share_tokens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."imaging_shares_v76" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."imaging_studies" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imaging_v61_pet_guard" ON "public"."imaging_studies" AS RESTRICTIVE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."pets" "p"
  WHERE (("p"."id" = "imaging_studies"."pet_id") AND (("p"."tenant_id")::"text" = "imaging_studies"."tenant_id"))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."pets" "p"
  WHERE (("p"."id" = "imaging_studies"."pet_id") AND (("p"."tenant_id")::"text" = "imaging_studies"."tenant_id")))) AND (("device_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."diagnostic_devices" "d"
  WHERE (("d"."id" = "imaging_studies"."device_id") AND ("d"."tenant_id" = "imaging_studies"."tenant_id")))))));

CREATE POLICY "imaging_v61_study_guard" ON "public"."imaging_assets" AS RESTRICTIVE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."imaging_studies" "s"
  WHERE (("s"."id" = "imaging_assets"."study_id") AND ("s"."tenant_id" = "imaging_assets"."tenant_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."imaging_studies" "s"
  WHERE (("s"."id" = "imaging_assets"."study_id") AND ("s"."tenant_id" = "imaging_assets"."tenant_id")))));

ALTER TABLE "public"."inpatients" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_movements_tenant_read" ON "public"."inventory_movements" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));

ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."item_categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."lab_reports" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."lab_tests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legacy_histories_insert" ON "public"."legacy_medical_histories" FOR INSERT TO "authenticated" WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'admin'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."pets" "p"
  WHERE (("p"."id" = "legacy_medical_histories"."pet_id") AND (("p"."tenant_id")::"text" = ("legacy_medical_histories"."tenant_id")::"text") AND ("p"."legacy_source_no" = "legacy_medical_histories"."source_pet_no"))))));

CREATE POLICY "legacy_histories_read" ON "public"."legacy_medical_histories" FOR SELECT TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'read'::"text")));

ALTER TABLE "public"."legacy_medical_histories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."medical_records" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."medicines" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."owner_code_counters" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."owners" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pharmacy_jobs_v9133" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."platform_operators" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pos_audit_v77" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pos_movements_v77" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pos_pending_v77" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pos_requests_v77" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pos_shifts_v77" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rapid_test_records" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rapid_types" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."regulated_drug_transactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."regulated_lots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."regulatory_report_batch_transactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."regulatory_report_batches" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."report_export_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_delete" ON "public"."appointments" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'appointment'::"text")));

CREATE POLICY "role_delete" ON "public"."breeds" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_delete" ON "public"."categories" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_delete" ON "public"."diagnostic_devices" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_delete" ON "public"."diagnostic_import_jobs" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_delete" ON "public"."diagnostic_results" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_delete" ON "public"."imaging_assets" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_delete" ON "public"."imaging_share_tokens" FOR DELETE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'clinical'::"text")));

CREATE POLICY "role_delete" ON "public"."imaging_studies" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_delete" ON "public"."inpatients" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_delete" ON "public"."item_categories" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_delete" ON "public"."items" FOR DELETE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'admin'::"text")));

CREATE POLICY "role_delete" ON "public"."lab_reports" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_delete" ON "public"."lab_tests" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_delete" ON "public"."medical_records" FOR DELETE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'clinical'::"text")));

CREATE POLICY "role_delete" ON "public"."medicines" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_delete" ON "public"."owners" FOR DELETE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'operational'::"text")));

CREATE POLICY "role_delete" ON "public"."pets" FOR DELETE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'operational'::"text")));

CREATE POLICY "role_delete" ON "public"."rapid_test_records" FOR DELETE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'clinical'::"text")));

CREATE POLICY "role_delete" ON "public"."rapid_types" FOR DELETE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'admin'::"text")));

CREATE POLICY "role_delete" ON "public"."regulated_lots" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_delete" ON "public"."regulatory_report_batch_transactions" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."regulatory_report_batches" "b"
  WHERE (("b"."id" = "regulatory_report_batch_transactions"."batch_id") AND ("b"."tenant_id" = "public"."current_tenant_id"())))) AND "private"."has_ability"("public"."current_tenant_id"(), 'admin'::"text")));

CREATE POLICY "role_delete" ON "public"."regulatory_report_batches" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_delete" ON "public"."report_export_profiles" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_delete" ON "public"."vaccination_records" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_delete" ON "public"."vaccine_types" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'appointment'::"text")));

CREATE POLICY "role_insert" ON "public"."breeds" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."controlled_drug_counts" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."diagnostic_devices" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."diagnostic_import_jobs" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_insert" ON "public"."diagnostic_results" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_insert" ON "public"."imaging_assets" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_insert" ON "public"."imaging_share_tokens" FOR INSERT TO "authenticated" WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'clinical'::"text")));

CREATE POLICY "role_insert" ON "public"."imaging_studies" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_insert" ON "public"."inpatients" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_insert" ON "public"."item_categories" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."items" FOR INSERT TO "authenticated" WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."lab_reports" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_insert" ON "public"."lab_tests" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."medical_records" FOR INSERT TO "authenticated" WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'clinical'::"text")));

CREATE POLICY "role_insert" ON "public"."medicines" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."owners" FOR INSERT TO "authenticated" WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'operational'::"text")));

CREATE POLICY "role_insert" ON "public"."pets" FOR INSERT TO "authenticated" WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'operational'::"text")));

CREATE POLICY "role_insert" ON "public"."rapid_test_records" FOR INSERT TO "authenticated" WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'clinical'::"text")));

CREATE POLICY "role_insert" ON "public"."rapid_types" FOR INSERT TO "authenticated" WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."regulated_drug_transactions" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."regulated_lots" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."regulatory_report_batch_transactions" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."regulatory_report_batches" "b"
  WHERE (("b"."id" = "regulatory_report_batch_transactions"."batch_id") AND ("b"."tenant_id" = "public"."current_tenant_id"())))) AND "private"."has_ability"("public"."current_tenant_id"(), 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."regulatory_report_batches" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."report_export_profiles" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_insert" ON "public"."vaccination_records" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_insert" ON "public"."vaccine_types" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_select" ON "public"."appointments" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."breeds" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."categories" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."controlled_drug_counts" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_select" ON "public"."diagnostic_devices" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."diagnostic_import_jobs" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."diagnostic_results" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."imaging_assets" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."imaging_share_tokens" FOR SELECT TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."imaging_studies" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."inpatients" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."invoice_items" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."invoices" "i"
  WHERE (("i"."id" = "invoice_items"."invoice_id") AND (("i"."tenant_id")::"text" = "public"."current_tenant_id"())))) AND "private"."has_ability"("public"."current_tenant_id"(), 'checkout'::"text")));

CREATE POLICY "role_select" ON "public"."invoices" FOR SELECT TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'checkout'::"text")));

CREATE POLICY "role_select" ON "public"."item_categories" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."items" FOR SELECT TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."lab_reports" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."lab_tests" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."medical_records" FOR SELECT TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."medicines" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."owners" FOR SELECT TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."pets" FOR SELECT TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."rapid_test_records" FOR SELECT TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."rapid_types" FOR SELECT TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."regulated_drug_transactions" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_select" ON "public"."regulated_lots" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_select" ON "public"."regulatory_report_batch_transactions" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."regulatory_report_batches" "b"
  WHERE (("b"."id" = "regulatory_report_batch_transactions"."batch_id") AND ("b"."tenant_id" = "public"."current_tenant_id"())))) AND "private"."has_ability"("public"."current_tenant_id"(), 'admin'::"text")));

CREATE POLICY "role_select" ON "public"."regulatory_report_batches" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_select" ON "public"."report_export_profiles" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_select" ON "public"."vaccination_records" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_select" ON "public"."vaccine_types" FOR SELECT TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'read'::"text")));

CREATE POLICY "role_update" ON "public"."appointments" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'appointment'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'appointment'::"text")));

CREATE POLICY "role_update" ON "public"."breeds" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."categories" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."controlled_drug_counts" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."diagnostic_devices" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."diagnostic_import_jobs" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_update" ON "public"."diagnostic_results" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_update" ON "public"."imaging_assets" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_update" ON "public"."imaging_share_tokens" FOR UPDATE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'clinical'::"text"))) WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'clinical'::"text")));

CREATE POLICY "role_update" ON "public"."imaging_studies" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_update" ON "public"."inpatients" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_update" ON "public"."item_categories" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."items" FOR UPDATE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'admin'::"text"))) WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."lab_reports" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_update" ON "public"."lab_tests" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."medical_records" FOR UPDATE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'clinical'::"text"))) WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'clinical'::"text")));

CREATE POLICY "role_update" ON "public"."medicines" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."owners" FOR UPDATE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'operational'::"text"))) WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'operational'::"text")));

CREATE POLICY "role_update" ON "public"."pets" FOR UPDATE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'operational'::"text"))) WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'operational'::"text")));

CREATE POLICY "role_update" ON "public"."rapid_test_records" FOR UPDATE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'clinical'::"text"))) WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'clinical'::"text")));

CREATE POLICY "role_update" ON "public"."rapid_types" FOR UPDATE TO "authenticated" USING (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'admin'::"text"))) WITH CHECK (((("tenant_id")::"text" = "public"."current_tenant_id"()) AND "private"."has_ability"(("tenant_id")::"text", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."regulated_drug_transactions" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."regulated_lots" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."regulatory_report_batch_transactions" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."regulatory_report_batches" "b"
  WHERE (("b"."id" = "regulatory_report_batch_transactions"."batch_id") AND ("b"."tenant_id" = "public"."current_tenant_id"())))) AND "private"."has_ability"("public"."current_tenant_id"(), 'admin'::"text"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."regulatory_report_batches" "b"
  WHERE (("b"."id" = "regulatory_report_batch_transactions"."batch_id") AND ("b"."tenant_id" = "public"."current_tenant_id"())))) AND "private"."has_ability"("public"."current_tenant_id"(), 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."regulatory_report_batches" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."report_export_profiles" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "role_update" ON "public"."vaccination_records" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'clinical'::"text")));

CREATE POLICY "role_update" ON "public"."vaccine_types" FOR UPDATE TO "authenticated" USING ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text"))) WITH CHECK ((("tenant_id" = "public"."current_tenant_id"()) AND "private"."has_ability"("tenant_id", 'admin'::"text")));

CREATE POLICY "staff_admin_read_clinic_settings" ON "public"."clinic_settings" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"()));

ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_admin_select_tenant" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING ("private"."has_ability"("tenant_id", 'admin'::"text"));

CREATE POLICY "user_profiles_select_own" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

ALTER TABLE "public"."vaccination_records" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."vaccine_types" ENABLE ROW LEVEL SECURITY;
