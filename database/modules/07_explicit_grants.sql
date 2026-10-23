-- GENERATED module; execute through 00_install_empty.sql, not by itself.
GRANT USAGE ON SCHEMA "private" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

REVOKE ALL ON FUNCTION "booking"."close_approved_slot_v91_24"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "booking"."early_checkin_v92_2"("ast" "text", "checked_at" timestamp with time zone, "slot_start" timestamp with time zone) FROM PUBLIC;

REVOKE ALL ON FUNCTION "booking"."generate_v60"("t" "text") FROM PUBLIC;

REVOKE ALL ON FUNCTION "booking"."guard_duplicate_day_v91_25"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "booking"."guard_submission_hours_v91_27"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "booking"."submission_time_error_v91_27"("p_now" timestamp with time zone, "p_slot" timestamp with time zone) FROM PUBLIC;

REVOKE ALL ON FUNCTION "booking"."time_allowed_v60_1"("dt" timestamp with time zone) FROM PUBLIC;

REVOKE ALL ON FUNCTION "booking"."used_v60"("t" "text", "dt" timestamp with time zone) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."capture_doctor_visit_v57"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."checkout_inventory_doctor_v57"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_attribution" "jsonb") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."clear_visit_claim_v51"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."emergency_invoice_v925"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."emergency_visit_guard_v925"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."genblue_backup_core_manifest_v851"("p_expected_tenant" "text") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."genblue_backup_core_parts_v73"("p_expected_tenant" "text") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."genblue_backup_public_manifest_v851"("p_expected_tenant" "text") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."genblue_backup_public_parts_v73"("p_expected_tenant" "text") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."guard_google_calendar_v9135"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."guard_invoice_attribution_v57"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."guard_medical_claim_v51"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."guard_visit_status_v51"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."has_ability"("p_tenant" "text", "p_ability" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "private"."has_ability"("p_tenant" "text", "p_ability" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "private"."is_consulting_doctor_v52"("t" "text", "u" "uuid") FROM PUBLIC;

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."medical_records" TO "authenticated";

GRANT ALL ON TABLE "public"."medical_records" TO "service_role";

REVOKE ALL ON FUNCTION "private"."is_offline_archive_insert_v1"("r" "public"."medical_records") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."medical_revision_guard_v53"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."night_pricing_guard_v93"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."observe_clinical_record_v57"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."product_sale_ledger_trigger"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."record_product_sale_movement"("p_movement_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."restore_original_fields_v63"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."restore_row_check_v63"("t" "text", "n" "text", "r" "jsonb") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."strict_clinical_v51"("t" "text") FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."add_prescription_route_v66"("p_name" "text", "p_kind" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."add_prescription_route_v66"("p_name" "text", "p_kind" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."add_prescription_route_v66"("p_name" "text", "p_kind" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."adjust_inventory"("p_kind" "text", "p_id" "uuid", "p_change" numeric, "p_reason" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."adjust_inventory"("p_kind" "text", "p_id" "uuid", "p_change" numeric, "p_reason" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."adjust_inventory"("p_kind" "text", "p_id" "uuid", "p_change" numeric, "p_reason" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."allocate_owner_system_code"("p_tenant_id" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."allocate_owner_system_code"("p_tenant_id" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."amend_medical_text_v53"("p_record_id" "uuid", "p_expected_version" bigint, "p_chief" "text", "p_reason" "text", "p_request_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."amend_medical_text_v53"("p_record_id" "uuid", "p_expected_version" bigint, "p_chief" "text", "p_reason" "text", "p_request_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."amend_medical_text_v53"("p_record_id" "uuid", "p_expected_version" bigint, "p_chief" "text", "p_reason" "text", "p_request_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."assign_owner_system_code"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."assign_owner_system_code"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."assign_waiting_doctor_v54"("p_appointment_id" "uuid", "p_doctor_id" "uuid", "p_expected_doctor_id" "uuid", "p_expected_doctor" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."assign_waiting_doctor_v54"("p_appointment_id" "uuid", "p_doctor_id" "uuid", "p_expected_doctor_id" "uuid", "p_expected_doctor" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."assign_waiting_doctor_v54"("p_appointment_id" "uuid", "p_doctor_id" "uuid", "p_expected_doctor_id" "uuid", "p_expected_doctor" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."checkout_clinic_doctor_v57"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_appointment_id" "uuid", "p_request_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."checkout_clinic_doctor_v57"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_appointment_id" "uuid", "p_request_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."checkout_clinic_doctor_v57"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_appointment_id" "uuid", "p_request_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."checkout_clinic_medicine_groups_v64"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_appointment_id" "uuid", "p_request_id" "uuid", "p_medication_groups" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."checkout_clinic_medicine_groups_v64"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_appointment_id" "uuid", "p_request_id" "uuid", "p_medication_groups" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."checkout_clinic_medicine_groups_v64"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_appointment_id" "uuid", "p_request_id" "uuid", "p_medication_groups" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."checkout_family_v74"("p_tenant_id" "text", "p_owner_id" "uuid", "p_request_id" "uuid", "p_entries" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."checkout_family_v74"("p_tenant_id" "text", "p_owner_id" "uuid", "p_request_id" "uuid", "p_entries" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."checkout_family_v74"("p_tenant_id" "text", "p_owner_id" "uuid", "p_request_id" "uuid", "p_entries" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."checkout_with_inventory"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."checkout_with_inventory"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."checkout_with_inventory"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."claim_clinic_visit_v51"("p_pet_id" "uuid", "p_appointment_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."claim_clinic_visit_v51"("p_pet_id" "uuid", "p_appointment_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."claim_clinic_visit_v51"("p_pet_id" "uuid", "p_appointment_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."clinic_doctor_state_v51"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."clinic_doctor_state_v51"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."clinic_doctor_state_v51"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_invoice_with_items"("p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total_amount" numeric, "p_items" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_invoice_with_items"("p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total_amount" numeric, "p_items" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."current_tenant_id"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "anon";

GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."delete_imaging_asset_v79"("p_action" "text", "p_asset_id" "uuid", "p_study_id" "uuid", "p_pet_id" "uuid", "p_expected_path" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."delete_imaging_asset_v79"("p_action" "text", "p_asset_id" "uuid", "p_study_id" "uuid", "p_pet_id" "uuid", "p_expected_path" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."delete_imaging_asset_v79"("p_action" "text", "p_asset_id" "uuid", "p_study_id" "uuid", "p_pet_id" "uuid", "p_expected_path" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."doctor_statistics_v57"("p_start" "date", "p_end" "date", "p_doctor" "text", "p_offset" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."doctor_statistics_v57"("p_start" "date", "p_end" "date", "p_doctor" "text", "p_offset" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."doctor_statistics_v57"("p_start" "date", "p_end" "date", "p_doctor" "text", "p_offset" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."emergency_v925"("p_action" "text", "p_data" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."emergency_v925"("p_action" "text", "p_data" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."emergency_v925"("p_action" "text", "p_data" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."genblue_backup_manifest_v851"("p_expected_tenant" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."genblue_backup_manifest_v851"("p_expected_tenant" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."genblue_backup_manifest_v851"("p_expected_tenant" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."genblue_backup_page_v851"("p_expected_tenant" "text", "p_schema" "text", "p_table" "text", "p_signature" "text", "p_offset" integer, "p_limit" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."genblue_backup_page_v851"("p_expected_tenant" "text", "p_schema" "text", "p_table" "text", "p_signature" "text", "p_offset" integer, "p_limit" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."genblue_backup_page_v851"("p_expected_tenant" "text", "p_schema" "text", "p_table" "text", "p_signature" "text", "p_offset" integer, "p_limit" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."genblue_check_backup_objects_v62"("p_expected_tenant" "text", "p_objects" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."genblue_check_backup_objects_v62"("p_expected_tenant" "text", "p_objects" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."genblue_check_backup_objects_v62"("p_expected_tenant" "text", "p_objects" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."genblue_export_clinic_backup_v1"("p_expected_tenant" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."genblue_export_clinic_backup_v1"("p_expected_tenant" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."genblue_export_clinic_backup_v1"("p_expected_tenant" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."genblue_export_clinic_backup_v53"("p_expected_tenant" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."genblue_export_clinic_backup_v53"("p_expected_tenant" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."genblue_export_clinic_backup_v53"("p_expected_tenant" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."genblue_export_clinic_backup_v62"("p_expected_tenant" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."genblue_export_clinic_backup_v62"("p_expected_tenant" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."genblue_export_clinic_backup_v62"("p_expected_tenant" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."genblue_export_clinic_core_v62"("p_expected_tenant" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."genblue_export_clinic_core_v62"("p_expected_tenant" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."genblue_export_clinic_public_v53"("p_expected_tenant" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."genblue_export_clinic_public_v53"("p_expected_tenant" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."genblue_export_clinic_public_v62"("p_expected_tenant" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."genblue_export_clinic_public_v62"("p_expected_tenant" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_medical_text_v53"("p_record_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_medical_text_v53"("p_record_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_medical_text_v53"("p_record_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."google_calendar_admin_v9135"("p_action" "text", "p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."google_calendar_admin_v9135"("p_action" "text", "p_token" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."google_calendar_admin_v9135"("p_action" "text", "p_token" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."google_calendar_feed_v9135"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."google_calendar_feed_v9135"("p_token" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."google_calendar_feed_v9135"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."google_calendar_feed_v9135"("p_token" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."guard_family_checkout_metadata_v74"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."guard_family_checkout_metadata_v74"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."id_for_update_v77"("d" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."id_for_update_v77"("d" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."import_offline_medical_v1"("p_expected_tenant" "text", "p_visits" "jsonb", "p_commit" boolean, "p_confirmation" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."import_offline_medical_v1"("p_expected_tenant" "text", "p_visits" "jsonb", "p_commit" boolean, "p_confirmation" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."import_offline_medical_v1"("p_expected_tenant" "text", "p_visits" "jsonb", "p_commit" boolean, "p_confirmation" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."keep_owner_system_code"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."keep_owner_system_code"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."manage_billing_presets_v80"("p_action" "text", "p_items" "jsonb", "p_expected" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."manage_billing_presets_v80"("p_action" "text", "p_items" "jsonb", "p_expected" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."manage_billing_presets_v80"("p_action" "text", "p_items" "jsonb", "p_expected" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."manage_imaging_share_v76"("p_action" "text", "p_data" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."manage_imaging_share_v76"("p_action" "text", "p_data" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."manage_imaging_share_v76"("p_action" "text", "p_data" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."my_trial_expires_at"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."my_trial_expires_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."my_trial_expires_at"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."night_work_v93"("p_action" "text", "p_data" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."night_work_v93"("p_action" "text", "p_data" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."night_work_v93"("p_action" "text", "p_data" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ob_calendar_v92_2"("p_start" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."ob_calendar_v92_2"("p_start" "date") TO "service_role";

GRANT ALL ON FUNCTION "public"."ob_calendar_v92_2"("p_start" "date") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."ob_public"("p_action" "text", "p_data" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."ob_public"("p_action" "text", "p_data" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ob_restore_slot_v91_26"("p_slot_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."ob_restore_slot_v91_26"("p_slot_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."ob_restore_slot_v91_26"("p_slot_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ob_staff"("p_action" "text", "p_data" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."ob_staff"("p_action" "text", "p_data" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."ob_staff"("p_action" "text", "p_data" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."period_fees_v932"("p_action" "text", "p_data" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."period_fees_v932"("p_action" "text", "p_data" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."period_fees_v932"("p_action" "text", "p_data" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pharmacy_delivery_sync_v9133"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pharmacy_delivery_sync_v9133"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."pharmacy_invoice_guard_v9133"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pharmacy_invoice_guard_v9133"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."pharmacy_mirror_v9133"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pharmacy_mirror_v9133"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."pharmacy_pending_guard_v9133"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pharmacy_pending_guard_v9133"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."pharmacy_room_v9133"("p_action" "text", "p_data" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pharmacy_room_v9133"("p_action" "text", "p_data" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."pharmacy_room_v9133"("p_action" "text", "p_data" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pharmacy_visit_guard_v9133"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pharmacy_visit_guard_v9133"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."platform_provision_trial"("p_operator_id" "uuid", "p_user_id" "uuid", "p_clinic_name" "text", "p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."platform_provision_trial"("p_operator_id" "uuid", "p_user_id" "uuid", "p_clinic_name" "text", "p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_call_checkout_v77"("p_name" "text", "p_args" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_call_checkout_v77"("p_name" "text", "p_args" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_core_v845"("p_action" "text", "p_data" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_core_v845"("p_action" "text", "p_data" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_day_v845"("p_tenant" "text", "p_shift" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_day_v845"("p_tenant" "text", "p_shift" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_guard_pending_visit_v77"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_guard_pending_visit_v77"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_invoice_links_v845"("p_tenant" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_invoice_links_v845"("p_tenant" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_movement_correction_v9119"("p_action" "text", "p_data" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_movement_correction_v9119"("p_action" "text", "p_data" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."pos_movement_correction_v9119"("p_action" "text", "p_data" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_paid_progress_v854"("p_tenant" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_paid_progress_v854"("p_tenant" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_reissue_source_v854"("p_tenant" "text", "p_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_reissue_source_v854"("p_tenant" "text", "p_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_revenue_split_v853"("p_tenant" "text", "p_invoice" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_revenue_split_v853"("p_tenant" "text", "p_invoice" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_review_v849"("p_tenant" "text", "p_shift" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_review_v849"("p_tenant" "text", "p_shift" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_v77"("p_action" "text", "p_data" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_v77"("p_action" "text", "p_data" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."pos_v77"("p_action" "text", "p_data" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_validate_draft_v77"("d" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_validate_draft_v77"("d" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."pos_work_v854"("p_action" "text", "p_data" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."pos_work_v854"("p_action" "text", "p_data" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."preview_clinic_restore_raw_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows_json" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."preview_clinic_restore_raw_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows_json" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."preview_clinic_restore_raw_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows_json" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."preview_clinic_restore_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."preview_clinic_restore_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."preview_clinic_restore_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."receive_regulated_lot"("p_kind" "text", "p_id" "uuid", "p_quantity" numeric, "p_lot_no" "text", "p_expiry_date" "date", "p_supplier_name" "text", "p_purchase_document_no" "text", "p_received_at" timestamp with time zone, "p_notes" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."receive_regulated_lot"("p_kind" "text", "p_id" "uuid", "p_quantity" numeric, "p_lot_no" "text", "p_expiry_date" "date", "p_supplier_name" "text", "p_purchase_document_no" "text", "p_received_at" timestamp with time zone, "p_notes" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."receive_regulated_lot"("p_kind" "text", "p_id" "uuid", "p_quantity" numeric, "p_lot_no" "text", "p_expiry_date" "date", "p_supplier_name" "text", "p_purchase_document_no" "text", "p_received_at" timestamp with time zone, "p_notes" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."release_clinic_visit_v51"("p_pet_id" "uuid", "p_appointment_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."release_clinic_visit_v51"("p_pet_id" "uuid", "p_appointment_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."release_clinic_visit_v51"("p_pet_id" "uuid", "p_appointment_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."resolve_imaging_share_v76"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."resolve_imaging_share_v76"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."restore_missing_clinic_raw_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows_json" "text", "p_backup_sha256" "text", "p_reason" "text", "p_confirmation" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."restore_missing_clinic_raw_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows_json" "text", "p_backup_sha256" "text", "p_reason" "text", "p_confirmation" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."restore_missing_clinic_raw_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows_json" "text", "p_backup_sha256" "text", "p_reason" "text", "p_confirmation" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."restore_missing_clinic_rows_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows" "jsonb", "p_backup_sha256" "text", "p_reason" "text", "p_confirmation" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."restore_missing_clinic_rows_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows" "jsonb", "p_backup_sha256" "text", "p_reason" "text", "p_confirmation" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."restore_missing_clinic_rows_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows" "jsonb", "p_backup_sha256" "text", "p_reason" "text", "p_confirmation" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_archive_medical_v53"("p_id" "uuid", "p_pet_id" "uuid", "p_expected_version" bigint, "p_chief" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_archive_medical_v53"("p_id" "uuid", "p_pet_id" "uuid", "p_expected_version" bigint, "p_chief" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."save_archive_medical_v53"("p_id" "uuid", "p_pet_id" "uuid", "p_expected_version" bigint, "p_chief" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_imaging_upload_v61"("p_study_id" "uuid", "p_asset_id" "uuid", "p_pet_id" "uuid", "p_device_id" "uuid", "p_modality" "text", "p_study_date" timestamp with time zone, "p_body_part" "text", "p_note" "text", "p_filename" "text", "p_mime" "text", "p_size" bigint, "p_extension" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_imaging_upload_v61"("p_study_id" "uuid", "p_asset_id" "uuid", "p_pet_id" "uuid", "p_device_id" "uuid", "p_modality" "text", "p_study_date" timestamp with time zone, "p_body_part" "text", "p_note" "text", "p_filename" "text", "p_mime" "text", "p_size" bigint, "p_extension" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."save_imaging_upload_v61"("p_study_id" "uuid", "p_asset_id" "uuid", "p_pet_id" "uuid", "p_device_id" "uuid", "p_modality" "text", "p_study_date" timestamp with time zone, "p_body_part" "text", "p_note" "text", "p_filename" "text", "p_mime" "text", "p_size" bigint, "p_extension" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_pet_temperature"("p_pet_id" "uuid", "p_temperature" numeric) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_pet_temperature"("p_pet_id" "uuid", "p_temperature" numeric) TO "service_role";

GRANT ALL ON FUNCTION "public"."save_pet_temperature"("p_pet_id" "uuid", "p_temperature" numeric) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."search_imaging_pets_v61"("p_query" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."search_imaging_pets_v61"("p_query" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."search_imaging_pets_v61"("p_query" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_appointments_updated_at"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_appointments_updated_at"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_clinic_multidoctor_v51"("p_enabled" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_clinic_multidoctor_v51"("p_enabled" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_clinic_multidoctor_v51"("p_enabled" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_staff_clinician_v52"("p_user_id" "uuid", "p_enabled" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_staff_clinician_v52"("p_user_id" "uuid", "p_enabled" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_staff_clinician_v52"("p_user_id" "uuid", "p_enabled" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_staff_display_name_v56"("p_user_id" "uuid", "p_display_name" "text", "p_expected_name" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_staff_display_name_v56"("p_user_id" "uuid", "p_display_name" "text", "p_expected_name" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_staff_display_name_v56"("p_user_id" "uuid", "p_display_name" "text", "p_expected_name" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."staff_clinician_flags_v52"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."staff_clinician_flags_v52"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."staff_clinician_flags_v52"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."staff_display_names_v56"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."staff_display_names_v56"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."staff_display_names_v56"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."verify_clinic_visit_v51"("p_pet_id" "uuid", "p_claim_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."verify_clinic_visit_v51"("p_pet_id" "uuid", "p_claim_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."verify_clinic_visit_v51"("p_pet_id" "uuid", "p_claim_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."void_checkout_with_inventory"("p_invoice_id" "uuid", "p_reason" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."void_checkout_with_inventory"("p_invoice_id" "uuid", "p_reason" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."void_checkout_with_inventory"("p_invoice_id" "uuid", "p_reason" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."waiting_doctor_state_v54"("p_appointment_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."waiting_doctor_state_v54"("p_appointment_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."waiting_doctor_state_v54"("p_appointment_id" "uuid") TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."appointments" TO "authenticated";

GRANT ALL ON TABLE "public"."appointments" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."audit_logs" TO "authenticated";

GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";

GRANT ALL ON TABLE "public"."breed_images" TO "authenticated";

GRANT ALL ON TABLE "public"."breed_images" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."breeds" TO "authenticated";

GRANT ALL ON TABLE "public"."breeds" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."categories" TO "authenticated";

GRANT ALL ON TABLE "public"."categories" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."clinic_settings" TO "authenticated";

GRANT ALL ON TABLE "public"."clinic_settings" TO "service_role";

GRANT ALL ON TABLE "public"."clinic_trials" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."controlled_drug_counts" TO "authenticated";

GRANT ALL ON TABLE "public"."controlled_drug_counts" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."diagnostic_devices" TO "authenticated";

GRANT ALL ON TABLE "public"."diagnostic_devices" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."diagnostic_import_jobs" TO "authenticated";

GRANT ALL ON TABLE "public"."diagnostic_import_jobs" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."diagnostic_results" TO "authenticated";

GRANT ALL ON TABLE "public"."diagnostic_results" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imaging_assets" TO "authenticated";

GRANT ALL ON TABLE "public"."imaging_assets" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imaging_share_tokens" TO "authenticated";

GRANT ALL ON TABLE "public"."imaging_share_tokens" TO "service_role";

GRANT ALL ON TABLE "public"."imaging_shares_v76" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."imaging_studies" TO "authenticated";

GRANT ALL ON TABLE "public"."imaging_studies" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."inpatients" TO "authenticated";

GRANT ALL ON TABLE "public"."inpatients" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."inventory_movements" TO "authenticated";

GRANT ALL ON TABLE "public"."inventory_movements" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."invoice_items" TO "authenticated";

GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."invoices" TO "authenticated";

GRANT ALL ON TABLE "public"."invoices" TO "service_role";

GRANT ALL ON TABLE "public"."item_categories" TO "service_role";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."item_categories" TO "authenticated";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."items" TO "authenticated";

GRANT ALL ON TABLE "public"."items" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."lab_reports" TO "authenticated";

GRANT ALL ON TABLE "public"."lab_reports" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."lab_tests" TO "authenticated";

GRANT ALL ON TABLE "public"."lab_tests" TO "service_role";

GRANT ALL ON TABLE "public"."legacy_medical_histories" TO "service_role";

GRANT SELECT,INSERT ON TABLE "public"."legacy_medical_histories" TO "authenticated";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."medicines" TO "authenticated";

GRANT ALL ON TABLE "public"."medicines" TO "service_role";

GRANT ALL ON TABLE "public"."owner_code_counters" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."owners" TO "authenticated";

GRANT ALL ON TABLE "public"."owners" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."pets" TO "authenticated";

GRANT ALL ON TABLE "public"."pets" TO "service_role";

GRANT ALL ON TABLE "public"."pharmacy_jobs_v9133" TO "service_role";

GRANT ALL ON TABLE "public"."platform_operators" TO "service_role";

GRANT ALL ON TABLE "public"."pos_audit_v77" TO "service_role";

GRANT ALL ON SEQUENCE "public"."pos_audit_v77_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."pos_audit_v77_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."pos_audit_v77_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."pos_movements_v77" TO "service_role";

GRANT ALL ON TABLE "public"."pos_pending_v77" TO "service_role";

GRANT ALL ON TABLE "public"."pos_requests_v77" TO "service_role";

GRANT ALL ON TABLE "public"."pos_shifts_v77" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."rapid_test_records" TO "authenticated";

GRANT ALL ON TABLE "public"."rapid_test_records" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."rapid_types" TO "authenticated";

GRANT ALL ON TABLE "public"."rapid_types" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."regulated_drug_transactions" TO "authenticated";

GRANT ALL ON TABLE "public"."regulated_drug_transactions" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."regulated_lots" TO "authenticated";

GRANT ALL ON TABLE "public"."regulated_lots" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."regulatory_report_batch_transactions" TO "authenticated";

GRANT ALL ON TABLE "public"."regulatory_report_batch_transactions" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."regulatory_report_batches" TO "authenticated";

GRANT ALL ON TABLE "public"."regulatory_report_batches" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."report_export_profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."report_export_profiles" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."user_profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."v_controlled_drug_ledger" TO "authenticated";

GRANT ALL ON TABLE "public"."v_controlled_drug_ledger" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."v_regulatory_transactions" TO "authenticated";

GRANT ALL ON TABLE "public"."v_regulatory_transactions" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."vaccination_records" TO "authenticated";

GRANT ALL ON TABLE "public"."vaccination_records" TO "service_role";

GRANT ALL ON SEQUENCE "public"."vaccination_records_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."vaccination_records_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."vaccination_records_id_seq" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."vaccine_types" TO "authenticated";

GRANT ALL ON TABLE "public"."vaccine_types" TO "service_role";
