-- GENERATED module; execute through 00_install_empty.sql, not by itself.
CREATE OR REPLACE FUNCTION "booking"."close_approved_slot_v91_24"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
 -- 與申請轉 approved 同一交易：關閉失敗會一併回滾，不會留下已確認但未關閉。
 UPDATE booking.ob_slots
 SET enabled=false, closed_v60=true
 WHERE id=NEW.slot_id AND tenant_id=NEW.tenant_id;
 IF NOT FOUND THEN
  RAISE EXCEPTION '預約時段不存在或院所不符，確認未完成，請重新讀取核對';
 END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "booking"."close_approved_slot_v91_24"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "booking"."early_checkin_v92_2"("ast" "text", "checked_at" timestamp with time zone, "slot_start" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
 SELECT coalesce(ast IN ('候診中','診間看診中','已完成') AND checked_at IS NOT NULL
 AND checked_at<slot_start AND checked_at<=now(),false)
$$;

ALTER FUNCTION "booking"."early_checkin_v92_2"("ast" "text", "checked_at" timestamp with time zone, "slot_start" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "booking"."generate_v60"("t" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE cfg booking.ob_weekly_v60;
BEGIN
 PERFORM 1 FROM booking.ob_clinics WHERE tenant_id=t FOR UPDATE;
 SELECT * INTO cfg FROM booking.ob_weekly_v60 WHERE tenant_id=t;
 IF cfg.tenant_id IS NULL THEN RETURN; END IF;
 -- Rolling horizon: refreshed whenever the public page or staff screen is read.
 WITH desired AS (
  SELECT DISTINCT ((d.day::date+(r.value->>'start')::time)+n.step*interval '30 minutes') AT TIME ZONE 'Asia/Taipei' AS dt
  FROM generate_series((now() AT TIME ZONE 'Asia/Taipei')::date::timestamp,
   (now() AT TIME ZONE 'Asia/Taipei')::date::timestamp+interval '30 days',interval '1 day') d(day)
  CROSS JOIN jsonb_array_elements(cfg.rules) r(value)
  CROSS JOIN LATERAL generate_series(0,((extract(epoch FROM ((r.value->>'end')::time-(r.value->>'start')::time))/1800)::integer)-1) n(step)
  WHERE cfg.enabled AND extract(dow FROM d.day)::integer=(r.value->>'dow')::integer
 ), changed AS (
  INSERT INTO booking.ob_slots(tenant_id,starts_at,capacity,enabled,generated_v60)
  SELECT t,dt,1,NOT EXISTS(SELECT 1 FROM booking.ob_closed_days_v60 c WHERE c.tenant_id=t AND c.day=(dt AT TIME ZONE 'Asia/Taipei')::date),true
  FROM desired WHERE dt>now() AND dt<now()+interval '30 days'
  ON CONFLICT(tenant_id,starts_at) DO UPDATE SET capacity=excluded.capacity,
   generated_v60=true,enabled=excluded.enabled AND NOT booking.ob_slots.closed_v60
  RETURNING id
 )
 UPDATE booking.ob_slots sl SET enabled=false WHERE sl.tenant_id=t AND sl.generated_v60 AND sl.starts_at>now()
  AND NOT EXISTS(SELECT 1 FROM desired WHERE dt=sl.starts_at);
 UPDATE booking.ob_slots sl SET enabled=false WHERE sl.tenant_id=t AND sl.starts_at>now()
  AND EXISTS(SELECT 1 FROM booking.ob_closed_days_v60 c WHERE c.tenant_id=t AND c.day=(sl.starts_at AT TIME ZONE 'Asia/Taipei')::date);
END $$;

ALTER FUNCTION "booking"."generate_v60"("t" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "booking"."guard_duplicate_day_v91_25"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE slot_time timestamptz; day_start timestamptz; day_end timestamptz;
        confirmed_pet uuid; warning constant text := '您已有本日預約申請，請勿重複送出。如需取消或更改時間，請來電或透過 LINE 訊息通知本院。';
BEGIN
 -- 沿用公開送單與院內確認的 clinic 鎖定順序，讓並行送單依序檢查。
 PERFORM 1 FROM booking.ob_clinics WHERE tenant_id=NEW.tenant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到院所設定，請聯絡醫院'; END IF;
 SELECT starts_at INTO slot_time FROM booking.ob_slots WHERE id=NEW.slot_id AND tenant_id=NEW.tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION '預約時段不存在或院所不符'; END IF;
 day_start:=((slot_time AT TIME ZONE 'Asia/Taipei')::date)::timestamp AT TIME ZONE 'Asia/Taipei';
 day_end:=day_start+interval '1 day';
 IF TG_OP='INSERT' AND NEW.status='pending' THEN
  IF EXISTS (
   SELECT 1 FROM booking.ob_requests q
   JOIN booking.ob_slots sl ON sl.id=q.slot_id AND sl.tenant_id=q.tenant_id
   LEFT JOIN public.appointments a ON a.id=q.appointment_id AND a.tenant_id=q.tenant_id
   WHERE q.tenant_id=NEW.tenant_id AND q.id<>NEW.id
    AND regexp_replace(q.phone,'[^0-9]','','g')=regexp_replace(NEW.phone,'[^0-9]','','g')
    AND lower(btrim(q.pet_name))=lower(btrim(NEW.pet_name)) AND q.species=NEW.species
    AND sl.starts_at>=day_start AND sl.starts_at<day_end
    AND (q.status='pending' OR (q.status='approved' AND (a.id IS NULL OR a.status<>'已取消')))
  ) THEN RAISE EXCEPTION '%',warning; END IF;
  -- 已由櫃台／電話建立的院內預約也納入同日比對。
  IF EXISTS (
   SELECT 1 FROM public.appointments a
   JOIN public.pets p ON p.id=a.pet_id AND p.tenant_id=a.tenant_id
   JOIN public.owners o ON o.id=p.owner_id AND o.tenant_id=a.tenant_id
   WHERE a.tenant_id=NEW.tenant_id AND a.status<>'已取消'
    AND a.scheduled_at>=day_start AND a.scheduled_at<day_end
    AND lower(btrim(p.name))=lower(btrim(NEW.pet_name))
    AND (p.species=NEW.species OR NEW.species='其他')
    AND (regexp_replace(coalesce(o.mobile,''),'[^0-9]','','g')=regexp_replace(NEW.phone,'[^0-9]','','g')
      OR regexp_replace(coalesce(o.phone,''),'[^0-9]','','g')=regexp_replace(NEW.phone,'[^0-9]','','g'))
  ) THEN RAISE EXCEPTION '%',warning; END IF;
 ELSIF NEW.status='approved' THEN
  -- 家人使用不同電話代約，於院內核對後改以真正 pet_id 檢查。
  SELECT pet_id INTO confirmed_pet FROM public.appointments
   WHERE id=NEW.appointment_id AND tenant_id=NEW.tenant_id;
  IF confirmed_pet IS NULL THEN RAISE EXCEPTION '找不到對應院內預約，確認未完成'; END IF;
  IF EXISTS (SELECT 1 FROM public.appointments a
    WHERE a.tenant_id=NEW.tenant_id AND a.pet_id=confirmed_pet
     AND a.id<>NEW.appointment_id AND a.status<>'已取消'
     AND a.scheduled_at>=day_start AND a.scheduled_at<day_end)
  THEN RAISE EXCEPTION '%',warning; END IF;
 END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "booking"."guard_duplicate_day_v91_25"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "booking"."guard_submission_hours_v91_27"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE slot_time timestamptz; problem text;
BEGIN
 SELECT starts_at INTO slot_time FROM booking.ob_slots WHERE id=NEW.slot_id AND tenant_id=NEW.tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION '預約時段不存在或院所不符'; END IF;
 -- clock_timestamp 依真正收件時間判斷，避免跨過22:00的長交易仍能送單。
 problem:=booking.submission_time_error_v91_27(clock_timestamp(),slot_time);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem; END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "booking"."guard_submission_hours_v91_27"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "booking"."submission_time_error_v91_27"("p_now" timestamp with time zone, "p_slot" timestamp with time zone) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
DECLARE local_now timestamp:=p_now AT TIME ZONE 'Asia/Taipei';
        local_slot timestamp:=p_slot AT TIME ZONE 'Asia/Taipei';
BEGIN
 IF local_now::time<time '09:00' OR local_now::time>=time '21:00' THEN
  RETURN '線上預約申請受理時間為每日09:00至21:00前，請於受理時間內送出。您仍可查詢既有預約；如需取消或更改時間，請來電或透過 LINE 訊息通知本院。';
 END IF;
 IF local_slot::time<time '12:00' AND local_now>=(local_slot::date-1)+time '21:00' THEN
  RETURN '上午時段須於前一天21:00前申請，當日上午不受理線上申請，或是請來電或透過 LINE 訊息聯絡本院。';
 END IF;
 RETURN NULL;
END $$;

ALTER FUNCTION "booking"."submission_time_error_v91_27"("p_now" timestamp with time zone, "p_slot" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "booking"."time_allowed_v60_1"("dt" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 SELECT coalesce(dt>now()+interval '1 hour' AND dt<now()+interval '30 days' AND (
  (dt AT TIME ZONE 'Asia/Taipei')::date>(now() AT TIME ZONE 'Asia/Taipei')::date OR
  ((dt AT TIME ZONE 'Asia/Taipei')::date=(now() AT TIME ZONE 'Asia/Taipei')::date AND
   (CASE WHEN extract(hour FROM dt AT TIME ZONE 'Asia/Taipei')<12 THEN 0 WHEN extract(hour FROM dt AT TIME ZONE 'Asia/Taipei')<18 THEN 1 ELSE 2 END)>
   (CASE WHEN extract(hour FROM now() AT TIME ZONE 'Asia/Taipei')<12 THEN 0 WHEN extract(hour FROM now() AT TIME ZONE 'Asia/Taipei')<18 THEN 1 ELSE 2 END))),false)
$$;

ALTER FUNCTION "booking"."time_allowed_v60_1"("dt" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "booking"."used_v60"("t" "text", "dt" timestamp with time zone) RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 SELECT ((SELECT count(*) FROM booking.ob_requests q JOIN booking.ob_slots sl ON sl.id=q.slot_id AND sl.tenant_id=q.tenant_id
  WHERE q.tenant_id=t AND q.status='pending' AND sl.starts_at>=dt AND sl.starts_at<dt+interval '30 minutes')+
 (SELECT count(*) FROM public.appointments a WHERE a.tenant_id=t AND a.status<>'已取消'
  AND a.scheduled_at>=dt AND a.scheduled_at<dt+interval '30 minutes'
  AND NOT booking.early_checkin_v92_2(a.status,a.checked_in_at,dt)))::integer
$$;

ALTER FUNCTION "booking"."used_v60"("t" "text", "dt" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."capture_doctor_visit_v57"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE c private.clinic_visit_claims_v51;
BEGIN
 IF TG_OP='INSERT' THEN NEW.clinician_id_v57:=NULL;NEW.clinician_name_v57:=NULL;NEW.clinical_record_v57:=false;
 ELSE NEW.clinician_id_v57:=OLD.clinician_id_v57;NEW.clinician_name_v57:=OLD.clinician_name_v57;NEW.clinical_record_v57:=OLD.clinical_record_v57; END IF;
 SELECT * INTO c FROM private.clinic_visit_claims_v51 WHERE tenant_id=NEW.tenant_id AND pet_id=NEW.pet_id AND appointment_id=NEW.id FOR UPDATE;
 IF c.claim_id IS NOT NULL THEN
  IF NEW.status='診間看診中' AND (TG_OP='INSERT' OR OLD.status<>'診間看診中') THEN NEW.clinician_id_v57:=c.clinician_id;NEW.clinician_name_v57:=c.clinician_name; END IF;
  IF NEW.clinician_id_v57=c.clinician_id AND EXISTS(SELECT 1 FROM public.medical_records r WHERE r.tenant_id=NEW.tenant_id AND r.pet_id=NEW.pet_id AND r.created_at>=c.claimed_at) THEN NEW.clinical_record_v57:=true; END IF;
 END IF;
 IF NEW.status='已完成' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN NEW.completed_at:=now(); END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "private"."capture_doctor_visit_v57"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."checkout_inventory_doctor_v57"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_attribution" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_invoice uuid; v_tenant text; v_line jsonb; v_kind text; v_id uuid;
 v_qty numeric; v_price numeric; v_name text; v_before numeric; v_actual_name text; v_sum numeric:=0;
begin
 IF auth.uid() IS NULL OR NOT private.has_ability(public.current_tenant_id(), 'checkout') THEN RAISE EXCEPTION '此帳號沒有操作權限' USING ERRCODE = '42501'; END IF;
 v_tenant:=public.current_tenant_id();
 if auth.uid() is null or v_tenant is null or p_tenant_id is distinct from v_tenant then raise exception '沒有此醫院的結帳權限'; end if;
 if p_checkout_type is null or p_checkout_type='' or p_subtotal<0 or p_discount<0 or p_total<0
   or p_subtotal is null or p_discount is null or p_total is null or p_discount>p_subtotal
   or abs(p_total-(p_subtotal-p_discount))>0.02 then raise exception '結帳金額不正確'; end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)=0 then raise exception '帳單沒有明細'; end if;
 if p_owner_id is not null and not exists(select 1 from public.owners where id=p_owner_id and tenant_id=v_tenant) then raise exception '飼主不屬於此醫院'; end if;
 if p_pet_id is not null and not exists(select 1 from public.pets where id=p_pet_id and tenant_id=v_tenant) then raise exception '寵物不屬於此醫院'; end if;
 insert into public.invoices(tenant_id,owner_id,pet_id,checkout_type,category,subtotal,discount,total_amount,appointment_id_v57,clinician_id_v57,clinician_name_v57,cashier_id_v57,checkout_request_v57,checkout_payload_v57)
 values(v_tenant,p_owner_id,p_pet_id,p_checkout_type,p_category,p_subtotal,p_discount,p_total,(p_attribution->>'appointment_id')::uuid,(p_attribution->>'clinician_id')::uuid,p_attribution->>'clinician_name',auth.uid(),(p_attribution->>'request_id')::uuid,p_attribution->'payload') returning id into v_invoice;
 for v_line in select value from jsonb_array_elements(p_lines) loop
   v_name:=trim(v_line->>'item_name'); v_qty:=(v_line->>'quantity')::numeric; v_price:=(v_line->>'unit_price')::numeric;
   v_kind:=coalesce(v_line->>'stock_kind','');
   v_id:=nullif(v_line->>'stock_id','')::uuid;
   if v_name is null or v_name='' or v_qty is null or v_qty<=0 or v_price is null or v_price<0 then raise exception '明細的名稱、數量或單價不正確'; end if;
   if v_kind not in ('','item','medicine') or (v_kind='' and v_id is not null) or (v_kind<>'' and v_id is null) then raise exception '庫存品項識別錯誤'; end if;
   if v_kind='item' then
     if v_qty<>trunc(v_qty) then raise exception '商品數量需為整數'; end if;
     select stock_qty,name into v_before,v_actual_name from public.items where id=v_id and tenant_id=v_tenant for update;
     if not found then raise exception '商品已不存在'; end if;
     if v_actual_name<>v_name then raise exception '商品名稱已變更，請重新選取'; end if;
     if coalesce(v_before,0)<v_qty then raise exception '商品「%」庫存不足（剩餘 %）',v_name,coalesce(v_before,0); end if;
     update public.items set stock_qty=v_before-v_qty where id=v_id and tenant_id=v_tenant;
   elsif v_kind='medicine' then
     select stock_qty,name into v_before,v_actual_name from public.medicines where id=v_id and tenant_id=v_tenant for update;
     if not found then raise exception '藥品已不存在'; end if;
     if position(v_actual_name in v_name)=0 then raise exception '處方藥品名稱已變更，請重新開立'; end if;
     if coalesce(v_before,0)<v_qty then raise exception '藥品「%」庫存不足（剩餘 %）',v_actual_name,coalesce(v_before,0); end if;
     update public.medicines set stock_qty=v_before-v_qty where id=v_id and tenant_id=v_tenant;
   end if;
   if v_kind<>'' then
     insert into public.inventory_movements(tenant_id,item_kind,item_id,item_name,change_qty,qty_before,qty_after,reason)
     values(v_tenant,v_kind,v_id,v_actual_name,-v_qty,v_before,v_before-v_qty,'結帳 '||v_invoice::text);
   end if;
   v_sum:=v_sum+v_qty*v_price;
   insert into public.invoice_items(invoice_id,item_name,quantity,unit_price,subtotal)
   values(v_invoice,v_name,v_qty,v_price,v_qty*v_price);
 end loop;
 if abs(v_sum-p_subtotal)>0.02 then raise exception '明細合計與帳單金額不符'; end if;
 return v_invoice;
end $$;

ALTER FUNCTION "private"."checkout_inventory_doctor_v57"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_attribution" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."clear_visit_claim_v51"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
 IF OLD.status='診間看診中' AND NEW.status<>'診間看診中' THEN DELETE FROM private.clinic_visit_claims_v51 WHERE tenant_id=OLD.tenant_id AND appointment_id=OLD.id; END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "private"."clear_visit_claim_v51"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."emergency_invoice_v925"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.is_emergency_v925:=coalesce((SELECT a.is_emergency_v925 OR a.notes ~ E'(^|\\n)\\[來院目的\\] 急診($|\\n)' FROM public.appointments a WHERE a.id=NEW.appointment_id_v57 AND a.tenant_id=NEW.tenant_id AND a.pet_id=NEW.pet_id),false);
 ELSIF NEW.is_emergency_v925 IS DISTINCT FROM OLD.is_emergency_v925 THEN RAISE EXCEPTION '帳單急診分類不可改寫' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $_$;

ALTER FUNCTION "private"."emergency_invoice_v925"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."emergency_visit_guard_v925"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.is_emergency_v925 AND ROW(NEW.is_emergency_v925,NEW.emergency_fee_v925) IS DISTINCT FROM ROW(OLD.is_emergency_v925,OLD.emergency_fee_v925) THEN RAISE EXCEPTION '急診掛號屬性與原預設費用已保存，實收費用請於帳單調整'; END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "private"."emergency_visit_guard_v925"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."genblue_backup_core_manifest_v851"("p_expected_tenant" "text") RETURNS TABLE("payload" "text", "export_table_count" integer, "export_total_rows" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    SET "jit" TO 'off'
    AS $_$
DECLARE t text:=public.current_tenant_id(); snapshot text; v_base text; v_extra text; v_table_count integer; v_total_rows bigint; entries jsonb:='{}'::jsonb; rows jsonb; v_sig text; v_count bigint; n text; private_rows bigint:=0;
BEGIN
 IF auth.uid() IS NULL OR p_expected_tenant IS DISTINCT FROM t OR NOT private.has_ability(t,'admin') THEN RAISE EXCEPTION '只有本院管理者可備份' USING ERRCODE='42501'; END IF;
 IF to_regprocedure('public.genblue_export_clinic_public_v53(text)') IS NULL THEN RAISE EXCEPTION '請先安裝原院一鍵備份函式，再重跑v53更新SQL'; END IF;
 SELECT x.payload,x.export_table_count,x.export_total_rows INTO snapshot,v_table_count,v_total_rows FROM private.genblue_backup_public_manifest_v851(t) x;
 FOREACH n IN ARRAY ARRAY['clinic_visit_claims_v51','clinic_multidoctor_settings_v51','medical_amendments_v53'] LOOP
  EXECUTE format('SELECT count(*),md5(coalesce(string_agg(q.ctid::text||'':''||q.xmin::text,'','' ORDER BY q.ctid),'''')) FROM private.%I q WHERE tenant_id::text=$1',n) INTO v_count,v_sig USING t; rows:='[]'::jsonb;
  entries:=entries||jsonb_build_object(n,jsonb_build_object('source_schema','private','row_count',v_count,'signature',v_sig,'rows',rows));private_rows:=private_rows+v_count;
 END LOOP;
 -- genblue_backup_parts_v73: keep data text intact; carry counts separately.
 v_extra:=json_build_object('private_tables',entries)::text;
 snapshot:=substr(snapshot,1,length(snapshot)-1)||','||substr(v_extra,2,length(v_extra)-2)||'}';
 RETURN QUERY SELECT snapshot,v_table_count+3,v_total_rows+private_rows;
END $_$;

ALTER FUNCTION "private"."genblue_backup_core_manifest_v851"("p_expected_tenant" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."genblue_backup_core_parts_v73"("p_expected_tenant" "text") RETURNS TABLE("payload" "text", "export_table_count" integer, "export_total_rows" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE t text:=public.current_tenant_id(); snapshot text; v_base text; v_extra text; v_table_count integer; v_total_rows bigint; entries jsonb:='{}'::jsonb; rows jsonb; n text; private_rows bigint:=0;
BEGIN
 IF auth.uid() IS NULL OR p_expected_tenant IS DISTINCT FROM t OR NOT private.has_ability(t,'admin') THEN RAISE EXCEPTION '只有本院管理者可備份' USING ERRCODE='42501'; END IF;
 IF to_regprocedure('public.genblue_export_clinic_public_v53(text)') IS NULL THEN RAISE EXCEPTION '請先安裝原院一鍵備份函式，再重跑v53更新SQL'; END IF;
 SELECT x.payload,x.export_table_count,x.export_total_rows INTO snapshot,v_table_count,v_total_rows FROM private.genblue_backup_public_parts_v73(t) x;
 FOREACH n IN ARRAY ARRAY['clinic_visit_claims_v51','clinic_multidoctor_settings_v51','medical_amendments_v53'] LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(q)),''[]''::jsonb) FROM (SELECT * FROM private.%I WHERE tenant_id=$1) q',n) INTO rows USING t;
  entries:=entries||jsonb_build_object(n,jsonb_build_object('source_schema','private','row_count',jsonb_array_length(rows),'rows',rows));private_rows:=private_rows+jsonb_array_length(rows);
 END LOOP;
 -- genblue_backup_parts_v73: keep data text intact; carry counts separately.
 v_extra:=json_build_object('private_tables',entries)::text;
 snapshot:=substr(snapshot,1,length(snapshot)-1)||','||substr(v_extra,2,length(v_extra)-2)||'}';
 RETURN QUERY SELECT snapshot,v_table_count+3,v_total_rows+private_rows;
END $_$;

ALTER FUNCTION "private"."genblue_backup_core_parts_v73"("p_expected_tenant" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."genblue_backup_public_manifest_v851"("p_expected_tenant" "text") RETURNS TABLE("payload" "text", "export_table_count" integer, "export_total_rows" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    SET "statement_timeout" TO '60s'
    SET "jit" TO 'off'
    AS $$
DECLARE
  v_base_snapshot text;
  v_uid uuid := auth.uid();
  v_tenant text;
  v_role text;
  v_table text;
  v_known text[] := ARRAY['appointments','audit_logs','breed_images','breeds','categories','clinic_settings','clinic_trials','controlled_drug_counts','diagnostic_devices','diagnostic_import_jobs','diagnostic_results','imaging_assets','imaging_share_tokens','imaging_studies','inpatients','inventory_movements','invoice_items','invoices','item_categories','items','lab_reports','lab_tests','legacy_medical_histories','medical_records','medicines','owner_code_counters','owners','pets','rapid_test_records','rapid_types','regulated_drug_transactions','regulated_lots','regulatory_report_batch_transactions','regulatory_report_batches','report_export_profiles','user_profiles','vaccination_records','vaccine_types','imaging_shares_v76','pos_audit_v77','pos_movements_v77','pos_pending_v77','pos_requests_v77','pos_shifts_v77','pharmacy_jobs_v9133'];
  v_unknown text;
  v_columns jsonb;
  v_constraints jsonb;
  v_foreign_keys jsonb;
  v_payload json;
  v_parts text[] := ARRAY[]::text[];
  v_total bigint := 0;
  v_storage jsonb;
  v_references bigint;
  v_actual_files bigint;
  v_filter text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '請先登入管理者帳號。' USING ERRCODE = '42501';
  END IF;
  SELECT u.tenant_id::text, u.role INTO v_tenant, v_role
  FROM public.user_profiles u WHERE u.user_id = v_uid;
  IF v_tenant IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION '只有本院管理者可以備份。' USING ERRCODE = '42501';
  END IF;
  IF p_expected_tenant IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION '醫院登入狀態已改變，請重新登入。' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE(private.has_ability(v_tenant, 'admin'), false) THEN
    RAISE EXCEPTION '目前帳號沒有有效的管理者權限。' USING ERRCODE = '42501';
  END IF;

  SELECT string_agg(n.nspname || '.' || c.relname, ', ' ORDER BY n.nspname,c.relname) INTO v_unknown
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p') AND NOT c.relispartition
    AND NOT (n.nspname='public' AND (c.relname = ANY(v_known) OR c.relname='platform_operators')) AND NOT (n.nspname='private' AND c.relname IN ('clinic_visit_claims_v51','clinic_multidoctor_settings_v51','medical_amendments_v53'));
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION '備份範圍需要更新，發現新資料表：%', v_unknown;
  END IF;

  v_actual_files:=0; v_references:=0; v_storage:='[]'::jsonb;
  IF EXISTS (SELECT 1 FROM public.regulatory_report_batch_transactions x
    JOIN public.regulatory_report_batches b ON b.id=x.batch_id
    JOIN public.regulated_drug_transactions t ON t.id=x.transaction_id
    WHERE (b.tenant_id::text=v_tenant OR t.tenant_id::text=v_tenant)
      AND b.tenant_id::text IS DISTINCT FROM t.tenant_id::text) THEN
    RAISE EXCEPTION '申報明細存在跨醫院連結，請先修正資料。';
  END IF;

  FOREACH v_table IN ARRAY v_known LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION '缺少必要資料表：%', v_table;
    END IF;
    IF v_table = 'invoice_items' THEN
      v_filter := format('EXISTS (SELECT 1 FROM public.invoices p WHERE p.id=t.invoice_id AND p.tenant_id::text=%L)', v_tenant);
    ELSIF v_table = 'regulatory_report_batch_transactions' THEN
      v_filter := format('EXISTS (SELECT 1 FROM public.regulatory_report_batches b JOIN public.regulated_drug_transactions x ON x.id=t.transaction_id WHERE b.id=t.batch_id AND b.tenant_id::text=%L AND x.tenant_id::text=%L)', v_tenant, v_tenant);
    ELSE
      v_filter := format('t.tenant_id::text=%L', v_tenant);
    END IF;
    SELECT jsonb_agg(jsonb_build_object('name', a.attname,
      'type', format_type(a.atttypid, a.atttypmod), 'not_null', a.attnotnull,
      'identity', a.attidentity, 'generated', a.attgenerated,
      'default', pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
    INTO v_columns
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=to_regclass(format('public.%I',v_table)) AND a.attnum>0 AND NOT a.attisdropped;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k.conname,
      'kind', k.contype, 'definition', pg_get_constraintdef(k.oid,true)) ORDER BY k.conname), '[]'::jsonb)
    INTO v_constraints FROM pg_constraint k WHERE k.conrelid=to_regclass(format('public.%I',v_table));
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'constraint', k.conname, 'parent_schema', n.nspname, 'parent_table', p.relname,
      'columns', (SELECT jsonb_agg(a.attname ORDER BY u.ord) FROM unnest(k.conkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=u.num),
      'parent_columns', (SELECT jsonb_agg(a.attname ORDER BY u.ord) FROM unnest(k.confkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=u.num)
    ) ORDER BY k.conname), '[]'::jsonb) INTO v_foreign_keys
    FROM pg_constraint k JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace n ON n.oid=p.relnamespace
    WHERE k.conrelid=to_regclass(format('public.%I',v_table)) AND k.contype='f';
    -- 只收集查詢及結構；避免每讀完一張表就複製先前所有病歷 JSONB。
    -- 所有資料最後一次聚合，json_agg 直接保留資料庫的數字原文。
    v_parts := array_append(v_parts, format(
      'SELECT %L::text AS table_name, count(*) AS row_count, '
      || 'json_build_object(''row_count'', count(*), ''scope'', %L, '
      || '''columns'', %L::jsonb, ''constraints'', %L::jsonb, ''foreign_keys'', %L::jsonb, '
      || '''signature'', md5(COALESCE(string_agg(t.ctid::text||'':''||t.xmin::text, '','' ORDER BY t.ctid), '''')), ''rows'', ''[]''::json) AS table_data '
      || 'FROM public.%I t WHERE %s',
      v_table, CASE WHEN v_table IN ('invoice_items','regulatory_report_batch_transactions') THEN 'parent_tenant' ELSE 'tenant_id' END,
      v_columns::text, v_constraints::text, v_foreign_keys::text, v_table, v_filter));
  END LOOP;
  EXECUTE 'SELECT COALESCE(json_object_agg(s.table_name, s.table_data), ''{}''::json), '
       || 'COALESCE(sum(s.row_count), 0)::bigint FROM ('
       || array_to_string(v_parts, ' UNION ALL ') || ') s'
    INTO v_payload, v_total;
  v_base_snapshot := json_build_object(
    'format', 'genblue-clinic-snapshot', 'tenant_id', v_tenant,
    'snapshot_at', statement_timestamp(),
    'tables', v_payload,
    'exclusions', jsonb_build_array('auth_accounts_and_passwords','platform_operators','program_html',
      'sql_functions_policies_and_project_settings'),
    'restore_status', 'not_yet_rehearsed_for_this_file')::text;
  RETURN QUERY SELECT v_base_snapshot, cardinality(v_known), v_total;
END;
$$;

ALTER FUNCTION "private"."genblue_backup_public_manifest_v851"("p_expected_tenant" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."genblue_backup_public_parts_v73"("p_expected_tenant" "text") RETURNS TABLE("payload" "text", "export_table_count" integer, "export_total_rows" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    SET "statement_timeout" TO '60s'
    AS $$
DECLARE
  v_base_snapshot text;
  v_uid uuid := auth.uid();
  v_tenant text;
  v_role text;
  v_table text;
  v_known text[] := ARRAY['appointments','audit_logs','breed_images','breeds','categories','clinic_settings','clinic_trials','controlled_drug_counts','diagnostic_devices','diagnostic_import_jobs','diagnostic_results','imaging_assets','imaging_share_tokens','imaging_studies','inpatients','inventory_movements','invoice_items','invoices','item_categories','items','lab_reports','lab_tests','legacy_medical_histories','medical_records','medicines','owner_code_counters','owners','pets','rapid_test_records','rapid_types','regulated_drug_transactions','regulated_lots','regulatory_report_batch_transactions','regulatory_report_batches','report_export_profiles','user_profiles','vaccination_records','vaccine_types','imaging_shares_v76','pos_audit_v77','pos_movements_v77','pos_pending_v77','pos_requests_v77','pos_shifts_v77'];
  v_unknown text;
  v_columns jsonb;
  v_constraints jsonb;
  v_foreign_keys jsonb;
  v_payload json;
  v_parts text[] := ARRAY[]::text[];
  v_total bigint := 0;
  v_storage jsonb;
  v_references bigint;
  v_actual_files bigint;
  v_filter text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '請先登入管理者帳號。' USING ERRCODE = '42501';
  END IF;
  SELECT u.tenant_id::text, u.role INTO v_tenant, v_role
  FROM public.user_profiles u WHERE u.user_id = v_uid;
  IF v_tenant IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION '只有本院管理者可以備份。' USING ERRCODE = '42501';
  END IF;
  IF p_expected_tenant IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION '醫院登入狀態已改變，請重新登入。' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE(private.has_ability(v_tenant, 'admin'), false) THEN
    RAISE EXCEPTION '目前帳號沒有有效的管理者權限。' USING ERRCODE = '42501';
  END IF;

  SELECT string_agg(n.nspname || '.' || c.relname, ', ' ORDER BY n.nspname,c.relname) INTO v_unknown
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p') AND NOT c.relispartition
    AND NOT (n.nspname='public' AND (c.relname = ANY(v_known) OR c.relname='platform_operators')) AND NOT (n.nspname='private' AND c.relname IN ('clinic_visit_claims_v51','clinic_multidoctor_settings_v51','medical_amendments_v53'));
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION '備份範圍需要更新，發現新資料表：%', v_unknown;
  END IF;

  v_actual_files:=0; v_references:=0; v_storage:='[]'::jsonb;
  IF EXISTS (SELECT 1 FROM public.regulatory_report_batch_transactions x
    JOIN public.regulatory_report_batches b ON b.id=x.batch_id
    JOIN public.regulated_drug_transactions t ON t.id=x.transaction_id
    WHERE (b.tenant_id::text=v_tenant OR t.tenant_id::text=v_tenant)
      AND b.tenant_id::text IS DISTINCT FROM t.tenant_id::text) THEN
    RAISE EXCEPTION '申報明細存在跨醫院連結，請先修正資料。';
  END IF;

  FOREACH v_table IN ARRAY v_known LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION '缺少必要資料表：%', v_table;
    END IF;
    IF v_table = 'invoice_items' THEN
      v_filter := format('EXISTS (SELECT 1 FROM public.invoices p WHERE p.id=t.invoice_id AND p.tenant_id::text=%L)', v_tenant);
    ELSIF v_table = 'regulatory_report_batch_transactions' THEN
      v_filter := format('EXISTS (SELECT 1 FROM public.regulatory_report_batches b JOIN public.regulated_drug_transactions x ON x.id=t.transaction_id WHERE b.id=t.batch_id AND b.tenant_id::text=%L AND x.tenant_id::text=%L)', v_tenant, v_tenant);
    ELSE
      v_filter := format('t.tenant_id::text=%L', v_tenant);
    END IF;
    SELECT jsonb_agg(jsonb_build_object('name', a.attname,
      'type', format_type(a.atttypid, a.atttypmod), 'not_null', a.attnotnull,
      'identity', a.attidentity, 'generated', a.attgenerated,
      'default', pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
    INTO v_columns
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=to_regclass(format('public.%I',v_table)) AND a.attnum>0 AND NOT a.attisdropped;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k.conname,
      'kind', k.contype, 'definition', pg_get_constraintdef(k.oid,true)) ORDER BY k.conname), '[]'::jsonb)
    INTO v_constraints FROM pg_constraint k WHERE k.conrelid=to_regclass(format('public.%I',v_table));
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'constraint', k.conname, 'parent_schema', n.nspname, 'parent_table', p.relname,
      'columns', (SELECT jsonb_agg(a.attname ORDER BY u.ord) FROM unnest(k.conkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=u.num),
      'parent_columns', (SELECT jsonb_agg(a.attname ORDER BY u.ord) FROM unnest(k.confkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=u.num)
    ) ORDER BY k.conname), '[]'::jsonb) INTO v_foreign_keys
    FROM pg_constraint k JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace n ON n.oid=p.relnamespace
    WHERE k.conrelid=to_regclass(format('public.%I',v_table)) AND k.contype='f';
    -- 只收集查詢及結構；避免每讀完一張表就複製先前所有病歷 JSONB。
    -- 所有資料最後一次聚合，json_agg 直接保留資料庫的數字原文。
    v_parts := array_append(v_parts, format(
      'SELECT %L::text AS table_name, count(*) AS row_count, '
      || 'json_build_object(''row_count'', count(*), ''scope'', %L, '
      || '''columns'', %L::jsonb, ''constraints'', %L::jsonb, ''foreign_keys'', %L::jsonb, '
      || '''rows'', COALESCE(json_agg(t), ''[]''::json)) AS table_data '
      || 'FROM public.%I t WHERE %s',
      v_table, CASE WHEN v_table IN ('invoice_items','regulatory_report_batch_transactions') THEN 'parent_tenant' ELSE 'tenant_id' END,
      v_columns::text, v_constraints::text, v_foreign_keys::text, v_table, v_filter));
  END LOOP;
  EXECUTE 'SELECT COALESCE(json_object_agg(s.table_name, s.table_data), ''{}''::json), '
       || 'COALESCE(sum(s.row_count), 0)::bigint FROM ('
       || array_to_string(v_parts, ' UNION ALL ') || ') s'
    INTO v_payload, v_total;
  v_base_snapshot := json_build_object(
    'format', 'genblue-clinic-snapshot', 'tenant_id', v_tenant,
    'snapshot_at', statement_timestamp(),
    'tables', v_payload,
    'exclusions', jsonb_build_array('auth_accounts_and_passwords','platform_operators','program_html',
      'sql_functions_policies_and_project_settings'),
    'restore_status', 'not_yet_rehearsed_for_this_file')::text;
  RETURN QUERY SELECT v_base_snapshot, cardinality(v_known), v_total;
END;
$$;

ALTER FUNCTION "private"."genblue_backup_public_parts_v73"("p_expected_tenant" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."guard_google_calendar_v9135"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 IF (TG_OP='INSERT' AND NEW.google_calendar_v9135 IS NOT NULL)
 OR (TG_OP='UPDATE' AND NEW.google_calendar_v9135 IS DISTINCT FROM OLD.google_calendar_v9135) THEN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_profiles u WHERE u.user_id=auth.uid() AND u.tenant_id::text=NEW.tenant_id::text AND u.role='admin')
 OR NOT coalesce(private.has_ability(NEW.tenant_id::text,'admin'),false) THEN RAISE EXCEPTION '只有本院管理者可變更日曆連線' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "private"."guard_google_calendar_v9135"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."guard_invoice_attribution_v57"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
 -- Direct authenticated table writes cannot invent or alter attribution / request tokens.
 IF current_user IN ('authenticated','anon','authenticator') THEN
  IF TG_OP='INSERT' AND (NEW.appointment_id_v57 IS NOT NULL OR NEW.clinician_id_v57 IS NOT NULL OR NEW.clinician_name_v57 IS NOT NULL OR NEW.cashier_id_v57 IS NOT NULL OR NEW.checkout_request_v57 IS NOT NULL OR NEW.checkout_payload_v57 IS NOT NULL) THEN RAISE EXCEPTION '請使用新版門診結帳，不可自行指定帳單醫師' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND ROW(NEW.appointment_id_v57,NEW.clinician_id_v57,NEW.clinician_name_v57,NEW.cashier_id_v57,NEW.checkout_request_v57,NEW.checkout_payload_v57) IS DISTINCT FROM ROW(OLD.appointment_id_v57,OLD.clinician_id_v57,OLD.clinician_name_v57,OLD.cashier_id_v57,OLD.checkout_request_v57,OLD.checkout_payload_v57) THEN RAISE EXCEPTION '帳單接診歸屬不可改寫' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "private"."guard_invoice_attribution_v57"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."guard_medical_claim_v51"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE c private.clinic_visit_claims_v51;
BEGIN
 IF TG_OP='INSERT' AND private.is_offline_archive_insert_v1(NEW) THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.pet_id IS DISTINCT FROM OLD.pet_id) THEN RAISE EXCEPTION '不能將這筆紀錄改到另一位病患或醫院'; END IF;
 SELECT * INTO c FROM private.clinic_visit_claims_v51 WHERE tenant_id=NEW.tenant_id AND pet_id=NEW.pet_id FOR UPDATE;
 IF TG_OP='INSERT' AND (private.strict_clinical_v51(NEW.tenant_id) OR c.claim_id IS NOT NULL) AND (c.claim_id IS NULL OR c.clinician_id<>auth.uid() OR NOT private.has_ability(NEW.tenant_id,'clinical') OR NOT private.is_consulting_doctor_v52(NEW.tenant_id,auth.uid())) THEN RAISE EXCEPTION '看診權已變更，請保留輸入並重新確認'; END IF;
 IF TG_OP='UPDATE' AND c.claim_id IS NOT NULL AND c.clinician_id<>auth.uid() AND NOT (NEW.status='已完成' AND private.has_ability(NEW.tenant_id,'checkout') AND (to_jsonb(NEW)-'status'-'updated_at')=(to_jsonb(OLD)-'status'-'updated_at')) THEN RAISE EXCEPTION '此寵物由其他醫師看診中，病歷不可覆寫'; END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "private"."guard_medical_claim_v51"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."guard_visit_status_v51"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE c private.clinic_visit_claims_v51;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.pet_id IS DISTINCT FROM OLD.pet_id) THEN RAISE EXCEPTION '不能將這筆紀錄改到另一位病患或醫院'; END IF;
 SELECT * INTO c FROM private.clinic_visit_claims_v51 WHERE tenant_id=NEW.tenant_id AND pet_id=NEW.pet_id FOR UPDATE;
 IF NEW.status='診間看診中' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
  IF (c.claim_id IS NULL AND private.strict_clinical_v51(NEW.tenant_id)) OR (c.claim_id IS NOT NULL AND (c.clinician_id<>auth.uid() OR c.appointment_id IS DISTINCT FROM NEW.id)) THEN RAISE EXCEPTION '請從新版接診按鈕取得看診權，避免重複接診'; END IF;
 END IF;
 IF c.claim_id IS NOT NULL AND c.appointment_id=NEW.id AND c.clinician_id<>auth.uid() AND NOT private.has_ability(NEW.tenant_id,'admin') THEN
  IF TG_OP='UPDATE' AND NEW IS DISTINCT FROM OLD AND NOT (NEW.status='已完成' AND private.has_ability(NEW.tenant_id,'checkout') AND (to_jsonb(NEW)-'status'-'completed_at'-'updated_at')=(to_jsonb(OLD)-'status'-'completed_at'-'updated_at')) THEN RAISE EXCEPTION '此筆由其他醫師看診中，無法修改'; END IF;
 END IF;
 IF NEW.assigned_doctor_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.assigned_doctor_id IS DISTINCT FROM OLD.assigned_doctor_id) AND NOT EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.user_id=NEW.assigned_doctor_id AND p.tenant_id=NEW.tenant_id AND private.is_consulting_doctor_v52(p.tenant_id,p.user_id)) THEN RAISE EXCEPTION '指定醫師不屬於本院或沒有醫師資格'; END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "private"."guard_visit_status_v51"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."has_ability"("p_tenant" "text", "p_ability" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.user_profiles p
   WHERE p.user_id = auth.uid() AND p.tenant_id = p_tenant
     AND p.role IN ('admin','doctor','staff')
     AND NOT EXISTS (
       SELECT 1 FROM public.clinic_trials t
       WHERE t.tenant_id = p.tenant_id AND t.expires_at <= now()
     )
     AND (
       p_ability = 'read'
       OR p.role = 'admin'
       OR (p_ability = 'clinical' AND coalesce(p.permission_clinical, p.role = 'doctor'))
       OR (p_ability = 'appointment' AND coalesce(p.permission_appointment, p.role IN ('doctor','staff')))
       OR (p_ability = 'operational' AND coalesce(p.permission_operational, p.role = 'staff'))
       OR (p_ability = 'checkout' AND coalesce(p.permission_checkout,
            p.role = 'staff' OR (p.role = 'doctor' AND p.can_checkout)))
     )
 );
$$;

ALTER FUNCTION "private"."has_ability"("p_tenant" "text", "p_ability" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."is_consulting_doctor_v52"("t" "text", "u" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.tenant_id=t AND p.user_id=u AND p.is_consulting_doctor AND (p.role='admin' OR (p.role IN ('doctor','staff') AND coalesce(p.permission_clinical,p.role='doctor'))));
$$;

ALTER FUNCTION "private"."is_consulting_doctor_v52"("t" "text", "u" "uuid") OWNER TO "postgres";

SET LOCAL default_tablespace = '';

SET LOCAL default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."medical_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "pet_id" "uuid",
    "status" character varying(30) DEFAULT '診間看診中'::character varying,
    "chief_complaint" "text",
    "prescription_details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "vaccine_info" "jsonb" DEFAULT '{}'::"jsonb",
    "row_version" bigint DEFAULT 1 NOT NULL,
    "edited_at" timestamp with time zone,
    "edited_by" "uuid"
);

ALTER TABLE "public"."medical_records" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."is_offline_archive_insert_v1"("r" "public"."medical_records") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 SELECT auth.uid() IS NOT NULL
 AND (r).tenant_id::text=public.current_tenant_id()
 AND coalesce(private.has_ability((r).tenant_id::text,'admin'),false)
 AND EXISTS(SELECT 1 FROM public.user_profiles u WHERE u.user_id=auth.uid() AND u.tenant_id::text=(r).tenant_id::text AND u.role='admin')
 AND (r).status='已完成'
 AND nullif(current_setting('genblue.offline_insert_v1',true),'')::jsonb =
 jsonb_build_object('id',(r).id,'tenant_id',(r).tenant_id,'pet_id',(r).pet_id,'status',(r).status,
 'chief_complaint',(r).chief_complaint,'prescription_details',(r).prescription_details,
 'created_at',(r).created_at,'vaccine_info',(r).vaccine_info)
 AND (r).vaccine_info->'offline_emergency_v1'->'source'->>'id'=(r).id::text;
$$;

ALTER FUNCTION "private"."is_offline_archive_insert_v1"("r" "public"."medical_records") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."medical_revision_guard_v53"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE pname text;
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.row_version:=1;NEW.edited_at:=NULL;NEW.edited_by:=NULL;RETURN NEW;
 END IF;
 IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.pet_id IS DISTINCT FROM OLD.pet_id THEN RAISE EXCEPTION '不能將病歷移到另一位病患或醫院'; END IF;
 IF auth.uid() IS NOT NULL AND (NEW.chief_complaint IS DISTINCT FROM OLD.chief_complaint OR NEW.prescription_details IS DISTINCT FROM OLD.prescription_details OR NEW.vaccine_info IS DISTINCT FROM OLD.vaccine_info) AND NEW.row_version IS DISTINCT FROM OLD.row_version+1 THEN
  RAISE EXCEPTION '病歷版本已變更或未提供版本，請保留輸入並重新核對' USING ERRCODE='40001';
 END IF;
 IF (to_jsonb(NEW)-'row_version'-'edited_at'-'edited_by') IS DISTINCT FROM (to_jsonb(OLD)-'row_version'-'edited_at'-'edited_by') THEN
  NEW.row_version:=OLD.row_version+1;
  IF NEW.chief_complaint IS DISTINCT FROM OLD.chief_complaint OR NEW.prescription_details IS DISTINCT FROM OLD.prescription_details OR NEW.vaccine_info IS DISTINCT FROM OLD.vaccine_info THEN
   NEW.edited_at:=clock_timestamp();NEW.edited_by:=auth.uid();
   SELECT COALESCE(NULLIF(btrim(display_name),''),'人員（'||left(auth.uid()::text,8)||'）') INTO pname FROM public.user_profiles WHERE user_id=auth.uid() AND tenant_id=NEW.tenant_id;
   INSERT INTO private.medical_amendments_v53(request_id,tenant_id,medical_record_id,actor_id,actor_name,reason,previous_version,saved_version,previous_chief,next_chief,previous_payload,next_payload)
   VALUES(gen_random_uuid(),NEW.tenant_id,NEW.id,auth.uid(),COALESCE(pname,'資料庫維護'),'由其他已授權流程更新',OLD.row_version,NEW.row_version,OLD.chief_complaint,NEW.chief_complaint,jsonb_build_object('chief_complaint',OLD.chief_complaint,'prescription_details',OLD.prescription_details,'vaccine_info',OLD.vaccine_info),jsonb_build_object('chief_complaint',NEW.chief_complaint,'prescription_details',NEW.prescription_details,'vaccine_info',NEW.vaccine_info));
  ELSE NEW.edited_at:=OLD.edited_at;NEW.edited_by:=OLD.edited_by;
  END IF;
 ELSE
  NEW.row_version:=OLD.row_version;NEW.edited_at:=OLD.edited_at;
  -- Allow ON DELETE SET NULL to remove a deleted account reference.
  IF auth.uid() IS NOT NULL THEN NEW.edited_by:=OLD.edited_by; END IF;
 END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "private"."medical_revision_guard_v53"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."night_pricing_guard_v93"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE night boolean:=false;
BEGIN
 IF TG_OP='UPDATE' AND OLD.night_pricing_v93 IS NOT NULL THEN
  IF NEW.night_pricing_v93 IS DISTINCT FROM OLD.night_pricing_v93 THEN RAISE EXCEPTION '本次就診計價已保存，不可改寫'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.status IN('候診中','診間看診中') THEN
  -- Existing active visits remain ordinary; only new arrivals snapshot the active work mode.
  IF TG_OP='INSERT' OR OLD.status='已預約' THEN
   SELECT s.night_emergency_v93 INTO night FROM public.pos_shifts_v77 s WHERE s.tenant_id=NEW.tenant_id AND s.closed_at IS NULL ORDER BY s.opened_at DESC LIMIT 1;
  END IF;
  NEW.night_pricing_v93:=jsonb_build_object('emergency',coalesce(night,false),'registration',500,'multiplier',1.5,'rounding','2_decimal');
 ELSE NEW.night_pricing_v93:=NULL; END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "private"."night_pricing_guard_v93"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."observe_clinical_record_v57"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE c private.clinic_visit_claims_v51;
BEGIN
 IF TG_OP='INSERT' AND private.is_offline_archive_insert_v1(NEW) THEN RETURN NEW; END IF;
 SELECT * INTO c FROM private.clinic_visit_claims_v51 WHERE tenant_id=NEW.tenant_id AND pet_id=NEW.pet_id FOR UPDATE;
 IF c.appointment_id IS NOT NULL AND NEW.created_at>=c.claimed_at THEN
  UPDATE public.appointments SET updated_at=updated_at WHERE id=c.appointment_id AND tenant_id=c.tenant_id AND status='診間看診中';
 END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "private"."observe_clinical_record_v57"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."product_sale_ledger_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
 PERFORM private.record_product_sale_movement(NEW.id);
 RETURN NEW;
END;
$$;

ALTER FUNCTION "private"."product_sale_ledger_trigger"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."record_product_sale_movement"("p_movement_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
DECLARE
 m public.inventory_movements%ROWTYPE;
 inv public.invoices%ROWTYPE;
 product jsonb;
 original public.regulated_drug_transactions%ROWTYPE;
 invoice_uuid uuid;
 result_uuid uuid;
 line_uuid uuid;
 line_count integer;
BEGIN
 SELECT * INTO m FROM public.inventory_movements WHERE id=p_movement_id;
 IF NOT FOUND OR m.tenant_id<>'GIB-TP-001' OR m.item_kind<>'item' THEN RETURN NULL; END IF;
 SELECT id INTO result_uuid FROM public.regulated_drug_transactions WHERE source_inventory_movement_id=m.id;
 IF FOUND THEN RETURN result_uuid; END IF;
 IF m.change_qty<0 AND m.reason ~ '^結帳 [0-9a-fA-F-]{36}$' THEN
   invoice_uuid:=substring(m.reason FROM 4)::uuid;
 ELSIF m.change_qty>0 AND m.reason ~ '^作廢 [0-9a-fA-F-]{36}：' THEN
   invoice_uuid:=substring(m.reason FROM 4 FOR 36)::uuid;
 ELSE RETURN NULL;
 END IF;
 SELECT * INTO inv FROM public.invoices WHERE id=invoice_uuid AND tenant_id::text=m.tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION '商品申報：找不到同院帳單 %',invoice_uuid; END IF;
 IF m.qty_after<>m.qty_before+m.change_qty THEN RAISE EXCEPTION '商品申報：庫存異動數量不符'; END IF;
 IF m.change_qty>0 THEN
   SELECT t.* INTO original FROM public.regulated_drug_transactions t
   WHERE t.tenant_id=m.tenant_id AND t.invoice_id=inv.id AND t.item_kind='item'
   AND t.item_id=m.item_id AND t.direction='OUT' AND t.quantity=m.change_qty
   AND t.source_inventory_movement_id IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.regulated_drug_transactions r WHERE r.reversal_of=t.id)
   ORDER BY t.occurred_at,t.id LIMIT 1 FOR UPDATE;
   IF NOT FOUND THEN
     -- 一般商品或修正前尚未補登的舊帳，不假造沖回紀錄。
     RETURN NULL;
   END IF;
   INSERT INTO public.regulated_drug_transactions(
     tenant_id,occurred_at,transaction_type,direction,reason_code,reason_text,
     item_kind,item_id,item_name,regulatory_class,report_scheme,reportable,
     veterinary_license_no,active_ingredient,strength,dosage_form,manufacturer,
     controlled_drug,controlled_level,smallest_unit,quantity,
     balance_after,owner_id,pet_id,invoice_id,invoice_item_id,
     lot_id,lot_no,expiry_date,reversal_of,notes,created_by,source_inventory_movement_id
   ) VALUES (
     m.tenant_id,m.created_at,'sale_void','IN','sale_void',m.reason,
     'item',m.item_id,original.item_name,original.regulatory_class,original.report_scheme,original.reportable,
     original.veterinary_license_no,original.active_ingredient,original.strength,original.dosage_form,original.manufacturer,
     false,NULL,original.smallest_unit,m.change_qty,
     m.qty_after,original.owner_id,original.pet_id,inv.id,original.invoice_item_id,
     original.lot_id,original.lot_no,original.expiry_date,original.id,
     '依實際作廢庫存異動記錄沖回；未額外增減庫存。',m.actor_id,m.id
   ) RETURNING id INTO result_uuid;
   RETURN result_uuid;
 END IF;
 SELECT to_jsonb(i) INTO product FROM public.items i WHERE i.id=m.item_id AND i.tenant_id::text=m.tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION '商品申報：找不到同院商品'; END IF;
 IF product->>'regulatory_class' IS DISTINCT FROM '動物用商品'
 OR COALESCE((product->>'controlled_drug')::boolean,false) THEN RETURN NULL; END IF;
 -- 發生時未提供批號：不得以目前批號推測實際出庫批號。
 SELECT count(*) INTO line_count FROM public.invoice_items li
 WHERE li.invoice_id=inv.id AND li.item_name=m.item_name AND li.quantity=-m.change_qty;
 IF line_count=0 THEN RAISE EXCEPTION '商品申報：帳單明細與庫存異動不符，停止寫入'; END IF;
 IF line_count=1 THEN
   SELECT li.id INTO line_uuid FROM public.invoice_items li
   WHERE li.invoice_id=inv.id AND li.item_name=m.item_name AND li.quantity=-m.change_qty;
 END IF;
 INSERT INTO public.regulated_drug_transactions(
   tenant_id,occurred_at,transaction_type,direction,reason_code,reason_text,
   item_kind,item_id,item_name,regulatory_class,report_scheme,reportable,
   veterinary_license_no,active_ingredient,strength,dosage_form,manufacturer,
   controlled_drug,controlled_level,smallest_unit,quantity,balance_after,
   owner_id,pet_id,invoice_id,invoice_item_id,notes,created_by,source_inventory_movement_id
 ) VALUES (
   m.tenant_id,m.created_at,'sale','OUT','sale',m.reason,
   'item',m.item_id,m.item_name,'動物用商品',COALESCE(product->>'report_scheme','none'),
   COALESCE((product->>'reportable')::boolean,false),
   product->>'veterinary_license_no',product->>'active_ingredient',product->>'strength',
   product->>'dosage_form',product->>'manufacturer',false,NULL,
   COALESCE(NULLIF(product->>'smallest_unit',''),'件'),-m.change_qty,m.qty_after,
   inv.owner_id,inv.pet_id,inv.id,line_uuid,
   '依實際結帳庫存異動記錄；商品資料採登錄當下設定。未記錄實際出庫批號及效期，待人工核對。操作人非自動視為醫師；未再次扣庫存。',m.actor_id,m.id
 ) RETURNING id INTO result_uuid;
 RETURN result_uuid;
END;
$_$;

ALTER FUNCTION "private"."record_product_sale_movement"("p_movement_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."restore_original_fields_v63"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE x jsonb:=nullif(current_setting('genblue.restore_row_v63',true),'')::jsonb;t text:=public.current_tenant_id();
BEGIN
 IF x IS NULL THEN RETURN NEW; END IF;
 IF x->>'table' IS DISTINCT FROM TG_TABLE_NAME OR x->>'id' IS DISTINCT FROM NEW.id::text OR x->>'tenant_id' IS DISTINCT FROM NEW.tenant_id::text OR t IS DISTINCT FROM NEW.tenant_id::text OR auth.uid() IS NULL OR NOT coalesce(private.has_ability(t,'admin'),false) OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=auth.uid() AND tenant_id::text=t AND role='admin') THEN RAISE EXCEPTION '還原識別資料驗證失敗'; END IF;
 IF TG_TABLE_NAME='owners' THEN NEW.system_code:=x->>'system_code';
 ELSIF TG_TABLE_NAME='medical_records' THEN NEW.row_version:=(x->>'row_version')::bigint;NEW.edited_at:=(x->>'edited_at')::timestamptz;NEW.edited_by:=(x->>'edited_by')::uuid;END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "private"."restore_original_fields_v63"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."restore_row_check_v63"("t" "text", "n" "text", "r" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $_$
DECLARE canonical jsonb; current_row jsonb; cols text[]; keys text[]; id uuid; f record; child_values text[]; conditions text; ok boolean; parent regclass; extra text; collisions boolean;
BEGIN
 IF n NOT IN ('owners','pets','medical_records','legacy_medical_histories') OR jsonb_typeof(r) IS DISTINCT FROM 'object' OR r->>'tenant_id' IS DISTINCT FROM t THEN RAISE EXCEPTION '還原範圍或醫院不符'; END IF;
 id:=(r->>'id')::uuid;IF id IS NULL THEN RAISE EXCEPTION '還原資料缺少編號'; END IF;
 SELECT array_agg(a.attname::text ORDER BY a.attname) INTO cols FROM pg_attribute a WHERE a.attrelid=to_regclass(format('public.%I',n)) AND a.attnum>0 AND NOT a.attisdropped;
 SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(r) k;
 IF cols IS DISTINCT FROM keys THEN RETURN jsonb_build_object('id',id,'status','blocked','reason','備份欄位與目前資料表不同，需要先更新還原規格'); END IF;
 EXECUTE format('SELECT to_jsonb(x) FROM jsonb_populate_record(NULL::public.%I,$1) x',n) INTO canonical USING r;
 -- 類型正規化，避免同一日期不同時區或數值格式造成誤判。
 EXECUTE format('SELECT to_jsonb(x) FROM public.%I x WHERE id=$1',n) INTO current_row USING id;
 IF current_row IS NOT NULL THEN
  IF current_row->>'tenant_id' IS DISTINCT FROM t THEN RETURN jsonb_build_object('id',id,'status','blocked','reason','編號衝突，不能還原'); END IF;
  IF current_row=canonical THEN RETURN jsonb_build_object('id',id,'status','same','reason','已存在且內容相同'); END IF;
  SELECT string_agg(k,', ' ORDER BY k) INTO extra FROM jsonb_object_keys(canonical) k WHERE current_row->k IS DISTINCT FROM canonical->k;
  RETURN jsonb_build_object('id',id,'status','different','reason','目前資料已存在，保留目前內容','changed_columns',extra);
 END IF;
 -- 核對必填欄位，完整備份提供每一欄；不能猜測或默默補值。
 IF EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass(format('public.%I',n)) AND a.attnum>0 AND NOT a.attisdropped AND a.attnotnull AND canonical->a.attname='null'::jsonb) THEN RETURN jsonb_build_object('id',id,'status','blocked','reason','備份缺少必填資料'); END IF;
 -- 每個外鍵都核對現有父資料；有醫院欄位者再核對院別。
 FOR f IN SELECT c.oid,c.confrelid,c.conkey,c.confkey FROM pg_constraint c WHERE c.conrelid=to_regclass(format('public.%I',n)) AND c.contype='f' LOOP
  parent:=f.confrelid;conditions:='';child_values:=ARRAY[]::text[];
  FOR i IN 1..array_length(f.conkey,1) LOOP
   SELECT attname INTO extra FROM pg_attribute WHERE attrelid=to_regclass(format('public.%I',n)) AND attnum=f.conkey[i];
   child_values:=array_append(child_values,canonical->>extra);
   SELECT attname INTO extra FROM pg_attribute WHERE attrelid=f.confrelid AND attnum=f.confkey[i];
   conditions:=conditions||CASE WHEN conditions='' THEN '' ELSE ' AND ' END||format('p.%I::text=$1[%s]',extra,i);
  END LOOP;
  IF array_position(child_values,NULL) IS NOT NULL THEN CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=f.confrelid AND attname='tenant_id' AND NOT attisdropped) THEN conditions:=conditions||' AND p.tenant_id::text=$2'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s p WHERE %s)',parent,conditions) INTO ok USING child_values,t;
  IF NOT ok THEN RETURN jsonb_build_object('id',id,'status','blocked','reason','關聯資料不存在或院別不符，請先還原飼主／寵物，或核對原人員帳號'); END IF;
 END LOOP;
 -- 特有識別碼不能對到另一筆；跨院晶片衝突只回報一般原因。
 IF n='owners' THEN
  SELECT EXISTS(SELECT 1 FROM public.owners o WHERE o.tenant_id::text=t AND ((o.system_code=canonical->>'system_code') OR (o.legacy_import_key=canonical->>'legacy_import_key'))) INTO collisions;
 ELSIF n='pets' THEN
  SELECT EXISTS(SELECT 1 FROM public.pets p WHERE (p.microchip=canonical->>'microchip') OR (p.tenant_id::text=t AND p.legacy_source_no=canonical->>'legacy_source_no')) INTO collisions;
 ELSIF n='legacy_medical_histories' THEN
  SELECT EXISTS(SELECT 1 FROM public.legacy_medical_histories h WHERE h.tenant_id::text=t AND (h.source_pet_no=canonical->>'source_pet_no' OR h.pet_id::text=canonical->>'pet_id')) INTO collisions;
 END IF;
 IF coalesce(collisions,false) THEN RETURN jsonb_build_object('id',id,'status','blocked','reason','病患編號、晶片或舊資料識別碼已被其他資料使用'); END IF;
 RETURN jsonb_build_object('id',id,'status','missing','reason','目前缺少，可選擇還原');
END $_$;

ALTER FUNCTION "private"."restore_row_check_v63"("t" "text", "n" "text", "r" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "private"."strict_clinical_v51"("t" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ SELECT COALESCE((SELECT enabled FROM private.clinic_multidoctor_settings_v51 WHERE tenant_id=t),false); $$;

ALTER FUNCTION "private"."strict_clinical_v51"("t" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_prescription_route_v66"("p_name" "text", "p_kind" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text; n text:=btrim(p_name); routes jsonb; setting_id uuid;
BEGIN
 t:=public.current_tenant_id();
 IF auth.uid() IS NULL OR t IS NULL OR NOT private.has_ability(t,'clinical') THEN RAISE EXCEPTION '沒有同院處方編輯權限'; END IF;
 IF n IS NULL OR n='' OR char_length(n)>30 OR n~E'[\\[\\]\\r\\n]' OR p_kind IS NULL OR p_kind NOT IN ('oral','injection','other') THEN RAISE EXCEPTION '給藥方式名稱或分類不符'; END IF;
 IF n=ANY(ARRAY['口服錠劑','口服膠囊','口服液','口服懸浮液','皮下注射','肌肉注射','靜脈注射','外用滴劑','外用藥膏','眼藥水','眼藥膏','耳藥水','耳藥膏','霧化吸入']) THEN RAISE EXCEPTION '此方式已在內建選單'; END IF;
 SELECT id,prescription_routes INTO STRICT setting_id,routes FROM public.clinic_settings WHERE tenant_id=t FOR UPDATE;
 IF jsonb_typeof(routes)<>'array' THEN RAISE EXCEPTION '院所給藥設定格式不符'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(routes) x WHERE x->>'name'=n) THEN
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(routes) x WHERE x->>'name'=n AND x->>'kind'=p_kind) THEN RAISE EXCEPTION '同名方式已有不同分類'; END IF;
  RETURN routes;
 END IF;
 IF jsonb_array_length(routes)>=100 THEN RAISE EXCEPTION '自訂方式最多100項'; END IF;
 routes:=routes||jsonb_build_array(jsonb_build_object('name',n,'kind',p_kind));
 UPDATE public.clinic_settings SET prescription_routes=routes,updated_at=now() WHERE id=setting_id AND tenant_id=t;
 RETURN routes;
END $$;

ALTER FUNCTION "public"."add_prescription_route_v66"("p_name" "text", "p_kind" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."adjust_inventory"("p_kind" "text", "p_id" "uuid", "p_change" numeric, "p_reason" "text") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_tenant text; v_before numeric; v_after numeric; v_name text;
begin
 IF auth.uid() IS NULL OR NOT private.has_ability(public.current_tenant_id(), 'admin') THEN RAISE EXCEPTION '此帳號沒有操作權限' USING ERRCODE = '42501'; END IF;
 v_tenant := public.current_tenant_id();
 if auth.uid() is null or v_tenant is null then raise exception '請先登入醫院帳號'; end if;
 if p_kind not in ('item','medicine') or p_id is null or p_change is null or p_change=0 or trim(coalesce(p_reason,''))='' then
   raise exception '請填寫有效的品項、數量與原因'; end if;
 if p_kind='item' then
   select stock_qty,name into v_before,v_name from public.items where id=p_id and tenant_id=v_tenant for update;
 else
   select stock_qty,name into v_before,v_name from public.medicines where id=p_id and tenant_id=v_tenant for update;
 end if;
 if not found then raise exception '找不到此醫院的品項'; end if;
 v_before:=coalesce(v_before,0); v_after:=v_before+p_change;
 if v_after<0 then raise exception '庫存不足，目前剩餘 %',v_before; end if;
 if p_kind='item' then update public.items set stock_qty=v_after where id=p_id and tenant_id=v_tenant;
 else update public.medicines set stock_qty=v_after where id=p_id and tenant_id=v_tenant; end if;
 insert into public.inventory_movements(tenant_id,item_kind,item_id,item_name,change_qty,qty_before,qty_after,reason)
 values(v_tenant,p_kind,p_id,v_name,p_change,v_before,v_after,p_reason);
 return v_after;
end $$;

ALTER FUNCTION "public"."adjust_inventory"("p_kind" "text", "p_id" "uuid", "p_change" numeric, "p_reason" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."allocate_owner_system_code"("p_tenant_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  n integer;
BEGIN
  IF p_tenant_id IS NULL OR p_tenant_id = '' THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  INSERT INTO public.owner_code_counters AS counters (tenant_id, next_number)
  VALUES (p_tenant_id, 2)
  ON CONFLICT (tenant_id) DO UPDATE
    SET next_number = counters.next_number + 1
  RETURNING next_number - 1 INTO n;
  IF n > 259974 THEN
    RAISE EXCEPTION 'owner system code range exhausted for tenant %', p_tenant_id;
  END IF;
  RETURN chr(65 + (n - 1) / 9999) || lpad((((n - 1) % 9999) + 1)::text, 4, '0');
END;
$$;

ALTER FUNCTION "public"."allocate_owner_system_code"("p_tenant_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."amend_medical_text_v53"("p_record_id" "uuid", "p_expected_version" bigint, "p_chief" "text", "p_reason" "text", "p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); u uuid:=auth.uid(); r public.medical_records; previous private.medical_amendments_v53; actor_name text; original_chief text; target_pet uuid;
BEGIN
 IF u IS NULL OR NOT private.has_ability(t,'clinical') THEN RAISE EXCEPTION '沒有本院病歷編輯權限' USING ERRCODE='42501'; END IF;
 IF p_record_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<1 OR p_chief IS NULL OR length(p_chief)>200000 OR NULLIF(btrim(p_reason),'') IS NULL OR length(p_reason)>500 THEN RAISE EXCEPTION '請提供有效版本、病歷文字及修正原因（最多500字）'; END IF;
 SELECT pet_id INTO target_pet FROM public.medical_records WHERE id=p_record_id AND tenant_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到本院病歷' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM private.clinic_visit_claims_v51 WHERE tenant_id=t AND pet_id=target_pet FOR UPDATE;
 SELECT * INTO r FROM public.medical_records WHERE id=p_record_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到本院病歷' USING ERRCODE='42501'; END IF;
 SELECT * INTO previous FROM private.medical_amendments_v53 WHERE request_id=p_request_id;
 IF FOUND THEN
  IF previous.tenant_id<>t OR previous.actor_id IS DISTINCT FROM u OR previous.medical_record_id<>p_record_id OR previous.previous_version<>p_expected_version OR previous.next_chief IS DISTINCT FROM p_chief OR previous.reason<>btrim(p_reason) THEN RAISE EXCEPTION '此儲存識別已使用，請重新核對'; END IF;
  RETURN jsonb_build_object('ok',true,'row_version',previous.saved_version,'replayed',true);
 END IF;
 IF r.row_version<>p_expected_version THEN RETURN jsonb_build_object('ok',false,'reason','conflict','row_version',r.row_version); END IF;
 IF r.chief_complaint IS NOT DISTINCT FROM p_chief THEN RETURN jsonb_build_object('ok',true,'row_version',r.row_version,'no_change',true); END IF;
 original_chief:=r.chief_complaint;
 SELECT COALESCE(NULLIF(btrim(display_name),''),'人員（'||left(u::text,8)||'）') INTO actor_name FROM public.user_profiles WHERE user_id=u AND tenant_id=t;
 UPDATE public.medical_records SET chief_complaint=p_chief,row_version=p_expected_version+1 WHERE id=p_record_id AND tenant_id=t RETURNING * INTO r;
 UPDATE private.medical_amendments_v53 SET request_id=p_request_id,reason=btrim(p_reason)
 WHERE tenant_id=t AND medical_record_id=p_record_id AND previous_version=p_expected_version AND saved_version=r.row_version;
 IF NOT FOUND THEN RAISE EXCEPTION '未確認修正紀錄已保存'; END IF;
 RETURN jsonb_build_object('ok',true,'row_version',r.row_version);
END $$;

ALTER FUNCTION "public"."amend_medical_text_v53"("p_record_id" "uuid", "p_expected_version" bigint, "p_chief" "text", "p_reason" "text", "p_request_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."assign_owner_system_code"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Ignore a client-supplied value; the server owns this new short code.
  NEW.system_code := public.allocate_owner_system_code(NEW.tenant_id::text);
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."assign_owner_system_code"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."assign_waiting_doctor_v54"("p_appointment_id" "uuid", "p_doctor_id" "uuid", "p_expected_doctor_id" "uuid", "p_expected_doctor" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); a public.appointments; pet uuid; doctor_name text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(t,'appointment') THEN RAISE EXCEPTION '沒有本院掛號權限' USING ERRCODE='42501'; END IF;
 SELECT pet_id INTO pet FROM public.appointments WHERE id=p_appointment_id AND tenant_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到本院候診紀錄' USING ERRCODE='42501'; END IF;
 IF p_doctor_id IS NOT NULL THEN
  SELECT COALESCE(NULLIF(btrim(display_name),''),'醫師（'||left(user_id::text,8)||'）') INTO doctor_name FROM public.user_profiles WHERE user_id=p_doctor_id AND tenant_id=t FOR SHARE;
  IF NOT FOUND OR NOT private.is_consulting_doctor_v52(t,p_doctor_id) THEN RAISE EXCEPTION '此醫師不屬於本院或未啟用接診資格'; END IF;
 END IF;
 -- Do not transfer an active consultation; retain the original clinician and their drafts.
 PERFORM 1 FROM private.clinic_visit_claims_v51 WHERE tenant_id=t AND pet_id=pet FOR UPDATE;
 IF FOUND THEN RAISE EXCEPTION '此病患已開始看診，請先確認接診狀態，不能直接更換指定醫師'; END IF;
 SELECT * INTO a FROM public.appointments WHERE id=p_appointment_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND OR a.status<>'候診中' THEN RAISE EXCEPTION '本筆尚未報到或已開始看診，不能指定醫師'; END IF;
 IF a.assigned_doctor_id IS DISTINCT FROM p_expected_doctor_id OR a.doctor IS DISTINCT FROM p_expected_doctor THEN
  IF a.assigned_doctor_id IS NOT DISTINCT FROM p_doctor_id AND a.doctor IS NOT DISTINCT FROM doctor_name THEN RETURN jsonb_build_object('ok',true,'appointment',to_jsonb(a),'replayed',true); END IF;
  RETURN jsonb_build_object('ok',false,'reason','conflict');
 END IF;
 UPDATE public.appointments SET assigned_doctor_id=p_doctor_id,doctor=doctor_name WHERE id=p_appointment_id AND tenant_id=t RETURNING * INTO a;
 RETURN jsonb_build_object('ok',true,'appointment',to_jsonb(a));
END $$;

ALTER FUNCTION "public"."assign_waiting_doctor_v54"("p_appointment_id" "uuid", "p_doctor_id" "uuid", "p_expected_doctor_id" "uuid", "p_expected_doctor" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."checkout_clinic_doctor_v57"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_appointment_id" "uuid", "p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); a public.appointments; inv public.invoices; payload jsonb; v_invoice_id uuid;
BEGIN
 IF auth.uid() IS NULL OR p_tenant_id IS DISTINCT FROM t OR NOT private.has_ability(t,'checkout') THEN RAISE EXCEPTION '沒有本院結帳權限' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_category IS DISTINCT FROM '門診' OR p_checkout_type NOT LIKE '門診收費%' THEN RAISE EXCEPTION '請使用門診收費流程'; END IF;
 payload:=jsonb_build_object('owner',p_owner_id,'pet',p_pet_id,'type',p_checkout_type,'category',p_category,'subtotal',p_subtotal,'discount',p_discount,'total',p_total,'lines',p_lines,'appointment',p_appointment_id);
 PERFORM pg_advisory_xact_lock(hashtextextended(t||':'||p_request_id::text,0));
 SELECT * INTO inv FROM public.invoices WHERE tenant_id=t AND checkout_request_v57=p_request_id;
 IF FOUND THEN
  IF inv.cashier_id_v57 IS DISTINCT FROM auth.uid() OR inv.checkout_payload_v57 IS DISTINCT FROM payload THEN RAISE EXCEPTION '此結帳請求已儲存不同內容，請先核對原帳單，勿重複收費'; END IF;
  RETURN jsonb_build_object('invoice_id',inv.id,'appointment_id',inv.appointment_id_v57,'replayed',true,'voided',inv.voided_at IS NOT NULL);
 END IF;
 IF p_appointment_id IS NOT NULL THEN
  -- Match existing locking order: pet claim, then appointment.
  PERFORM 1 FROM private.clinic_visit_claims_v51 WHERE tenant_id=t AND pet_id=p_pet_id FOR UPDATE;
  SELECT * INTO a FROM public.appointments WHERE id=p_appointment_id AND tenant_id=t AND pet_id=p_pet_id FOR UPDATE;
  IF NOT FOUND OR a.status NOT IN ('候診中','診間看診中') THEN RAISE EXCEPTION '本次掛號已結束或資料不符，請更新並核對既有帳單，勿重複結帳'; END IF;
  IF p_owner_id IS DISTINCT FROM (SELECT owner_id FROM public.pets WHERE id=p_pet_id AND tenant_id=t) THEN RAISE EXCEPTION '本次掛號的飼主與帳單不符'; END IF;
  IF EXISTS(SELECT 1 FROM public.invoices WHERE tenant_id=t AND appointment_id_v57=p_appointment_id AND voided_at IS NULL) THEN RAISE EXCEPTION '本次掛號已有有效帳單，請核對，勿重複收費'; END IF;
 END IF;
 v_invoice_id:=private.checkout_inventory_doctor_v57(p_tenant_id,p_owner_id,p_pet_id,p_checkout_type,p_category,p_subtotal,p_discount,p_total,p_lines,
  jsonb_build_object('appointment_id',p_appointment_id,'clinician_id',a.clinician_id_v57,'clinician_name',a.clinician_name_v57,'request_id',p_request_id,'payload',payload));
 IF p_appointment_id IS NOT NULL THEN UPDATE public.appointments SET status='已完成',completed_at=now() WHERE id=p_appointment_id AND tenant_id=t; END IF;
 RETURN jsonb_build_object('invoice_id',v_invoice_id,'appointment_id',p_appointment_id,'replayed',false,'voided',false);
END $$;

ALTER FUNCTION "public"."checkout_clinic_doctor_v57"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_appointment_id" "uuid", "p_request_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."checkout_clinic_medicine_groups_v64"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_appointment_id" "uuid", "p_request_id" "uuid", "p_medication_groups" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $_$
DECLARE t text:=public.current_tenant_id();g jsonb;d jsonb;line jsonb;all_lines jsonb:=p_lines;hidden_names text[]:=ARRAY[]::text[];kinds text[]:=ARRAY[]::text[];kind text;label text;marker text;price numeric;qty numeric;id uuid;n integer;count_drugs integer:=0;changed integer;result jsonb;v_invoice_id uuid;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR p_tenant_id IS DISTINCT FROM t OR NOT coalesce(private.has_ability(t,'checkout'),false) THEN RAISE EXCEPTION '沒有本院結帳權限' USING ERRCODE='42501'; END IF;
 IF p_category IS DISTINCT FROM '門診' OR p_pet_id IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION '請使用有指定寵物的門診收費流程'; END IF;
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines)>200 OR jsonb_typeof(p_medication_groups) IS DISTINCT FROM 'array' OR jsonb_array_length(p_medication_groups) NOT BETWEEN 1 AND 3 OR octet_length(p_medication_groups::text)>1048576 THEN RAISE EXCEPTION '合併收費資料格式不正確'; END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  IF line->>'stock_kind'='medicine' OR line->>'item_name' IN ('口服藥','針劑','其他用藥') OR coalesce(line->>'item_name','') LIKE '[用藥庫存v64:%' THEN RAISE EXCEPTION '藥品須由合併處方清單送入，不能重複列入其他收費'; END IF;
 END LOOP;
 FOR g IN SELECT value FROM jsonb_array_elements(p_medication_groups) LOOP
  kind:=g->>'kind';label:=CASE kind WHEN 'oral' THEN '口服藥' WHEN 'injection' THEN '針劑' WHEN 'other' THEN '其他用藥' END;
  IF label IS NULL OR kind=ANY(kinds) OR jsonb_typeof(g->'price') IS DISTINCT FROM 'number' OR coalesce(g->>'price','') !~ '^[0-9]+(\.[0-9]{1,2})?$' OR jsonb_typeof(g->'drugs') IS DISTINCT FROM 'array' OR jsonb_array_length(g->'drugs')=0 THEN RAISE EXCEPTION '請填寫每組藥費（可填0），每組只能有一筆'; END IF;
  price:=(g->>'price')::numeric;IF price>100000000 THEN RAISE EXCEPTION '藥費金額超出範圍'; END IF;kinds:=array_append(kinds,kind);
  all_lines:=all_lines||jsonb_build_array(jsonb_build_object('item_name',label,'quantity',1,'unit_price',price,'stock_kind','','stock_id',''));
  n:=0;
  FOR d IN SELECT value FROM jsonb_array_elements(g->'drugs') LOOP
   n:=n+1;count_drugs:=count_drugs+1;IF count_drugs>200 THEN RAISE EXCEPTION '一次最多200筆處方'; END IF;
   id:=(d->>'medicine_id')::uuid;qty:=(d->>'quantity')::numeric;
   IF id IS NULL OR qty IS NULL OR qty<=0 OR qty::text IN ('NaN','Infinity','-Infinity') OR nullif(btrim(d->>'item_name'),'') IS NULL OR length(d->>'item_name')>1000 THEN RAISE EXCEPTION '處方藥品與數量不正確'; END IF;
   marker:=format('[用藥庫存v64:%s:%s] %s',kind,n,d->>'item_name');hidden_names:=array_append(hidden_names,marker);
   all_lines:=all_lines||jsonb_build_array(jsonb_build_object('item_name',marker,'quantity',qty,'unit_price',0,'stock_kind','medicine','stock_id',id));
  END LOOP;
 END LOOP;
 result:=public.checkout_clinic_doctor_v57(p_tenant_id,p_owner_id,p_pet_id,p_checkout_type,p_category,p_subtotal,p_discount,p_total,all_lines,p_appointment_id,p_request_id);
 v_invoice_id:=(result->>'invoice_id')::uuid;IF v_invoice_id IS NULL THEN RAISE EXCEPTION '未取得門診帳單確認'; END IF;
 IF coalesce((result->>'voided')::boolean,false) THEN RETURN result; END IF;
 -- 同一交易內保留藥品用量供庫存／申報查詢，並把費用與收據顯示分開。
 UPDATE public.invoice_items i SET receipt_visible_v64=false,medicine_group_v64=split_part(i.item_name,':',2)
 WHERE i.invoice_id=v_invoice_id AND i.item_name=ANY(hidden_names) AND i.unit_price=0;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>count_drugs THEN RAISE EXCEPTION '用藥明細核對不符，本次帳單與庫存全部未變更'; END IF;
 UPDATE public.invoice_items SET medicine_group_v64=CASE item_name WHEN '口服藥' THEN 'oral' WHEN '針劑' THEN 'injection' WHEN '其他用藥' THEN 'other' END WHERE invoice_items.invoice_id=v_invoice_id AND item_name IN ('口服藥','針劑','其他用藥') AND receipt_visible_v64;
 RETURN result;
END $_$;

ALTER FUNCTION "public"."checkout_clinic_medicine_groups_v64"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb", "p_appointment_id" "uuid", "p_request_id" "uuid", "p_medication_groups" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."checkout_family_v74"("p_tenant_id" "text", "p_owner_id" "uuid", "p_request_id" "uuid", "p_entries" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE t text:=public.current_tenant_id(); entry jsonb; result jsonb; invoice_id uuid;
 results jsonb:='[]'::jsonb; child_request uuid; payload jsonb; existing_count integer;
 subtotal numeric:=0; discount numeric:=0; total numeric:=0;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR p_tenant_id IS DISTINCT FROM t
    OR NOT coalesce(private.has_ability(t,'checkout'),false) THEN
   RAISE EXCEPTION '沒有本院結帳權限' USING ERRCODE='42501';
 END IF;
 IF p_owner_id IS NULL OR p_request_id IS NULL
    OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION '請指定飼主與合併帳單'; END IF;
 IF jsonb_array_length(p_entries) NOT BETWEEN 1 AND 20 OR octet_length(p_entries::text)>2097152 THEN
   RAISE EXCEPTION '合併帳單限1至20隻寵物，資料最多2MB'; END IF;
 payload:=jsonb_build_object('owner_id',p_owner_id,'entries',p_entries);
 PERFORM pg_advisory_xact_lock(hashtextextended(t||':family-v74:'||p_request_id::text,0));
 SELECT count(*) INTO existing_count FROM public.invoices WHERE tenant_id=t AND family_checkout_v74=p_request_id;
 IF existing_count>0 AND (existing_count<>jsonb_array_length(p_entries) OR EXISTS(
   SELECT 1 FROM public.invoices WHERE tenant_id=t AND family_checkout_v74=p_request_id
   AND (cashier_id_v57 IS DISTINCT FROM auth.uid() OR family_checkout_payload_v74 IS DISTINCT FROM payload OR voided_at IS NOT NULL)
 )) THEN RAISE EXCEPTION '這批帳單內容已變更或已作廢，請核對原帳單，勿重複收費'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_entries) e GROUP BY e->>'p_pet_id' HAVING count(*)>1)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_entries) e GROUP BY e->>'p_appointment_id' HAVING count(*)>1) THEN
   RAISE EXCEPTION '同一寵物或掛號不可重複加入'; END IF;
 -- 固定鎖定順序；每隻仍由既有結帳函式驗證金額、庫存、掛號與權限。
 FOR entry IN SELECT value FROM jsonb_array_elements(p_entries) ORDER BY value->>'p_pet_id' LOOP
   IF entry->>'p_tenant_id' IS DISTINCT FROM t OR (entry->>'p_owner_id')::uuid IS DISTINCT FROM p_owner_id
     OR entry->>'p_category' IS DISTINCT FROM '門診' OR (entry->>'p_appointment_id')::uuid IS NULL
     OR (entry->>'p_pet_id')::uuid IS NULL OR NOT EXISTS(
       SELECT 1 FROM public.pets WHERE id=(entry->>'p_pet_id')::uuid AND tenant_id=t AND owner_id=p_owner_id
     ) THEN RAISE EXCEPTION '合併帳單必須是本院同一飼主的有效掛號'; END IF;
   child_request:=md5(p_request_id::text||':'||(entry->>'p_appointment_id'))::uuid;
   IF coalesce(jsonb_array_length(entry->'p_medication_groups'),0)>0 THEN
     result:=public.checkout_clinic_medicine_groups_v64(t,p_owner_id,(entry->>'p_pet_id')::uuid,
       entry->>'p_checkout_type','門診',(entry->>'p_subtotal')::numeric,(entry->>'p_discount')::numeric,
       (entry->>'p_total')::numeric,entry->'p_lines',(entry->>'p_appointment_id')::uuid,child_request,entry->'p_medication_groups');
   ELSE
     result:=public.checkout_clinic_doctor_v57(t,p_owner_id,(entry->>'p_pet_id')::uuid,
       entry->>'p_checkout_type','門診',(entry->>'p_subtotal')::numeric,(entry->>'p_discount')::numeric,
       (entry->>'p_total')::numeric,entry->'p_lines',(entry->>'p_appointment_id')::uuid,child_request);
   END IF;
   invoice_id:=(result->>'invoice_id')::uuid;
   IF invoice_id IS NULL OR coalesce((result->>'voided')::boolean,false) THEN RAISE EXCEPTION '帳單未完成或已作廢'; END IF;
   UPDATE public.invoices SET family_checkout_v74=p_request_id,family_checkout_payload_v74=payload
     WHERE id=invoice_id AND tenant_id=t;
   results:=results||jsonb_build_array(jsonb_build_object('invoice_id',invoice_id,
     'pet_id',entry->>'p_pet_id','appointment_id',entry->>'p_appointment_id'));
   subtotal:=subtotal+(entry->>'p_subtotal')::numeric;
   discount:=discount+(entry->>'p_discount')::numeric; total:=total+(entry->>'p_total')::numeric;
 END LOOP;
 RETURN jsonb_build_object('request_id',p_request_id,'owner_id',p_owner_id,'invoices',results,
   'subtotal',subtotal,'discount',discount,'total',total,'replayed',existing_count>0);
 -- 任何一隻失敗會中止整個交易，帳單、完診與庫存一起回復。
END $$;

ALTER FUNCTION "public"."checkout_family_v74"("p_tenant_id" "text", "p_owner_id" "uuid", "p_request_id" "uuid", "p_entries" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."checkout_with_inventory"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_invoice uuid; v_tenant text; v_line jsonb; v_kind text; v_id uuid;
 v_qty numeric; v_price numeric; v_name text; v_before numeric; v_actual_name text; v_sum numeric:=0;
begin
 IF auth.uid() IS NULL OR NOT private.has_ability(public.current_tenant_id(), 'checkout') THEN RAISE EXCEPTION '此帳號沒有操作權限' USING ERRCODE = '42501'; END IF;
 v_tenant:=public.current_tenant_id();
 if auth.uid() is null or v_tenant is null or p_tenant_id is distinct from v_tenant then raise exception '沒有此醫院的結帳權限'; end if;
 if p_checkout_type is null or p_checkout_type='' or p_subtotal<0 or p_discount<0 or p_total<0
   or p_subtotal is null or p_discount is null or p_total is null or p_discount>p_subtotal
   or abs(p_total-(p_subtotal-p_discount))>0.02 then raise exception '結帳金額不正確'; end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)=0 then raise exception '帳單沒有明細'; end if;
 if p_owner_id is not null and not exists(select 1 from public.owners where id=p_owner_id and tenant_id=v_tenant) then raise exception '飼主不屬於此醫院'; end if;
 if p_pet_id is not null and not exists(select 1 from public.pets where id=p_pet_id and tenant_id=v_tenant) then raise exception '寵物不屬於此醫院'; end if;
 insert into public.invoices(tenant_id,owner_id,pet_id,checkout_type,category,subtotal,discount,total_amount)
 values(v_tenant,p_owner_id,p_pet_id,p_checkout_type,p_category,p_subtotal,p_discount,p_total) returning id into v_invoice;
 for v_line in select value from jsonb_array_elements(p_lines) loop
   v_name:=trim(v_line->>'item_name'); v_qty:=(v_line->>'quantity')::numeric; v_price:=(v_line->>'unit_price')::numeric;
   v_kind:=coalesce(v_line->>'stock_kind','');
   v_id:=nullif(v_line->>'stock_id','')::uuid;
   if v_name is null or v_name='' or v_qty is null or v_qty<=0 or v_price is null or v_price<0 then raise exception '明細的名稱、數量或單價不正確'; end if;
   if v_kind not in ('','item','medicine') or (v_kind='' and v_id is not null) or (v_kind<>'' and v_id is null) then raise exception '庫存品項識別錯誤'; end if;
   if v_kind='item' then
     if v_qty<>trunc(v_qty) then raise exception '商品數量需為整數'; end if;
     select stock_qty,name into v_before,v_actual_name from public.items where id=v_id and tenant_id=v_tenant for update;
     if not found then raise exception '商品已不存在'; end if;
     if v_actual_name<>v_name then raise exception '商品名稱已變更，請重新選取'; end if;
     if coalesce(v_before,0)<v_qty then raise exception '商品「%」庫存不足（剩餘 %）',v_name,coalesce(v_before,0); end if;
     update public.items set stock_qty=v_before-v_qty where id=v_id and tenant_id=v_tenant;
   elsif v_kind='medicine' then
     select stock_qty,name into v_before,v_actual_name from public.medicines where id=v_id and tenant_id=v_tenant for update;
     if not found then raise exception '藥品已不存在'; end if;
     if position(v_actual_name in v_name)=0 then raise exception '處方藥品名稱已變更，請重新開立'; end if;
     if coalesce(v_before,0)<v_qty then raise exception '藥品「%」庫存不足（剩餘 %）',v_actual_name,coalesce(v_before,0); end if;
     update public.medicines set stock_qty=v_before-v_qty where id=v_id and tenant_id=v_tenant;
   end if;
   if v_kind<>'' then
     insert into public.inventory_movements(tenant_id,item_kind,item_id,item_name,change_qty,qty_before,qty_after,reason)
     values(v_tenant,v_kind,v_id,v_actual_name,-v_qty,v_before,v_before-v_qty,'結帳 '||v_invoice::text);
   end if;
   v_sum:=v_sum+v_qty*v_price;
   insert into public.invoice_items(invoice_id,item_name,quantity,unit_price,subtotal)
   values(v_invoice,v_name,v_qty,v_price,v_qty*v_price);
 end loop;
 if abs(v_sum-p_subtotal)>0.02 then raise exception '明細合計與帳單金額不符'; end if;
 return v_invoice;
end $$;

ALTER FUNCTION "public"."checkout_with_inventory"("p_tenant_id" "text", "p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total" numeric, "p_lines" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."claim_clinic_visit_v51"("p_pet_id" "uuid", "p_appointment_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); u uuid:=auth.uid(); pname text; powner uuid; c private.clinic_visit_claims_v51; a public.appointments; inserted boolean;
BEGIN
 IF u IS NULL OR NOT private.has_ability(t,'clinical') THEN RAISE EXCEPTION '沒有本院看診權限' USING ERRCODE='42501'; END IF;
 -- Synchronize eligibility changes with entry: an admin update needs this same profile row lock.
 PERFORM 1 FROM public.user_profiles WHERE user_id=u AND tenant_id=t FOR SHARE;
 IF NOT private.is_consulting_doctor_v52(t,u) THEN RAISE EXCEPTION '此帳號未設定為接診醫師，請由管理者勾選接診醫師' USING ERRCODE='42501'; END IF;
 SELECT owner_id INTO powner FROM public.pets WHERE id=p_pet_id AND tenant_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到本院寵物' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(NULLIF(btrim(display_name),''),'看診人員（'||left(u::text,8)||'）') INTO pname FROM public.user_profiles WHERE user_id=u AND tenant_id=t;
 INSERT INTO private.clinic_visit_claims_v51(tenant_id,pet_id,clinician_id,clinician_name) VALUES(t,p_pet_id,u,pname) ON CONFLICT(tenant_id,pet_id) DO NOTHING;
 inserted:=FOUND;
 SELECT * INTO c FROM private.clinic_visit_claims_v51 WHERE tenant_id=t AND pet_id=p_pet_id FOR UPDATE;
 IF c.clinician_id<>u THEN RETURN jsonb_build_object('ok',false,'reason','occupied','name',c.clinician_name); END IF;
 IF c.appointment_id IS NOT NULL THEN
  IF p_appointment_id IS NOT NULL AND p_appointment_id<>c.appointment_id THEN RETURN jsonb_build_object('ok',false,'reason','other_visit','name',c.clinician_name); END IF;
  SELECT * INTO a FROM public.appointments WHERE id=c.appointment_id AND tenant_id=t AND pet_id=p_pet_id FOR UPDATE;
  IF NOT FOUND OR a.status<>'診間看診中' THEN RAISE EXCEPTION '原看診狀態已變更，請更新候診'; END IF;
 ELSE
  IF p_appointment_id IS NOT NULL THEN
   SELECT * INTO a FROM public.appointments WHERE id=p_appointment_id AND tenant_id=t AND pet_id=p_pet_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION '找不到本院這筆預約'; END IF;
  ELSE
   SELECT * INTO a FROM public.appointments WHERE tenant_id=t AND pet_id=p_pet_id AND status IN ('候診中','診間看診中') ORDER BY scheduled_at,id LIMIT 1 FOR UPDATE;
   IF NOT FOUND THEN
    INSERT INTO public.appointments(tenant_id,pet_id,owner_id,scheduled_at,checked_in_at,session,status) VALUES(t,p_pet_id,powner,now(),now(),'上午診','候診中') RETURNING * INTO a;
   END IF;
  END IF;
  IF a.status='診間看診中' THEN
   -- Pre-upgrade or unclaimed consultation: do not silently take it over.
   DELETE FROM private.clinic_visit_claims_v51 WHERE tenant_id=t AND pet_id=p_pet_id AND claim_id=c.claim_id;
   RETURN jsonb_build_object('ok',false,'reason','legacy_busy','name',COALESCE(a.doctor,'既有看診人員'));
  END IF;
  IF a.status<>'候診中' THEN RAISE EXCEPTION '請先完成報到，才能接診'; END IF;
  UPDATE private.clinic_visit_claims_v51 SET appointment_id=a.id WHERE claim_id=c.claim_id;
  UPDATE public.appointments SET status='診間看診中',doctor=pname,assigned_doctor_id=u WHERE id=a.id AND tenant_id=t RETURNING * INTO a;
 END IF;
 RETURN jsonb_build_object('ok',true,'claim_id',c.claim_id,'name',pname,'appointment',to_jsonb(a));
END $$;

ALTER FUNCTION "public"."claim_clinic_visit_v51"("p_pet_id" "uuid", "p_appointment_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."clinic_doctor_state_v51"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(t,'read') THEN RAISE EXCEPTION '沒有本院資料讀取權限' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('enabled',private.strict_clinical_v51(t),'doctors',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.user_id,'name',COALESCE(NULLIF(btrim(p.display_name),''),CASE WHEN p.role='admin' THEN '管理者' ELSE '醫師' END||'（'||left(p.user_id::text,8)||'）'),'role',p.role) ORDER BY p.display_name,p.user_id) FROM public.user_profiles p WHERE p.tenant_id=t AND private.is_consulting_doctor_v52(p.tenant_id,p.user_id)),'[]'::jsonb),
 'claims',COALESCE((SELECT jsonb_agg(jsonb_build_object('claim_id',c.claim_id,'pet_id',c.pet_id,'appointment_id',c.appointment_id,'clinician_id',c.clinician_id,'clinician_name',c.clinician_name,'claimed_at',c.claimed_at)) FROM private.clinic_visit_claims_v51 c WHERE c.tenant_id=t),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;

ALTER FUNCTION "public"."clinic_doctor_state_v51"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_invoice_with_items"("p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total_amount" numeric, "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
    v_tenant text;
    v_invoice_id uuid;
    v_item jsonb;
    v_items_total numeric := 0;
begin
    v_tenant := public.current_tenant_id();
    if auth.uid() is null or v_tenant is null then
        raise exception '請先登入並設定所屬醫院';
    end if;
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception '帳單至少需要一筆明細';
    end if;
    if p_subtotal < 0 or p_discount < 0 or p_total_amount < 0
       or p_total_amount <> p_subtotal - p_discount then
        raise exception '帳單金額不正確';
    end if;
    if p_owner_id is not null and not exists
       (select 1 from public.owners where id = p_owner_id and tenant_id = v_tenant) then
        raise exception '飼主不屬於目前醫院';
    end if;
    if p_pet_id is not null and not exists
       (select 1 from public.pets where id = p_pet_id and tenant_id = v_tenant) then
        raise exception '寵物不屬於目前醫院';
    end if;
    insert into public.invoices (tenant_id, owner_id, pet_id, checkout_type, category,
                                 subtotal, discount, total_amount)
    values (v_tenant, p_owner_id, p_pet_id, p_checkout_type, p_category,
            p_subtotal, p_discount, p_total_amount)
    returning id into v_invoice_id;
    for v_item in select value from jsonb_array_elements(p_items) loop
        if nullif(trim(v_item->>'item_name'), '') is null
           or coalesce((v_item->>'quantity')::integer, 0) <= 0
           or coalesce((v_item->>'unit_price')::numeric, -1) < 0
           or coalesce((v_item->>'subtotal')::numeric, -1) < 0 then
            raise exception '帳單明細有無效的品項、數量或價格';
        end if;
        if (v_item->>'subtotal')::numeric <> (v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric then
            raise exception '明細金額與數量或單價不符';
        end if;
        v_items_total := v_items_total + (v_item->>'subtotal')::numeric;
        insert into public.invoice_items (invoice_id, item_name, quantity, unit_price, subtotal)
        values (v_invoice_id, v_item->>'item_name', (v_item->>'quantity')::integer,
                (v_item->>'unit_price')::numeric, (v_item->>'subtotal')::numeric);
    end loop;
    if abs(v_items_total - p_subtotal) > 0.005 then
        raise exception '明細合計與帳單小計不符';
    end if;
    return v_invoice_id;
end;
$$;

ALTER FUNCTION "public"."create_invoice_with_items"("p_owner_id" "uuid", "p_pet_id" "uuid", "p_checkout_type" "text", "p_category" "text", "p_subtotal" numeric, "p_discount" numeric, "p_total_amount" numeric, "p_items" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."current_tenant_id"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select tenant_id
    from public.user_profiles
    where user_id = auth.uid()
    limit 1;
$$;

ALTER FUNCTION "public"."current_tenant_id"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."delete_imaging_asset_v79"("p_action" "text", "p_asset_id" "uuid", "p_study_id" "uuid", "p_pet_id" "uuid", "p_expected_path" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE t text:=public.current_tenant_id(); a public.imaging_assets; s public.imaging_studies; n integer:=0; expected_prefix text;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT coalesce(private.has_ability(t,'clinical'),false) THEN
  RAISE EXCEPTION '沒有本院影像刪除權限' USING ERRCODE='42501';
 END IF;
 IF p_action IS NULL OR p_action NOT IN ('prepare','delete') OR p_asset_id IS NULL OR p_study_id IS NULL OR p_pet_id IS NULL THEN RAISE EXCEPTION '刪除資料不完整'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pets WHERE id=p_pet_id AND tenant_id::text=t) THEN RAISE EXCEPTION '寵物不屬於本院' USING ERRCODE='42501'; END IF;
 -- 與上傳存檔使用相同的檢查鎖，避免同一筆存檔重試與刪除交錯。
 PERFORM pg_advisory_xact_lock(hashtextextended(p_study_id::text,0));
 SELECT * INTO s FROM public.imaging_studies WHERE id=p_study_id AND tenant_id::text=t AND pet_id=p_pet_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到本院此寵物的檢查'; END IF;
 expected_prefix:=t||'/'||p_pet_id::text||'/'||p_study_id::text||'/'||p_asset_id::text||'.';
 SELECT * INTO a FROM public.imaging_assets WHERE id=p_asset_id FOR UPDATE;
 IF NOT FOUND THEN
  IF p_action='delete' AND starts_with(p_expected_path,expected_prefix)
   AND substring(p_expected_path FROM length(expected_prefix)+1) IN ('jpg','png','webp','mp4','mov','webm') THEN
   RETURN jsonb_build_object('deleted',true,'already_deleted',true,'storage_path',p_expected_path,'asset_id',p_asset_id,'pet_id',p_pet_id);
  END IF;
  RAISE EXCEPTION '找不到影像附件';
 END IF;
 IF a.tenant_id::text IS DISTINCT FROM t OR a.study_id IS DISTINCT FROM p_study_id
 OR NOT coalesce(starts_with(a.storage_path,expected_prefix),false)
 OR substring(a.storage_path FROM length(expected_prefix)+1) NOT IN ('jpg','png','webp','mp4','mov','webm') THEN
  RAISE EXCEPTION '附件不屬於本院此寵物或路徑不符' USING ERRCODE='42501';
 END IF;
 IF p_action='prepare' THEN
  SELECT count(*) INTO n FROM public.imaging_shares_v76 WHERE tenant_id=t AND p_asset_id=ANY(asset_ids) AND revoked_at IS NULL AND expires_at>clock_timestamp();
  RETURN jsonb_build_object('asset_id',a.id,'pet_id',p_pet_id,'storage_path',a.storage_path,'filename',a.original_filename,'active_shares',n);
 END IF;
 IF p_expected_path IS DISTINCT FROM a.storage_path THEN RAISE EXCEPTION '附件路徑已變更，請重新確認'; END IF;
 UPDATE public.imaging_shares_v76 SET revoked_at=coalesce(revoked_at,clock_timestamp())
  WHERE tenant_id=t AND p_asset_id=ANY(asset_ids) AND revoked_at IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 DELETE FROM public.imaging_assets WHERE id=a.id AND tenant_id::text=t AND study_id=p_study_id;
 RETURN jsonb_build_object('deleted',true,'asset_id',a.id,'pet_id',p_pet_id,'storage_path',a.storage_path,'revoked_shares',n);
END;
$$;

ALTER FUNCTION "public"."delete_imaging_asset_v79"("p_action" "text", "p_asset_id" "uuid", "p_study_id" "uuid", "p_pet_id" "uuid", "p_expected_path" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."doctor_statistics_v57"("p_start" "date", "p_end" "date", "p_doctor" "text" DEFAULT 'all'::"text", "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); lo timestamptz; hi timestamptz; summary jsonb; details jsonb; count_rows bigint; excluded_retail bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(t,'admin') THEN RAISE EXCEPTION '只有本院管理者可查閱醫師統計' USING ERRCODE='42501'; END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_end<p_start OR p_end-p_start>365 OR p_offset IS NULL OR p_offset<0 OR p_doctor IS NULL THEN RAISE EXCEPTION '日期範圍需為 1 至 366 天'; END IF;
 lo:=p_start::timestamp AT TIME ZONE 'Asia/Taipei';hi:=(p_end+1)::timestamp AT TIME ZONE 'Asia/Taipei';
 WITH visits AS (SELECT clinician_id_v57 AS id,max(clinician_name_v57) AS name,count(*) AS n FROM public.appointments av WHERE av.tenant_id=t AND av.status='已完成' AND (av.clinical_record_v57 OR (av.clinician_id_v57 IS NOT NULL AND EXISTS(SELECT 1 FROM public.invoices bi WHERE bi.tenant_id=t AND bi.appointment_id_v57=av.id AND bi.clinician_id_v57=av.clinician_id_v57))) AND av.completed_at>=lo AND av.completed_at<hi GROUP BY clinician_id_v57),
 bills AS (SELECT clinician_id_v57 AS id,max(clinician_name_v57) AS name,count(*) FILTER(WHERE voided_at IS NULL) AS n,count(*) FILTER(WHERE voided_at IS NOT NULL) AS void_n,coalesce(sum(subtotal) FILTER(WHERE voided_at IS NULL),0) AS gross,coalesce(sum(discount) FILTER(WHERE voided_at IS NULL),0) AS discount,coalesce(sum(total_amount) FILTER(WHERE voided_at IS NULL),0) AS net FROM public.invoices WHERE tenant_id=t AND (category='門診' OR checkout_type LIKE '門診收費%') AND created_at>=lo AND created_at<hi GROUP BY clinician_id_v57),
 ids AS (SELECT id FROM visits UNION SELECT id FROM bills UNION SELECT user_id FROM public.user_profiles WHERE tenant_id=t AND is_consulting_doctor)
 SELECT coalesce(jsonb_agg(jsonb_build_object('doctor_id',ids.id,'doctor_name',coalesce(NULLIF(p.display_name,''),v.name,b.name,CASE WHEN ids.id IS NULL THEN '未歸屬／待核對' ELSE '已移除醫師（'||left(ids.id::text,8)||'）' END),'visit_count',coalesce(v.n,0),'invoice_count',coalesce(b.n,0),'void_count',coalesce(b.void_n,0),'subtotal',coalesce(b.gross,0),'discount',coalesce(b.discount,0),'net',coalesce(b.net,0)) ORDER BY ids.id NULLS LAST),'[]'::jsonb) INTO summary
 FROM ids LEFT JOIN visits v ON v.id IS NOT DISTINCT FROM ids.id LEFT JOIN bills b ON b.id IS NOT DISTINCT FROM ids.id LEFT JOIN public.user_profiles p ON p.user_id=ids.id AND p.tenant_id=t
 WHERE p_doctor='all' OR (p_doctor='unassigned' AND ids.id IS NULL) OR ids.id::text=p_doctor;
 WITH events AS (
 SELECT 'visit'::text AS kind,a.id,a.completed_at AS event_at,a.pet_id,a.owner_id,a.clinician_id_v57 AS doctor_id,a.clinician_name_v57 AS doctor_name,0::numeric AS subtotal,0::numeric AS discount,0::numeric AS net,NULL::timestamptz AS voided_at,NULL::text AS void_reason FROM public.appointments a WHERE a.tenant_id=t AND a.status='已完成' AND (a.clinical_record_v57 OR (a.clinician_id_v57 IS NOT NULL AND EXISTS(SELECT 1 FROM public.invoices bi WHERE bi.tenant_id=t AND bi.appointment_id_v57=a.id AND bi.clinician_id_v57=a.clinician_id_v57))) AND a.completed_at>=lo AND a.completed_at<hi
 UNION ALL
 SELECT 'invoice',i.id,i.created_at,i.pet_id,i.owner_id,i.clinician_id_v57,i.clinician_name_v57,i.subtotal,i.discount,i.total_amount,i.voided_at,i.void_reason FROM public.invoices i WHERE i.tenant_id=t AND (i.category='門診' OR i.checkout_type LIKE '門診收費%') AND i.created_at>=lo AND i.created_at<hi
 ), filtered AS (SELECT * FROM events WHERE p_doctor='all' OR (p_doctor='unassigned' AND doctor_id IS NULL) OR doctor_id::text=p_doctor), page AS (SELECT * FROM filtered ORDER BY event_at DESC,kind,id LIMIT 100 OFFSET p_offset)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.event_at DESC,q.kind,q.id) FROM (SELECT page.*,p.name AS pet_name,o.name AS owner_name FROM page LEFT JOIN public.pets p ON p.id=page.pet_id AND p.tenant_id=t LEFT JOIN public.owners o ON o.id=page.owner_id AND o.tenant_id=t) q),'[]'::jsonb)) INTO details;
 SELECT count(*) INTO excluded_retail FROM public.invoices WHERE tenant_id=t AND checkout_type='商品零售' AND created_at>=lo AND created_at<hi AND voided_at IS NULL;
 RETURN jsonb_build_object('summary',summary,'details',details->'rows','detail_count',details->'total','offset',p_offset,'page_size',100,'excluded_retail',excluded_retail,'timezone','Asia/Taipei');
END $$;

ALTER FUNCTION "public"."doctor_statistics_v57"("p_start" "date", "p_end" "date", "p_doctor" "text", "p_offset" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."emergency_v925"("p_action" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    SET "lock_timeout" TO '3s'
    SET "statement_timeout" TO '15s'
    AS $_$
DECLARE t text:=public.current_tenant_id(); u uuid:=auth.uid(); a public.appointments; p public.pets; sh public.pos_shifts_v77;
 fee numeric; config jsonb; request_id uuid; prior public.pos_audit_v77; reply jsonb; starts date; ends date;
BEGIN
 IF u IS NULL OR t IS NULL OR NOT private.has_ability(t,'read') THEN RAISE EXCEPTION '請先登入有效院所' USING ERRCODE='42501'; END IF;
 SELECT coalesce(c.emergency_v925,'{"fee":0}'::jsonb) INTO config FROM public.clinic_settings c WHERE c.tenant_id=t;
 config:=coalesce(config,'{"fee":0}'::jsonb); fee:=coalesce((config->>'fee')::numeric,0);
 IF p_action='status' THEN
  SELECT * INTO sh FROM public.pos_shifts_v77 s WHERE s.tenant_id=t AND s.closed_at IS NULL ORDER BY s.opened_at DESC LIMIT 1;
  RETURN jsonb_build_object('version',925,'tenant_id',t,'shift_id',sh.id,'opened_at',sh.opened_at,'has_today_shift',EXISTS(SELECT 1 FROM public.pos_shifts_v77 x WHERE x.tenant_id=t AND (x.opened_at AT TIME ZONE 'Asia/Taipei')::date=(now() AT TIME ZONE 'Asia/Taipei')::date),'fee',fee,'can_start',private.has_ability(t,'checkout'),'can_config',private.has_ability(t,'admin'));
 ELSIF p_action='config' THEN
  IF NOT private.has_ability(t,'admin') THEN RAISE EXCEPTION '只有管理者可設定急診費' USING ERRCODE='42501'; END IF;
  fee:=(p_data->>'fee')::numeric;
  IF fee IS NULL OR fee<0 OR fee>10000000 OR fee<>round(fee,2) THEN RAISE EXCEPTION '急診預設費須為非負金額，最多兩位小數'; END IF;
  UPDATE public.clinic_settings SET emergency_v925=jsonb_build_object('fee',fee) WHERE tenant_id=t;
  IF NOT FOUND THEN RAISE EXCEPTION '請先儲存醫院設定'; END IF;
  INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(t,gen_random_uuid(),'emergency_config_v925',config,jsonb_build_object('fee',fee),u);
  RETURN jsonb_build_object('tenant_id',t,'fee',fee);
 ELSIF p_action='start' THEN
  IF NOT private.has_ability(t,'checkout') THEN RAISE EXCEPTION '請由有收費權限的人員開始急診工作' USING ERRCODE='42501'; END IF;
  request_id:=(p_data->>'id')::uuid;
  IF request_id IS NULL THEN RAISE EXCEPTION '缺少工作請求識別碼'; END IF;
  -- Existing POS implements idempotent same-day resume and archives prior closing count.
  reply:=public.pos_v77('today_work',p_data);
  INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor)
  SELECT t,request_id,'emergency_start_v925',p_data,reply,u WHERE NOT EXISTS(SELECT 1 FROM public.pos_audit_v77 x WHERE x.tenant_id=t AND x.entity_id=request_id AND x.action='emergency_start_v925');
  RETURN reply||jsonb_build_object('tenant_id',t,'emergency',true);
 ELSIF p_action='register' THEN
  IF NOT private.has_ability(t,'appointment') THEN RAISE EXCEPTION '沒有急診掛號權限' USING ERRCODE='42501'; END IF;
  request_id:=(p_data->>'id')::uuid;
  IF request_id IS NULL THEN RAISE EXCEPTION '缺少掛號識別碼'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('emergency-register:'||t||':'||(p_data->>'pet_id'),0));
  SELECT * INTO prior FROM public.pos_audit_v77 x WHERE x.tenant_id=t AND x.entity_id=request_id AND x.action='emergency_register_v925';
  IF FOUND THEN
   IF prior.before_data IS DISTINCT FROM p_data THEN RAISE EXCEPTION '同一掛號請求不可更改內容'; END IF;
   SELECT * INTO a FROM public.appointments x WHERE x.tenant_id=t AND x.id=(prior.after_data->>'appointment_id')::uuid;
   RETURN jsonb_build_object('tenant_id',t,'appointment',to_jsonb(a),'existing',true);
  END IF;
  SELECT * INTO p FROM public.pets x WHERE x.id=(p_data->>'pet_id')::uuid AND x.tenant_id=t;
  IF p.id IS NULL THEN RAISE EXCEPTION '找不到本院寵物，請先建檔'; END IF;
  SELECT * INTO a FROM public.appointments x WHERE x.tenant_id=t AND x.pet_id=p.id AND x.status IN('候診中','診間看診中') ORDER BY x.scheduled_at DESC LIMIT 1 FOR UPDATE;
  IF a.id IS NOT NULL THEN
   IF NOT a.is_emergency_v925 THEN RAISE EXCEPTION '此寵物已有一般門診進行中，請先處理原就診，避免重複掛號'; END IF;
  ELSE
   INSERT INTO public.appointments(tenant_id,pet_id,owner_id,scheduled_at,checked_in_at,session,status,notes,is_emergency_v925,emergency_fee_v925)
   VALUES(t,p.id,p.owner_id,now(),now(),'急診','候診中','[來院目的] 急診',true,fee) RETURNING * INTO a;
  END IF;
  INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(t,request_id,'emergency_register_v925',p_data,jsonb_build_object('appointment_id',a.id),u);
  RETURN jsonb_build_object('tenant_id',t,'appointment',to_jsonb(a),'existing',false);
 ELSIF p_action='visit' THEN
  IF NOT(private.has_ability(t,'clinical') OR private.has_ability(t,'checkout') OR private.has_ability(t,'appointment')) THEN RAISE EXCEPTION '沒有就診查詢權限' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.appointments x WHERE x.tenant_id=t AND x.id=(p_data->>'appointment_id')::uuid;
  IF a.id IS NULL THEN RAISE EXCEPTION '找不到本院掛號'; END IF;
  RETURN jsonb_build_object('tenant_id',t,'appointment_id',a.id,'pet_id',a.pet_id,'emergency',a.is_emergency_v925 OR coalesce(a.notes ~ E'(^|\\n)\\[來院目的\\] 急診($|\\n)',false),'fee',a.emergency_fee_v925,'status',a.status);
 ELSIF p_action='report' THEN
  IF NOT private.has_ability(t,'checkout') THEN RAISE EXCEPTION '沒有收入報表權限' USING ERRCODE='42501'; END IF;
  starts:=(p_data->>'from')::date;ends:=(p_data->>'to')::date;
  IF starts IS NULL OR ends IS NULL OR ends<starts OR ends-starts>366 THEN RAISE EXCEPTION '請選擇一年內的有效日期範圍'; END IF;
  SELECT jsonb_build_object('tenant_id',t,'from',starts,'to',ends,'emergency_count',count(*) FILTER(WHERE i.is_emergency_v925),'emergency_total',coalesce(sum(i.total_amount) FILTER(WHERE i.is_emergency_v925),0),'regular_count',count(*) FILTER(WHERE NOT i.is_emergency_v925),'regular_total',coalesce(sum(i.total_amount) FILTER(WHERE NOT i.is_emergency_v925),0),'voided_count', (SELECT count(*) FROM public.invoices z WHERE z.tenant_id=t AND z.is_emergency_v925 AND z.voided_at IS NOT NULL AND z.created_at>=starts::timestamp AT TIME ZONE 'Asia/Taipei' AND z.created_at<(ends+1)::timestamp AT TIME ZONE 'Asia/Taipei')) INTO reply
  FROM public.invoices i WHERE i.tenant_id=t AND i.voided_at IS NULL AND i.created_at>=starts::timestamp AT TIME ZONE 'Asia/Taipei' AND i.created_at<(ends+1)::timestamp AT TIME ZONE 'Asia/Taipei';
  RETURN reply;
 END IF;
 RAISE EXCEPTION '不支援的急診操作';
END $_$;

ALTER FUNCTION "public"."emergency_v925"("p_action" "text", "p_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."genblue_backup_manifest_v851"("p_expected_tenant" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    SET "statement_timeout" TO '60s'
    SET "jit" TO 'off'
    AS $_$
DECLARE t text:=public.current_tenant_id(); snapshot text; v_base text; v_extra text; v_table_count integer; v_total_rows bigint; files jsonb; bk jsonb:='{}'; n text;
 rows jsonb; v_sig text; v_count bigint; cols jsonb; cons jsonb; count_rows bigint:=0; unknown_tables text;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR p_expected_tenant IS DISTINCT FROM t
 OR NOT coalesce(private.has_ability(t,'admin'),false) THEN
  RAISE EXCEPTION '只有本院管理者可備份' USING ERRCODE='42501';
 END IF;
 SELECT x.payload,x.export_table_count,x.export_total_rows INTO snapshot,v_table_count,v_total_rows FROM private.genblue_backup_core_manifest_v851(t) x;
 -- 不猜測外部連結或舊版附件位置，避免缺檔仍報成功。
 IF EXISTS(SELECT 1 FROM public.lab_tests WHERE tenant_id::text=t AND nullif(file_url,'') IS NOT NULL)
 OR EXISTS(SELECT 1 FROM public.diagnostic_import_jobs WHERE tenant_id::text=t AND nullif(source_storage_path,'') IS NOT NULL)
 OR EXISTS(SELECT 1 FROM public.imaging_assets a WHERE a.tenant_id::text=t AND
 (nullif(a.preview_storage_path,'') IS NOT NULL OR NOT EXISTS(
 SELECT 1 FROM public.imaging_studies s WHERE s.id=a.study_id AND s.tenant_id::text=t
 AND a.storage_path=t||'/'||s.pet_id::text||'/'||s.id::text||'/'||a.id::text||'.'||CASE a.mime_type
 WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp'
 WHEN 'video/mp4' THEN 'mp4' WHEN 'video/quicktime' THEN 'mov' WHEN 'video/webm' THEN 'webm' END
 ))) THEN RAISE EXCEPTION '有尚未支援的舊版附件路徑，備份未產生，請保留此訊息核對'; END IF;
 IF EXISTS(SELECT 1 FROM public.imaging_assets a WHERE a.tenant_id::text=t AND NOT EXISTS(
 SELECT 1 FROM storage.objects o WHERE o.bucket_id='clinic-imaging' AND o.name=a.storage_path
 AND (o.metadata->>'size')::bigint=a.file_size AND o.metadata->>'mimetype'=a.mime_type
 )) THEN RAISE EXCEPTION '影像紀錄有缺檔或檔案資料不符，備份未產生'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='clinic-imaging' AND split_part(o.name,'/',1)=t
 AND (NOT EXISTS(SELECT 1 FROM public.pets p WHERE p.tenant_id::text=t AND p.id::text=split_part(o.name,'/',2))
 OR o.name !~ '^[^/]+/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|webm)$'
 OR coalesce((o.metadata->>'size')::bigint,0) NOT BETWEEN 1 AND 52428800)) THEN
 RAISE EXCEPTION '私人影像區有無法核對的本院檔案，備份未產生'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('bucket','clinic-imaging','path',o.name,
 'object_id',o.id,'updated_at',o.updated_at,'etag',o.metadata->>'eTag','size',(o.metadata->>'size')::bigint,
 'mime',o.metadata->>'mimetype','linked',EXISTS(SELECT 1 FROM public.imaging_assets a WHERE a.tenant_id::text=t AND a.storage_path=o.name)) ORDER BY o.name),'[]')
 INTO files FROM storage.objects o WHERE o.bucket_id='clinic-imaging' AND split_part(o.name,'/',1)=t;
 -- 一併保留線上預約、每週排程與休診日。
 SELECT string_agg(c.relname,',') INTO unknown_tables FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='booking' AND c.relkind IN ('r','p') AND NOT c.relispartition
 AND c.relname NOT IN ('ob_clinics','ob_slots','ob_requests','ob_weekly_v60','ob_closed_days_v60');
 IF unknown_tables IS NOT NULL THEN RAISE EXCEPTION '線上預約備份範圍需更新：%',unknown_tables; END IF;
 FOREACH n IN ARRAY ARRAY['ob_clinics','ob_slots','ob_requests','ob_weekly_v60','ob_closed_days_v60'] LOOP
 IF to_regclass(format('booking.%I',n)) IS NULL THEN RAISE EXCEPTION '缺少線上預約資料表：%',n; END IF;
 EXECUTE format('SELECT count(*),md5(coalesce(string_agg(q.ctid::text||'':''||q.xmin::text,'','' ORDER BY q.ctid),'''')) FROM booking.%I q WHERE tenant_id::text=$1',n) INTO v_count,v_sig USING t; rows:='[]'::jsonb;
 SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
 'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
 INTO cols FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid=to_regclass(format('booking.%I',n)) AND a.attnum>0 AND NOT a.attisdropped;
 SELECT coalesce(jsonb_agg(jsonb_build_object('name',conname,'kind',contype,'definition',pg_get_constraintdef(oid,true)) ORDER BY conname),'[]')
 INTO cons FROM pg_constraint WHERE conrelid=to_regclass(format('booking.%I',n));
 bk:=bk||jsonb_build_object(n,jsonb_build_object('source_schema','booking','row_count',v_count,'signature',v_sig,'columns',cols,'constraints',cons,'rows',rows));
 count_rows:=count_rows+v_count;
 END LOOP;
 -- genblue_backup_parts_v73: no reparse of full medical-history JSON.
 v_extra:=json_build_object('format_version',3,'booking_tables',bk,
 'table_count',v_table_count+5,'total_rows',v_total_rows+count_rows,
 'attachments',jsonb_build_object('mode','private_storage_v62','objects',files,'object_count',jsonb_array_length(files),
 'total_bytes',coalesce((SELECT sum((f->>'size')::bigint) FROM jsonb_array_elements(files) f),0),
 'exclusions',jsonb_build_array('public_program_html','unmanaged_external_files')))::text;
 RETURN substr(snapshot,1,length(snapshot)-1)||','||substr(v_extra,2,length(v_extra)-2)||'}';
END $_$;

ALTER FUNCTION "public"."genblue_backup_manifest_v851"("p_expected_tenant" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."genblue_backup_page_v851"("p_expected_tenant" "text", "p_schema" "text", "p_table" "text", "p_signature" "text", "p_offset" integer DEFAULT 0, "p_limit" integer DEFAULT 50) RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    SET "statement_timeout" TO '60s'
    SET "jit" TO 'off'
    AS $_$
DECLARE t text:=public.current_tenant_id();v_filter text;v_sig text;v_count bigint;v_rows json;v_allowed boolean;v_known text[]:=ARRAY['appointments','audit_logs','breed_images','breeds','categories','clinic_settings','clinic_trials','controlled_drug_counts','diagnostic_devices','diagnostic_import_jobs','diagnostic_results','imaging_assets','imaging_share_tokens','imaging_studies','inpatients','inventory_movements','invoice_items','invoices','item_categories','items','lab_reports','lab_tests','legacy_medical_histories','medical_records','medicines','owner_code_counters','owners','pets','rapid_test_records','rapid_types','regulated_drug_transactions','regulated_lots','regulatory_report_batch_transactions','regulatory_report_batches','report_export_profiles','user_profiles','vaccination_records','vaccine_types','imaging_shares_v76','pos_audit_v77','pos_movements_v77','pos_pending_v77','pos_requests_v77','pos_shifts_v77','pharmacy_jobs_v9133'];
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR p_expected_tenant IS DISTINCT FROM t OR NOT coalesce(private.has_ability(t,'admin'),false) THEN RAISE EXCEPTION '只有本院管理者可備份' USING ERRCODE='42501'; END IF;
 v_allowed:=CASE p_schema WHEN 'public' THEN p_table=ANY(v_known) WHEN 'private' THEN p_table=ANY(ARRAY['clinic_visit_claims_v51','clinic_multidoctor_settings_v51','medical_amendments_v53']) WHEN 'booking' THEN p_table=ANY(ARRAY['ob_clinics','ob_slots','ob_requests','ob_weekly_v60','ob_closed_days_v60']) ELSE false END;
 IF NOT coalesce(v_allowed,false) OR p_signature IS NULL OR p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION '備份分批參數有誤'; END IF;
 IF p_schema='public' AND p_table='invoice_items' THEN v_filter:=format('EXISTS(SELECT 1 FROM public.invoices parent WHERE parent.id=q.invoice_id AND parent.tenant_id::text=%L)',t);
 ELSIF p_schema='public' AND p_table='regulatory_report_batch_transactions' THEN v_filter:=format('EXISTS(SELECT 1 FROM public.regulatory_report_batches parent JOIN public.regulated_drug_transactions tx ON tx.id=q.transaction_id WHERE parent.id=q.batch_id AND parent.tenant_id::text=%L AND tx.tenant_id::text=%L)',t,t);
 ELSE v_filter:=format('q.tenant_id::text=%L',t); END IF;
 EXECUTE format('SELECT count(*),md5(coalesce(string_agg(q.ctid::text||'':''||q.xmin::text,'','' ORDER BY q.ctid),'''')) FROM %I.%I q WHERE %s',p_schema,p_table,v_filter) INTO v_count,v_sig;
 IF v_sig IS DISTINCT FROM p_signature THEN RAISE EXCEPTION '備份期間資料已變動（%.%），請重新備份',p_schema,p_table USING ERRCODE='40001'; END IF;
 EXECUTE format('SELECT coalesce(json_agg(r),''[]''::json) FROM (SELECT q.* FROM %I.%I q WHERE %s ORDER BY q.ctid LIMIT $1 OFFSET $2) r',p_schema,p_table,v_filter) INTO v_rows USING p_limit,p_offset;
 -- rows is last: the browser preserves this JSON array verbatim, including bigint IDs.
 RETURN json_build_object('tenant_id',t,'schema',p_schema,'table',p_table,'signature',v_sig,'total',v_count,'offset',p_offset,'rows',v_rows)::text;
END;$_$;

ALTER FUNCTION "public"."genblue_backup_page_v851"("p_expected_tenant" "text", "p_schema" "text", "p_table" "text", "p_signature" "text", "p_offset" integer, "p_limit" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."genblue_check_backup_objects_v62"("p_expected_tenant" "text", "p_objects" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    SET "statement_timeout" TO '30s'
    AS $$
DECLARE t text:=public.current_tenant_id(); x jsonb;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR p_expected_tenant IS DISTINCT FROM t
 OR NOT coalesce(private.has_ability(t,'admin'),false) THEN RAISE EXCEPTION '只有本院管理者可核對備份' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_objects) IS DISTINCT FROM 'array' OR jsonb_array_length(p_objects)>1000 THEN RAISE EXCEPTION '核對清單格式有誤'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_objects) LOOP
 IF x->>'bucket' IS DISTINCT FROM 'clinic-imaging' OR split_part(x->>'path','/',1) IS DISTINCT FROM t
 OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='clinic-imaging' AND o.name=x->>'path'
 AND o.id::text=x->>'object_id' AND o.updated_at=(x->>'updated_at')::timestamptz
 AND (o.metadata->>'size')::bigint=(x->>'size')::bigint
 AND o.metadata->>'eTag' IS NOT DISTINCT FROM x->>'etag') THEN RAISE EXCEPTION '備份期間檔案已變更或缺失，請重新備份'; END IF;
 END LOOP;
 RETURN true;
END $$;

ALTER FUNCTION "public"."genblue_check_backup_objects_v62"("p_expected_tenant" "text", "p_objects" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."genblue_export_clinic_backup_v1"("p_expected_tenant" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    SET "statement_timeout" TO '60s'
    AS $_$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant text;
  v_role text;
  v_table text;
  v_known text[] := ARRAY['appointments','audit_logs','breed_images','breeds','categories','clinic_settings','clinic_trials','controlled_drug_counts','diagnostic_devices','diagnostic_import_jobs','diagnostic_results','imaging_assets','imaging_share_tokens','imaging_studies','inpatients','inventory_movements','invoice_items','invoices','item_categories','items','lab_reports','lab_tests','legacy_medical_histories','medical_records','medicines','owner_code_counters','owners','pets','rapid_test_records','rapid_types','regulated_drug_transactions','regulated_lots','regulatory_report_batch_transactions','regulatory_report_batches','report_export_profiles','user_profiles','vaccination_records','vaccine_types'];
  v_unknown text;
  v_columns jsonb;
  v_constraints jsonb;
  v_foreign_keys jsonb;
  v_payload json;
  v_parts text[] := ARRAY[]::text[];
  v_total bigint := 0;
  v_storage jsonb;
  v_references bigint;
  v_actual_files bigint;
  v_filter text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '請先登入管理者帳號。' USING ERRCODE = '42501';
  END IF;
  SELECT u.tenant_id::text, u.role INTO v_tenant, v_role
  FROM public.user_profiles u WHERE u.user_id = v_uid;
  IF v_tenant IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION '只有本院管理者可以備份。' USING ERRCODE = '42501';
  END IF;
  IF p_expected_tenant IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION '醫院登入狀態已改變，請重新登入。' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE(private.has_ability(v_tenant, 'admin'), false) THEN
    RAISE EXCEPTION '目前帳號沒有有效的管理者權限。' USING ERRCODE = '42501';
  END IF;

  SELECT string_agg(n.nspname || '.' || c.relname, ', ' ORDER BY n.nspname,c.relname) INTO v_unknown
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p') AND NOT c.relispartition
    AND NOT (n.nspname='public' AND (c.relname = ANY(v_known) OR c.relname='platform_operators'));
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION '備份範圍需要更新，發現新資料表：%', v_unknown;
  END IF;

  SELECT count(*) INTO v_actual_files FROM storage.objects o
  WHERE o.name !~* '\.html$';
  SELECT
    (SELECT count(*) FROM public.imaging_assets WHERE tenant_id::text=v_tenant AND
      (NULLIF(storage_path, '') IS NOT NULL OR NULLIF(preview_storage_path, '') IS NOT NULL)) +
    (SELECT count(*) FROM public.lab_tests WHERE tenant_id::text=v_tenant AND NULLIF(file_url, '') IS NOT NULL) +
    (SELECT count(*) FROM public.diagnostic_import_jobs WHERE tenant_id::text=v_tenant AND NULLIF(source_storage_path, '') IS NOT NULL)
  INTO v_references;
  IF v_actual_files > 0 OR v_references > 0 THEN
    RAISE EXCEPTION '偵測到影像或附件，需升級含檔案的備份版本，本次未產生備份。';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', b.id,
    'html_files_excluded', (SELECT count(*) FROM storage.objects o WHERE o.bucket_id=b.id))), '[]'::jsonb)
  INTO v_storage FROM storage.buckets b;

  -- 橋接資料兩端必須都屬同一醫院；不一致時中止，避免默默漏掉資料。
  IF EXISTS (SELECT 1 FROM public.regulatory_report_batch_transactions x
    JOIN public.regulatory_report_batches b ON b.id=x.batch_id
    JOIN public.regulated_drug_transactions t ON t.id=x.transaction_id
    WHERE (b.tenant_id::text=v_tenant OR t.tenant_id::text=v_tenant)
      AND b.tenant_id::text IS DISTINCT FROM t.tenant_id::text) THEN
    RAISE EXCEPTION '申報明細存在跨醫院連結，請先修正資料。';
  END IF;

  FOREACH v_table IN ARRAY v_known LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION '缺少必要資料表：%', v_table;
    END IF;
    IF v_table = 'invoice_items' THEN
      v_filter := format('EXISTS (SELECT 1 FROM public.invoices p WHERE p.id=t.invoice_id AND p.tenant_id::text=%L)', v_tenant);
    ELSIF v_table = 'regulatory_report_batch_transactions' THEN
      v_filter := format('EXISTS (SELECT 1 FROM public.regulatory_report_batches b JOIN public.regulated_drug_transactions x ON x.id=t.transaction_id WHERE b.id=t.batch_id AND b.tenant_id::text=%L AND x.tenant_id::text=%L)', v_tenant, v_tenant);
    ELSE
      v_filter := format('t.tenant_id::text=%L', v_tenant);
    END IF;
    SELECT jsonb_agg(jsonb_build_object('name', a.attname,
      'type', format_type(a.atttypid, a.atttypmod), 'not_null', a.attnotnull,
      'identity', a.attidentity, 'generated', a.attgenerated,
      'default', pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
    INTO v_columns
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=to_regclass(format('public.%I',v_table)) AND a.attnum>0 AND NOT a.attisdropped;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k.conname,
      'kind', k.contype, 'definition', pg_get_constraintdef(k.oid,true)) ORDER BY k.conname), '[]'::jsonb)
    INTO v_constraints FROM pg_constraint k WHERE k.conrelid=to_regclass(format('public.%I',v_table));
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'constraint', k.conname, 'parent_schema', n.nspname, 'parent_table', p.relname,
      'columns', (SELECT jsonb_agg(a.attname ORDER BY u.ord) FROM unnest(k.conkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=u.num),
      'parent_columns', (SELECT jsonb_agg(a.attname ORDER BY u.ord) FROM unnest(k.confkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=u.num)
    ) ORDER BY k.conname), '[]'::jsonb) INTO v_foreign_keys
    FROM pg_constraint k JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace n ON n.oid=p.relnamespace
    WHERE k.conrelid=to_regclass(format('public.%I',v_table)) AND k.contype='f';
    -- 只收集查詢及結構；避免每讀完一張表就複製先前所有病歷 JSONB。
    -- 所有資料最後一次聚合，json_agg 直接保留資料庫的數字原文。
    v_parts := array_append(v_parts, format(
      'SELECT %L::text AS table_name, count(*) AS row_count, '
      || 'json_build_object(''row_count'', count(*), ''scope'', %L, '
      || '''columns'', %L::jsonb, ''constraints'', %L::jsonb, ''foreign_keys'', %L::jsonb, '
      || '''rows'', COALESCE(json_agg(t), ''[]''::json)) AS table_data '
      || 'FROM public.%I t WHERE %s',
      v_table, CASE WHEN v_table IN ('invoice_items','regulatory_report_batch_transactions') THEN 'parent_tenant' ELSE 'tenant_id' END,
      v_columns::text, v_constraints::text, v_foreign_keys::text, v_table, v_filter));
  END LOOP;
  EXECUTE 'SELECT COALESCE(json_object_agg(s.table_name, s.table_data), ''{}''::json), '
       || 'COALESCE(sum(s.row_count), 0)::bigint FROM ('
       || array_to_string(v_parts, ' UNION ALL ') || ') s'
    INTO v_payload, v_total;
  RETURN json_build_object(
    'format', 'genblue-clinic-snapshot', 'format_version', 1, 'tenant_id', v_tenant,
    'snapshot_at', statement_timestamp(), 'table_count', cardinality(v_known), 'total_rows', v_total,
    'tables', v_payload,
    'attachments', jsonb_build_object('mode','verified_none_v1','patient_file_references',v_references,
      'non_html_storage_objects',v_actual_files,'excluded_program_files',v_storage),
    'exclusions', jsonb_build_array('auth_accounts_and_passwords','platform_operators','program_html',
      'sql_functions_policies_and_project_settings'),
    'restore_status', 'not_yet_rehearsed_for_this_file')::text;
END;
$_$;

ALTER FUNCTION "public"."genblue_export_clinic_backup_v1"("p_expected_tenant" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."genblue_export_clinic_backup_v1"("p_expected_tenant" "text") IS '管理者專用單院一致性資料快照相容 v1，讀取優化 v2；不含 Auth、平台設定及程式；有附件或未知表時拒絕產出。';

CREATE OR REPLACE FUNCTION "public"."genblue_export_clinic_backup_v53"("p_expected_tenant" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE t text:=public.current_tenant_id(); snapshot jsonb; entries jsonb:='{}'::jsonb; rows jsonb; n text; private_rows bigint:=0;
BEGIN
 IF auth.uid() IS NULL OR p_expected_tenant IS DISTINCT FROM t OR NOT private.has_ability(t,'admin') THEN RAISE EXCEPTION '只有本院管理者可備份' USING ERRCODE='42501'; END IF;
 IF to_regprocedure('public.genblue_export_clinic_public_v53(text)') IS NULL THEN RAISE EXCEPTION '請先安裝原院一鍵備份函式，再重跑v53更新SQL'; END IF;
 snapshot:=public.genblue_export_clinic_public_v53(t)::jsonb;
 FOREACH n IN ARRAY ARRAY['clinic_visit_claims_v51','clinic_multidoctor_settings_v51','medical_amendments_v53'] LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(q)),''[]''::jsonb) FROM (SELECT * FROM private.%I WHERE tenant_id=$1) q',n) INTO rows USING t;
  entries:=entries||jsonb_build_object(n,jsonb_build_object('source_schema','private','row_count',jsonb_array_length(rows),'rows',rows));private_rows:=private_rows+jsonb_array_length(rows);
 END LOOP;
 snapshot:=snapshot||jsonb_build_object('format_version',2,'private_tables',entries,'table_count',(snapshot->>'table_count')::integer+3,'total_rows',(snapshot->>'total_rows')::bigint+private_rows);
 RETURN snapshot::text;
END $_$;

ALTER FUNCTION "public"."genblue_export_clinic_backup_v53"("p_expected_tenant" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."genblue_export_clinic_backup_v62"("p_expected_tenant" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    SET "statement_timeout" TO '60s'
    AS $_$
DECLARE t text:=public.current_tenant_id(); snapshot text; v_base text; v_extra text; v_table_count integer; v_total_rows bigint; files jsonb; bk jsonb:='{}'; n text;
 rows jsonb; cols jsonb; cons jsonb; count_rows bigint:=0; unknown_tables text;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR p_expected_tenant IS DISTINCT FROM t
 OR NOT coalesce(private.has_ability(t,'admin'),false) THEN
  RAISE EXCEPTION '只有本院管理者可備份' USING ERRCODE='42501';
 END IF;
 SELECT x.payload,x.export_table_count,x.export_total_rows INTO snapshot,v_table_count,v_total_rows FROM private.genblue_backup_core_parts_v73(t) x;
 -- 不猜測外部連結或舊版附件位置，避免缺檔仍報成功。
 IF EXISTS(SELECT 1 FROM public.lab_tests WHERE tenant_id::text=t AND nullif(file_url,'') IS NOT NULL)
 OR EXISTS(SELECT 1 FROM public.diagnostic_import_jobs WHERE tenant_id::text=t AND nullif(source_storage_path,'') IS NOT NULL)
 OR EXISTS(SELECT 1 FROM public.imaging_assets a WHERE a.tenant_id::text=t AND
 (nullif(a.preview_storage_path,'') IS NOT NULL OR NOT EXISTS(
 SELECT 1 FROM public.imaging_studies s WHERE s.id=a.study_id AND s.tenant_id::text=t
 AND a.storage_path=t||'/'||s.pet_id::text||'/'||s.id::text||'/'||a.id::text||'.'||CASE a.mime_type
 WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp'
 WHEN 'video/mp4' THEN 'mp4' WHEN 'video/quicktime' THEN 'mov' WHEN 'video/webm' THEN 'webm' END
 ))) THEN RAISE EXCEPTION '有尚未支援的舊版附件路徑，備份未產生，請保留此訊息核對'; END IF;
 IF EXISTS(SELECT 1 FROM public.imaging_assets a WHERE a.tenant_id::text=t AND NOT EXISTS(
 SELECT 1 FROM storage.objects o WHERE o.bucket_id='clinic-imaging' AND o.name=a.storage_path
 AND (o.metadata->>'size')::bigint=a.file_size AND o.metadata->>'mimetype'=a.mime_type
 )) THEN RAISE EXCEPTION '影像紀錄有缺檔或檔案資料不符，備份未產生'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='clinic-imaging' AND split_part(o.name,'/',1)=t
 AND (NOT EXISTS(SELECT 1 FROM public.pets p WHERE p.tenant_id::text=t AND p.id::text=split_part(o.name,'/',2))
 OR o.name !~ '^[^/]+/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|webm)$'
 OR coalesce((o.metadata->>'size')::bigint,0) NOT BETWEEN 1 AND 52428800)) THEN
 RAISE EXCEPTION '私人影像區有無法核對的本院檔案，備份未產生'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('bucket','clinic-imaging','path',o.name,
 'object_id',o.id,'updated_at',o.updated_at,'etag',o.metadata->>'eTag','size',(o.metadata->>'size')::bigint,
 'mime',o.metadata->>'mimetype','linked',EXISTS(SELECT 1 FROM public.imaging_assets a WHERE a.tenant_id::text=t AND a.storage_path=o.name)) ORDER BY o.name),'[]')
 INTO files FROM storage.objects o WHERE o.bucket_id='clinic-imaging' AND split_part(o.name,'/',1)=t;
 -- 一併保留線上預約、每週排程與休診日。
 SELECT string_agg(c.relname,',') INTO unknown_tables FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='booking' AND c.relkind IN ('r','p') AND NOT c.relispartition
 AND c.relname NOT IN ('ob_clinics','ob_slots','ob_requests','ob_weekly_v60','ob_closed_days_v60');
 IF unknown_tables IS NOT NULL THEN RAISE EXCEPTION '線上預約備份範圍需更新：%',unknown_tables; END IF;
 FOREACH n IN ARRAY ARRAY['ob_clinics','ob_slots','ob_requests','ob_weekly_v60','ob_closed_days_v60'] LOOP
 IF to_regclass(format('booking.%I',n)) IS NULL THEN RAISE EXCEPTION '缺少線上預約資料表：%',n; END IF;
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(q)),''[]''::jsonb) FROM (SELECT * FROM booking.%I WHERE tenant_id=$1) q',n) INTO rows USING t;
 SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
 'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
 INTO cols FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid=to_regclass(format('booking.%I',n)) AND a.attnum>0 AND NOT a.attisdropped;
 SELECT coalesce(jsonb_agg(jsonb_build_object('name',conname,'kind',contype,'definition',pg_get_constraintdef(oid,true)) ORDER BY conname),'[]')
 INTO cons FROM pg_constraint WHERE conrelid=to_regclass(format('booking.%I',n));
 bk:=bk||jsonb_build_object(n,jsonb_build_object('source_schema','booking','row_count',jsonb_array_length(rows),'columns',cols,'constraints',cons,'rows',rows));
 count_rows:=count_rows+jsonb_array_length(rows);
 END LOOP;
 -- genblue_backup_parts_v73: no reparse of full medical-history JSON.
 v_extra:=json_build_object('format_version',3,'booking_tables',bk,
 'table_count',v_table_count+5,'total_rows',v_total_rows+count_rows,
 'attachments',jsonb_build_object('mode','private_storage_v62','objects',files,'object_count',jsonb_array_length(files),
 'total_bytes',coalesce((SELECT sum((f->>'size')::bigint) FROM jsonb_array_elements(files) f),0),
 'exclusions',jsonb_build_array('public_program_html','unmanaged_external_files')))::text;
 RETURN substr(snapshot,1,length(snapshot)-1)||','||substr(v_extra,2,length(v_extra)-2)||'}';
END $_$;

ALTER FUNCTION "public"."genblue_export_clinic_backup_v62"("p_expected_tenant" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."genblue_export_clinic_core_v62"("p_expected_tenant" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE t text:=public.current_tenant_id(); snapshot text; v_base text; v_extra text; v_table_count integer; v_total_rows bigint; entries jsonb:='{}'::jsonb; rows jsonb; n text; private_rows bigint:=0;
BEGIN
 IF auth.uid() IS NULL OR p_expected_tenant IS DISTINCT FROM t OR NOT private.has_ability(t,'admin') THEN RAISE EXCEPTION '只有本院管理者可備份' USING ERRCODE='42501'; END IF;
 IF to_regprocedure('public.genblue_export_clinic_public_v53(text)') IS NULL THEN RAISE EXCEPTION '請先安裝原院一鍵備份函式，再重跑v53更新SQL'; END IF;
 snapshot:=public.genblue_export_clinic_public_v62(t);
 FOREACH n IN ARRAY ARRAY['clinic_visit_claims_v51','clinic_multidoctor_settings_v51','medical_amendments_v53'] LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(q)),''[]''::jsonb) FROM (SELECT * FROM private.%I WHERE tenant_id=$1) q',n) INTO rows USING t;
  entries:=entries||jsonb_build_object(n,jsonb_build_object('source_schema','private','row_count',jsonb_array_length(rows),'rows',rows));private_rows:=private_rows+jsonb_array_length(rows);
 END LOOP;
 -- genblue_backup_json_stream_v1: parse top-level entries once; keep every raw data value.
 SELECT string_agg(to_json(e.key)::text||':'||e.value::text,',')
          FILTER (WHERE e.key NOT IN ('format_version','private_tables','table_count','total_rows')),
        max(CASE WHEN e.key='table_count' THEN e.value::text::integer END),
        max(CASE WHEN e.key='total_rows' THEN e.value::text::bigint END)
 INTO v_base,v_table_count,v_total_rows FROM json_each(snapshot::json) AS e;
 IF v_base IS NULL OR v_table_count IS NULL OR v_total_rows IS NULL THEN
  RAISE EXCEPTION '公共備份統計欄位不完整，停止備份';
 END IF;
 v_extra:=json_build_object('format_version',2,'private_tables',entries,
   'table_count',v_table_count+3,'total_rows',v_total_rows+private_rows)::text;
 snapshot:='{'||v_base||','||substr(v_extra,2,length(v_extra)-2)||'}';
 RETURN snapshot::text;
END $_$;

ALTER FUNCTION "public"."genblue_export_clinic_core_v62"("p_expected_tenant" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."genblue_export_clinic_public_v53"("p_expected_tenant" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    SET "statement_timeout" TO '60s'
    AS $_$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant text;
  v_role text;
  v_table text;
  v_known text[] := ARRAY['appointments','audit_logs','breed_images','breeds','categories','clinic_settings','clinic_trials','controlled_drug_counts','diagnostic_devices','diagnostic_import_jobs','diagnostic_results','imaging_assets','imaging_share_tokens','imaging_studies','inpatients','inventory_movements','invoice_items','invoices','item_categories','items','lab_reports','lab_tests','legacy_medical_histories','medical_records','medicines','owner_code_counters','owners','pets','rapid_test_records','rapid_types','regulated_drug_transactions','regulated_lots','regulatory_report_batch_transactions','regulatory_report_batches','report_export_profiles','user_profiles','vaccination_records','vaccine_types'];
  v_unknown text;
  v_columns jsonb;
  v_constraints jsonb;
  v_foreign_keys jsonb;
  v_payload json;
  v_parts text[] := ARRAY[]::text[];
  v_total bigint := 0;
  v_storage jsonb;
  v_references bigint;
  v_actual_files bigint;
  v_filter text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '請先登入管理者帳號。' USING ERRCODE = '42501';
  END IF;
  SELECT u.tenant_id::text, u.role INTO v_tenant, v_role
  FROM public.user_profiles u WHERE u.user_id = v_uid;
  IF v_tenant IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION '只有本院管理者可以備份。' USING ERRCODE = '42501';
  END IF;
  IF p_expected_tenant IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION '醫院登入狀態已改變，請重新登入。' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE(private.has_ability(v_tenant, 'admin'), false) THEN
    RAISE EXCEPTION '目前帳號沒有有效的管理者權限。' USING ERRCODE = '42501';
  END IF;

  SELECT string_agg(n.nspname || '.' || c.relname, ', ' ORDER BY n.nspname,c.relname) INTO v_unknown
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p') AND NOT c.relispartition
    AND NOT (n.nspname='public' AND (c.relname = ANY(v_known) OR c.relname='platform_operators')) AND NOT (n.nspname='private' AND c.relname IN ('clinic_visit_claims_v51','clinic_multidoctor_settings_v51','medical_amendments_v53'));
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION '備份範圍需要更新，發現新資料表：%', v_unknown;
  END IF;

  SELECT count(*) INTO v_actual_files FROM storage.objects o
  WHERE o.name !~* '\.html$';
  SELECT
    (SELECT count(*) FROM public.imaging_assets WHERE tenant_id::text=v_tenant AND
      (NULLIF(storage_path, '') IS NOT NULL OR NULLIF(preview_storage_path, '') IS NOT NULL)) +
    (SELECT count(*) FROM public.lab_tests WHERE tenant_id::text=v_tenant AND NULLIF(file_url, '') IS NOT NULL) +
    (SELECT count(*) FROM public.diagnostic_import_jobs WHERE tenant_id::text=v_tenant AND NULLIF(source_storage_path, '') IS NOT NULL)
  INTO v_references;
  IF v_actual_files > 0 OR v_references > 0 THEN
    RAISE EXCEPTION '偵測到影像或附件，需升級含檔案的備份版本，本次未產生備份。';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', b.id,
    'html_files_excluded', (SELECT count(*) FROM storage.objects o WHERE o.bucket_id=b.id))), '[]'::jsonb)
  INTO v_storage FROM storage.buckets b;

  -- 橋接資料兩端必須都屬同一醫院；不一致時中止，避免默默漏掉資料。
  IF EXISTS (SELECT 1 FROM public.regulatory_report_batch_transactions x
    JOIN public.regulatory_report_batches b ON b.id=x.batch_id
    JOIN public.regulated_drug_transactions t ON t.id=x.transaction_id
    WHERE (b.tenant_id::text=v_tenant OR t.tenant_id::text=v_tenant)
      AND b.tenant_id::text IS DISTINCT FROM t.tenant_id::text) THEN
    RAISE EXCEPTION '申報明細存在跨醫院連結，請先修正資料。';
  END IF;

  FOREACH v_table IN ARRAY v_known LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION '缺少必要資料表：%', v_table;
    END IF;
    IF v_table = 'invoice_items' THEN
      v_filter := format('EXISTS (SELECT 1 FROM public.invoices p WHERE p.id=t.invoice_id AND p.tenant_id::text=%L)', v_tenant);
    ELSIF v_table = 'regulatory_report_batch_transactions' THEN
      v_filter := format('EXISTS (SELECT 1 FROM public.regulatory_report_batches b JOIN public.regulated_drug_transactions x ON x.id=t.transaction_id WHERE b.id=t.batch_id AND b.tenant_id::text=%L AND x.tenant_id::text=%L)', v_tenant, v_tenant);
    ELSE
      v_filter := format('t.tenant_id::text=%L', v_tenant);
    END IF;
    SELECT jsonb_agg(jsonb_build_object('name', a.attname,
      'type', format_type(a.atttypid, a.atttypmod), 'not_null', a.attnotnull,
      'identity', a.attidentity, 'generated', a.attgenerated,
      'default', pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
    INTO v_columns
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=to_regclass(format('public.%I',v_table)) AND a.attnum>0 AND NOT a.attisdropped;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k.conname,
      'kind', k.contype, 'definition', pg_get_constraintdef(k.oid,true)) ORDER BY k.conname), '[]'::jsonb)
    INTO v_constraints FROM pg_constraint k WHERE k.conrelid=to_regclass(format('public.%I',v_table));
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'constraint', k.conname, 'parent_schema', n.nspname, 'parent_table', p.relname,
      'columns', (SELECT jsonb_agg(a.attname ORDER BY u.ord) FROM unnest(k.conkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=u.num),
      'parent_columns', (SELECT jsonb_agg(a.attname ORDER BY u.ord) FROM unnest(k.confkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=u.num)
    ) ORDER BY k.conname), '[]'::jsonb) INTO v_foreign_keys
    FROM pg_constraint k JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace n ON n.oid=p.relnamespace
    WHERE k.conrelid=to_regclass(format('public.%I',v_table)) AND k.contype='f';
    -- 只收集查詢及結構；避免每讀完一張表就複製先前所有病歷 JSONB。
    -- 所有資料最後一次聚合，json_agg 直接保留資料庫的數字原文。
    v_parts := array_append(v_parts, format(
      'SELECT %L::text AS table_name, count(*) AS row_count, '
      || 'json_build_object(''row_count'', count(*), ''scope'', %L, '
      || '''columns'', %L::jsonb, ''constraints'', %L::jsonb, ''foreign_keys'', %L::jsonb, '
      || '''rows'', COALESCE(json_agg(t), ''[]''::json)) AS table_data '
      || 'FROM public.%I t WHERE %s',
      v_table, CASE WHEN v_table IN ('invoice_items','regulatory_report_batch_transactions') THEN 'parent_tenant' ELSE 'tenant_id' END,
      v_columns::text, v_constraints::text, v_foreign_keys::text, v_table, v_filter));
  END LOOP;
  EXECUTE 'SELECT COALESCE(json_object_agg(s.table_name, s.table_data), ''{}''::json), '
       || 'COALESCE(sum(s.row_count), 0)::bigint FROM ('
       || array_to_string(v_parts, ' UNION ALL ') || ') s'
    INTO v_payload, v_total;
  RETURN json_build_object(
    'format', 'genblue-clinic-snapshot', 'format_version', 1, 'tenant_id', v_tenant,
    'snapshot_at', statement_timestamp(), 'table_count', cardinality(v_known), 'total_rows', v_total,
    'tables', v_payload,
    'attachments', jsonb_build_object('mode','verified_none_v1','patient_file_references',v_references,
      'non_html_storage_objects',v_actual_files,'excluded_program_files',v_storage),
    'exclusions', jsonb_build_array('auth_accounts_and_passwords','platform_operators','program_html',
      'sql_functions_policies_and_project_settings'),
    'restore_status', 'not_yet_rehearsed_for_this_file')::text;
END;
$_$;

ALTER FUNCTION "public"."genblue_export_clinic_public_v53"("p_expected_tenant" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."genblue_export_clinic_public_v62"("p_expected_tenant" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    SET "statement_timeout" TO '60s'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant text;
  v_role text;
  v_table text;
  v_known text[] := ARRAY['appointments','audit_logs','breed_images','breeds','categories','clinic_settings','clinic_trials','controlled_drug_counts','diagnostic_devices','diagnostic_import_jobs','diagnostic_results','imaging_assets','imaging_share_tokens','imaging_studies','inpatients','inventory_movements','invoice_items','invoices','item_categories','items','lab_reports','lab_tests','legacy_medical_histories','medical_records','medicines','owner_code_counters','owners','pets','rapid_test_records','rapid_types','regulated_drug_transactions','regulated_lots','regulatory_report_batch_transactions','regulatory_report_batches','report_export_profiles','user_profiles','vaccination_records','vaccine_types','imaging_shares_v76','pos_audit_v77','pos_movements_v77','pos_pending_v77','pos_requests_v77','pos_shifts_v77'];
  v_unknown text;
  v_columns jsonb;
  v_constraints jsonb;
  v_foreign_keys jsonb;
  v_payload json;
  v_parts text[] := ARRAY[]::text[];
  v_total bigint := 0;
  v_storage jsonb;
  v_references bigint;
  v_actual_files bigint;
  v_filter text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '請先登入管理者帳號。' USING ERRCODE = '42501';
  END IF;
  SELECT u.tenant_id::text, u.role INTO v_tenant, v_role
  FROM public.user_profiles u WHERE u.user_id = v_uid;
  IF v_tenant IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION '只有本院管理者可以備份。' USING ERRCODE = '42501';
  END IF;
  IF p_expected_tenant IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION '醫院登入狀態已改變，請重新登入。' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE(private.has_ability(v_tenant, 'admin'), false) THEN
    RAISE EXCEPTION '目前帳號沒有有效的管理者權限。' USING ERRCODE = '42501';
  END IF;

  SELECT string_agg(n.nspname || '.' || c.relname, ', ' ORDER BY n.nspname,c.relname) INTO v_unknown
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p') AND NOT c.relispartition
    AND NOT (n.nspname='public' AND (c.relname = ANY(v_known) OR c.relname='platform_operators')) AND NOT (n.nspname='private' AND c.relname IN ('clinic_visit_claims_v51','clinic_multidoctor_settings_v51','medical_amendments_v53'));
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION '備份範圍需要更新，發現新資料表：%', v_unknown;
  END IF;

  v_actual_files:=0; v_references:=0; v_storage:='[]'::jsonb;
  IF EXISTS (SELECT 1 FROM public.regulatory_report_batch_transactions x
    JOIN public.regulatory_report_batches b ON b.id=x.batch_id
    JOIN public.regulated_drug_transactions t ON t.id=x.transaction_id
    WHERE (b.tenant_id::text=v_tenant OR t.tenant_id::text=v_tenant)
      AND b.tenant_id::text IS DISTINCT FROM t.tenant_id::text) THEN
    RAISE EXCEPTION '申報明細存在跨醫院連結，請先修正資料。';
  END IF;

  FOREACH v_table IN ARRAY v_known LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION '缺少必要資料表：%', v_table;
    END IF;
    IF v_table = 'invoice_items' THEN
      v_filter := format('EXISTS (SELECT 1 FROM public.invoices p WHERE p.id=t.invoice_id AND p.tenant_id::text=%L)', v_tenant);
    ELSIF v_table = 'regulatory_report_batch_transactions' THEN
      v_filter := format('EXISTS (SELECT 1 FROM public.regulatory_report_batches b JOIN public.regulated_drug_transactions x ON x.id=t.transaction_id WHERE b.id=t.batch_id AND b.tenant_id::text=%L AND x.tenant_id::text=%L)', v_tenant, v_tenant);
    ELSE
      v_filter := format('t.tenant_id::text=%L', v_tenant);
    END IF;
    SELECT jsonb_agg(jsonb_build_object('name', a.attname,
      'type', format_type(a.atttypid, a.atttypmod), 'not_null', a.attnotnull,
      'identity', a.attidentity, 'generated', a.attgenerated,
      'default', pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
    INTO v_columns
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=to_regclass(format('public.%I',v_table)) AND a.attnum>0 AND NOT a.attisdropped;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', k.conname,
      'kind', k.contype, 'definition', pg_get_constraintdef(k.oid,true)) ORDER BY k.conname), '[]'::jsonb)
    INTO v_constraints FROM pg_constraint k WHERE k.conrelid=to_regclass(format('public.%I',v_table));
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'constraint', k.conname, 'parent_schema', n.nspname, 'parent_table', p.relname,
      'columns', (SELECT jsonb_agg(a.attname ORDER BY u.ord) FROM unnest(k.conkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=u.num),
      'parent_columns', (SELECT jsonb_agg(a.attname ORDER BY u.ord) FROM unnest(k.confkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=u.num)
    ) ORDER BY k.conname), '[]'::jsonb) INTO v_foreign_keys
    FROM pg_constraint k JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace n ON n.oid=p.relnamespace
    WHERE k.conrelid=to_regclass(format('public.%I',v_table)) AND k.contype='f';
    -- 只收集查詢及結構；避免每讀完一張表就複製先前所有病歷 JSONB。
    -- 所有資料最後一次聚合，json_agg 直接保留資料庫的數字原文。
    v_parts := array_append(v_parts, format(
      'SELECT %L::text AS table_name, count(*) AS row_count, '
      || 'json_build_object(''row_count'', count(*), ''scope'', %L, '
      || '''columns'', %L::jsonb, ''constraints'', %L::jsonb, ''foreign_keys'', %L::jsonb, '
      || '''rows'', COALESCE(json_agg(t), ''[]''::json)) AS table_data '
      || 'FROM public.%I t WHERE %s',
      v_table, CASE WHEN v_table IN ('invoice_items','regulatory_report_batch_transactions') THEN 'parent_tenant' ELSE 'tenant_id' END,
      v_columns::text, v_constraints::text, v_foreign_keys::text, v_table, v_filter));
  END LOOP;
  EXECUTE 'SELECT COALESCE(json_object_agg(s.table_name, s.table_data), ''{}''::json), '
       || 'COALESCE(sum(s.row_count), 0)::bigint FROM ('
       || array_to_string(v_parts, ' UNION ALL ') || ') s'
    INTO v_payload, v_total;
  RETURN json_build_object(
    'format', 'genblue-clinic-snapshot', 'format_version', 1, 'tenant_id', v_tenant,
    'snapshot_at', statement_timestamp(), 'table_count', cardinality(v_known), 'total_rows', v_total,
    'tables', v_payload,
    'attachments', jsonb_build_object('mode','verified_none_v1','patient_file_references',v_references,
      'non_html_storage_objects',v_actual_files,'excluded_program_files',v_storage),
    'exclusions', jsonb_build_array('auth_accounts_and_passwords','platform_operators','program_html',
      'sql_functions_policies_and_project_settings'),
    'restore_status', 'not_yet_rehearsed_for_this_file')::text;
END;
$$;

ALTER FUNCTION "public"."genblue_export_clinic_public_v62"("p_expected_tenant" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_medical_text_v53"("p_record_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); r public.medical_records; changes jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(t,'read') THEN RAISE EXCEPTION '沒有本院病歷查閱權限' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.medical_records WHERE id=p_record_id AND tenant_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到本院病歷' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(q)),'[]'::jsonb) INTO changes FROM
 (SELECT actor_name,reason,changed_at,previous_version,saved_version FROM private.medical_amendments_v53 WHERE tenant_id=t AND medical_record_id=p_record_id ORDER BY changed_at DESC,request_id DESC LIMIT 10) q;
 RETURN jsonb_build_object('record',to_jsonb(r),'changes',changes);
END $$;

ALTER FUNCTION "public"."get_medical_text_v53"("p_record_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."google_calendar_admin_v9135"("p_action" "text", "p_token" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $_$
DECLARE t text:=public.current_tenant_id(); c jsonb;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_profiles u WHERE u.user_id=auth.uid() AND u.tenant_id::text=t AND u.role='admin') OR NOT coalesce(private.has_ability(t,'admin'),false) THEN RAISE EXCEPTION '只有本院管理者可設定日曆' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.clinic_settings WHERE tenant_id::text=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '請先儲存醫院基本設定，再設定日曆';END IF;
 IF p_action='connect' THEN
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION '連線金鑰格式不符';END IF;
 UPDATE public.clinic_settings SET google_calendar_v9135=jsonb_build_object('enabled',true,'issued_by',auth.uid(),'token_hash',encode(sha256(convert_to(p_token,'UTF8')),'hex'),'updated_at',statement_timestamp()) WHERE tenant_id::text=t;
 ELSIF p_action='disconnect' THEN
 UPDATE public.clinic_settings SET google_calendar_v9135=NULL WHERE tenant_id::text=t;
 ELSIF p_action IS DISTINCT FROM 'status' THEN RAISE EXCEPTION '不支援的日曆操作';END IF;
 SELECT google_calendar_v9135 INTO c FROM public.clinic_settings WHERE tenant_id::text=t;
 RETURN jsonb_build_object('tenant_id',t,'enabled',coalesce((c->>'enabled')::boolean,false),'updated_at',c->>'updated_at');
END $_$;

ALTER FUNCTION "public"."google_calendar_admin_v9135"("p_action" "text", "p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."google_calendar_feed_v9135"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    SET "statement_timeout" TO '15s'
    AS $_$
DECLARE t text; n text; f timestamptz:=date_trunc('day',now() AT TIME ZONE 'Asia/Taipei') AT TIME ZONE 'Asia/Taipei'-interval '7 days'; z timestamptz; data jsonb;cnt bigint;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION '日曆連線已失效' USING ERRCODE='42501';END IF;
 SELECT c.tenant_id::text,c.clinic_name INTO t,n FROM public.clinic_settings c
 WHERE c.google_calendar_v9135->>'enabled'='true'
 AND c.google_calendar_v9135->>'token_hash'=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 IF t IS NULL OR EXISTS(SELECT 1 FROM public.clinic_trials tr WHERE tr.tenant_id::text=t AND tr.expires_at<=now()) OR NOT EXISTS(SELECT 1 FROM public.clinic_settings cs JOIN public.user_profiles u ON u.user_id::text=cs.google_calendar_v9135->>'issued_by' AND u.tenant_id::text=cs.tenant_id::text AND u.role='admin' WHERE cs.tenant_id::text=t) THEN RAISE EXCEPTION '日曆連線已停用或失效' USING ERRCODE='42501';END IF;
 z:=f+interval '373 days';
 -- 不輸出未審核申請、電話、地址、病歷或處方；只讀本院已核對的預約。
 -- LEFT JOIN 保留缺少關聯的預約，以明確佔位文字顯示，避免默默遺漏。
 WITH source AS (
 SELECT DISTINCT a.id,a.scheduled_at,a.doctor,a.status,p.name AS pet_name,o.name AS owner_name,r.reason
 FROM booking.ob_requests r JOIN public.appointments a ON a.id=r.appointment_id AND a.tenant_id::text=t
 LEFT JOIN public.pets p ON p.id=a.pet_id AND p.tenant_id::text=t
 LEFT JOIN public.owners o ON o.id=p.owner_id AND o.tenant_id::text=t
 WHERE r.tenant_id::text=t AND r.status='approved' AND a.status IS DISTINCT FROM '已取消'
 AND a.scheduled_at>=f AND a.scheduled_at<z
 ) SELECT count(*),coalesce(jsonb_agg(jsonb_build_object('id',id,'starts_at',scheduled_at,'ends_at',scheduled_at+interval '30 minutes','pet_name',coalesce(pet_name,'寵物資料待核對'),'owner_name',coalesce(owner_name,'飼主資料待核對'),'doctor',doctor,'status',status,'reason',reason) ORDER BY scheduled_at,id),'[]'::jsonb) INTO cnt,data FROM source;
 IF cnt>2000 THEN RAISE EXCEPTION '預約超過試用同步上限，請先調整同步範圍；未回傳部分清單';END IF;
 RETURN jsonb_build_object('format','genblue-google-calendar-v9135','tenant_id',t,'clinic_name',n,'from',f,'until',z,'complete',true,'count',cnt,'events',data);
END $_$;

ALTER FUNCTION "public"."google_calendar_feed_v9135"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."guard_family_checkout_metadata_v74"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
 IF current_user IN ('authenticated','anon') THEN
   IF TG_OP='INSERT' THEN
     IF NEW.family_checkout_v74 IS NOT NULL OR NEW.family_checkout_payload_v74 IS NOT NULL THEN
       RAISE EXCEPTION '合併帳單識別不可直接寫入' USING ERRCODE='42501'; END IF;
   ELSIF NEW.family_checkout_v74 IS DISTINCT FROM OLD.family_checkout_v74
      OR NEW.family_checkout_payload_v74 IS DISTINCT FROM OLD.family_checkout_payload_v74 THEN
     RAISE EXCEPTION '合併帳單識別不可直接修改' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "public"."guard_family_checkout_metadata_v74"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."id_for_update_v77"("d" "jsonb") RETURNS "uuid"
    LANGUAGE "sql" IMMUTABLE
    AS $$select (d->>'id')::uuid$$;

ALTER FUNCTION "public"."id_for_update_v77"("d" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."import_offline_medical_v1"("p_expected_tenant" "text", "p_visits" "jsonb", "p_commit" boolean DEFAULT false, "p_confirmation" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    SET "statement_timeout" TO '60s'
    AS $_$
DECLARE t text:=public.current_tenant_id(); u uuid:=auth.uid(); v jsonb; rx jsonb; item jsonb;
 source_id uuid; pet uuid; source_owner uuid; visit_time timestamptz; p public.pets; existing public.medical_records;
 actor text; doctor text; chief text; instruction text; route text; original_name text;
 plans jsonb:='[]'; results jsonb:='[]'; r jsonb; canonical jsonb; saved public.medical_records;
 is_injection boolean; status text; reason text; old_flag text:=current_setting('genblue.offline_insert_v1',true);
 inserted integer:=0; repeated integer:=0; blocked integer:=0; seen uuid[]:=ARRAY[]::uuid[];
BEGIN
 IF u IS NULL OR t IS NULL OR p_expected_tenant IS DISTINCT FROM t
 OR NOT coalesce(private.has_ability(t,'admin'),false)
 OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=u AND tenant_id::text=t AND role='admin')
 THEN RAISE EXCEPTION '只有本院有效管理者可補回離線病歷' USING ERRCODE='42501'; END IF;
 IF p_commit IS NULL OR jsonb_typeof(p_visits) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION '補回資料格式不正確'; END IF;
 IF jsonb_array_length(p_visits) NOT BETWEEN 1 AND 20 OR octet_length(p_visits::text)>5242880 THEN RAISE EXCEPTION '一次限1至20筆、5MB'; END IF;
 IF p_commit THEN
  IF p_confirmation IS DISTINCT FROM '補回離線病歷' THEN RAISE EXCEPTION '請先確認補回範圍'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('offline_import_v1:'||t,0));
  PERFORM 1 FROM public.user_profiles WHERE user_id=u AND tenant_id::text=t FOR SHARE;
 END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(p_visits) LOOP
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR v->>'tenant_id' IS DISTINCT FROM t
   OR v->>'sync_status' IS DISTINCT FROM 'pending' OR jsonb_typeof(v->'prescriptions') IS DISTINCT FROM 'array'
   OR coalesce(v->>'local_version','') !~ '^[1-9][0-9]*$' OR length(v->>'local_version')>9
   OR nullif(btrim(v->>'doctor'),'') IS NULL OR length(v->>'doctor')>100
   OR coalesce(v->>'visit_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
   OR length(coalesce(v->>'chief',''))+length(coalesce(v->>'plan',''))+length(coalesce(v->>'fee_note',''))>180000
  THEN RAISE EXCEPTION '應急病歷缺少必要欄位、日期時區或資料超過限制'; END IF;
  source_id:=(v->>'id')::uuid;pet:=(v->>'pet_id')::uuid;source_owner:=nullif(v->>'owner_id','')::uuid;visit_time:=(v->>'visit_at')::timestamptz;
  IF source_id IS NULL OR pet IS NULL OR source_id=ANY(seen) OR NOT isfinite(visit_time) THEN RAISE EXCEPTION '應急編號重複或日期不正確'; END IF;seen:=array_append(seen,source_id);
  IF (v->>'weight' IS NOT NULL AND ((v->>'weight')::numeric<=0 OR (v->>'weight')::numeric::text IN ('NaN','Infinity','-Infinity')))
   OR (v->>'temperature' IS NOT NULL AND ((v->>'temperature')::numeric<=0 OR (v->>'temperature')::numeric::text IN ('NaN','Infinity','-Infinity')))
  THEN RAISE EXCEPTION '體重、體溫需為正數或留白'; END IF;
  IF p_commit THEN SELECT * INTO p FROM public.pets WHERE pets.id=pet AND tenant_id::text=t FOR SHARE;
  ELSE SELECT * INTO p FROM public.pets WHERE pets.id=pet AND tenant_id::text=t;END IF;
  status:='ready';reason:='可新增為已完成病歷';
  IF p.id IS NULL OR p.owner_id IS DISTINCT FROM source_owner THEN status:='blocked';reason:='寵物不存在、院別不符或飼主連結已變更'; END IF;
  IF p_commit THEN SELECT * INTO existing FROM public.medical_records WHERE medical_records.id=source_id FOR UPDATE;
  ELSE SELECT * INTO existing FROM public.medical_records WHERE medical_records.id=source_id;END IF;
  IF existing.id IS NOT NULL THEN
   IF existing.tenant_id::text=t AND existing.pet_id=pet AND existing.vaccine_info->'offline_emergency_v1'->'source'=v
   THEN status:='already';reason:='此筆已補回，不再次新增，也不覆寫現在的病歷';
   ELSE status:='blocked';reason:='相同編號已有其他內容；請保留原檔人工核對，不覆寫'; END IF;
  END IF;
  rx:='[]';
  FOR item IN SELECT value FROM jsonb_array_elements(v->'prescriptions') LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR nullif(btrim(item->>'medicine_name'),'') IS NULL
    OR nullif(btrim(item->>'route'),'') IS NULL OR nullif(btrim(item->>'dose'),'') IS NULL OR nullif(btrim(item->>'quantity'),'') IS NULL
   THEN RAISE EXCEPTION '處方必須有藥名、途徑、劑量與總量'; END IF;
   route:=item->>'route';original_name:=item->>'medicine_name';
   is_injection:=route ~* '^(皮下(注射)?|肌肉(注射)?|靜脈(注射)?|皮內(注射)?|腹腔(注射)?|針劑|注射|SC|SQ|IM|IV)$';
   instruction:=CASE WHEN is_injection THEN '' ELSE concat_ws('；',nullif('頻率：'||nullif(btrim(item->>'frequency'),''),''),
    CASE WHEN nullif(btrim(item->>'days'),'') IS NOT NULL THEN '天數：'||(item->>'days')||' 天' END,nullif(item->>'instruction','')) END;
   rx:=rx||jsonb_build_array(jsonb_build_object('medicine_id',CASE WHEN EXISTS(SELECT 1 FROM public.medicines m WHERE m.id::text=item->>'medicine_id' AND m.tenant_id::text=t) THEN item->'medicine_id' ELSE 'null'::jsonb END,
    'medicine_name','['||route||'] '||original_name,'custom_dose',item->>'dose','quantity',item->>'quantity','instruction',instruction,
    'offline_frequency',item->>'frequency','offline_days',item->>'days','billing_kind',CASE WHEN is_injection THEN 'injection' ELSE CASE WHEN route LIKE '口服%' THEN 'oral' ELSE 'other' END END));
  END LOOP;
  doctor:=btrim(v->>'doctor');
  chief:=concat_ws(chr(10),'【離線應急病歷補回】','原看診時間：'||to_char(visit_time AT TIME ZONE 'Asia/Taipei','YYYY/MM/DD HH24:MI'),
   '原看診醫師：'||doctor,'體重：'||coalesce(v->>'weight','未填寫')||CASE WHEN v->>'weight' IS NULL THEN '' ELSE ' kg' END,
   '體溫：'||coalesce(v->>'temperature','未填寫')||CASE WHEN v->>'temperature' IS NULL THEN '' ELSE ' °C' END,
   '主訴／病歷：'||coalesce(v->>'chief',''),'診斷／處置／追蹤：'||coalesce(v->>'plan',''),
   '費用備註（未開帳、未扣庫存）：'||coalesce(v->>'fee_note',''));
  canonical:=jsonb_build_object('id',source_id,'tenant_id',t,'pet_id',pet,'status','已完成','chief_complaint',chief,
   'prescription_details',rx,'created_at',visit_time,'vaccine_info',jsonb_build_object('offline_emergency_v1',jsonb_build_object('source',v,'imported_by',u,'imported_at',now())));
  plans:=plans||jsonb_build_array(jsonb_build_object('status',status,'record',canonical));
  results:=results||jsonb_build_array(jsonb_build_object('id',source_id,'status',status,'reason',reason,'pet_id',pet,
    'pet_name',p.name,'source_pet_name',v->>'pet_name','owner_id',p.owner_id,'doctor',doctor,'visit_at',visit_time));
  IF status='already' THEN repeated:=repeated+1;ELSIF status='blocked' THEN blocked:=blocked+1;END IF;
 END LOOP;
 IF p_commit THEN
  IF blocked>0 THEN RAISE EXCEPTION '有衝突，本批全部未補回；請重新預覽核對'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(plans) LOOP
   IF r->>'status'<>'ready' THEN CONTINUE; END IF;
   canonical:=r->'record';
   -- Serialize the exact approved row for the narrowly scoped trigger exception.
   PERFORM set_config('genblue.offline_insert_v1',canonical::text,true);
   INSERT INTO public.medical_records(id,tenant_id,pet_id,status,chief_complaint,prescription_details,created_at,vaccine_info)
   SELECT x.id,x.tenant_id,x.pet_id,x.status,x.chief_complaint,x.prescription_details,x.created_at,x.vaccine_info
   FROM jsonb_populate_record(NULL::public.medical_records,canonical) x RETURNING * INTO saved;
   IF (to_jsonb(saved)-'row_version'-'edited_at'-'edited_by') IS DISTINCT FROM canonical THEN RAISE EXCEPTION '病歷規格不同，本批未補回'; END IF;
   PERFORM set_config('genblue.offline_insert_v1',coalesce(old_flag,''),true);inserted:=inserted+1;
  END LOOP;
  IF inserted>0 THEN
   SELECT coalesce(nullif(btrim(display_name),''),'管理者') INTO actor FROM public.user_profiles WHERE user_id=u;
   INSERT INTO public.audit_logs(tenant_id,operator,action) VALUES(t,left(actor,100),jsonb_build_object('operation','offline_medical_import_v1','actor_id',u,'ids',to_jsonb(seen),'inserted',inserted,'already',repeated,'billing_created',false,'stock_changed',false)::text);
  END IF;
 END IF;
 RETURN jsonb_build_object('tenant_id',t,'committed',p_commit,'ready',jsonb_array_length(p_visits)-repeated-blocked,'already',repeated,'blocked',blocked,'inserted',inserted,'results',results);
END $_$;

ALTER FUNCTION "public"."import_offline_medical_v1"("p_expected_tenant" "text", "p_visits" "jsonb", "p_commit" boolean, "p_confirmation" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."keep_owner_system_code"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.system_code := OLD.system_code;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."keep_owner_system_code"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."manage_billing_presets_v80"("p_action" "text", "p_items" "jsonb" DEFAULT '[]'::"jsonb", "p_expected" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE t text:=public.current_tenant_id(); existing jsonb; item jsonb; amount numeric; item_id uuid; ids uuid[]:=ARRAY[]::uuid[];
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT coalesce(private.has_ability(t,'read'),false) THEN
  RAISE EXCEPTION '沒有本院讀取權限' USING ERRCODE='42501';
 END IF;
 SELECT billing_presets_v80 INTO existing FROM public.clinic_settings WHERE tenant_id::text=t;
 IF NOT FOUND THEN RAISE EXCEPTION '請管理者先在醫院設定儲存院所資料'; END IF;
 IF p_action='list' THEN RETURN jsonb_build_object('tenant_id',t,'items',existing); END IF;
 IF p_action IS DISTINCT FROM 'save' OR NOT coalesce(private.has_ability(t,'admin'),false) THEN
  RAISE EXCEPTION '只有本院管理者可設定常用收費項目' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)>200 THEN RAISE EXCEPTION '常用項目最多 200 筆'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string'
   OR jsonb_typeof(item->'name') IS DISTINCT FROM 'string' OR length(btrim(item->>'name')) NOT BETWEEN 1 AND 100
   OR jsonb_typeof(item->'code') IS DISTINCT FROM 'string' OR length(item->>'code')>30
   OR jsonb_typeof(item->'category') IS DISTINCT FROM 'string' OR length(btrim(item->>'category')) NOT BETWEEN 1 AND 50
   OR jsonb_typeof(item->'price') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION '常用項目格式不正確'; END IF;
  item_id:=(item->>'id')::uuid;
  IF item_id=ANY(ids) THEN RAISE EXCEPTION '常用項目識別碼重複'; END IF;
  ids:=array_append(ids,item_id);amount:=(item->>'price')::numeric;
  IF amount<0 OR amount>99999999.99 OR amount<>round(amount,2) THEN RAISE EXCEPTION '金額需為 0 至 99999999.99，最多兩位小數'; END IF;
 END LOOP;
 UPDATE public.clinic_settings SET billing_presets_v80=p_items,updated_at=clock_timestamp()
  WHERE tenant_id::text=t AND billing_presets_v80 IS NOT DISTINCT FROM p_expected
  RETURNING billing_presets_v80 INTO existing;
 IF NOT FOUND THEN RAISE EXCEPTION '常用清單已由其他人更新，請重新讀取後再修改'; END IF;
 RETURN jsonb_build_object('tenant_id',t,'items',existing,'saved',true);
END;
$$;

ALTER FUNCTION "public"."manage_billing_presets_v80"("p_action" "text", "p_items" "jsonb", "p_expected" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."manage_imaging_share_v76"("p_action" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $_$
DECLARE t text:=public.current_tenant_id(); u uuid:=auth.uid(); p uuid; ids uuid[]; tok text; days integer; s public.imaging_shares_v76; n integer; out_data jsonb;
BEGIN
 IF u IS NULL OR t IS NULL OR NOT coalesce(private.has_ability(t,'clinical'),false) THEN
  RAISE EXCEPTION '沒有本院影像分享權限' USING ERRCODE='42501';
 END IF;
 IF p_action='revoke' THEN
  UPDATE public.imaging_shares_v76 SET revoked_at=coalesce(revoked_at,clock_timestamp())
   WHERE id=(p_data->>'id')::uuid AND tenant_id=t RETURNING * INTO s;
  IF NOT FOUND THEN RAISE EXCEPTION '找不到本院分享'; END IF;
  RETURN jsonb_build_object('id',s.id,'revoked',true);
 END IF;
 p:=(p_data->>'pet_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.pets WHERE id=p AND tenant_id::text=t) THEN RAISE EXCEPTION '寵物不屬於本院'; END IF;
 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(x),'[]'::jsonb) INTO out_data FROM
   (SELECT id,created_at,expires_at,revoked_at,cardinality(asset_ids) AS image_count
    FROM public.imaging_shares_v76 WHERE tenant_id=t AND pet_id=p ORDER BY created_at DESC LIMIT 50) x;
  RETURN jsonb_build_object('shares',out_data);
 END IF;
 IF p_action IS DISTINCT FROM 'create' THEN RAISE EXCEPTION '不支援此操作'; END IF;
 tok:=p_data->>'token'; days:=(p_data->>'days')::integer;
 IF tok IS NULL OR tok!~'^[0-9a-f]{64}$' OR days IS NULL OR days NOT IN (1,7,30) THEN RAISE EXCEPTION '分享資料格式不正確'; END IF;
 IF jsonb_typeof(p_data->'asset_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'asset_ids') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION '請選擇 1 至 20 張影像'; END IF;
 SELECT array_agg(value::uuid ORDER BY value::uuid) INTO ids FROM jsonb_array_elements_text(p_data->'asset_ids');
 IF cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) THEN RAISE EXCEPTION '不可重複選取影像'; END IF;
 SELECT count(*) INTO n FROM public.imaging_assets a JOIN public.imaging_studies st ON st.id=a.study_id
 WHERE a.id=ANY(ids) AND a.tenant_id::text=t AND st.tenant_id::text=t AND st.pet_id=p AND st.modality='XRAY'
  AND a.mime_type IN ('image/jpeg','image/png') AND a.file_size BETWEEN 1 AND 52428800
  AND starts_with(a.storage_path,t||'/'||p::text||'/'||st.id::text||'/')
  AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='clinic-imaging' AND o.name=a.storage_path);
 IF n<>cardinality(ids) THEN RAISE EXCEPTION '影像需為本院此寵物的已上傳 X 光 JPG 或 PNG'; END IF;
 -- Same capability retry returns the same share. It never silently changes its scope.
 SELECT * INTO s FROM public.imaging_shares_v76 WHERE token_hash=sha256(convert_to(tok,'UTF8')) FOR UPDATE;
 IF FOUND THEN
  IF s.tenant_id<>t OR s.pet_id<>p OR s.asset_ids<>ids OR s.created_by<>u OR s.revoked_at IS NOT NULL OR s.expires_at<=clock_timestamp()
   OR s.expires_at-s.created_at<>days*interval '1 day' THEN RAISE EXCEPTION '原分享內容已變更或失效，請重新建立'; END IF;
 ELSE
  INSERT INTO public.imaging_shares_v76(tenant_id,pet_id,asset_ids,token_hash,created_by,expires_at)
   VALUES(t,p,ids,sha256(convert_to(tok,'UTF8')),u,now()+days*interval '1 day') RETURNING * INTO s;
 END IF;
 RETURN jsonb_build_object('id',s.id,'pet_id',p,'expires_at',s.expires_at,'image_count',cardinality(ids));
END $_$;

ALTER FUNCTION "public"."manage_imaging_share_v76"("p_action" "text", "p_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."my_trial_expires_at"() RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 SELECT (SELECT t.expires_at FROM public.clinic_trials t
   WHERE t.tenant_id = (SELECT p.tenant_id FROM public.user_profiles p
     WHERE p.user_id = auth.uid() LIMIT 1));
$$;

ALTER FUNCTION "public"."my_trial_expires_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."night_work_v93"("p_action" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    SET "lock_timeout" TO '3s'
    AS $$
DECLARE t text:=public.current_tenant_id();u uuid:=auth.uid();s public.pos_shifts_v77;a public.appointments;night boolean;
BEGIN
 IF u IS NULL OR t IS NULL OR NOT private.has_ability(t,'read') THEN RAISE EXCEPTION '請先登入有效院所' USING ERRCODE='42501'; END IF;
 IF p_action='mode' THEN
  IF NOT private.has_ability(t,'checkout') THEN RAISE EXCEPTION '沒有開始工作的權限' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pos_v77:'||t,0));
  SELECT * INTO s FROM public.pos_shifts_v77 x WHERE x.tenant_id=t AND x.id=(p_data->>'shift_id')::uuid AND x.closed_at IS NULL FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION '工作已結束或錢櫃不符，請重新確認'; END IF;
  night:=(p_data->>'emergency')::boolean;
  IF night IS NULL THEN RAISE EXCEPTION '缺少工作模式'; END IF;
  IF s.night_emergency_v93 IS DISTINCT FROM night THEN
   UPDATE public.pos_shifts_v77 SET night_emergency_v93=night WHERE id=s.id AND tenant_id=t;
   INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(t,s.id,'night_mode_v93',jsonb_build_object('emergency',s.night_emergency_v93),jsonb_build_object('emergency',night,'registration',500,'multiplier',1.5),u);
  END IF;
  RETURN jsonb_build_object('tenant_id',t,'shift_id',s.id,'emergency',night);
 ELSIF p_action='status' THEN
  SELECT * INTO s FROM public.pos_shifts_v77 x WHERE x.tenant_id=t AND x.closed_at IS NULL ORDER BY x.opened_at DESC LIMIT 1;
  RETURN jsonb_build_object('tenant_id',t,'shift_id',s.id,'emergency',coalesce(s.night_emergency_v93,false));
 ELSIF p_action='visit' THEN
  SELECT * INTO a FROM public.appointments x WHERE x.tenant_id=t AND x.id=(p_data->>'appointment_id')::uuid;
  IF a.id IS NULL THEN RAISE EXCEPTION '找不到本院掛號' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('tenant_id',t,'appointment_id',a.id,'pet_id',a.pet_id,'emergency',coalesce((a.night_pricing_v93->>'emergency')::boolean,false),'registration',500,'multiplier',1.5);
 END IF;
 RAISE EXCEPTION '不支援的工作模式操作';
END $$;

ALTER FUNCTION "public"."night_work_v93"("p_action" "text", "p_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."ob_calendar_v92_2"("p_start" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); result jsonb; apps jsonb;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT coalesce(private.has_ability(t,'appointment'),false)
 THEN RAISE EXCEPTION '沒有本院預約管理權限' USING ERRCODE='42501';END IF;
 result:=public.ob_staff('calendar',jsonb_build_object('start',p_start));
 IF result->>'tenant_id' IS DISTINCT FROM t OR jsonb_typeof(result->'appointments') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION '預約日曆回覆不完整，請重新讀取';END IF;
 SELECT coalesce(jsonb_agg(x.row||jsonb_build_object('checked_in_at',a.checked_in_at) ORDER BY x.ord),'[]'::jsonb) INTO apps
 FROM jsonb_array_elements(result->'appointments') WITH ORDINALITY AS x(row,ord)
 LEFT JOIN public.appointments a ON a.id::text=x.row->>'id' AND a.tenant_id=t;
 RETURN result||jsonb_build_object('appointments',apps,'early_checkin_version',922);
END $$;

ALTER FUNCTION "public"."ob_calendar_v92_2"("p_start" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."ob_public"("p_action" "text", "p_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE c booking.ob_clinics; s booking.ob_slots; r booking.ob_requests; n integer; rid uuid;
BEGIN

 IF p_action='status' THEN
  SELECT * INTO c FROM booking.ob_clinics WHERE slug=p_data->>'clinic';
  IF c.tenant_id IS NULL OR coalesce(p_data->>'reference','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR coalesce(p_data->>'phone','') !~ '^[0-9]{8,15}$' THEN RAISE EXCEPTION '查無符合的申請，請核對申請編號與聯絡電話'; END IF;
  SELECT * INTO r FROM booking.ob_requests WHERE tenant_id=c.tenant_id AND id=(p_data->>'reference')::uuid AND phone=p_data->>'phone';
  IF NOT FOUND THEN RAISE EXCEPTION '查無符合的申請，請核對申請編號與聯絡電話'; END IF;
  SELECT * INTO s FROM booking.ob_slots WHERE id=r.slot_id AND tenant_id=c.tenant_id;
  RETURN jsonb_build_object('reference',r.id,'status',CASE WHEN r.status='rejected' AND r.appointment_id IS NOT NULL THEN 'cancelled' WHEN r.status='approved' AND EXISTS(SELECT 1 FROM public.appointments a WHERE a.id=r.appointment_id AND a.tenant_id=c.tenant_id AND a.status='已取消') THEN 'cancelled' ELSE r.status END,'starts_at',s.starts_at,'clinic_name',c.name);
 END IF;
 SELECT * INTO c FROM booking.ob_clinics WHERE slug=p_data->>'clinic' FOR UPDATE;
 IF NOT FOUND OR NOT c.enabled OR EXISTS(SELECT 1 FROM public.clinic_trials ct WHERE ct.tenant_id=c.tenant_id AND ct.expires_at<=now()) THEN RAISE EXCEPTION '目前未開放線上預約'; END IF;
 PERFORM booking.generate_v60(c.tenant_id);
 IF p_action='slots' THEN
  RETURN jsonb_build_object('name',c.name,'notice',c.notice,'slots',coalesce((
   SELECT jsonb_agg(jsonb_build_object('id',x.id,'starts_at',x.starts_at,'remaining',x.remaining) ORDER BY x.starts_at)
   FROM (SELECT sl.id,sl.starts_at,1-booking.used_v60(c.tenant_id,sl.starts_at) AS remaining
    FROM booking.ob_slots sl WHERE sl.tenant_id=c.tenant_id AND sl.enabled
     AND booking.time_allowed_v60_1(sl.starts_at) AND sl.starts_at>now()+interval '1 hour' AND sl.starts_at<now()+interval '30 days') x
    WHERE x.remaining>0),'[]'::jsonb));
 ELSIF p_action<>'submit' THEN RAISE EXCEPTION '不支援此操作'; END IF;
 IF jsonb_typeof(p_data)<>'object' OR length(coalesce(p_data->>'name','')) NOT BETWEEN 1 AND 100
  OR coalesce(p_data->>'phone','') !~ '^[0-9]{8,15}$'
  OR length(coalesce(p_data->>'pet_name','')) NOT BETWEEN 1 AND 100
  OR coalesce(p_data->>'species','') NOT IN ('犬','貓','其他')
  OR length(coalesce(p_data->>'registered_hint',''))>150 OR length(coalesce(p_data->>'reason',''))>1000 THEN RAISE EXCEPTION '請核對預約資料'; END IF;
 rid:=(p_data->>'request_id')::uuid;
 IF rid IS NULL THEN RAISE EXCEPTION '缺少送出識別碼'; END IF;
 SELECT * INTO r FROM booking.ob_requests WHERE id=rid;
 IF FOUND THEN
  IF r.tenant_id<>c.tenant_id OR r.slot_id<>(p_data->>'slot_id')::uuid OR r.name<>p_data->>'name'
   OR r.phone<>p_data->>'phone' OR r.pet_name<>p_data->>'pet_name' OR r.species<>p_data->>'species'
   OR r.registered_hint<>coalesce(p_data->>'registered_hint','') OR r.reason<>coalesce(p_data->>'reason','') THEN RAISE EXCEPTION '識別碼已使用，請重新整理'; END IF;
  RETURN jsonb_build_object('reference',r.id,'status',r.status);
 END IF;
 SELECT * INTO s FROM booking.ob_slots WHERE id=(p_data->>'slot_id')::uuid AND tenant_id=c.tenant_id FOR UPDATE;
 IF NOT FOUND OR NOT s.enabled OR NOT booking.time_allowed_v60_1(s.starts_at) OR s.starts_at<=now()+interval '1 hour' OR s.starts_at>=now()+interval '30 days'
  THEN RAISE EXCEPTION '此時段已停止受理'; END IF;
 n:=booking.used_v60(c.tenant_id,s.starts_at);
 IF n>=1 THEN RAISE EXCEPTION '此時段已額滿，請改選時段'; END IF;
 SELECT count(*) INTO n FROM booking.ob_requests q LEFT JOIN public.appointments a ON a.id=q.appointment_id
 JOIN booking.ob_slots sl ON sl.id=q.slot_id WHERE q.tenant_id=c.tenant_id AND q.phone=p_data->>'phone'
 AND sl.starts_at>now() AND (q.status='pending' OR (q.status='approved' AND a.status<>'已取消'));
 IF n>=3 THEN RAISE EXCEPTION '已有待處理預約，請聯絡醫院'; END IF;
 IF EXISTS(SELECT 1 FROM booking.ob_requests q JOIN booking.ob_slots sl ON sl.id=q.slot_id
 LEFT JOIN public.appointments a ON a.id=q.appointment_id
 WHERE q.tenant_id=c.tenant_id AND q.phone=p_data->>'phone' AND lower(trim(q.pet_name))=lower(trim(p_data->>'pet_name'))
 AND sl.starts_at>=s.starts_at AND sl.starts_at<s.starts_at+interval '30 minutes'
 AND (q.status='pending' OR (q.status='approved' AND a.status<>'已取消')))
 THEN RAISE EXCEPTION '此寵物已有同時段申請，請勿重複預約'; END IF;
 INSERT INTO booking.ob_requests(id,tenant_id,slot_id,name,phone,pet_name,species,reason,registered_hint)
 VALUES(rid,c.tenant_id,s.id,p_data->>'name',p_data->>'phone',p_data->>'pet_name',p_data->>'species',coalesce(p_data->>'reason',''),coalesce(p_data->>'registered_hint',''));
 RETURN jsonb_build_object('reference',rid,'status','pending');
END $_$;

ALTER FUNCTION "public"."ob_public"("p_action" "text", "p_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."ob_restore_slot_v91_26"("p_slot_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); s booking.ob_slots;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL
    OR NOT coalesce(private.has_ability(t,'appointment'),false)
    OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=auth.uid() AND tenant_id=t AND role='admin')
 THEN RAISE EXCEPTION '僅本院管理者可恢復時段' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM booking.ob_clinics WHERE tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到院所設定'; END IF;
 SELECT * INTO s FROM booking.ob_slots WHERE id=p_slot_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到本院時段'; END IF;
 IF NOT booking.time_allowed_v60_1(s.starts_at) OR s.starts_at<=now()+interval '1 hour' OR s.starts_at>=now()+interval '30 days'
 THEN RAISE EXCEPTION '此時段不在可受理範圍，請選擇符合預約規則的未來時段'; END IF;
 IF EXISTS(SELECT 1 FROM booking.ob_closed_days_v60 WHERE tenant_id=t AND day=(s.starts_at AT TIME ZONE 'Asia/Taipei')::date)
 THEN RAISE EXCEPTION '這天已設為休診，請先恢復當日開放規則，再恢復此時段'; END IF;
 IF booking.used_v60(t,s.starts_at)>=1
 THEN RAISE EXCEPTION '此時段已有預約或待審核申請，不能恢復新申請；請先核對並處理原預約'; END IF;
 -- 明確恢復這一格，視為手動開放；其餘每週時段及休診日維持原設定。
 UPDATE booking.ob_slots SET enabled=true,closed_v60=false,generated_v60=false,capacity=1 WHERE id=s.id AND tenant_id=t;
 RETURN jsonb_build_object('ok',true,'slot_id',s.id,'enabled',true);
END $$;

ALTER FUNCTION "public"."ob_restore_slot_v91_26"("p_slot_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."ob_staff"("p_action" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE t text; is_admin boolean; c booking.ob_clinics; r booking.ob_requests; s booking.ob_slots;
 pet public.pets; aid uuid; ast text; dt timestamptz; rule jsonb; day_v60 date; query_v62 text;
BEGIN
 t:=public.current_tenant_id();
 IF auth.uid() IS NULL OR t IS NULL OR NOT coalesce(private.has_ability(t,'appointment'),false) THEN
  RAISE EXCEPTION '沒有預約管理權限'; END IF;

 IF p_action='pending_count' THEN
  RETURN jsonb_build_object('tenant_id',t,'pending_count',(SELECT count(*) FROM booking.ob_requests WHERE tenant_id=t AND status='pending'));
 ELSIF p_action='search_pets' THEN
  query_v62:=trim(coalesce(p_data->>'query',''));
  IF length(query_v62) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION '請輸入寵物名、原飼主姓名、電話、病歷號或晶片'; END IF;
  RETURN jsonb_build_object('tenant_id',t,'pets',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT p.id,p.name,p.species,p.owner_id,p.microchip,p.legacy_source_no,
     jsonb_build_object('id',o.id,'name',o.name,'mobile',o.mobile,'phone',o.phone,'owner_code',o.owner_code,'system_code',o.system_code) AS owners
   FROM public.pets p JOIN public.owners o ON o.id=p.owner_id AND o.tenant_id=t
   WHERE p.tenant_id=t AND (strpos(lower(p.name),lower(query_v62))>0 OR strpos(lower(o.name),lower(query_v62))>0
    OR strpos(coalesce(o.mobile,''),query_v62)>0 OR strpos(coalesce(o.phone,''),query_v62)>0
    OR strpos(lower(coalesce(o.owner_code,'')),lower(query_v62))>0 OR strpos(lower(coalesce(o.system_code,'')),lower(query_v62))>0
    OR strpos(coalesce(p.microchip,''),query_v62)>0 OR strpos(coalesce(p.legacy_source_no,''),query_v62)>0)
   ORDER BY p.name,p.id LIMIT 51) x),'[]'::jsonb));
 END IF;
 SELECT role='admin' INTO is_admin FROM public.user_profiles WHERE user_id=auth.uid() AND tenant_id=t;
 SELECT * INTO c FROM booking.ob_clinics WHERE tenant_id=t;
 PERFORM booking.generate_v60(t);
 IF p_action='weekly_save' THEN
  IF NOT coalesce(is_admin,false) OR c.tenant_id IS NULL THEN RAISE EXCEPTION '請管理者先儲存院所設定'; END IF;
  PERFORM 1 FROM booking.ob_clinics WHERE tenant_id=t FOR UPDATE;
  IF jsonb_typeof(p_data->'rules') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'rules')>21
   THEN RAISE EXCEPTION '開放規則格式不正確，最多21段'; END IF;
  IF coalesce((p_data->>'enabled')::boolean,false) AND jsonb_array_length(p_data->'rules')=0 THEN RAISE EXCEPTION '請至少新增一段每週開放時間'; END IF;
  FOR rule IN SELECT value FROM jsonb_array_elements(p_data->'rules') LOOP
   IF jsonb_typeof(rule) IS DISTINCT FROM 'object' OR (rule->>'dow') IS NULL OR (rule->>'dow') !~ '^[0-6]$'
    OR coalesce(rule->>'start','') !~ '^([01][0-9]|2[0-3]):(00|30)$'
    OR coalesce(rule->>'end','') !~ '^([01][0-9]|2[0-3]):(00|30)$'
    OR (rule->>'end')::time<=(rule->>'start')::time THEN RAISE EXCEPTION '時間請用半小時刻度，同日結束時間須晚於開始'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'rules') WITH ORDINALITY a(v,i)
   JOIN jsonb_array_elements(p_data->'rules') WITH ORDINALITY b(v,i) ON a.i<b.i
   WHERE a.v->>'dow'=b.v->>'dow' AND (a.v->>'start')::time<(b.v->>'end')::time AND (b.v->>'start')::time<(a.v->>'end')::time)
   THEN RAISE EXCEPTION '同一天的開放時間重疊，請調整'; END IF;
  INSERT INTO booking.ob_weekly_v60(tenant_id,enabled,capacity,rules)
   VALUES(t,coalesce((p_data->>'enabled')::boolean,false),1,p_data->'rules')
   ON CONFLICT(tenant_id) DO UPDATE SET enabled=excluded.enabled,capacity=excluded.capacity,rules=excluded.rules,updated_at=now();
  PERFORM booking.generate_v60(t);
  RETURN jsonb_build_object('ok',true);
 ELSIF p_action='closed_day' THEN
  IF NOT coalesce(is_admin,false) OR c.tenant_id IS NULL THEN RAISE EXCEPTION '僅管理者可設定休診日'; END IF;
  PERFORM 1 FROM booking.ob_clinics WHERE tenant_id=t FOR UPDATE;
  day_v60:=(p_data->>'day')::date;
  IF day_v60 IS NULL OR day_v60<(now() AT TIME ZONE 'Asia/Taipei')::date OR day_v60>(now() AT TIME ZONE 'Asia/Taipei')::date+365
   THEN RAISE EXCEPTION '請選今天至未來一年內的日期'; END IF;
  IF coalesce((p_data->>'closed')::boolean,false) THEN
   INSERT INTO booking.ob_closed_days_v60 VALUES(t,day_v60) ON CONFLICT DO NOTHING;
  ELSE
   DELETE FROM booking.ob_closed_days_v60 WHERE tenant_id=t AND day=day_v60;
  END IF;
  PERFORM booking.generate_v60(t);
  RETURN jsonb_build_object('ok',true);
 ELSIF p_action='calendar' THEN
  day_v60:=coalesce((p_data->>'start')::date,(now() AT TIME ZONE 'Asia/Taipei')::date);
  IF day_v60<(now() AT TIME ZONE 'Asia/Taipei')::date-365 OR day_v60>(now() AT TIME ZONE 'Asia/Taipei')::date+365 THEN RAISE EXCEPTION '日期超出範圍'; END IF;
  RETURN jsonb_build_object('tenant_id',t,'start',day_v60,
   'slots',coalesce((SELECT jsonb_agg(to_jsonb(sl)||jsonb_build_object('capacity',1,'used',booking.used_v60(t,sl.starts_at)) ORDER BY sl.starts_at)
    FROM booking.ob_slots sl WHERE sl.tenant_id=t AND sl.starts_at>=day_v60::timestamp AT TIME ZONE 'Asia/Taipei'
    AND sl.starts_at<(day_v60+7)::timestamp AT TIME ZONE 'Asia/Taipei'),'[]'::jsonb),
   'requests',coalesce((SELECT jsonb_agg(to_jsonb(q)||jsonb_build_object('starts_at',sl.starts_at,'appointment_status',a.status) ORDER BY sl.starts_at,q.created_at)
    FROM booking.ob_requests q JOIN booking.ob_slots sl ON sl.id=q.slot_id LEFT JOIN public.appointments a ON a.id=q.appointment_id AND a.tenant_id=t
    WHERE q.tenant_id=t AND sl.starts_at>=day_v60::timestamp AT TIME ZONE 'Asia/Taipei'
    AND sl.starts_at<(day_v60+7)::timestamp AT TIME ZONE 'Asia/Taipei'),'[]'::jsonb),
   'appointments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'starts_at',a.scheduled_at,'status',a.status,'pet_name',p.name,'owner_name',o.name) ORDER BY a.scheduled_at)
    FROM public.appointments a LEFT JOIN public.pets p ON p.id=a.pet_id AND p.tenant_id=t LEFT JOIN public.owners o ON o.id=a.owner_id AND o.tenant_id=t
    WHERE a.tenant_id=t AND a.status<>'已取消' AND a.scheduled_at>=day_v60::timestamp AT TIME ZONE 'Asia/Taipei'
    AND a.scheduled_at<(day_v60+7)::timestamp AT TIME ZONE 'Asia/Taipei'),'[]'::jsonb));
 END IF;

 IF p_action='list' THEN
  RETURN jsonb_build_object('admin',coalesce(is_admin,false),'config',CASE WHEN c.tenant_id IS NULL THEN NULL ELSE to_jsonb(c) END,
   'slots',coalesce((SELECT jsonb_agg(to_jsonb(sl)||jsonb_build_object('capacity',1) ORDER BY sl.starts_at) FROM booking.ob_slots sl
     WHERE sl.tenant_id=t AND sl.starts_at>now()-interval '1 day'),'[]'::jsonb),
   'weekly',(SELECT to_jsonb(w) FROM booking.ob_weekly_v60 w WHERE w.tenant_id=t),
   'closed_days',coalesce((SELECT jsonb_agg(cd.day ORDER BY cd.day) FROM booking.ob_closed_days_v60 cd WHERE cd.tenant_id=t AND cd.day>=(now() AT TIME ZONE 'Asia/Taipei')::date),'[]'::jsonb),
   'pending_count',(SELECT count(*) FROM booking.ob_requests q WHERE q.tenant_id=t AND q.status='pending'),
   'requests',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
     (SELECT q.*,sl.starts_at FROM booking.ob_requests q JOIN booking.ob_slots sl ON sl.id=q.slot_id
      WHERE q.tenant_id=t AND q.status='pending' ORDER BY q.created_at ASC LIMIT 300)
     UNION ALL
     (SELECT q.*,sl.starts_at FROM booking.ob_requests q JOIN booking.ob_slots sl ON sl.id=q.slot_id
      WHERE q.tenant_id=t AND q.status<>'pending' AND sl.starts_at>now()-interval '7 days'
      ORDER BY q.created_at DESC LIMIT 300)) x),'[]'::jsonb));
 ELSIF p_action='export' THEN
  IF NOT coalesce(is_admin,false) THEN RAISE EXCEPTION '僅管理者可匯出'; END IF;
  RETURN jsonb_build_object('format','genblue-online-booking-export','version',2,'tenant_id',t,'exported_at',now(),
    'config',CASE WHEN c.tenant_id IS NULL THEN NULL ELSE to_jsonb(c) END,'slots',coalesce((SELECT jsonb_agg(to_jsonb(sl)) FROM booking.ob_slots sl WHERE sl.tenant_id=t),'[]'::jsonb),
    'weekly',(SELECT to_jsonb(w) FROM booking.ob_weekly_v60 w WHERE w.tenant_id=t),
    'closed_days',coalesce((SELECT jsonb_agg(cd.day) FROM booking.ob_closed_days_v60 cd WHERE cd.tenant_id=t),'[]'::jsonb),
    'requests',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM booking.ob_requests q WHERE q.tenant_id=t),'[]'::jsonb));
 ELSIF p_action='settings' THEN
  IF NOT coalesce(is_admin,false) THEN RAISE EXCEPTION '僅管理者可設定'; END IF;
  INSERT INTO booking.ob_clinics(tenant_id,slug,name,enabled,notice)
   VALUES(t,trim(p_data->>'slug'),trim(p_data->>'name'),coalesce((p_data->>'enabled')::boolean,false),coalesce(p_data->>'notice',''))
   ON CONFLICT(tenant_id) DO UPDATE SET slug=excluded.slug,name=excluded.name,enabled=excluded.enabled,notice=excluded.notice;
  RETURN jsonb_build_object('ok',true);
 ELSIF p_action='slot' THEN
  IF NOT coalesce(is_admin,false) OR c.tenant_id IS NULL THEN RAISE EXCEPTION '請管理者先儲存院所設定'; END IF;
  PERFORM 1 FROM booking.ob_clinics WHERE tenant_id=t FOR UPDATE;
  dt:=(p_data->>'starts_at')::timestamptz;
  IF dt IS NULL OR dt<=now() OR dt>=now()+interval '30 days' THEN RAISE EXCEPTION '請選未來30天內的時段'; END IF;
  INSERT INTO booking.ob_slots(tenant_id,starts_at,capacity,enabled)
   VALUES(t,dt,1,true)
   ON CONFLICT(tenant_id,starts_at) DO UPDATE SET capacity=excluded.capacity,enabled=true,closed_v60=false;
  RETURN jsonb_build_object('ok',true);
 ELSIF p_action='close_slot' THEN
  IF NOT coalesce(is_admin,false) THEN RAISE EXCEPTION '僅管理者可關閉時段'; END IF;
  PERFORM 1 FROM booking.ob_clinics WHERE tenant_id=t FOR UPDATE;
  UPDATE booking.ob_slots SET enabled=false,closed_v60=true WHERE id=(p_data->>'id')::uuid AND tenant_id=t;
  IF NOT FOUND THEN RAISE EXCEPTION '找不到時段'; END IF;
  RETURN jsonb_build_object('ok',true);
 ELSIF p_action NOT IN ('approve','reject') THEN RAISE EXCEPTION '不支援此操作'; END IF;
 -- 與公開送出採相同 clinic -> slot/request 鎖定順序，避免超收和互鎖。
 PERFORM 1 FROM booking.ob_clinics WHERE tenant_id=t FOR UPDATE;
 SELECT * INTO r FROM booking.ob_requests WHERE id=(p_data->>'id')::uuid AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到預約申請'; END IF;
 IF p_action='reject' THEN
  IF r.status='approved' THEN
   SELECT status INTO ast FROM public.appointments WHERE id=r.appointment_id AND tenant_id=t FOR UPDATE;
   IF ast<>'已預約' OR ast IS NULL THEN RAISE EXCEPTION '已報到或完成的預約，請回院內流程處理'; END IF;
   UPDATE public.appointments SET status='已取消',cancelled_at=now(),cancel_reason='院內取消線上預約',updated_at=now()
    WHERE id=r.appointment_id AND tenant_id=t;
  END IF;
  UPDATE booking.ob_requests SET status='rejected',reviewed_at=now(),reviewed_by=auth.uid() WHERE id=r.id;
  RETURN jsonb_build_object('ok',true);
 END IF;
 IF r.status='approved' THEN RETURN jsonb_build_object('ok',true,'appointment_id',r.appointment_id); END IF;
 IF r.status<>'pending' THEN RAISE EXCEPTION '此申請已拒絕'; END IF;
 SELECT * INTO s FROM booking.ob_slots WHERE id=r.slot_id;
 IF s.starts_at<=now() THEN RAISE EXCEPTION '時段已過，請拒絕並另外安排'; END IF;
 SELECT * INTO pet FROM public.pets WHERE id=(p_data->>'pet_id')::uuid AND tenant_id=t;
 IF NOT FOUND OR pet.owner_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.owners o WHERE o.id=pet.owner_id AND o.tenant_id=t)
  THEN RAISE EXCEPTION '請選本院已登錄且有飼主的寵物'; END IF;
 IF booking.used_v60(t,s.starts_at)>1 THEN RAISE EXCEPTION '此時段已有院內預約，名額不足；請另行安排'; END IF;
 IF EXISTS(SELECT 1 FROM public.appointments a WHERE a.tenant_id=t AND a.pet_id=pet.id AND a.status<>'已取消'
  AND a.scheduled_at>=s.starts_at AND a.scheduled_at<s.starts_at+interval '30 minutes')
 THEN RAISE EXCEPTION '此寵物已有同時段院內預約，請勿重複確認'; END IF;
 INSERT INTO public.appointments(tenant_id,pet_id,owner_id,scheduled_at,session,status,notes,created_by)
 VALUES(t,pet.id,pet.owner_id,s.starts_at,
  CASE WHEN extract(hour FROM s.starts_at AT TIME ZONE 'Asia/Taipei')<12 THEN '上午診'
   WHEN extract(hour FROM s.starts_at AT TIME ZONE 'Asia/Taipei')<18 THEN '下午診' ELSE '夜診' END,
  '已預約','線上預約｜聯絡人：'||r.name||'｜電話：'||r.phone||'｜填寫寵物：'||r.pet_name||'｜原因：'||r.reason,auth.uid()) RETURNING id INTO aid;
 UPDATE booking.ob_requests SET status='approved',appointment_id=aid,reviewed_at=now(),reviewed_by=auth.uid() WHERE id=r.id;
 RETURN jsonb_build_object('ok',true,'appointment_id',aid);
END $_$;

ALTER FUNCTION "public"."ob_staff"("p_action" "text", "p_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."period_fees_v932"("p_action" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    SET "statement_timeout" TO '20s'
    AS $$
DECLARE t text:=public.current_tenant_id();u uuid:=auth.uid();p public.pets;o public.owners;
 q text;d1 date;d2 date;lo timestamptz;hi timestamptz;basis text;rows jsonb;pending jsonb;summary jsonb;clinic jsonb;result jsonb;n integer;unassigned integer;
BEGIN
 IF u IS NULL OR t IS NULL OR NOT coalesce(private.has_ability(t,'checkout'),false) THEN RAISE EXCEPTION '需要本院收費權限才能查詢費用' USING ERRCODE='42501'; END IF;
 IF p_action='search' THEN
  q:=lower(trim(coalesce(p_data->>'query','')));
  IF length(q) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION '請輸入寵物、飼主姓名、電話或病歷號（最多120字）'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO rows FROM (
   SELECT sp.id,sp.name,sp.species,sp.owner_id,so.name owner_name,so.system_code,so.owner_code,so.mobile,so.phone
   FROM public.pets sp JOIN public.owners so ON so.id=sp.owner_id AND so.tenant_id=t
   WHERE sp.tenant_id=t AND strpos(lower(concat_ws(' ',sp.name,so.name,so.mobile,so.phone,so.system_code,so.owner_code,sp.legacy_source_no)),q)>0
   ORDER BY so.name,sp.name,sp.id LIMIT 51
  )x;
  RETURN jsonb_build_object('tenant_id',t,'matches',CASE WHEN jsonb_array_length(rows)>50 THEN rows-50 ELSE rows END,'has_more',jsonb_array_length(rows)>50);
 ELSIF p_action<>'report' THEN RAISE EXCEPTION '不支援的期間費用操作'; END IF;
 SELECT * INTO p FROM public.pets x WHERE x.id=(p_data->>'pet_id')::uuid AND x.tenant_id=t;
 IF p.id IS NULL THEN RAISE EXCEPTION '找不到本院寵物' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.owners x WHERE x.id=p.owner_id AND x.tenant_id=t;
 IF o.id IS NULL THEN RAISE EXCEPTION '找不到本院飼主，請先核對關聯'; END IF;
 IF p_data ? 'owner_id' AND (p_data->>'owner_id')::uuid IS DISTINCT FROM o.id THEN RAISE EXCEPTION '飼主關聯已變更，請重新搜尋選定寵物'; END IF;
 d1:=(p_data->>'from')::date;d2:=(p_data->>'to')::date;basis:=coalesce(p_data->>'basis','visit');
 IF d1 IS NULL OR d2 IS NULL OR d2<d1 OR d2-d1>3660 OR d2>(now() AT TIME ZONE 'Asia/Taipei')::date OR basis NOT IN('visit','issued') THEN RAISE EXCEPTION '請選擇有效日期（最多10年，迄日不得晚於今日）'; END IF;
 lo:=d1::timestamp AT TIME ZONE 'Asia/Taipei';hi:=(d2+1)::timestamp AT TIME ZONE 'Asia/Taipei';
 SELECT count(*) INTO n FROM public.invoices i LEFT JOIN public.appointments a ON a.id=i.appointment_id_v57 AND a.tenant_id=t
 WHERE i.tenant_id=t AND i.pet_id=p.id AND i.owner_id=o.id
 AND (CASE WHEN basis='visit' THEN coalesce(a.scheduled_at,i.created_at) ELSE i.created_at END)>=lo
 AND (CASE WHEN basis='visit' THEN coalesce(a.scheduled_at,i.created_at) ELSE i.created_at END)<hi;
 IF n>500 THEN RAISE EXCEPTION '期間超過500張帳單，請縮短查詢範圍'; END IF;
 WITH scope AS MATERIALIZED (
  SELECT i.*,CASE WHEN basis='visit' THEN coalesce(a.scheduled_at,i.created_at) ELSE i.created_at END event_at
  FROM public.invoices i LEFT JOIN public.appointments a ON a.id=i.appointment_id_v57 AND a.tenant_id=t
  WHERE i.tenant_id=t AND i.pet_id=p.id AND i.owner_id=o.id
  AND (CASE WHEN basis='visit' THEN coalesce(a.scheduled_at,i.created_at) ELSE i.created_at END)>=lo
  AND (CASE WHEN basis='visit' THEN coalesce(a.scheduled_at,i.created_at) ELSE i.created_at END)<hi
 ), links AS MATERIALIZED (SELECT * FROM public.pos_invoice_links_v845(t)),
 chosen_movements AS MATERIALIZED(SELECT DISTINCT l.movement_id FROM links l JOIN scope s ON l.invoice_id=s.id::text),
 groups AS MATERIALIZED(
  SELECT l.movement_id,count(*) invoice_count,sum(i.total_amount) group_total
  FROM chosen_movements c JOIN links l ON l.movement_id=c.movement_id JOIN public.invoices i ON i.id::text=l.invoice_id AND i.tenant_id=t GROUP BY l.movement_id
 ), amounts AS (
  SELECT s.*,coalesce(pay.allocated,0) paid,coalesce(pay.link_count,0) link_count,coalesce(pay.ambiguous,false) ambiguous,
   coalesce(ref.amount,0) refunded,coalesce(pay.movements,'[]'::jsonb) payments,coalesce(ref.movements,'[]'::jsonb) refunds,
   coalesce(items.data,'[]'::jsonb) items
  FROM scope s
  LEFT JOIN LATERAL(
   SELECT count(*) link_count,bool_or(g.invoice_count>1 AND m.amount<>g.group_total) ambiguous,
    sum(CASE WHEN g.invoice_count=1 THEN m.amount WHEN m.amount=g.group_total THEN s.total_amount ELSE 0 END) allocated,
    jsonb_agg(jsonb_build_object('id',m.id,'date',m.created_at,'method',m.method,'allocated',CASE WHEN g.invoice_count=1 THEN m.amount WHEN m.amount=g.group_total THEN s.total_amount ELSE NULL END) ORDER BY m.created_at,m.id) movements
   FROM links l JOIN groups g ON g.movement_id=l.movement_id JOIN public.pos_movements_v77 m ON m.id=l.movement_id AND m.tenant_id=t AND m.kind='payment'
   WHERE l.invoice_id=s.id::text
  )pay ON true
  LEFT JOIN LATERAL(
   SELECT sum(m.amount) amount,jsonb_agg(jsonb_build_object('id',m.id,'date',m.created_at,'method',m.method,'amount',m.amount) ORDER BY m.created_at,m.id) movements
   FROM public.pos_movements_v77 m WHERE m.tenant_id=t AND m.kind='refund' AND m.reference=s.id::text AND m.amount>0
  )ref ON true
  LEFT JOIN LATERAL(
   SELECT jsonb_agg(jsonb_build_object('name',it.item_name,'quantity',it.quantity,'unit_price',it.unit_price,'subtotal',it.subtotal) ORDER BY it.id) data
   FROM public.invoice_items it WHERE it.invoice_id=s.id AND it.receipt_visible_v64
  )items ON true
 ), classified AS (
  SELECT x.*,CASE
   WHEN ambiguous THEN '合併收款金額無法明確分攤'
   WHEN paid>total_amount THEN '收款紀錄超過帳單，請核對是否重複收款'
   WHEN refunded>paid THEN '退款大於可確認收款，請核對'
   WHEN link_count=0 AND total_amount>0 AND checkout_type NOT LIKE '%未付款%' THEN '舊帳單標示已付，但缺少對應金流紀錄'
   WHEN link_count>0 AND checkout_type LIKE '%未付款%' AND paid>0 THEN '帳單未付款狀態與金流不一致'
   ELSE '' END issue
  FROM amounts x
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'event_at',event_at,'created_at',created_at,'appointment_id',appointment_id_v57,'family_id',family_checkout_v74,'subtotal',subtotal,'discount',discount,'total',total_amount,'checkout_type',checkout_type,'voided_at',voided_at,'void_reason',void_reason,'paid',paid,'refunded',refunded,'net',CASE WHEN issue='' THEN paid-refunded ELSE NULL END,'due',CASE WHEN issue='' AND voided_at IS NULL THEN greatest(total_amount-paid,0) ELSE NULL END,'issue',issue,'payments',payments,'refunds',refunds,'items',items) ORDER BY event_at,id),'[]'::jsonb) INTO rows FROM classified;
 IF (SELECT coalesce(sum(jsonb_array_length(x->'items')),0) FROM jsonb_array_elements(rows)x)>10000 THEN RAISE EXCEPTION '明細超過10000列，請縮短期間'; END IF;
 SELECT count(*) INTO n FROM public.pos_pending_v77 q JOIN public.appointments a ON a.id=q.appointment_id AND a.tenant_id=t
 WHERE q.tenant_id=t AND q.state='pending' AND a.pet_id=p.id AND a.owner_id=o.id
 AND (CASE WHEN basis='visit' THEN a.scheduled_at ELSE q.created_at END)>=lo AND (CASE WHEN basis='visit' THEN a.scheduled_at ELSE q.created_at END)<hi
 AND NOT EXISTS(SELECT 1 FROM public.invoices i WHERE i.tenant_id=t AND i.appointment_id_v57=q.appointment_id AND i.voided_at IS NULL);
 IF n>500 THEN RAISE EXCEPTION '待付款超過500筆，請縮短期間'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'event_at',CASE WHEN basis='visit' THEN a.scheduled_at ELSE q.created_at END,'created_at',q.created_at,'total',(q.draft->>'total')::numeric,'dispensing',q.dispensing,'items',coalesce(q.draft->'lines','[]'::jsonb)||coalesce((SELECT jsonb_agg(jsonb_build_object('item_name',CASE g->>'kind' WHEN 'oral' THEN '口服藥' WHEN 'injection' THEN '針劑' ELSE '其他用藥' END,'quantity',1,'unit_price',g->'price')) FROM jsonb_array_elements(coalesce(q.draft->'medicationGroups','[]'::jsonb))g),'[]'::jsonb)) ORDER BY q.created_at,q.id),'[]'::jsonb) INTO pending
 FROM public.pos_pending_v77 q JOIN public.appointments a ON a.id=q.appointment_id AND a.tenant_id=t
 WHERE q.tenant_id=t AND q.state='pending' AND a.pet_id=p.id AND a.owner_id=o.id
 AND (CASE WHEN basis='visit' THEN a.scheduled_at ELSE q.created_at END)>=lo AND (CASE WHEN basis='visit' THEN a.scheduled_at ELSE q.created_at END)<hi
 AND NOT EXISTS(SELECT 1 FROM public.invoices i WHERE i.tenant_id=t AND i.appointment_id_v57=q.appointment_id AND i.voided_at IS NULL);
 -- Free-text refund vouchers cannot be attributed to a pet reliably. Do not guess.
 SELECT count(*) INTO unassigned FROM public.pos_movements_v77 m
 WHERE m.tenant_id=t AND m.kind='refund' AND m.amount>0 AND m.created_at>=lo
 AND NOT EXISTS(SELECT 1 FROM public.invoices i WHERE i.tenant_id=t AND i.id::text=m.reference);
 SELECT jsonb_build_object('invoice_count',count(*) FILTER(WHERE x->>'voided_at' IS NULL),'voided_count',count(*) FILTER(WHERE x->>'voided_at' IS NOT NULL),
  'billed',coalesce(sum((x->>'total')::numeric) FILTER(WHERE x->>'voided_at' IS NULL),0)+(SELECT coalesce(sum((z->>'total')::numeric),0) FROM jsonb_array_elements(pending)z),
  'paid',coalesce(sum((x->>'paid')::numeric) FILTER(WHERE x->>'voided_at' IS NULL AND x->>'issue'=''),0),
  'refunded',coalesce(sum((x->>'refunded')::numeric) FILTER(WHERE x->>'voided_at' IS NULL AND x->>'issue'=''),0),
  'net',coalesce(sum((x->>'net')::numeric) FILTER(WHERE x->>'voided_at' IS NULL AND x->>'issue'=''),0),
  'due',coalesce(sum((x->>'due')::numeric) FILTER(WHERE x->>'voided_at' IS NULL AND x->>'issue'=''),0)+(SELECT coalesce(sum((z->>'total')::numeric),0) FROM jsonb_array_elements(pending)z),
  'unknown',coalesce(sum((x->>'total')::numeric) FILTER(WHERE x->>'voided_at' IS NULL AND x->>'issue'<>''),0),
  'issue_count',count(*) FILTER(WHERE x->>'issue'<>''),
  'voided_residual',coalesce(sum((x->>'net')::numeric) FILTER(WHERE x->>'voided_at' IS NOT NULL AND x->>'issue'=''),0),
  'unassigned_refund_count',unassigned,'pending_count',jsonb_array_length(pending)) INTO summary FROM jsonb_array_elements(rows)x;
 summary:=summary||jsonb_build_object('receipt_allowed',(summary->>'issue_count')::int=0 AND (summary->>'voided_residual')::numeric=0 AND unassigned=0 AND (summary->>'paid')::numeric>0);
 SELECT jsonb_build_object('name',c.clinic_name,'phone',c.phone,'address',c.address) INTO clinic FROM public.clinic_settings c WHERE c.tenant_id=t LIMIT 1;
 result:=jsonb_build_object('tenant_id',t,'pet',jsonb_build_object('id',p.id,'name',p.name,'species',p.species),'owner',jsonb_build_object('id',o.id,'name',o.name,'system_code',o.system_code,'owner_code',o.owner_code),'clinic',coalesce(clinic,'{}'::jsonb),'from',d1,'to',d2,'basis',basis,'invoices',rows,'pending',pending,'summary',summary);
 RETURN result||jsonb_build_object('as_of',now(),'revision',md5(result::text));
END $$;

ALTER FUNCTION "public"."period_fees_v932"("p_action" "text", "p_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pharmacy_delivery_sync_v9133"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
 IF NEW.state='paid' AND NEW.dispensing='已交付' THEN
  UPDATE public.pharmacy_jobs_v9133 SET state='handed',version=version+1,updated_at=now(),
   events=events||jsonb_build_array(jsonb_build_object('at',now(),'actor',auth.uid(),'name','櫃台／交藥人員','action','handed'))
  WHERE id=NEW.id AND tenant_id=NEW.tenant_id AND state='ready';
 END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "public"."pharmacy_delivery_sync_v9133"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pharmacy_invoice_guard_v9133"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.pharmacy_jobs_v9133 j
  WHERE j.tenant_id=to_jsonb(NEW)->>'tenant_id' AND j.appointment_id::text=coalesce(to_jsonb(NEW)->>'appointment_id_v57',to_jsonb(NEW)->>'appointment_id')
   AND j.state IN('waiting','preparing','returned'))
 THEN RAISE EXCEPTION '此門診仍在配藥室處理，不能先收款結帳'; END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "public"."pharmacy_invoice_guard_v9133"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pharmacy_mirror_v9133"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
 UPDATE public.pos_pending_v77 SET draft=draft||jsonb_build_object('pharmacy_record_v9133',to_jsonb(NEW))
 WHERE id=NEW.id AND tenant_id=NEW.tenant_id;
 RETURN NEW;
END $$;

ALTER FUNCTION "public"."pharmacy_mirror_v9133"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pharmacy_pending_guard_v9133"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE j public.pharmacy_jobs_v9133;
BEGIN
 SELECT * INTO j FROM public.pharmacy_jobs_v9133 WHERE id=OLD.id AND tenant_id=OLD.tenant_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 -- Allow only an exact server snapshot refresh without any billing/status changes.
 IF NEW.draft->'pharmacy_record_v9133'=to_jsonb(j)
 AND (NEW.draft-'pharmacy_record_v9133')=(OLD.draft-'pharmacy_record_v9133')
 AND (to_jsonb(NEW)-'draft')=(to_jsonb(OLD)-'draft') THEN RETURN NEW; END IF;
 IF NEW.draft->'medicationGroups' IS DISTINCT FROM OLD.draft->'medicationGroups' THEN
  -- After release cashier may change group fees, but never the drugs or quantities.
  IF (SELECT jsonb_agg(jsonb_build_object('kind',x->'kind','drugs',x->'drugs') ORDER BY x->>'kind') FROM jsonb_array_elements(NEW.draft->'medicationGroups') x)
   IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('kind',x->'kind','drugs',x->'drugs') ORDER BY x->>'kind') FROM jsonb_array_elements(OLD.draft->'medicationGroups') x)
  THEN RAISE EXCEPTION '配藥處方不可由櫃台變更；請退回醫師重開'; END IF;
 END IF;
 IF NEW.draft->>'billingPetId' IS DISTINCT FROM OLD.draft->>'billingPetId'
 OR NEW.draft->>'ownerId' IS DISTINCT FROM OLD.draft->>'ownerId'
 OR NEW.draft->>'billingAppointmentId' IS DISTINCT FROM OLD.draft->>'billingAppointmentId'
 THEN RAISE EXCEPTION '配藥單飼主與寵物不可變更'; END IF;
 IF (SELECT jsonb_agg(x ORDER BY x->>'stock_id') FROM jsonb_array_elements(NEW.draft->'lines') x WHERE x->>'stock_kind'='medicine')
  IS DISTINCT FROM (SELECT jsonb_agg(x ORDER BY x->>'stock_id') FROM jsonb_array_elements(OLD.draft->'lines') x WHERE x->>'stock_kind'='medicine')
 THEN RAISE EXCEPTION '處方用藥請退回醫師重開，不可從櫃台增刪'; END IF;
 IF NEW.dispensing='已交付' AND NEW.state<>'paid' THEN RAISE EXCEPTION '請先完成收款，再確認交藥'; END IF;
 IF j.state NOT IN('ready','handed','cancelled') THEN RAISE EXCEPTION '配藥尚未完成，請由配藥室完成或退回醫師'; END IF;
 IF NEW.state='cancelled' AND j.state<>'cancelled' THEN RAISE EXCEPTION '配藥帳單請由原醫師在配藥室撤回，不可單獨取消待付款'; END IF;
 IF j.state='cancelled' AND NEW.state<>'cancelled' THEN RAISE EXCEPTION '此配藥單已撤回，請重新開立'; END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "public"."pharmacy_pending_guard_v9133"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pharmacy_room_v9133"("p_action" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE t text:=public.current_tenant_id()::text; actor uuid:=auth.uid(); profile jsonb;
 admin boolean; clinical boolean; worker boolean; cashier boolean; who text; j public.pharmacy_jobs_v9133;
 a public.appointments; d jsonb; labels jsonb; rx jsonb; record_id uuid; job_id uuid; target uuid; pending public.pos_pending_v77;
 note text:=btrim(coalesce(p_data->>'reason','')); event jsonb;
BEGIN
 IF octet_length(p_data::text)>2097152 THEN RAISE EXCEPTION '配藥資料超過2MB，請減少單次內容'; END IF;
 IF actor IS NULL OR t IS NULL OR NOT coalesce(private.has_ability(t,'read'),false) THEN RAISE EXCEPTION '請登入有效院所' USING ERRCODE='42501'; END IF;
 SELECT to_jsonb(u) INTO profile FROM public.user_profiles u WHERE u.user_id=actor AND u.tenant_id::text=t;
 IF profile IS NULL THEN RAISE EXCEPTION '無院所權限' USING ERRCODE='42501'; END IF;
 admin:=profile->>'role'='admin';clinical:=private.has_ability(t,'clinical');cashier:=private.has_ability(t,'checkout');
 worker:=admin OR coalesce((profile->>'permission_pharmacy')::boolean,false);who:=coalesce(nullif(profile->>'display_name',''),profile->>'role');
 IF NOT(admin OR clinical OR worker OR cashier) THEN RAISE EXCEPTION '沒有配藥室權限，請管理者指派' USING ERRCODE='42501'; END IF;
 IF p_action='list' THEN
  IF coalesce(p_data->>'filter','active') NOT IN('active','all','waiting','preparing','returned','ready') OR length(coalesce(p_data->>'query',''))>100 THEN RAISE EXCEPTION '查詢條件不正確'; END IF;
  RETURN jsonb_build_object('tenant_id',t,'worker',worker,'admin',admin,'clinical',clinical,'cashier',cashier,
   'counts',(SELECT jsonb_build_object('waiting',count(*) FILTER(WHERE state='waiting'),'preparing',count(*) FILTER(WHERE state='preparing'),'returned',count(*) FILTER(WHERE state='returned')) FROM public.pharmacy_jobs_v9133 WHERE tenant_id=t),
   'total',(SELECT count(*) FROM public.pharmacy_jobs_v9133 queue_job WHERE queue_job.tenant_id=t
    AND (CASE coalesce(p_data->>'filter','active') WHEN 'all' THEN queue_job.state NOT IN('handed','cancelled') OR queue_job.updated_at>=now()-interval '1 day' WHEN 'active' THEN queue_job.state IN('waiting','preparing','returned') ELSE queue_job.state=p_data->>'filter' END)
    AND strpos(lower(concat_ws(' ',queue_job.bill->>'ownerName',queue_job.bill->>'billingPetName',queue_job.doctor_name,queue_job.prepared_name)),lower(btrim(coalesce(p_data->>'query',''))))>0),
   'jobs',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at,x.id) FROM (
    SELECT queue_job.*,q.state AS payment_state,q.dispensing FROM public.pharmacy_jobs_v9133 queue_job
    LEFT JOIN public.pos_pending_v77 q ON q.id=queue_job.id AND q.tenant_id=t
    WHERE queue_job.tenant_id=t
     AND (CASE coalesce(p_data->>'filter','active') WHEN 'all' THEN queue_job.state NOT IN('handed','cancelled') OR queue_job.updated_at>=now()-interval '1 day' WHEN 'active' THEN queue_job.state IN('waiting','preparing','returned') ELSE queue_job.state=p_data->>'filter' END)
     AND strpos(lower(concat_ws(' ',queue_job.bill->>'ownerName',queue_job.bill->>'billingPetName',queue_job.doctor_name,queue_job.prepared_name)),lower(btrim(coalesce(p_data->>'query',''))))>0
    ORDER BY queue_job.created_at,queue_job.id LIMIT 100 OFFSET greatest(0,least(100000,coalesce((p_data->>'offset')::integer,0)))) x),'[]'::jsonb));
 END IF;
 IF p_action='counts' THEN
  RETURN jsonb_build_object('tenant_id',t,'waiting',(SELECT count(*) FROM public.pharmacy_jobs_v9133 WHERE tenant_id=t AND state='waiting'),'returned',(SELECT count(*) FROM public.pharmacy_jobs_v9133 WHERE tenant_id=t AND state='returned' AND (doctor_id=actor OR admin)));
 END IF;
 IF p_action='staff' THEN
  IF NOT admin THEN RAISE EXCEPTION '僅管理者可設定配藥權限'; END IF;
  RETURN jsonb_build_object('tenant_id',t,'staff',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.user_id,'name',coalesce(to_jsonb(u)->>'display_name',u.role),'role',u.role,'enabled',u.permission_pharmacy)) FROM public.user_profiles u WHERE u.tenant_id::text=t),'[]'::jsonb));
 END IF;
 IF p_action='permission' THEN
  IF NOT admin THEN RAISE EXCEPTION '僅管理者可設定配藥權限'; END IF;
  UPDATE public.user_profiles SET permission_pharmacy=coalesce((p_data->>'enabled')::boolean,false) WHERE user_id=(p_data->>'user_id')::uuid AND tenant_id::text=t;
  IF NOT FOUND THEN RAISE EXCEPTION '找不到本院人員'; END IF;
  RETURN jsonb_build_object('ok',true,'tenant_id',t);
 END IF;
 IF p_action='export' THEN
  IF NOT admin THEN RAISE EXCEPTION '僅管理者可匯出'; END IF;
  RETURN jsonb_build_object('format','genblue-pharmacy-v9133','tenant_id',t,'exported_at',now(),'jobs',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM public.pharmacy_jobs_v9133 q WHERE q.tenant_id=t),'[]'::jsonb));
 END IF;
 -- Same lock as existing POS: consistent order across send/prepare/checkout/cancel.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pos_v77:'||t,0));
 IF p_action='send' THEN
  IF NOT clinical THEN RAISE EXCEPTION '只有具病歷編輯權限的醫師可送單'; END IF;
  job_id:=(p_data->>'id')::uuid;d:=p_data->'draft';rx:=p_data->'prescription';
  IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR jsonb_typeof(d->'medicationGroups') IS DISTINCT FROM 'array' OR jsonb_typeof(d->'lines') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION '帳單格式不完整'; END IF;
  IF job_id IS NULL OR jsonb_typeof(rx) IS DISTINCT FROM 'array' OR jsonb_array_length(rx) NOT BETWEEN 1 AND 200 OR length(coalesce(p_data->>'chief',''))>200000 THEN RAISE EXCEPTION '請確認處方與病歷內容'; END IF;
  SELECT * INTO j FROM public.pharmacy_jobs_v9133 WHERE id=job_id;
  IF FOUND THEN
   IF j.tenant_id<>t OR j.doctor_id<>actor OR j.prescription<>rx OR (j.bill-'ownerName'-'billingPetName')<>(d-'ownerName'-'billingPetName') OR j.chief<>coalesce(p_data->>'chief','') THEN RAISE EXCEPTION '前次送單內容不同，請先核對配藥室'; END IF;
   RETURN jsonb_build_object('tenant_id',t,'job',to_jsonb(j),'replayed',true);
  END IF;
  PERFORM public.pos_validate_draft_v77(d);
  SELECT * INTO a FROM public.appointments WHERE id=(d->>'billingAppointmentId')::uuid AND tenant_id::text=t FOR UPDATE;
  IF NOT FOUND OR a.pet_id::text IS DISTINCT FROM d->>'billingPetId' OR a.owner_id::text IS DISTINCT FROM d->>'ownerId' OR a.status NOT IN('候診中','診間看診中') THEN RAISE EXCEPTION '本次掛號與處方不符或已結束'; END IF;
  SELECT jsonb_build_object('ownerName',o.name,'billingPetName',p.name) INTO labels
   FROM public.pets p JOIN public.owners o ON o.id=p.owner_id AND o.tenant_id::text=t
   WHERE p.id=a.pet_id AND p.tenant_id::text=t AND p.owner_id=a.owner_id;
  IF labels IS NULL THEN RAISE EXCEPTION '寵物與飼主資料已變更，請重新核對'; END IF;
  d:=d||labels;
  IF NOT admin AND to_jsonb(a)->>'clinician_id_v57' IS DISTINCT FROM actor::text THEN RAISE EXCEPTION '只能送出自己接診的處方'; END IF;
  IF public.verify_clinic_visit_v51(a.pet_id,(p_data->>'claim_id')::uuid) IS DISTINCT FROM true THEN RAISE EXCEPTION '看診權已變更，請重新核對'; END IF;
  IF EXISTS(SELECT 1 FROM public.pharmacy_jobs_v9133 WHERE tenant_id=t AND appointment_id=a.id AND state<>'cancelled') THEN RAISE EXCEPTION '本次掛號已送配藥室，請勿重複送出'; END IF;
  -- Every dispensed drug/quantity must match the complete medical prescription.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(rx) r WHERE coalesce(r->>'quantity','') !~ '^[0-9]+([.][0-9]+)?$' OR coalesce((r->>'quantity')::numeric,0)<=0 OR coalesce(r->>'custom_dose','')='' OR NOT EXISTS(SELECT 1 FROM public.medicines m WHERE m.id::text=r->>'medicine_id' AND m.tenant_id::text=t)) THEN RAISE EXCEPTION '處方藥品或數量不完整'; END IF;
  IF (SELECT jsonb_agg(jsonb_build_array(k.id,k.qty) ORDER BY k.id) FROM (SELECT r->>'medicine_id' id,sum((r->>'quantity')::numeric) qty FROM jsonb_array_elements(rx) r GROUP BY 1) k)
   IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_array(k.id,k.qty) ORDER BY k.id) FROM (SELECT x->>'medicine_id' id,sum((x->>'quantity')::numeric) qty FROM jsonb_array_elements(d->'medicationGroups') g CROSS JOIN LATERAL jsonb_array_elements(g->'drugs') x GROUP BY 1) k)
  THEN RAISE EXCEPTION '配藥處方與帳單用藥數量不符'; END IF;
  INSERT INTO public.medical_records(tenant_id,pet_id,status,chief_complaint,prescription_details,vaccine_info)
   VALUES(t,a.pet_id,'診間看診中',coalesce(p_data->>'chief',''),rx,jsonb_build_object('pharmacy_job_v9133',job_id)) RETURNING id INTO record_id;
  INSERT INTO public.pharmacy_jobs_v9133(id,tenant_id,appointment_id,record_id,prescription,chief,bill,doctor_id,doctor_name,events)
   VALUES(job_id,t,a.id,record_id,rx,coalesce(p_data->>'chief',''),d,actor,who,jsonb_build_array(jsonb_build_object('at',now(),'actor',actor,'name',who,'action','醫師送配藥室')));
  -- Stage uses the existing authoritative doctor/visit checks; no stock deduction.
  PERFORM public.pos_v77('stage',jsonb_build_object('id',job_id,'draft',d||jsonb_build_object('pharmacy_v9133',true)));
  UPDATE public.pharmacy_jobs_v9133 SET updated_at=updated_at WHERE id=job_id RETURNING * INTO j;
  INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,after_data,actor) VALUES(t,j.id,'配藥室：醫師送單',to_jsonb(j),actor);
  RETURN jsonb_build_object('tenant_id',t,'job',to_jsonb(j));
 END IF;
 SELECT * INTO j FROM public.pharmacy_jobs_v9133 WHERE id=(p_data->>'id')::uuid AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到本院配藥單'; END IF;
 IF p_action='claim' AND j.state='preparing' AND j.prepared_by=actor THEN RETURN jsonb_build_object('tenant_id',t,'job',to_jsonb(j)); END IF;
 IF p_action='complete' AND j.state IN('ready','handed') AND (j.prepared_by=actor OR admin) THEN RETURN jsonb_build_object('tenant_id',t,'job',to_jsonb(j)); END IF;
 IF p_action='cancel' AND j.state='cancelled' AND (j.doctor_id=actor OR admin) THEN RETURN jsonb_build_object('tenant_id',t,'job',to_jsonb(j)); END IF;
 IF p_action='handed' AND j.state='handed' THEN RETURN jsonb_build_object('tenant_id',t,'job',to_jsonb(j)); END IF;
 IF j.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION '配藥單已由其他人更新，請重新讀取'; END IF;
 SELECT * INTO pending FROM public.pos_pending_v77 WHERE id=j.id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '配藥單對應待付款已變更，請管理者核對'; END IF;
 IF p_action='claim' THEN
  IF NOT worker OR j.state<>'waiting' THEN RAISE EXCEPTION '無法接單：需配藥權限且尚未被接單'; END IF;
  UPDATE public.pharmacy_jobs_v9133 SET state='preparing',prepared_by=actor,prepared_name=who WHERE id=j.id;
 ELSIF p_action='complete' THEN
  IF NOT worker OR j.state<>'preparing' OR (j.prepared_by<>actor AND NOT admin) OR NOT coalesce((p_data->>'checked')::boolean,false) THEN RAISE EXCEPTION '請原配藥人員核對處方後完成'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.medical_records m WHERE m.id=j.record_id AND m.tenant_id::text=t AND m.prescription_details=j.prescription AND m.chief_complaint=j.chief) THEN RAISE EXCEPTION '病歷處方已變更，請退回醫師重新確認'; END IF;
  UPDATE public.pharmacy_jobs_v9133 SET state='ready' WHERE id=j.id;
  UPDATE public.pos_pending_v77 SET dispensing='已調劑',version=version+1,updated_by=actor,updated_at=now() WHERE id=j.id;
 ELSIF p_action='return' THEN
  IF NOT worker OR j.state NOT IN('waiting','preparing') OR (j.state='preparing' AND j.prepared_by<>actor AND NOT admin) OR note='' THEN RAISE EXCEPTION '請配藥負責人填寫退回原因'; END IF;
  UPDATE public.pharmacy_jobs_v9133 SET state='returned',reason=note WHERE id=j.id;
 ELSIF p_action='cancel' THEN
  IF NOT(admin OR (clinical AND j.doctor_id=actor)) OR j.state NOT IN('waiting','returned','ready') OR pending.state<>'pending' OR note='' THEN RAISE EXCEPTION '請原醫師填寫原因撤回；配藥中請先由配藥室退回，已收款請走原退款流程'; END IF;
  UPDATE public.pharmacy_jobs_v9133 SET state='cancelled',reason=note WHERE id=j.id;
  UPDATE public.pos_pending_v77 SET state='cancelled',updated_by=actor,updated_at=now(),version=version+1 WHERE id=j.id;
 ELSIF p_action='handed' THEN
  IF NOT(worker OR cashier) OR j.state<>'ready' OR pending.state<>'paid' THEN RAISE EXCEPTION '請確認已完成配藥並收款，再交藥'; END IF;
  UPDATE public.pharmacy_jobs_v9133 SET state='handed' WHERE id=j.id;
  UPDATE public.pos_pending_v77 SET dispensing='已交付',updated_by=actor,updated_at=now(),version=version+1 WHERE id=j.id;
 ELSE RAISE EXCEPTION '不支援配藥操作'; END IF;
 event:=jsonb_build_object('at',now(),'actor',actor,'name',who,'action',p_action,'reason',note);
 UPDATE public.pharmacy_jobs_v9133 SET version=version+1,updated_at=now(),events=events||jsonb_build_array(event) WHERE id=j.id RETURNING * INTO j;
 INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,after_data,actor) VALUES(t,j.id,'配藥室：'||p_action,to_jsonb(j),actor);
 RETURN jsonb_build_object('tenant_id',t,'job',to_jsonb(j));
END $_$;

ALTER FUNCTION "public"."pharmacy_room_v9133"("p_action" "text", "p_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pharmacy_visit_guard_v9133"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
 IF NEW.status='診間看診中' AND OLD.status IS DISTINCT FROM NEW.status
 AND EXISTS(SELECT 1 FROM public.pharmacy_jobs_v9133 j WHERE j.appointment_id=NEW.id AND j.tenant_id=NEW.tenant_id::text AND j.state<>'cancelled')
 THEN RAISE EXCEPTION '此掛號已送配藥室；如需改處方，請先由原醫師撤回'; END IF;
 RETURN NEW;
END $$;

ALTER FUNCTION "public"."pharmacy_visit_guard_v9133"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."platform_provision_trial"("p_operator_id" "uuid", "p_user_id" "uuid", "p_clinic_name" "text", "p_days" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_tenant text := gen_random_uuid()::text;
  v_expiry timestamptz := now() + make_interval(days => p_days);
  v_clinic_name text := btrim(p_clinic_name);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_operators WHERE user_id = p_operator_id) THEN
    RAISE EXCEPTION '非平台管理者' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION '試用管理者帳號不存在或已屬於其他院所';
  END IF;
  IF v_clinic_name IS NULL OR char_length(v_clinic_name) < 2
     OR char_length(v_clinic_name) > 80 OR p_days NOT BETWEEN 1 AND 90 THEN
    RAISE EXCEPTION '請輸入 2 至 80 字的醫院名稱、1 至 90 天試用期';
  END IF;
  INSERT INTO public.user_profiles (user_id, tenant_id, display_name, role, can_checkout)
  VALUES (p_user_id, v_tenant, left(v_clinic_name, 70) || '管理者', 'admin', false);
  INSERT INTO public.clinic_trials (tenant_id, expires_at)
  VALUES (v_tenant, v_expiry);
  INSERT INTO public.clinic_settings (tenant_id, clinic_name, director, phone, address, updated_at)
  VALUES (v_tenant, v_clinic_name, '', '', '', now());
  RETURN jsonb_build_object('tenant_id', v_tenant, 'expires_at', v_expiry);
END;
$$;

ALTER FUNCTION "public"."platform_provision_trial"("p_operator_id" "uuid", "p_user_id" "uuid", "p_clinic_name" "text", "p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_call_checkout_v77"("p_name" "text", "p_args" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare f record; a record; args text:=''; result jsonb; candidates integer;
begin
 if p_name not in ('checkout_with_inventory','checkout_clinic_doctor_v57','checkout_clinic_medicine_groups_v64','checkout_family_v74') then raise exception '未允許的結帳函式'; end if;
 select count(*) into candidates from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=p_name and p.prokind='f'
 and not exists(select 1 from unnest(p.proargnames) with ordinality z(name,i) where i<=p.pronargs-p.pronargdefaults and not p_args ? name);
 if candidates<>1 then raise exception '結帳函式 % 缺少或版本不明，請先安裝既有結帳 SQL',p_name; end if;
 select p.* into f from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=p_name and p.prokind='f'
 and not exists(select 1 from unnest(p.proargnames) with ordinality z(name,i) where i<=p.pronargs-p.pronargdefaults and not p_args ? name);
 for a in select name,i from unnest(f.proargnames) with ordinality z(name,i) where i<=f.pronargs loop
  if p_args ? a.name then
   args:=args||case when args='' then '' else ',' end||format('%I => ',a.name);
   if f.proargtypes[a.i-1] in ('jsonb'::regtype,'json'::regtype) then
    args:=args||format('($1->%L)::%s',a.name,format_type(f.proargtypes[a.i-1],null));
   else args:=args||format('($1->>%L)::%s',a.name,format_type(f.proargtypes[a.i-1],null)); end if;
  end if;
 end loop;
 execute format('select to_jsonb(public.%I(%s))',p_name,args) into result using p_args;
 return result;
end $_$;

ALTER FUNCTION "public"."pos_call_checkout_v77"("p_name" "text", "p_args" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_core_v845"("p_action" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
#variable_conflict error
<<pos_runtime_v844>>
declare tenant text:=public.current_tenant_id()::text; actor uuid:=auth.uid(); profile jsonb;
 canbill boolean; canmedical boolean; isadmin boolean; pending public.pos_pending_v77;
 shift public.pos_shifts_v77; prior public.pos_requests_v77; id uuid; appt jsonb; d jsonb;
 payload jsonb; args jsonb; result jsonb; amount numeric; method text; expected numeric; counted numeric;
 claim_schema text; claim_table text; request_payload jsonb; entry jsonb; denomination record; denom_total numeric:=0;
begin
 if actor is null or tenant is null then raise exception '請先登入有效院所'; end if;
 select to_jsonb(u) into profile from public.user_profiles u where u.user_id=actor and u.tenant_id::text=tenant;
 if profile is null then raise exception '無院所權限'; end if;
 isadmin:=profile->>'role'='admin';
 canbill:=isadmin or coalesce((profile->>'permission_checkout')::boolean,profile->>'role'='staff' or (profile->>'role'='doctor' and coalesce((profile->>'can_checkout')::boolean,false)));
 canmedical:=isadmin or coalesce((profile->>'permission_clinical')::boolean,profile->>'role'='doctor');
 if p_action in ('list','stage','dispensing') then
  if not (canbill or canmedical) then raise exception '沒有待付款權限'; end if;
 elsif not canbill then raise exception '沒有結帳權限'; end if;
 -- Serializes drawer close, cash movements and checkout across all computers.
 perform pg_advisory_xact_lock(hashtextextended('pos_v77:'||tenant,0));
 if p_action='export' then
  if not isadmin then raise exception '只有管理者可備份櫃台資料'; end if;
  return jsonb_build_object('schema_version',1,'tenant_id',tenant,'exported_at',now(),'tables',
   jsonb_build_object(
    'pos_pending_v77',coalesce((select jsonb_agg(q) from public.pos_pending_v77 q where tenant_id=tenant),'[]'::jsonb),
    'pos_shifts_v77',coalesce((select jsonb_agg(q) from public.pos_shifts_v77 q where tenant_id=tenant),'[]'::jsonb),
    'pos_movements_v77',coalesce((select jsonb_agg(q) from public.pos_movements_v77 q where tenant_id=tenant),'[]'::jsonb),
    'pos_requests_v77',coalesce((select jsonb_agg(q) from public.pos_requests_v77 q where tenant_id=tenant),'[]'::jsonb),
    'pos_audit_v77',coalesce((select jsonb_agg(q) from public.pos_audit_v77 q where tenant_id=tenant),'[]'::jsonb)));
 end if;
 if p_action='list' then
  select * into shift from public.pos_shifts_v77 where tenant_id=tenant and closed_at is null;
  expected:=coalesce(shift.opening,0)+(select coalesce(sum(case when m.kind in ('payment','in','opening_adjust') then m.amount else -m.amount end),0)
   from public.pos_movements_v77 m where m.tenant_id=tenant and m.shift_id=shift.id and m.method='現金');
  return jsonb_build_object('tenant_id',tenant,'pending',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.pos_pending_v77 q where tenant_id=tenant and state='pending'),'[]'::jsonb),
   'shift',case when canbill then to_jsonb(shift) else null end,'expected',case when canbill then expected else null end,
   'cash_parts',case when canbill then jsonb_build_object(
     'opening',coalesce(shift.opening,0),
     'payment',coalesce((select sum(m.amount) from public.pos_movements_v77 m where m.tenant_id=tenant and m.shift_id=shift.id and m.method='現金' and m.kind='payment'),0),
     'refund',coalesce((select sum(m.amount) from public.pos_movements_v77 m where m.tenant_id=tenant and m.shift_id=shift.id and m.method='現金' and m.kind='refund'),0),
     'in',coalesce((select sum(m.amount) from public.pos_movements_v77 m where m.tenant_id=tenant and m.shift_id=shift.id and m.method='現金' and m.kind='in'),0),
     'out',coalesce((select sum(m.amount) from public.pos_movements_v77 m where m.tenant_id=tenant and m.shift_id=shift.id and m.method='現金' and m.kind='out'),0),
     'opening_adjust',coalesce((select sum(m.amount) from public.pos_movements_v77 m where m.tenant_id=tenant and m.shift_id=shift.id and m.method='現金' and m.kind='opening_adjust'),0)) else null end,
   'methods',case when canbill then coalesce((select jsonb_agg(x) from (select m.method,sum(case when m.kind='refund' then -m.amount else m.amount end) total from public.pos_movements_v77 m where m.tenant_id=tenant and m.shift_id=shift.id and m.kind in ('payment','refund') group by m.method)x),'[]'::jsonb) else '[]'::jsonb end,
   'history',case when canbill then coalesce((select jsonb_agg(x) from (select h.*,h.opening+(select coalesce(sum(case when m.kind in ('payment','in','opening_adjust') then m.amount else -m.amount end),0) from public.pos_movements_v77 m where m.tenant_id=tenant and m.shift_id=h.id and m.method='現金') as ledger_expected from public.pos_shifts_v77 h where h.tenant_id=tenant order by h.opened_at desc limit 20)x),'[]'::jsonb) else '[]'::jsonb end,
   'movements',case when canbill then coalesce((select jsonb_agg(x) from (select * from public.pos_movements_v77 where tenant_id=tenant order by created_at desc limit 100)x),'[]'::jsonb) else '[]'::jsonb end);
 end if;
 id:=(p_data->>'id')::uuid;
 if p_action='stage' then
  d:=p_data->'draft';perform public.pos_validate_draft_v77(d);
  select to_jsonb(a) into appt from public.appointments a where a.id=(d->>'billingAppointmentId')::uuid and a.tenant_id::text=tenant for update;
  if appt is null or appt->>'owner_id' is distinct from d->>'ownerId' or appt->>'pet_id' is distinct from d->>'billingPetId'
   or appt->>'status' not in ('候診中','診間看診中') then raise exception '掛號與帳單不符或已結束'; end if;
  if not canbill and appt->>'clinician_id_v57' is distinct from actor::text then raise exception '只能送出自己的看診帳單'; end if;
  if appt->>'status'='診間看診中' and not isadmin and appt->>'clinician_id_v57' is distinct from actor::text then raise exception '請由原醫師送出待付款'; end if;
  select * into pending from public.pos_pending_v77 where tenant_id=tenant and appointment_id=(d->>'billingAppointmentId')::uuid;
  if pending.id is not null then
   if pending.id=id and pending.draft=d and pending.state='pending' then return to_jsonb(pending); end if;
   if pending.state<>'cancelled' then raise exception '此掛號已有待付款或已收款資料，請由櫃台清單接手'; end if;
   delete from public.pos_pending_v77 where pos_pending_v77.id=pending.id;
  end if;
  insert into public.pos_pending_v77(id,tenant_id,appointment_id,draft,created_by,updated_by)
   values(id,tenant,(d->>'billingAppointmentId')::uuid,d,actor,actor) returning * into pending;
  -- Preserve doctor attribution; return the medical claim to the pool.
  update public.appointments a set status='候診中' where a.id=pending.appointment_id and a.tenant_id::text=tenant;
  select n.nspname,c.relname into claim_schema,claim_table from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where c.relname='clinic_visit_claims_v51' and c.relkind='r' limit 1;
  if claim_schema is not null then execute format('delete from %I.%I c where to_jsonb(c)->>''tenant_id''=$1 and to_jsonb(c)->>''appointment_id''=$2',claim_schema,claim_table) using tenant,pending.appointment_id::text; end if;
  insert into public.pos_audit_v77(tenant_id,entity_id,action,after_data,actor) values(tenant,id,'送至待付款',d,actor);
  return to_jsonb(pending);
 elsif p_action in ('edit','dispensing','cancel') then
  select * into pending from public.pos_pending_v77 where tenant_id=tenant and pos_pending_v77.id=public.id_for_update_v77(p_data) for update;
  if pending.id is null or pending.state<>'pending' or pending.version is distinct from (p_data->>'version')::integer then raise exception '資料已被其他電腦更新，請重新載入'; end if;
  if p_action='edit' then
   d:=p_data->'draft';perform public.pos_validate_draft_v77(d);
   if d->>'ownerId' is distinct from pending.draft->>'ownerId' or d->>'billingPetId' is distinct from pending.draft->>'billingPetId' or d->>'billingAppointmentId' is distinct from pending.draft->>'billingAppointmentId' then raise exception '不可更換帳單飼主或掛號'; end if;
   if d->'medicationGroups' is distinct from pending.draft->'medicationGroups' then
    -- Fee editing is allowed; stock components must stay identical.
    if (select jsonb_agg(g-'price' order by g->>'kind') from jsonb_array_elements(d->'medicationGroups')g)
      is distinct from (select jsonb_agg(g-'price' order by g->>'kind') from jsonb_array_elements(pending.draft->'medicationGroups')g) then raise exception '不可在櫃台更改處方用量'; end if;
   end if;
   if (select jsonb_agg(l order by l::text) from jsonb_array_elements(d->'lines')l where l->>'stock_kind'='medicine')
     is distinct from (select jsonb_agg(l order by l::text) from jsonb_array_elements(pending.draft->'lines')l where l->>'stock_kind'='medicine') then raise exception '不可更改處方庫存明細'; end if;
   update public.pos_pending_v77 set draft=d,version=version+1,updated_by=actor,updated_at=now() where pos_pending_v77.id=pending.id;
  elsif p_action='dispensing' then
   update public.pos_pending_v77 set dispensing=p_data->>'value',version=version+1,updated_by=actor,updated_at=now() where pos_pending_v77.id=pending.id;
  else
   if not isadmin then raise exception '只有管理者可取消待付款'; end if;
   if pending.dispensing<>'未調劑' then raise exception '已調劑或交付的帳單，請先由管理者處理藥品退回'; end if;
   update public.pos_pending_v77 set state='cancelled',version=version+1,updated_by=actor,updated_at=now() where pos_pending_v77.id=pending.id;
  end if;
  insert into public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor)
   values(tenant,pending.id,p_action,to_jsonb(pending),p_data,actor);
  return jsonb_build_object('ok',true);
 elsif p_action='open' then
  amount:=(p_data->>'amount')::numeric;if amount is null or amount<0 or amount::text in ('NaN','Infinity','-Infinity') then raise exception '備用金須為非負數'; end if;
  select * into shift from public.pos_shifts_v77 where tenant_id=tenant and closed_at is null;
  if shift.id=id then return to_jsonb(shift); end if;
  if shift.id is not null then raise exception '已有開班中的錢櫃，請接續該班或先交班'; end if;
  insert into public.pos_shifts_v77(id,tenant_id,opening,opened_by) values(id,tenant,amount,actor) returning * into shift;
  insert into public.pos_audit_v77(tenant_id,entity_id,action,after_data,actor) values(tenant,id,'開班',to_jsonb(shift),actor);
  return to_jsonb(shift);
 elsif p_action in ('movement','close','opening_correct') then
  select * into shift from public.pos_shifts_v77 where tenant_id=tenant and pos_shifts_v77.id=(p_data->>'shift_id')::uuid for update;
  if shift.id is null then raise exception '班別不存在'; end if;
  if p_action='close' and shift.closed_at is not null then return to_jsonb(shift); end if;
  if shift.closed_at is not null then raise exception '班別已關閉，請重新載入'; end if;
  if p_action='opening_correct' then
   if not isadmin then raise exception '只有管理者可更正開班備用金'; end if;
   if exists(select 1 from public.pos_movements_v77 m where m.id=pos_runtime_v844.id and m.tenant_id=tenant) then return jsonb_build_object('ok',true); end if;
   amount:=(p_data->>'amount')::numeric;
   if amount is null or amount<0 or amount::text in ('NaN','Infinity','-Infinity') or length(trim(coalesce(p_data->>'reason','')))=0 then raise exception '更正備用金須為非負數，並填寫原因'; end if;
   amount:=amount-shift.opening-(select coalesce(sum(m.amount),0) from public.pos_movements_v77 m where m.shift_id=shift.id and m.kind='opening_adjust');
   insert into public.pos_movements_v77 values(id,tenant,shift.id,'opening_adjust',amount,'現金',p_data->>'reason',null,actor,now());
   insert into public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) values(tenant,shift.id,'更正開班備用金',to_jsonb(shift),p_data,actor);
   return jsonb_build_object('ok',true);
  end if;
  if p_action='movement' then
   if exists(select 1 from public.pos_movements_v77 m where m.id=pos_runtime_v844.id and m.tenant_id=tenant) then return jsonb_build_object('ok',true); end if;
   amount:=(p_data->>'amount')::numeric;method:=coalesce(p_data->>'method','現金');
   if amount is null or amount<=0 or amount::text in ('NaN','Infinity','-Infinity') or length(trim(coalesce(p_data->>'reason','')))=0 then raise exception '金額須大於零，並填寫原因'; end if;
   if p_data->>'kind' not in ('in','out','refund') then raise exception '無效現金異動'; end if;
   if p_data->>'kind'='refund' and coalesce(p_data->>'reference','')='' then raise exception '退款必須填原帳單號或退款憑證'; end if;
   if method not in ('現金','信用卡','轉帳','行動支付') or (p_data->>'kind'<>'refund' and method<>'現金') then raise exception '異動付款方式不正確'; end if;
   insert into public.pos_movements_v77 values(id,tenant,shift.id,p_data->>'kind',amount,method,p_data->>'reason',p_data->>'reference',actor,now());
   return jsonb_build_object('ok',true);
  end if;
  expected:=shift.opening+(select coalesce(sum(case when m.kind in ('payment','in','opening_adjust') then m.amount else -m.amount end),0) from public.pos_movements_v77 m where m.tenant_id=tenant and m.shift_id=shift.id and m.method='現金');
  counted:=(p_data->>'counted')::numeric;
  if counted is null or counted<0 or counted::text in ('NaN','Infinity','-Infinity') then raise exception '清點金額不正確'; end if;
  for denomination in select key,value from jsonb_each_text(p_data->'denominations') loop
   if denomination.key not in ('2000','1000','500','200','100','50','20','10','5','1') or denomination.value::numeric<0 or denomination.value::numeric<>trunc(denomination.value::numeric) then raise exception '面額張數不正確'; end if;
   denom_total:=denom_total+denomination.key::numeric*denomination.value::numeric;
  end loop;
  if denom_total<>counted then raise exception '面額清點加總不符'; end if;
  if expected<>counted and length(trim(coalesce(p_data->>'reason','')))=0 then raise exception '有差額，請填寫原因'; end if;
  update public.pos_shifts_v77 set closed_by=actor,closed_at=now(),counted=pos_runtime_v844.counted,expected=pos_runtime_v844.expected,difference=pos_runtime_v844.counted-pos_runtime_v844.expected,reason=p_data->>'reason',denominations=p_data->'denominations' where pos_shifts_v77.id=shift.id returning * into shift;
  insert into public.pos_audit_v77(tenant_id,entity_id,action,after_data,actor) values(tenant,shift.id,'交班',to_jsonb(shift),actor);
  return to_jsonb(shift);
 elsif p_action in ('pay','direct') then
  -- One request ID must be retained on ambiguous network failures.
  request_payload:=p_data;
  select * into prior from public.pos_requests_v77 where pos_requests_v77.id=pos_runtime_v844.id;
  if prior.id is not null then
   if prior.tenant_id<>tenant or prior.payload<>request_payload then raise exception '同一收款請求不能更改內容'; end if;
   return prior.result;
  end if;
  method:=p_data->>'method';if method not in ('現金','信用卡','轉帳','行動支付') then raise exception '請選擇實際收款方式；未付款請送待付款'; end if;
  select * into shift from public.pos_shifts_v77 where tenant_id=tenant and closed_at is null for update;
  if shift.id is null or shift.id::text is distinct from p_data->>'shift_id' then raise exception '請先開班，並重新確認本次班別'; end if;
  if p_action='pay' then
   select * into pending from public.pos_pending_v77 where tenant_id=tenant and pos_pending_v77.id=(p_data->>'pending_id')::uuid for update;
   if pending.id is null then raise exception '待付款帳單不存在'; end if;
   if pending.state='paid' then raise exception '這筆帳單已由櫃台完成收款，請勿再次收錢'; end if;
   if pending.state<>'pending' or pending.version is distinct from (p_data->>'version')::integer then raise exception '帳單已更新，請重載後核對'; end if;
   d:=pending.draft;perform public.pos_validate_draft_v77(d);
   args:=jsonb_build_object('p_tenant_id',tenant,'p_owner_id',d->'ownerId','p_pet_id',d->'billingPetId','p_checkout_type','門診收費 ('||method||')','p_category','門診','p_appointment_id',d->'billingAppointmentId','p_subtotal',d->'subtotal','p_discount',d->'discount','p_total',d->'total','p_lines',d->'lines','p_request_id',id);
   if jsonb_array_length(d->'medicationGroups')>0 then args:=args||jsonb_build_object('p_medication_groups',d->'medicationGroups');end if;
   result:=public.pos_call_checkout_v77(case when args ? 'p_medication_groups' then 'checkout_clinic_medicine_groups_v64' else 'checkout_clinic_doctor_v57' end,args);
   amount:=(d->>'total')::numeric;
  else
   payload:=p_data->'payload';args:=payload->'args';
   if args->>'p_tenant_id' is distinct from tenant then raise exception '院所不符'; end if;
   if payload->>'name'='checkout_family_v74' then
    amount:=0;
    for entry in select value from jsonb_array_elements(args->'p_entries') loop
     if exists(select 1 from public.pos_pending_v77 q where q.tenant_id=tenant and q.appointment_id::text=entry->>'p_appointment_id' and q.state in ('pending','paid')) then raise exception '此帳單已送櫃台，請從待付款接手'; end if;
     amount:=amount+(entry->>'p_total')::numeric;
    end loop;
   else
    if exists(select 1 from public.pos_pending_v77 q where q.tenant_id=tenant and q.appointment_id::text=args->>'p_appointment_id' and q.state in ('pending','paid')) then raise exception '此帳單已送櫃台，請從待付款接手'; end if;
    amount:=(args->>'p_total')::numeric;
   end if;
   result:=public.pos_call_checkout_v77(payload->>'name',args);
  end if;
  if result is null or result='null'::jsonb or coalesce((result->>'voided')::boolean,false) then raise exception '未取得有效結帳結果'; end if;
  if (p_action='pay' or payload->>'name' in ('checkout_clinic_doctor_v57','checkout_clinic_medicine_groups_v64')) and nullif(result->>'invoice_id','') is null then raise exception '未取得門診帳單確認'; end if;
  if payload->>'name'='checkout_family_v74' and (result->>'request_id' is distinct from args->>'p_request_id' or jsonb_typeof(result->'invoices')<>'array' or jsonb_array_length(result->'invoices')<>jsonb_array_length(args->'p_entries')) then raise exception '未取得完整合併收款確認'; end if;
  if amount is null or amount<0 or amount::text in ('NaN','Infinity','-Infinity') then raise exception '收款金額不正確'; end if;
  if method='現金' and coalesce(p_data->>'tendered','') in ('NaN','Infinity','-Infinity','') then raise exception '收到現金不正確'; end if;
  if method='現金' and coalesce((p_data->>'tendered')::numeric,0)<amount then raise exception '收到現金不足'; end if;
  insert into public.pos_movements_v77 values(id,tenant,shift.id,'payment',amount,method,'收款',coalesce(result->>'invoice_id',result->>'request_id',result#>>'{}'),actor,now());
  insert into public.pos_requests_v77(id,tenant_id,payload,result,actor) values(id,tenant,request_payload,result,actor);
  if p_action='pay' then
   update public.pos_pending_v77 set state='paid',paid_result=result,version=version+1,updated_by=actor,updated_at=now() where pos_pending_v77.id=pending.id;
   insert into public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) values(tenant,pending.id,'收款',to_jsonb(pending),result,actor);
  end if;
  return result;
 else raise exception '不支援的櫃台操作';end if;
end $_$;

ALTER FUNCTION "public"."pos_core_v845"("p_action" "text", "p_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_day_v845"("p_tenant" "text", "p_shift" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE v_day date;v_open numeric;v_parts jsonb;v_methods jsonb;v_receipts jsonb;v_expected numeric;v_revision text;v_legacy jsonb;
BEGIN
 SELECT (s.opened_at AT TIME ZONE 'Asia/Taipei')::date INTO v_day FROM public.pos_shifts_v77 s WHERE s.id=p_shift AND s.tenant_id=p_tenant;
 IF v_day IS NULL THEN RETURN NULL; END IF;
 SELECT s.opening INTO v_open FROM public.pos_shifts_v77 s WHERE s.tenant_id=p_tenant AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=v_day ORDER BY s.opened_at,s.id LIMIT 1;
 SELECT jsonb_build_object('opening',v_open,
 'payment',coalesce(sum(m.amount) FILTER(WHERE m.kind='payment'),0),
 'refund',coalesce(sum(m.amount) FILTER(WHERE m.kind='refund'),0),
 'in',coalesce(sum(m.amount) FILTER(WHERE m.kind='in'),0),
 'out',coalesce(sum(m.amount) FILTER(WHERE m.kind='out'),0),
 'opening_adjust',coalesce(sum(m.amount) FILTER(WHERE m.kind='opening_adjust'),0)) INTO v_parts
 FROM public.pos_movements_v77 m JOIN public.pos_shifts_v77 s ON s.id=m.shift_id AND s.tenant_id=p_tenant
 WHERE m.tenant_id=p_tenant AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=v_day AND m.method='現金';
 v_expected:=(v_parts->>'opening')::numeric+(v_parts->>'payment')::numeric-(v_parts->>'refund')::numeric+(v_parts->>'in')::numeric-(v_parts->>'out')::numeric+(v_parts->>'opening_adjust')::numeric;
 SELECT coalesce(jsonb_agg(x ORDER BY x.method),'[]'::jsonb) INTO v_methods FROM (
 SELECT m.method,sum(CASE WHEN m.kind='refund' THEN -m.amount ELSE m.amount END) total,
 coalesce(sum(CASE WHEN m.kind='refund' THEN -m.amount ELSE m.amount END) FILTER(WHERE EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=p_tenant AND a.entity_id=m.id AND a.action='receipt_verified_v845')),0) verified,
 count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=p_tenant AND a.entity_id=m.id AND a.action='receipt_verified_v845')) pending_count
 FROM public.pos_movements_v77 m JOIN public.pos_shifts_v77 s ON s.id=m.shift_id AND s.tenant_id=p_tenant
 WHERE m.tenant_id=p_tenant AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=v_day AND m.kind IN('payment','refund') GROUP BY m.method)x;
 SELECT coalesce(jsonb_agg(x ORDER BY x.created_at,x.id),'[]'::jsonb) INTO v_receipts FROM (
 SELECT m.*,EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=p_tenant AND a.entity_id=m.id AND a.action='receipt_verified_v845') verified,
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'total_amount',i.total_amount,'voided_at',i.voided_at)) FROM public.pos_invoice_links_v845(p_tenant) l JOIN public.invoices i ON i.id::text=l.invoice_id AND i.tenant_id::text=p_tenant WHERE l.movement_id=m.id),'[]'::jsonb) invoices
 FROM public.pos_movements_v77 m JOIN public.pos_shifts_v77 s ON s.id=m.shift_id AND s.tenant_id=p_tenant
 WHERE m.tenant_id=p_tenant AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=v_day AND m.kind IN('payment','refund'))x;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'created_at',i.created_at,'total_amount',i.total_amount,'checkout_type',i.checkout_type) ORDER BY i.created_at),'[]'::jsonb) INTO v_legacy
 FROM public.invoices i WHERE i.tenant_id::text=p_tenant AND (i.created_at AT TIME ZONE 'Asia/Taipei')::date=v_day AND i.voided_at IS NULL
 AND i.checkout_type NOT LIKE '%未付款%' AND NOT EXISTS(SELECT 1 FROM public.pos_invoice_links_v845(p_tenant) l WHERE l.invoice_id=i.id::text);
 -- Includes all money movements and invoice void changes; stale forms cannot verify newer transactions.
 SELECT md5(coalesce(string_agg(m.id::text||':'||m.kind||':'||m.amount::text||':'||m.method,',' ORDER BY m.id),'')||v_receipts::text||v_legacy::text||v_parts::text) INTO v_revision
 FROM public.pos_movements_v77 m JOIN public.pos_shifts_v77 s ON s.id=m.shift_id AND s.tenant_id=p_tenant
 WHERE m.tenant_id=p_tenant AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=v_day;
 RETURN jsonb_build_object('business_date',v_day,'expected',v_expected,'cash_parts',v_parts,'methods',v_methods,'receipts',v_receipts,'legacy',v_legacy,'revision',v_revision);
END;$$;

ALTER FUNCTION "public"."pos_day_v845"("p_tenant" "text", "p_shift" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_guard_pending_visit_v77"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
 if new.status='診間看診中' and exists(select 1 from public.pos_pending_v77 q where q.tenant_id=new.tenant_id::text and q.appointment_id=new.id and q.state='pending') then
  raise exception '此掛號已完成看診並送至待付款，請由櫃台接手';
 end if;
 return new;
end $$;

ALTER FUNCTION "public"."pos_guard_pending_visit_v77"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_invoice_links_v845"("p_tenant" "text") RETURNS TABLE("invoice_id" "text", "movement_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
 SELECT DISTINCT i.id::text,m.id
 FROM public.invoices i JOIN public.pos_movements_v77 m
 ON m.tenant_id=p_tenant AND m.kind='payment' AND m.reference=i.id::text
 WHERE i.tenant_id::text=p_tenant
 UNION
 SELECT DISTINCT i.id::text,m.id
 FROM public.pos_requests_v77 r
 JOIN public.pos_movements_v77 m ON m.id=r.id AND m.tenant_id=p_tenant AND m.kind='payment'
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.result->'invoices')='array' THEN r.result->'invoices' ELSE '[]'::jsonb END) e
 JOIN public.invoices i ON i.id::text=e->>'invoice_id' AND i.tenant_id::text=p_tenant
 WHERE r.tenant_id=p_tenant;
$$;

ALTER FUNCTION "public"."pos_invoice_links_v845"("p_tenant" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_movement_correction_v9119"("p_action" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
#variable_conflict error
declare
 v_tenant text:=public.current_tenant_id()::text;v_actor uuid:=auth.uid();v_profile jsonb;
 v_m public.pos_movements_v77;v_a public.pos_audit_v77;v_event uuid;v_reason text;v_result jsonb;
 v_start date;v_end date;v_offset integer;v_rows jsonb;v_day date;
begin
 if v_actor is null or v_tenant is null then raise exception '請先登入有效院所';end if;
 select to_jsonb(u) into v_profile from public.user_profiles u where u.user_id=v_actor and u.tenant_id::text=v_tenant;
 if v_profile is null or (v_profile->>'role') is distinct from 'admin' then raise exception '只有管理者可查詢及撤銷誤記異動';end if;
 perform pg_advisory_xact_lock(hashtextextended('pos_v77:'||v_tenant,0));
 if p_action='list' then
  v_start:=(p_data->>'start')::date;v_end:=(p_data->>'end')::date;v_offset:=coalesce((p_data->>'offset')::integer,0);
  if v_start is null or v_end is null or v_end<v_start or v_end-v_start>365 or v_offset<0 then raise exception '請選擇有效的日期範圍（最多一年）';end if;
  select coalesce(jsonb_agg(x order by x.created_at desc,x.id desc),'[]'::jsonb) into v_rows from (
   select m.*,s.closed_at is not null as shift_closed,(s.opened_at at time zone 'Asia/Taipei')::date as business_date,
    a.created_at as corrected_at,a.actor as corrected_by,a.before_data as original,a.after_data->>'reason' as correction_reason
   from public.pos_movements_v77 m join public.pos_shifts_v77 s on s.id=m.shift_id and s.tenant_id=v_tenant
   left join lateral (select z.* from public.pos_audit_v77 z where z.tenant_id=v_tenant and z.entity_id=m.id and z.action='movement_void_v9119' order by z.id desc limit 1) a on true
   where m.tenant_id=v_tenant and m.kind in ('refund','in','out')
    and m.created_at>=v_start::timestamp at time zone 'Asia/Taipei'
    and m.created_at<(v_end+1)::timestamp at time zone 'Asia/Taipei'
   order by m.created_at desc,m.id desc limit 51 offset v_offset
  ) x;
  return jsonb_build_object('tenant_id',v_tenant,'rows',v_rows);
 elsif p_action='void' then
  v_event:=(p_data->>'id')::uuid;v_reason:=trim(coalesce(p_data->>'reason',''));
  if v_event is null or length(v_reason)<2 then raise exception '請填寫撤銷原因';end if;
  select m.* into v_m from public.pos_movements_v77 m where m.tenant_id=v_tenant and m.id=(p_data->>'movement_id')::uuid for update;
  if v_m.id is null then raise exception '找不到本院異動紀錄';end if;
  if v_m.kind not in ('refund','in','out') then raise exception '此功能僅能撤銷誤記退款、補入或取出；收款帳單請用原作廢流程';end if;
  select a.* into v_a from public.pos_audit_v77 a where a.tenant_id=v_tenant and a.entity_id=v_m.id and a.action='movement_void_v9119' order by a.id desc limit 1;
  if v_a.id is not null then return v_a.after_data||jsonb_build_object('already_corrected',true);end if;
  if exists(select 1 from public.pos_audit_v77 a where a.tenant_id=v_tenant and a.action='movement_void_v9119' and a.after_data->>'request_id'=v_event::text)
   then raise exception '此更正請求已用於另一筆異動';end if;
  if v_m.amount<=0 or v_m.amount is distinct from (p_data->>'expected_amount')::numeric then raise exception '金額已更新，請重新查詢核對';end if;
  select (s.opened_at at time zone 'Asia/Taipei')::date into v_day from public.pos_shifts_v77 s where s.id=v_m.shift_id and s.tenant_id=v_tenant;
  if v_day is null then raise exception '班別資料不符';end if;
  -- Retain identity/kind/reference/date: all current v85 sums now use zero.
  -- Full original row, actor and date remain immutable in the correction audit.
  update public.pos_movements_v77 m set amount=0 where m.tenant_id=v_tenant and m.id=v_m.id;
  v_result:=jsonb_build_object('ok',true,'movement_id',v_m.id,'request_id',v_event,'reason',v_reason,'original_amount',v_m.amount,'effective_amount',0,'business_date',v_day,'corrected_at',now(),'corrected_by',v_actor);
  insert into public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor)
   values(v_tenant,v_m.id,'movement_void_v9119',to_jsonb(v_m),v_result,v_actor);
  -- Zeroed refunds must not remain as an unverified, zero-value pending refund.
  -- Prior verification history is retained when it exists.
  if v_m.kind='refund' and not exists(select 1 from public.pos_audit_v77 a where a.tenant_id=v_tenant and a.entity_id=v_m.id and a.action='receipt_verified_v845') then
   insert into public.pos_audit_v77(tenant_id,entity_id,action,after_data,actor)
    values(v_tenant,v_m.id,'receipt_verified_v845',jsonb_build_object('method',v_m.method,'amount',0,'kind',v_m.kind,'operation_id',v_event,'business_date',v_day,'settled_date',v_day,'evidence','誤記撤銷：'||v_reason,'correction_action','movement_void_v9119'),v_actor);
  end if;
  return v_result;
 else raise exception '不支援的更正操作';end if;
end $$;

ALTER FUNCTION "public"."pos_movement_correction_v9119"("p_action" "text", "p_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_paid_progress_v854"("p_tenant" "text") RETURNS TABLE("row_data" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
 WITH candidates AS (
 SELECT to_jsonb(q) AS d,i.created_at FROM public.pos_pending_v77 q JOIN public.invoices i ON i.id::text=q.paid_result->>'invoice_id' AND i.tenant_id::text=p_tenant WHERE q.tenant_id=p_tenant AND q.state='paid' AND i.voided_at IS NULL
 UNION ALL
 SELECT jsonb_build_object('id',a.entity_id,'draft',a.after_data->'draft','state','paid','dispensing',coalesce(a.after_data->>'dispensing','未調劑'),'version',(a.after_data->>'version')::integer,'updated_at',coalesce(a.after_data->>'updated_at',i.created_at::text),'updated_by',coalesce(a.after_data->>'updated_by',a.actor::text),'reissue_progress',true),i.created_at FROM public.pos_audit_v77 a JOIN public.invoices i ON i.id::text=a.after_data->>'new_invoice_id' AND i.tenant_id::text=p_tenant WHERE a.tenant_id=p_tenant AND a.action='reissue_draft_v854' AND a.after_data->>'state'='paid' AND i.voided_at IS NULL
 )
 SELECT c.d FROM candidates c WHERE (c.created_at AT TIME ZONE 'Asia/Taipei')::date=(now() AT TIME ZONE 'Asia/Taipei')::date OR (c.d->>'dispensing'<>'已交付' AND (EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(c.d#>'{draft,lines}','[]'::jsonb)) l WHERE l->>'stock_kind'='medicine') OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(c.d#>'{draft,medicationGroups}','[]'::jsonb)) g WHERE jsonb_array_length(coalesce(g->'drugs','[]'::jsonb))>0)));
$$;

ALTER FUNCTION "public"."pos_paid_progress_v854"("p_tenant" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_reissue_source_v854"("p_tenant" "text", "p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
#variable_conflict error
DECLARE i public.invoices;d jsonb;a jsonb;l jsonb;g jsonb;groups jsonb:='[]';lines jsonb:='[]';kind text;label text;drug jsonb;
BEGIN
 SELECT x.* INTO i FROM public.invoices x WHERE x.id=p_id AND x.tenant_id::text=p_tenant;
 IF i.id IS NULL THEN RAISE EXCEPTION '找不到本院原帳單'; END IF;
 SELECT q.draft INTO d FROM public.pos_pending_v77 q WHERE q.tenant_id=p_tenant AND q.paid_result->>'invoice_id'=p_id::text LIMIT 1;
 IF d IS NULL THEN
  SELECT r.payload#>'{payload,args}' INTO a FROM public.pos_requests_v77 r WHERE r.tenant_id=p_tenant AND (r.result->>'invoice_id'=p_id::text OR r.result#>>'{}'=p_id::text) LIMIT 1;
  IF a IS NULL THEN
   SELECT e.entry INTO a FROM public.pos_requests_v77 r
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.result->'invoices')='array' THEN r.result->'invoices' ELSE '[]'::jsonb END) WITH ORDINALITY z(entry,n)
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.payload#>'{payload,args,p_entries}')='array' THEN r.payload#>'{payload,args,p_entries}' ELSE '[]'::jsonb END) WITH ORDINALITY e(entry,n)
   WHERE r.tenant_id=p_tenant AND z.entry->>'invoice_id'=p_id::text AND e.n=z.n LIMIT 1;
  END IF;
  IF a IS NOT NULL THEN d:=jsonb_build_object('lines',a->'p_lines','medicationGroups',coalesce(a->'p_medication_groups','[]'::jsonb));
  ELSIF jsonb_typeof(i.checkout_payload_v57->'lines')='array' THEN
   -- Rebuild grouped medication from the authoritative checkout payload, never names alone.
   FOR kind IN SELECT DISTINCT split_part(x->>'item_name',':',2) FROM jsonb_array_elements(i.checkout_payload_v57->'lines') x WHERE x->>'stock_kind'='medicine' AND x->>'item_name' LIKE '[用藥庫存v64:%' LOOP
    label:=CASE kind WHEN 'oral' THEN '口服藥' WHEN 'injection' THEN '針劑' WHEN 'other' THEN '其他用藥' END;
    IF label IS NULL THEN RAISE EXCEPTION '原處方分組不明，請由醫師重新開立'; END IF;
    SELECT jsonb_build_object('kind',kind,'price',(SELECT (x->>'unit_price')::numeric FROM jsonb_array_elements(i.checkout_payload_v57->'lines') x WHERE x->>'item_name'=label LIMIT 1),'drugs',jsonb_agg(jsonb_build_object('medicine_id',x->>'stock_id','quantity',x->'quantity','item_name',regexp_replace(x->>'item_name','^\[用藥庫存v64:[^]]+\] ','')))) INTO g FROM jsonb_array_elements(i.checkout_payload_v57->'lines') x WHERE x->>'stock_kind'='medicine' AND split_part(x->>'item_name',':',2)=kind AND x->>'item_name' LIKE '[用藥庫存v64:%';
    groups:=groups||jsonb_build_array(g);
   END LOOP;
   FOR l IN SELECT value FROM jsonb_array_elements(i.checkout_payload_v57->'lines') LOOP
    IF l->>'item_name' LIKE '[用藥庫存v64:%' OR (l->>'item_name' IN('口服藥','針劑','其他用藥') AND jsonb_array_length(groups)>0) THEN CONTINUE; END IF;
    lines:=lines||jsonb_build_array(l);
   END LOOP;
   d:=jsonb_build_object('lines',lines,'medicationGroups',groups);
  ELSE RAISE EXCEPTION '原單未保留完整庫存明細，不能安全帶入；請由門診或商品銷售重新開立'; END IF;
 END IF;
 d:=d||jsonb_build_object('ownerId',i.owner_id,'billingPetId',i.pet_id,'billingAppointmentId',NULL,'ownerName',coalesce((SELECT o.name FROM public.owners o WHERE o.id=i.owner_id AND o.tenant_id::text=p_tenant),'散客'),'billingPetName',coalesce((SELECT p.name FROM public.pets p WHERE p.id=i.pet_id AND p.tenant_id::text=p_tenant),'無指定寵物'),'subtotal',i.subtotal,'discount',i.discount,'total',i.total_amount,'medicationGroups',coalesce(d->'medicationGroups','[]'::jsonb));
 PERFORM public.pos_validate_draft_v77(d);
 RETURN jsonb_build_object('original_invoice_id',i.id,'kind',CASE WHEN i.checkout_type LIKE '商品零售%' THEN 'retail' ELSE 'clinic' END,'category',i.category,'draft',d);
END;$$;

ALTER FUNCTION "public"."pos_reissue_source_v854"("p_tenant" "text", "p_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_revenue_split_v853"("p_tenant" "text", "p_invoice" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
#variable_conflict error
DECLARE v_id text:=p_invoice->>'id';v_draft jsonb;v_args jsonb;v_lines jsonb;v_groups jsonb;v_row jsonb;
v_product numeric:=0;v_clinic numeric:=0;v_gross numeric;v_total numeric:=coalesce((p_invoice->>'total_amount')::numeric,0);
v_discount numeric:=coalesce((p_invoice->>'discount')::numeric,0);v_ratio numeric:=0;v_product_total numeric:=0;v_source text:='invoice';v_products jsonb:='[]'::jsonb;
v_has_product boolean:=false;v_has_clinic boolean:=false;
BEGIN
 IF p_invoice->>'tenant_id' IS DISTINCT FROM p_tenant OR NOT EXISTS(SELECT 1 FROM public.invoices i WHERE i.id::text=v_id AND i.tenant_id::text=p_tenant) THEN RAISE EXCEPTION '帳單院所不符'; END IF;
 SELECT q.draft INTO v_draft FROM public.pos_pending_v77 q WHERE q.tenant_id=p_tenant AND q.state='paid' AND q.paid_result->>'invoice_id'=v_id LIMIT 1;
 IF v_draft IS NOT NULL THEN
  v_lines:=v_draft->'lines';v_groups:=v_draft->'medicationGroups';v_source:='paid_pending';
 ELSE
  SELECT r.payload#>'{payload,args}' INTO v_args FROM public.pos_requests_v77 r WHERE r.tenant_id=p_tenant AND (r.result->>'invoice_id'=v_id OR r.result#>>'{}'=v_id) LIMIT 1;
  IF v_args IS NULL THEN
   SELECT a.entry INTO v_args FROM public.pos_requests_v77 r
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.result->'invoices')='array' THEN r.result->'invoices' ELSE '[]'::jsonb END) WITH ORDINALITY z(entry,n)
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.payload#>'{payload,args,p_entries}')='array' THEN r.payload#>'{payload,args,p_entries}' ELSE '[]'::jsonb END) WITH ORDINALITY a(entry,n)
   WHERE r.tenant_id=p_tenant AND z.entry->>'invoice_id'=v_id AND a.n=z.n LIMIT 1;
  END IF;
  IF v_args IS NOT NULL THEN v_lines:=v_args->'p_lines';v_groups:=v_args->'p_medication_groups';v_source:='paid_request'; END IF;
 END IF;
 IF jsonb_typeof(v_lines) IS DISTINCT FROM 'array' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(ii)),'[]'::jsonb) INTO v_lines FROM public.invoice_items ii WHERE ii.invoice_id::text=v_id;
 END IF;
 FOR v_row IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
  IF v_row->>'stock_kind'='item' OR p_invoice->>'checkout_type' LIKE '商品零售%' THEN
   v_product:=v_product+coalesce((v_row->>'quantity')::numeric,0)*coalesce((v_row->>'unit_price')::numeric,(v_row->>'price')::numeric,0);v_has_product:=true;v_products:=v_products||jsonb_build_array(v_row);
  ELSE
   v_clinic:=v_clinic+coalesce((v_row->>'quantity')::numeric,0)*coalesce((v_row->>'unit_price')::numeric,(v_row->>'price')::numeric,0);v_has_clinic:=true;
  END IF;
 END LOOP;
 FOR v_row IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_groups)='array' THEN v_groups ELSE '[]'::jsonb END) LOOP
  v_clinic:=v_clinic+coalesce((v_row->>'price')::numeric,0);v_has_clinic:=true;
 END LOOP;
 v_gross:=v_product+v_clinic;
 IF p_invoice->>'checkout_type' LIKE '商品零售%' THEN v_ratio:=1;v_has_product:=true;v_has_clinic:=false;
 ELSIF v_gross>0 THEN v_ratio:=v_product/v_gross;
 ELSE v_ratio:=0;v_has_clinic:=true; END IF;
 v_product_total:=round(v_total*v_ratio,2);
 RETURN jsonb_build_object('version',853,'source',v_source,'product_ratio',v_ratio,'product_gross',v_product,'clinic_gross',v_clinic,'product_total',v_product_total,'clinic_total',v_total-v_product_total,'product_discount',round(v_discount*v_ratio,2),'clinic_discount',v_discount-round(v_discount*v_ratio,2),'has_product',v_has_product,'has_clinic',v_has_clinic,'product_lines',v_products);
END;$$;

ALTER FUNCTION "public"."pos_revenue_split_v853"("p_tenant" "text", "p_invoice" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_review_v849"("p_tenant" "text", "p_shift" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE v_day jsonb;v_saved jsonb;v_valid boolean:=false;v_voided jsonb;v_net numeric;v_income numeric;v_shift public.pos_shifts_v77;
BEGIN
 SELECT s.* INTO v_shift FROM public.pos_shifts_v77 s WHERE s.tenant_id=p_tenant AND s.id=p_shift;
 IF v_shift.id IS NULL THEN RETURN NULL; END IF;
 v_day:=public.pos_day_v845(p_tenant,p_shift);
 SELECT jsonb_build_object('data',a.after_data,'actor',a.actor,'created_at',a.created_at,'action',a.action) INTO v_saved FROM public.pos_audit_v77 a WHERE a.tenant_id=p_tenant AND a.action IN('handover_v845','end_day_v845','confirm_income_v846') AND a.after_data->>'business_date'=v_day->>'business_date' ORDER BY a.id DESC LIMIT 1;
 IF v_saved IS NOT NULL THEN
  v_valid:=(CASE WHEN v_saved#>>'{data,cash_fingerprint}' IS NOT NULL THEN v_saved#>>'{data,cash_fingerprint}'=md5((v_day->'cash_parts')::text||coalesce((SELECT jsonb_agg(e-'verified' ORDER BY e->>'id')::text FROM jsonb_array_elements(v_day->'receipts') e),'[]')||(v_day->'legacy')::text) ELSE coalesce(v_saved#>>'{data,verified_revision}',v_saved#>>'{data,revision}')=v_day->>'revision' END)
   AND (v_saved#>>'{data,actual,現金}')::numeric=(v_day->>'expected')::numeric
   AND coalesce((v_saved#>>'{data,unresolved_methods}')::integer,1)=0;
 END IF;
 SELECT coalesce(sum((e->>'total')::numeric),0) INTO v_net FROM jsonb_array_elements(v_day->'methods') e WHERE e->>'method'='現金';
 SELECT coalesce(sum(i.total_amount-coalesce((SELECT sum(m.amount) FROM public.pos_movements_v77 m WHERE m.tenant_id=p_tenant AND m.kind='refund' AND m.method='現金' AND m.reference=i.id::text AND EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=p_tenant AND a.entity_id=m.id AND a.action='receipt_verified_v845')),0)),0) INTO v_income
 FROM public.invoices i WHERE i.tenant_id::text=p_tenant AND (i.created_at AT TIME ZONE 'Asia/Taipei')::date=(v_day->>'business_date')::date AND i.voided_at IS NULL AND i.checkout_type NOT LIKE '%未付款%' AND EXISTS(SELECT 1 FROM public.pos_invoice_links_v845(p_tenant) l JOIN public.pos_movements_v77 m ON m.id=l.movement_id AND m.tenant_id=p_tenant AND m.method='現金' WHERE l.invoice_id=i.id::text);
 SELECT coalesce(jsonb_agg(jsonb_build_object('invoice_id',i.id,'amount',i.total_amount,'void_reason',i.void_reason,'payment_method',m.method,'recorded_refunds',coalesce((SELECT sum(r.amount) FROM public.pos_movements_v77 r WHERE r.tenant_id=p_tenant AND r.kind='refund' AND r.reference=i.id::text AND r.method=m.method),0)) ORDER BY i.created_at),'[]'::jsonb) INTO v_voided
 FROM public.invoices i JOIN public.pos_invoice_links_v845(p_tenant) l ON l.invoice_id=i.id::text JOIN public.pos_movements_v77 m ON m.id=l.movement_id AND m.tenant_id=p_tenant
 JOIN public.pos_shifts_v77 s ON s.id=m.shift_id AND s.tenant_id=p_tenant
 WHERE i.tenant_id::text=p_tenant AND i.voided_at IS NOT NULL AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=(v_day->>'business_date')::date;
 RETURN jsonb_build_object('business_date',v_day->'business_date','expected',v_day->'expected','cash_parts',v_day->'cash_parts','cash_net',v_net,'valid_cash_invoice_net',v_income,'cash_ledger_invoice_difference',v_net-v_income,'voided_payments',v_voided,'saved',v_saved,'count_current',coalesce(v_valid,false),'original_closed_at',v_shift.closed_at,'original_counted',v_shift.counted,'original_expected',v_shift.expected,'original_difference',v_shift.difference);
END;$$;

ALTER FUNCTION "public"."pos_review_v849"("p_tenant" "text", "p_shift" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_v77"("p_action" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
#variable_conflict error
DECLARE v_tenant text:=public.current_tenant_id()::text;v_actor uuid:=auth.uid();v_profile jsonb;v_bill boolean;
v_shift public.pos_shifts_v77;v_day jsonb;v_base jsonb;v_event uuid;v_prior public.pos_audit_v77;v_payload jsonb;
v_actual jsonb;v_count numeric;v_denom numeric;v_reason text;v_method text;v_total numeric;v_match boolean;v_unresolved integer:=0;
v_record record;v_invoice public.invoices;v_ids jsonb;v_status jsonb;v_snap jsonb;v_link record;v_confirm public.pos_audit_v77;
v_summary_date date;v_summary_offset integer;v_summary jsonb;v_summary_unverified integer;v_summary_refunds numeric;v_summary_end jsonb;
BEGIN
 IF v_actor IS NULL OR v_tenant IS NULL THEN RAISE EXCEPTION '請先登入有效院所'; END IF;
 SELECT to_jsonb(u) INTO v_profile FROM public.user_profiles u WHERE u.user_id=v_actor AND u.tenant_id::text=v_tenant;
 IF v_profile IS NULL THEN RAISE EXCEPTION '無院所權限'; END IF;
 v_bill:=v_profile->>'role'='admin' OR coalesce((v_profile->>'permission_checkout')::boolean,v_profile->>'role'='staff' OR (v_profile->>'role'='doctor' AND coalesce((v_profile->>'can_checkout')::boolean,false)));
 IF p_action NOT IN('list','stage','dispensing','work_list_v854') AND NOT v_bill THEN RAISE EXCEPTION '沒有結帳與核對權限'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('pos_v77:'||v_tenant,0));
 IF p_action IN('dispensing','work_list_v854','void_safe_v854','reissue_prepare_v854','reissue_save_v854','reissue_cancel_v854','reissue_pay_v854','reissue_links_v854') THEN RETURN public.pos_work_v854(p_action,p_data); END IF;
 IF p_action='today_work' THEN
  v_event:=(p_data->>'id')::uuid;
  IF v_event IS NULL THEN RAISE EXCEPTION '缺少今日工作識別碼'; END IF;
  SELECT a.* INTO v_prior FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.entity_id=v_event AND a.action='today_work_v85';
  IF v_prior.id IS NOT NULL THEN
   IF v_prior.before_data->'request' IS DISTINCT FROM p_data THEN RAISE EXCEPTION '相同工作請求不可更改內容'; END IF;
   RETURN v_prior.after_data;
  END IF;
  SELECT s.* INTO v_shift FROM public.pos_shifts_v77 s WHERE s.tenant_id=v_tenant AND s.closed_at IS NULL FOR UPDATE;
  IF v_shift.id IS NOT NULL THEN
   IF (v_shift.opened_at AT TIME ZONE 'Asia/Taipei')::date<>(now() AT TIME ZONE 'Asia/Taipei')::date THEN RAISE EXCEPTION '前一日工作尚未結束，請先清點並結束該日工作'; END IF;
   v_payload:=jsonb_build_object('id',v_shift.id,'mode','active','business_date',(v_shift.opened_at AT TIME ZONE 'Asia/Taipei')::date);
   INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(v_tenant,v_event,'today_work_v85',jsonb_build_object('request',p_data),v_payload,v_actor);
   RETURN v_payload;
  END IF;
  SELECT s.* INTO v_shift FROM public.pos_shifts_v77 s WHERE s.tenant_id=v_tenant AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=(now() AT TIME ZONE 'Asia/Taipei')::date ORDER BY s.opened_at DESC,s.id DESC LIMIT 1 FOR UPDATE;
  IF v_shift.id IS NOT NULL THEN
   v_snap:=to_jsonb(v_shift);
   UPDATE public.pos_shifts_v77 s SET closed_at=NULL,closed_by=NULL,counted=NULL,expected=NULL,difference=NULL,reason=NULL,denominations=NULL WHERE s.id=v_shift.id AND s.tenant_id=v_tenant;
   v_payload:=jsonb_build_object('id',v_shift.id,'mode','resumed','business_date',(v_shift.opened_at AT TIME ZONE 'Asia/Taipei')::date,'opening',v_shift.opening,'original_closed_at',v_shift.closed_at,'original_counted',v_shift.counted,'original_expected',v_shift.expected,'original_difference',v_shift.difference);
   INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(v_tenant,v_event,'today_work_v85',jsonb_build_object('request',p_data,'closed_shift',v_snap),v_payload,v_actor);
   RETURN v_payload;
  END IF;
  v_base:=public.pos_core_v845('open',p_data);
  v_payload:=jsonb_build_object('id',v_base->'id','mode','started','business_date',(now() AT TIME ZONE 'Asia/Taipei')::date,'opening',v_base->'opening');
  INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(v_tenant,v_event,'today_work_v85',jsonb_build_object('request',p_data),v_payload,v_actor);
  RETURN v_payload;
 END IF;
 IF p_action='daily_summary' THEN
  SELECT coalesce((s.opened_at AT TIME ZONE 'Asia/Taipei')::date,(now() AT TIME ZONE 'Asia/Taipei')::date) INTO v_summary_date FROM (SELECT 1) seed LEFT JOIN public.pos_shifts_v77 s ON s.tenant_id=v_tenant AND s.closed_at IS NULL;
  v_status:='[]'::jsonb;v_summary_offset:=0;
  LOOP
   SELECT coalesce(jsonb_agg(x.id),'[]'::jsonb) INTO v_ids FROM(SELECT i.id FROM public.invoices i WHERE i.tenant_id::text=v_tenant AND (i.created_at AT TIME ZONE 'Asia/Taipei')::date=v_summary_date ORDER BY i.id LIMIT 500 OFFSET v_summary_offset)x;
   EXIT WHEN jsonb_array_length(v_ids)=0;
   v_status:=v_status||(public.pos_v77('finance_status',jsonb_build_object('invoice_ids',v_ids))->'statuses');
   v_summary_offset:=v_summary_offset+500;
  END LOOP;
  v_summary:='[]'::jsonb;
  FOR v_invoice IN SELECT i.* FROM public.invoices i WHERE i.tenant_id::text=v_tenant AND (i.created_at AT TIME ZONE 'Asia/Taipei')::date=v_summary_date LOOP
   SELECT e INTO v_snap FROM jsonb_array_elements(v_status) e WHERE e->>'invoice_id'=v_invoice.id::text;
   v_total:=greatest(0,v_invoice.total_amount-coalesce((v_snap->>'confirmed_refunds')::numeric,0));
   v_payload:=v_snap->'revenue_split';
   v_count:=(v_payload->>'net_product_total')::numeric;
   v_summary:=v_summary||jsonb_build_array(jsonb_build_object('state',v_snap->>'state','amount',v_total,'clinic_amount',v_total-v_count,'product_amount',v_count));
  END LOOP;
  SELECT jsonb_build_object(
   'clinic_confirmed',coalesce(sum((e->>'clinic_amount')::numeric) FILTER(WHERE e->>'state'='verified'),0),
   'product_confirmed',coalesce(sum((e->>'product_amount')::numeric) FILTER(WHERE e->>'state'='verified'),0),
   'confirmed_total',coalesce(sum((e->>'amount')::numeric) FILTER(WHERE e->>'state'='verified'),0),
   'clinic_total',coalesce(sum((e->>'clinic_amount')::numeric) FILTER(WHERE e->>'state' IN('verified','pending','unlinked')),0),
   'product_total',coalesce(sum((e->>'product_amount')::numeric) FILTER(WHERE e->>'state' IN('verified','pending','unlinked')),0),
   'total',coalesce(sum((e->>'amount')::numeric) FILTER(WHERE e->>'state' IN('verified','pending','unlinked')),0),
   'pending_total',coalesce(sum((e->>'amount')::numeric) FILTER(WHERE e->>'state' IN('pending','unlinked')),0),
   'pending_count',count(*) FILTER(WHERE e->>'state' IN('pending','unlinked')),
   'legacy_count',count(*) FILTER(WHERE e->>'state'='unlinked'),
   'unpaid_total',coalesce(sum((e->>'amount')::numeric) FILTER(WHERE e->>'state'='unpaid'),0)) INTO v_summary FROM jsonb_array_elements(v_summary) e;
  SELECT count(*) INTO v_summary_unverified FROM public.pos_movements_v77 m JOIN public.pos_shifts_v77 s ON s.id=m.shift_id AND s.tenant_id=v_tenant WHERE m.tenant_id=v_tenant AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=v_summary_date AND m.kind IN('payment','refund') AND NOT EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.entity_id=m.id AND a.action='receipt_verified_v845');
  SELECT coalesce(sum(m.amount),0) INTO v_summary_refunds FROM public.pos_movements_v77 m JOIN public.pos_shifts_v77 s ON s.id=m.shift_id AND s.tenant_id=v_tenant WHERE m.tenant_id=v_tenant AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=v_summary_date AND m.kind='refund' AND NOT EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.entity_id=m.id AND a.action='receipt_verified_v845');
  SELECT a.after_data INTO v_summary_end FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.action='end_day_v845' AND a.after_data->>'business_date'=v_summary_date::text ORDER BY a.id DESC LIMIT 1;
  RETURN jsonb_build_object('tenant_id',v_tenant,'business_date',v_summary_date,'revenue_version',853,'unverified_movements',v_summary_unverified,'pending_refunds',v_summary_refunds,'end_day',v_summary_end,'work_state',CASE WHEN EXISTS(SELECT 1 FROM public.pos_shifts_v77 s WHERE s.tenant_id=v_tenant AND s.closed_at IS NULL) THEN 'active' WHEN EXISTS(SELECT 1 FROM public.pos_shifts_v77 s WHERE s.tenant_id=v_tenant AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=v_summary_date) THEN 'closed' ELSE 'not_started' END,'income_complete',(v_summary->>'pending_count')::integer=0 AND v_summary_unverified=0,'summary',v_summary,'drawer_review',(SELECT public.pos_review_v849(v_tenant,s.id) FROM public.pos_shifts_v77 s WHERE s.tenant_id=v_tenant AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=v_summary_date ORDER BY s.opened_at DESC,s.id DESC LIMIT 1));
 END IF;
 IF p_action='bank_pending' THEN
  IF coalesce((p_data->>'offset')::integer,0)<0 THEN RAISE EXCEPTION '分頁位置有誤'; END IF;
  RETURN jsonb_build_object('tenant_id',v_tenant,'total',(SELECT count(*) FROM public.pos_movements_v77 m WHERE m.tenant_id=v_tenant AND (m.method<>'現金' OR EXISTS(SELECT 1 FROM public.pos_shifts_v77 cs WHERE cs.id=m.shift_id AND cs.tenant_id=v_tenant AND cs.closed_at IS NOT NULL)) AND m.kind IN('payment','refund') AND NOT EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.entity_id=m.id AND a.action='receipt_verified_v845')),
  'rows',coalesce((SELECT jsonb_agg(x) FROM(SELECT m.* FROM public.pos_movements_v77 m WHERE m.tenant_id=v_tenant AND (m.method<>'現金' OR EXISTS(SELECT 1 FROM public.pos_shifts_v77 cs WHERE cs.id=m.shift_id AND cs.tenant_id=v_tenant AND cs.closed_at IS NOT NULL)) AND m.kind IN('payment','refund') AND NOT EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.entity_id=m.id AND a.action='receipt_verified_v845') ORDER BY m.created_at DESC,m.id LIMIT 50 OFFSET coalesce((p_data->>'offset')::integer,0))x),'[]'::jsonb));
 END IF;
 IF p_action='verify_bank' THEN
  v_event:=(p_data->>'id')::uuid;
  IF v_event IS NULL THEN RAISE EXCEPTION '缺少操作識別碼'; END IF;
  SELECT a.* INTO v_prior FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.entity_id=v_event AND a.action='verify_bank_v845';
  IF v_prior.id IS NOT NULL THEN IF v_prior.before_data IS DISTINCT FROM p_data THEN RAISE EXCEPTION '相同操作請求不可更改內容'; END IF; RETURN v_prior.after_data; END IF;
  SELECT m.* INTO v_record FROM public.pos_movements_v77 m WHERE m.tenant_id=v_tenant AND m.id=(p_data->>'movement_id')::uuid AND (m.method<>'現金' OR EXISTS(SELECT 1 FROM public.pos_shifts_v77 cs WHERE cs.id=m.shift_id AND cs.tenant_id=v_tenant AND cs.closed_at IS NOT NULL)) AND m.kind IN('payment','refund') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '待入帳款項不存在'; END IF;
  IF v_record.method='現金' AND v_profile->>'role'<>'admin' THEN RAISE EXCEPTION '舊日現金差異須由管理者查明並核對'; END IF;
  IF EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.entity_id=v_record.id AND a.action='receipt_verified_v845') THEN RAISE EXCEPTION '此款項已由其他人核對，請更新資料'; END IF;
  IF p_data->>'amount' IS NULL OR (p_data->>'amount')::numeric IS DISTINCT FROM v_record.amount OR trim(coalesce(p_data->>'evidence',''))='' THEN RAISE EXCEPTION '金額須相符並填寫交易／入帳憑證'; END IF;
  IF p_data->>'settled_date' IS NULL OR (p_data->>'settled_date')::date>(now() AT TIME ZONE 'Asia/Taipei')::date OR (p_data->>'settled_date')::date<(v_record.created_at AT TIME ZONE 'Asia/Taipei')::date THEN RAISE EXCEPTION '請填寫正確的實際入帳日期'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'total_amount',i.total_amount,'voided_at',i.voided_at)),'[]'::jsonb) INTO v_snap FROM public.pos_invoice_links_v845(v_tenant) l JOIN public.invoices i ON i.id::text=l.invoice_id AND i.tenant_id::text=v_tenant WHERE l.movement_id=v_record.id;
  INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,after_data,actor) VALUES(v_tenant,v_record.id,'receipt_verified_v845',jsonb_build_object('method',v_record.method,'amount',v_record.amount,'kind',v_record.kind,'invoices',v_snap,'operation_id',v_event,'evidence',p_data->>'evidence','settled_date',p_data->>'settled_date'),v_actor);
  v_payload:=jsonb_build_object('ok',true);
  INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(v_tenant,v_event,'verify_bank_v845',p_data,v_payload,v_actor);
  RETURN v_payload;
 END IF;
 IF p_action='finance_status' THEN
  IF jsonb_typeof(p_data->'invoice_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'invoice_ids')>500 THEN RAISE EXCEPTION '請分批查詢帳單'; END IF;
  v_status:='[]'::jsonb;
  FOR v_invoice IN SELECT i.* FROM public.invoices i WHERE i.tenant_id::text=v_tenant AND i.id::text IN(SELECT jsonb_array_elements_text(p_data->'invoice_ids')) LOOP
   v_confirm:=NULL;v_link:=NULL;
   SELECT l.* INTO v_link FROM public.pos_invoice_links_v845(v_tenant) l WHERE l.invoice_id=v_invoice.id::text LIMIT 1;
   IF v_link.movement_id IS NOT NULL THEN
    SELECT a.* INTO v_confirm FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.entity_id=v_link.movement_id AND a.action='receipt_verified_v845' ORDER BY a.created_at DESC,a.id DESC LIMIT 1;
   END IF;
   v_match:=false;
   IF v_confirm.id IS NOT NULL THEN
    SELECT e INTO v_snap FROM jsonb_array_elements(coalesce(v_confirm.after_data->'invoices','[]'::jsonb)) e WHERE e->>'id'=v_invoice.id::text;
    v_match:=v_snap IS NOT NULL AND (v_snap->>'total_amount')::numeric=v_invoice.total_amount AND v_snap->'voided_at' IS NOT DISTINCT FROM to_jsonb(v_invoice)->'voided_at';
   END IF;
   v_status:=v_status||jsonb_build_array(jsonb_build_object('invoice_id',v_invoice.id,'revenue_split',public.pos_revenue_split_v853(v_tenant,to_jsonb(v_invoice)),'state',CASE WHEN v_invoice.voided_at IS NOT NULL THEN 'voided' WHEN v_invoice.checkout_type LIKE '%未付款%' THEN 'unpaid' WHEN v_match THEN 'verified' WHEN v_link.movement_id IS NULL THEN 'unlinked' ELSE 'pending' END,'method',coalesce(v_confirm.after_data->>'method',(SELECT m.method FROM public.pos_movements_v77 m WHERE m.id=v_link.movement_id AND m.tenant_id=v_tenant)),'confirmed_refunds',coalesce((SELECT sum(m.amount) FROM public.pos_movements_v77 m WHERE m.tenant_id=v_tenant AND m.kind='refund' AND m.reference=v_invoice.id::text AND EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.entity_id=m.id AND a.action='receipt_verified_v845')),0),'pending_refunds',coalesce((SELECT sum(m.amount) FROM public.pos_movements_v77 m WHERE m.tenant_id=v_tenant AND m.kind='refund' AND m.reference=v_invoice.id::text AND NOT EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.entity_id=m.id AND a.action='receipt_verified_v845')),0),'settled_date',v_confirm.after_data->>'settled_date','verified_at',v_confirm.created_at,'verified_by',v_confirm.actor));
  END LOOP;
  SELECT coalesce(jsonb_agg(e||jsonb_build_object('revenue_split',(e->'revenue_split')||jsonb_build_object('net_product_total',round(n.net*(e#>>'{revenue_split,product_ratio}')::numeric,2),'net_clinic_total',n.net-round(n.net*(e#>>'{revenue_split,product_ratio}')::numeric,2)))),'[]'::jsonb) INTO v_status
  FROM jsonb_array_elements(v_status) e CROSS JOIN LATERAL (SELECT greatest(0,(e#>>'{revenue_split,product_total}')::numeric+(e#>>'{revenue_split,clinic_total}')::numeric-(e->>'confirmed_refunds')::numeric) AS net) n;
  RETURN jsonb_build_object('tenant_id',v_tenant,'statuses',v_status);
 END IF;
 IF p_action='close' THEN RAISE EXCEPTION '請更新至 v84_9，使用交班／結束今日工作核對'; END IF;
 IF p_action='list' THEN
  v_base:=public.pos_core_v845(p_action,p_data);
  IF NOT v_bill THEN RETURN v_base; END IF;
  -- New end-day records already contain the whole-day total; do not compare them with an old per-shift calculation.
  v_base:=jsonb_set(v_base,'{history}',coalesce((SELECT jsonb_agg(CASE WHEN EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.action='end_day_v845' AND a.after_data->>'id'=e->>'id') THEN e-'ledger_expected' ELSE e END) FROM jsonb_array_elements(v_base->'history') e),'[]'::jsonb));
  SELECT s.* INTO v_shift FROM public.pos_shifts_v77 s WHERE s.tenant_id=v_tenant AND s.closed_at IS NULL;
  IF v_shift.id IS NOT NULL THEN
   v_day:=public.pos_day_v845(v_tenant,v_shift.id);
   v_base:=v_base||jsonb_build_object('schema_version',850,'day',v_day,'expected',v_day->'expected','cash_parts',v_day->'cash_parts','methods',v_day->'methods','drawer_review',public.pos_review_v849(v_tenant,v_shift.id));
  ELSE
   SELECT s.* INTO v_shift FROM public.pos_shifts_v77 s WHERE s.tenant_id=v_tenant AND s.closed_at IS NOT NULL AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=(now() AT TIME ZONE 'Asia/Taipei')::date ORDER BY s.opened_at DESC,s.id DESC LIMIT 1;
   IF v_shift.id IS NOT NULL THEN
    v_day:=public.pos_day_v845(v_tenant,v_shift.id);
    v_base:=v_base||jsonb_build_object('schema_version',850,'review_shift',to_jsonb(v_shift),'day',v_day,'expected',v_day->'expected','cash_parts',v_day->'cash_parts','methods',v_day->'methods','drawer_review',public.pos_review_v849(v_tenant,v_shift.id));
   ELSE v_base:=v_base||jsonb_build_object('schema_version',850,'day',NULL); END IF;
  END IF;
  RETURN v_base||jsonb_build_object('handover_history',coalesce((SELECT jsonb_agg(x) FROM(SELECT a.id,a.action,a.actor,a.created_at,a.after_data FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND (a.action IN('handover_v845','end_day_v845','confirm_income_v846') OR (a.action='today_work_v85' AND a.after_data->>'mode'='resumed')) ORDER BY a.id DESC LIMIT 30)x),'[]'::jsonb));
 END IF;
 IF p_action IN('reconcile','adopt_legacy') THEN
  v_event:=(p_data->>'id')::uuid;
  IF v_event IS NULL THEN RAISE EXCEPTION '缺少操作識別碼'; END IF;
  SELECT a.* INTO v_prior FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.entity_id=v_event AND a.action IN('handover_v845','end_day_v845','confirm_income_v846','adopt_legacy_v845');
  IF v_prior.id IS NOT NULL THEN
   IF v_prior.before_data IS DISTINCT FROM p_data THEN RAISE EXCEPTION '相同操作請求不可更改內容'; END IF;
   RETURN v_prior.after_data;
  END IF;
  SELECT s.* INTO v_shift FROM public.pos_shifts_v77 s WHERE s.tenant_id=v_tenant AND s.id=(p_data->>'shift_id')::uuid AND (s.closed_at IS NULL OR (
   (p_action='adopt_legacy' OR (p_action='reconcile' AND p_data->>'mode'='confirm'))
   AND v_profile->>'role'='admin'
   AND (s.opened_at AT TIME ZONE 'Asia/Taipei')::date=(now() AT TIME ZONE 'Asia/Taipei')::date
   AND NOT EXISTS(SELECT 1 FROM public.pos_shifts_v77 live WHERE live.tenant_id=v_tenant AND live.closed_at IS NULL)
   AND s.id=(SELECT last_s.id FROM public.pos_shifts_v77 last_s WHERE last_s.tenant_id=v_tenant AND (last_s.opened_at AT TIME ZONE 'Asia/Taipei')::date=(now() AT TIME ZONE 'Asia/Taipei')::date ORDER BY last_s.opened_at DESC,last_s.id DESC LIMIT 1)
  )) FOR UPDATE;
  IF v_shift.id IS NULL THEN RAISE EXCEPTION '今日錢櫃已結束或不存在，請重新更新'; END IF;
  v_day:=public.pos_day_v845(v_tenant,v_shift.id);
  IF p_data->>'revision' IS DISTINCT FROM v_day->>'revision' THEN RAISE EXCEPTION '收款或核對資料已更新，請重新核對各付款方式'; END IF;
  v_reason:=trim(coalesce(p_data->>'reason',''));
  IF v_shift.closed_at IS NOT NULL AND v_reason='' THEN RAISE EXCEPTION '下班後補核對須填寫原因與核對憑證；保留原下班紀錄'; END IF;
  IF p_action='adopt_legacy' THEN
   IF v_profile->>'role'<>'admin' THEN RAISE EXCEPTION '只有管理者可納入舊版帳單'; END IF;
   IF v_reason='' THEN RAISE EXCEPTION '請填寫舊款納入原因'; END IF;
   v_method:=p_data->>'method';IF v_method NOT IN('現金','信用卡','轉帳','行動支付') THEN RAISE EXCEPTION '請選擇實際付款方式'; END IF;
   SELECT i.* INTO v_invoice FROM public.invoices i WHERE i.tenant_id::text=v_tenant AND i.id=(p_data->>'invoice_id')::uuid FOR UPDATE;
   IF v_invoice.id IS NULL OR v_invoice.voided_at IS NOT NULL OR v_invoice.checkout_type LIKE '%未付款%' OR (v_invoice.created_at AT TIME ZONE 'Asia/Taipei')::date IS DISTINCT FROM (v_day->>'business_date')::date OR EXISTS(SELECT 1 FROM public.pos_invoice_links_v845(v_tenant) l WHERE l.invoice_id=v_invoice.id::text) THEN RAISE EXCEPTION '帳單已納入、已作廢或不屬於今日'; END IF;
   IF v_invoice.checkout_type LIKE '%信用卡%' AND v_method<>'信用卡' OR v_invoice.checkout_type LIKE '%轉帳%' AND v_method<>'轉帳' OR v_invoice.checkout_type LIKE '%現金%' AND v_method<>'現金' THEN RAISE EXCEPTION '付款方式與原帳單不符'; END IF;
   INSERT INTO public.pos_movements_v77(id,tenant_id,shift_id,kind,amount,method,reason,reference,actor) VALUES(v_event,v_tenant,v_shift.id,'payment',v_invoice.total_amount,v_method,'舊款納入：'||v_reason,v_invoice.id::text,v_actor);
   v_payload:=jsonb_build_object('ok',true,'invoice_id',v_invoice.id);
   INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(v_tenant,v_event,'adopt_legacy_v845',p_data,v_payload,v_actor);
   RETURN v_payload;
  END IF;
  IF p_data->>'mode' NOT IN('confirm','handover','end_day') THEN RAISE EXCEPTION '請選擇交班或下班'; END IF;
  IF p_data->>'mode'='handover' AND length(trim(coalesce(p_data->>'recipient','')))=0 THEN RAISE EXCEPTION '請填寫接班人'; END IF;
  v_actual:=p_data->'actual';
  IF jsonb_typeof(v_actual) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION '請填寫各付款方式實際核對金額'; END IF;
  FOREACH v_method IN ARRAY ARRAY['現金','信用卡','轉帳','行動支付'] LOOP
   IF NOT v_actual ? v_method OR v_actual->>v_method IS NULL OR (v_method='現金' AND (v_actual->>v_method)::numeric<0) OR (v_actual->>v_method)::numeric::text IN('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION '現金須為非負数，其餘請填實際淨額'; END IF;
  END LOOP;
  v_count:=(v_actual->>'現金')::numeric;
  IF jsonb_typeof(p_data->'denominations') IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_data->'denominations'))<>10 THEN RAISE EXCEPTION '請完成現金面額清點'; END IF;
  v_denom:=0;
  FOR v_record IN SELECT key,value FROM jsonb_each_text(p_data->'denominations') LOOP
   IF v_record.value IS NULL OR v_record.key NOT IN('2000','1000','500','200','100','50','20','10','5','1') OR v_record.value::numeric<0 OR v_record.value::numeric<>trunc(v_record.value::numeric) OR v_record.value::numeric::text IN('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION '面額張數不正確'; END IF;
   v_denom:=v_denom+v_record.key::numeric*v_record.value::numeric;
  END LOOP;
  IF v_denom<>v_count THEN RAISE EXCEPTION '現金清點加總不符'; END IF;
  FOREACH v_method IN ARRAY ARRAY['現金','信用卡','轉帳','行動支付'] LOOP
   IF v_method='現金' THEN v_total:=(v_day->>'expected')::numeric;
   ELSE SELECT coalesce(sum((e->>'total')::numeric),0) INTO v_total FROM jsonb_array_elements(v_day->'methods') e WHERE e->>'method'=v_method; END IF;
   v_match:=(v_actual->>v_method)::numeric=v_total;
   IF v_match AND v_method<>'現金' AND EXISTS(SELECT 1 FROM jsonb_array_elements(v_day->'receipts') e WHERE e->>'method'=v_method AND NOT (e->>'verified')::boolean) AND length(trim(coalesce(p_data->'evidence'->>v_method,'')))=0 THEN RAISE EXCEPTION '請填寫 % 的交易／入帳核對憑證，尚未到帳請填實際金額並留下原因',v_method; END IF;
   IF NOT v_match THEN v_unresolved:=v_unresolved+1; END IF;
   IF v_match THEN
    FOR v_record IN SELECT e FROM jsonb_array_elements(v_day->'receipts') e WHERE e->>'method'=v_method AND NOT (e->>'verified')::boolean LOOP
     INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,after_data,actor) VALUES(v_tenant,(v_record.e->>'id')::uuid,'receipt_verified_v845',jsonb_build_object('method',v_method,'amount',v_record.e->'amount','kind',v_record.e->'kind','invoices',v_record.e->'invoices','operation_id',v_event,'business_date',v_day->'business_date','settled_date',v_day->>'business_date','evidence',p_data->'evidence'->>v_method),v_actor);
    END LOOP;
   END IF;
  END LOOP;
  IF p_data->>'mode'='confirm' AND v_unresolved>0 THEN RAISE EXCEPTION '確認今日入帳須各付款方式全部相符，未到帳款項請先保留待核對'; END IF;
  IF v_unresolved>0 AND v_reason='' THEN RAISE EXCEPTION '核對有差額，請填原因；不相符的款項會繼續待核對'; END IF;
  IF jsonb_array_length(v_day->'legacy')>0 THEN RAISE EXCEPTION '尚有未連結的今日舊版帳單，請先逐筆核對並納入今日錢櫃'; END IF;
  -- No exception after this point can leave partial verification; entire RPC is transactional.
  v_payload:=jsonb_build_object('ok',true,'id',v_shift.id,'business_date',v_day->'business_date','expected',v_day->'expected','actual',v_actual,'cash_difference',v_count-(v_day->>'expected')::numeric,'reason',v_reason,'recipient',p_data->>'recipient','unresolved_methods',v_unresolved,'closed_at',CASE WHEN p_data->>'mode'='end_day' THEN now() ELSE NULL END,'methods',v_day->'methods','revision',v_day->>'revision','supplement_after_close',v_shift.closed_at IS NOT NULL,'original_closed_at',v_shift.closed_at,'denominations',p_data->'denominations','cash_fingerprint',md5((v_day->'cash_parts')::text||coalesce((SELECT jsonb_agg(e-'verified' ORDER BY e->>'id')::text FROM jsonb_array_elements(v_day->'receipts') e),'[]')||(v_day->'legacy')::text),'verified_revision',public.pos_day_v845(v_tenant,v_shift.id)->>'revision');
  IF p_data->>'mode'='end_day' THEN
   UPDATE public.pos_shifts_v77 s SET closed_by=v_actor,closed_at=now(),counted=v_count,expected=(v_day->>'expected')::numeric,difference=v_count-(v_day->>'expected')::numeric,reason=v_reason,denominations=p_data->'denominations' WHERE s.id=v_shift.id AND s.tenant_id=v_tenant;
  END IF;
  INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(v_tenant,v_event,CASE WHEN p_data->>'mode'='end_day' THEN 'end_day_v845' WHEN p_data->>'mode'='confirm' THEN 'confirm_income_v846' ELSE 'handover_v845' END,p_data,v_payload,v_actor);
  RETURN v_payload;
 END IF;
 IF p_action='open' AND EXISTS(SELECT 1 FROM public.pos_audit_v77 a WHERE a.tenant_id=v_tenant AND a.action='end_day_v845' AND a.after_data->>'business_date'=(now() AT TIME ZONE 'Asia/Taipei')::date::text) THEN RAISE EXCEPTION '今日已完成最終結算，請勿再次開班'; END IF;
 IF p_action IN('direct','pay') THEN
  SELECT s.* INTO v_shift FROM public.pos_shifts_v77 s WHERE s.tenant_id=v_tenant AND s.closed_at IS NULL;
  IF v_shift.id IS NOT NULL AND (v_shift.opened_at AT TIME ZONE 'Asia/Taipei')::date<>(now() AT TIME ZONE 'Asia/Taipei')::date THEN RAISE EXCEPTION '前一日錢櫃尚未結束，請先完成該日結算再開今日工作'; END IF;
 END IF;
 RETURN public.pos_core_v845(p_action,p_data);
END;$$;

ALTER FUNCTION "public"."pos_v77"("p_action" "text", "p_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_validate_draft_v77"("d" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare l jsonb; total numeric:=0; disc numeric;
begin
 if jsonb_typeof(d->'lines')<>'array' or jsonb_typeof(d->'medicationGroups')<>'array' then raise exception '帳單格式不正確'; end if;
 for l in select value from jsonb_array_elements(d->'lines') loop
  if coalesce(l->>'item_name','')='' or (l->>'quantity')::numeric<=0 or (l->>'unit_price')::numeric<0
   or (l->>'quantity') is null or (l->>'unit_price') is null then raise exception '帳單數量或單價不正確'; end if;
  total:=total+(l->>'quantity')::numeric*(l->>'unit_price')::numeric;
 end loop;
 for l in select value from jsonb_array_elements(d->'medicationGroups') loop
  if (l->>'price') is null or (l->>'price')::numeric<0 then raise exception '藥費不正確'; end if;
  total:=total+(l->>'price')::numeric;
 end loop;
 disc:=(d->>'discount')::numeric;
 if disc is null or disc<0 or disc>total or total::text in ('NaN','Infinity','-Infinity')
  or abs(total-(d->>'subtotal')::numeric)>0.005 or abs(total-disc-(d->>'total')::numeric)>0.005
  or (d->>'total') is null or (d->>'subtotal') is null then raise exception '帳單合計不正確'; end if;
end $$;

ALTER FUNCTION "public"."pos_validate_draft_v77"("d" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pos_work_v854"("p_action" "text", "p_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
#variable_conflict error
DECLARE t text:=public.current_tenant_id()::text;u uuid:=auth.uid();profile jsonb;bill boolean;medical boolean;admin boolean;
q public.pos_pending_v77;a public.pos_audit_v77;prior public.pos_audit_v77;i public.invoices;s public.pos_shifts_v77;
e uuid;root uuid;d jsonb;old jsonb;result jsonb;args jsonb;src jsonb;v numeric;reason text;refunded numeric;field text;new_id uuid;v_version integer;
BEGIN
 SELECT to_jsonb(p) INTO profile FROM public.user_profiles p WHERE p.user_id=u AND p.tenant_id::text=t;
 IF u IS NULL OR t IS NULL OR profile IS NULL THEN RAISE EXCEPTION '請先登入本院帳號' USING ERRCODE='42501'; END IF;
 admin:=profile->>'role'='admin';bill:=admin OR coalesce((profile->>'permission_checkout')::boolean,profile->>'role'='staff' OR (profile->>'role'='doctor' AND coalesce((profile->>'can_checkout')::boolean,false)));
 medical:=admin OR coalesce((profile->>'permission_clinical')::boolean,profile->>'role'='doctor');
 PERFORM pg_advisory_xact_lock(hashtextextended('pos_v77:'||t,0));
 IF p_action='dispensing' THEN
  IF NOT (bill OR medical) THEN RAISE EXCEPTION '沒有調劑／交付權限' USING ERRCODE='42501'; END IF;

  IF NOT EXISTS(SELECT 1 FROM public.pos_pending_v77 x WHERE x.id=(p_data->>'id')::uuid AND x.tenant_id=t) THEN
   SELECT x.* INTO a FROM public.pos_audit_v77 x WHERE x.entity_id=(p_data->>'id')::uuid AND x.tenant_id=t AND x.action='reissue_draft_v854' FOR UPDATE;
   old:=a.after_data;
   IF a.id IS NULL OR old->>'state'<>'paid' OR (old->>'version')::integer IS DISTINCT FROM (p_data->>'version')::integer OR NOT EXISTS(SELECT 1 FROM public.invoices inv WHERE inv.id::text=old->>'new_invoice_id' AND inv.tenant_id::text=t AND inv.voided_at IS NULL) THEN RAISE EXCEPTION '重開帳單已更新或作廢，請重新載入'; END IF;
   IF p_data->>'value' NOT IN('未調劑','已調劑','已交付') OR p_data->>'value' IS NULL THEN RAISE EXCEPTION '請選擇正確進度'; END IF;
   IF array_position(ARRAY['未調劑','已調劑','已交付'],p_data->>'value')<array_position(ARRAY['未調劑','已調劑','已交付'],coalesce(old->>'dispensing','未調劑')) AND (NOT admin OR length(trim(coalesce(p_data->>'reason','')))<2) THEN RAISE EXCEPTION '退回較早進度須管理者填寫原因'; END IF;
   IF p_data->>'value'=coalesce(old->>'dispensing','未調劑') THEN RETURN jsonb_build_object('ok',true,'version',old->'version'); END IF;
   result:=old||jsonb_build_object('dispensing',p_data->>'value','version',(old->>'version')::integer+1,'updated_at',now(),'updated_by',u);
   UPDATE public.pos_audit_v77 x SET after_data=result WHERE x.id=a.id;
   INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(t,a.entity_id,'dispensing_v854',old,p_data,u);
   RETURN jsonb_build_object('ok',true,'version',result->'version');
  END IF;
  SELECT x.* INTO q FROM public.pos_pending_v77 x WHERE x.id=(p_data->>'id')::uuid AND x.tenant_id=t FOR UPDATE;
  IF q.id IS NULL OR q.state NOT IN('pending','paid') OR q.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION '帳單已更新，請重新載入'; END IF;
  IF p_data->>'value' NOT IN('未調劑','已調劑','已交付') OR p_data->>'value' IS NULL THEN RAISE EXCEPTION '請選擇正確進度'; END IF;
  IF q.state='paid' AND EXISTS(SELECT 1 FROM public.invoices x WHERE x.id::text=q.paid_result->>'invoice_id' AND x.tenant_id::text=t AND x.voided_at IS NOT NULL) THEN RAISE EXCEPTION '原單已作廢，請處理重開帳單'; END IF;
  IF array_position(ARRAY['未調劑','已調劑','已交付'],p_data->>'value')<array_position(ARRAY['未調劑','已調劑','已交付'],q.dispensing) AND (NOT admin OR length(trim(coalesce(p_data->>'reason','')))<2) THEN RAISE EXCEPTION '退回較早進度須管理者填寫原因'; END IF;
  IF q.dispensing=p_data->>'value' THEN RETURN jsonb_build_object('ok',true,'version',q.version); END IF;
  UPDATE public.pos_pending_v77 x SET dispensing=p_data->>'value',version=x.version+1,updated_by=u,updated_at=now() WHERE x.id=q.id;
  INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(t,q.id,'dispensing_v854',to_jsonb(q),p_data,u);
  RETURN jsonb_build_object('ok',true,'version',q.version+1);
 END IF;
 IF NOT bill AND NOT (p_action='work_list_v854' AND medical) THEN RAISE EXCEPTION '沒有帳款處理權限' USING ERRCODE='42501'; END IF;
 IF p_action='work_list_v854' THEN
  IF coalesce((p_data->>'offset')::integer,0)<0 OR coalesce((p_data->>'reissue_offset')::integer,0)<0 THEN RAISE EXCEPTION '分頁位置錯誤'; END IF;
  RETURN jsonb_build_object('tenant_id',t,'version',854,'paid_total',(SELECT count(*) FROM public.pos_paid_progress_v854(t)),
   'paid',coalesce((SELECT jsonb_agg(z.row_data) FROM(SELECT row_data FROM public.pos_paid_progress_v854(t) ORDER BY (row_data->>'updated_at')::timestamptz DESC,row_data->>'id' LIMIT 50 OFFSET coalesce((p_data->>'offset')::integer,0))z),'[]'::jsonb),
   'reissue_total',CASE WHEN bill THEN (SELECT count(*) FROM public.pos_audit_v77 x WHERE x.tenant_id=t AND x.action='reissue_draft_v854' AND x.after_data->>'state'='draft') ELSE 0 END,
   'reissues',coalesce((SELECT jsonb_agg(r) FROM(SELECT x.entity_id AS id,x.after_data,x.actor,x.created_at FROM public.pos_audit_v77 x WHERE x.tenant_id=t AND x.action='reissue_draft_v854' AND x.after_data->>'state'='draft' AND bill ORDER BY x.created_at DESC,x.id LIMIT 50 OFFSET coalesce((p_data->>'reissue_offset')::integer,0))r),'[]'::jsonb));
 END IF;
 IF p_action='reissue_links_v854' THEN
  IF jsonb_typeof(p_data->'invoice_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'invoice_ids')>500 THEN RAISE EXCEPTION '請分批查詢帳單'; END IF;
  RETURN jsonb_build_object('tenant_id',t,'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('draft_id',x.entity_id,'original_invoice_id',x.after_data->'original_invoice_id','new_invoice_id',x.after_data->'new_invoice_id','state',x.after_data->'state','reason',x.after_data->'reason','actor',x.actor,'created_at',x.created_at)) FROM public.pos_audit_v77 x WHERE x.tenant_id=t AND x.action='reissue_draft_v854' AND (x.after_data->>'original_invoice_id' IN(SELECT jsonb_array_elements_text(p_data->'invoice_ids')) OR x.after_data->>'new_invoice_id' IN(SELECT jsonb_array_elements_text(p_data->'invoice_ids')))),'[]'::jsonb));
 END IF;
 IF p_action='void_safe_v854' THEN
  IF NOT coalesce((p_data->>'stock_return_confirmed')::boolean,false) THEN RAISE EXCEPTION '請先確認原單藥品／商品已退回，或尚未實際交付'; END IF;
  PERFORM public.void_checkout_with_inventory((p_data->>'invoice_id')::uuid,p_data->>'reason');
  RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_action='reissue_prepare_v854' THEN
  e:=(p_data->>'id')::uuid;reason:=trim(coalesce(p_data->>'reason',''));
  IF e IS NULL OR length(reason)<2 THEN RAISE EXCEPTION '請填寫重新開立原因'; END IF;
  SELECT x.* INTO prior FROM public.pos_audit_v77 x WHERE x.tenant_id=t AND x.entity_id=e AND x.action='reissue_draft_v854' LIMIT 1;
  IF prior.id IS NOT NULL THEN IF prior.before_data->'request' IS DISTINCT FROM p_data THEN RAISE EXCEPTION '同一草稿請求不可更改'; END IF;RETURN prior.after_data; END IF;
  SELECT x.* INTO i FROM public.invoices x WHERE x.id=(p_data->>'invoice_id')::uuid AND x.tenant_id::text=t FOR UPDATE;
  IF i.id IS NULL OR i.voided_at IS NULL THEN RAISE EXCEPTION '請先作廢原單，再重新開立'; END IF;
  SELECT x.* INTO a FROM public.pos_audit_v77 x WHERE x.tenant_id=t AND x.action='reissue_draft_v854' AND x.after_data->>'original_invoice_id'=i.id::text AND x.after_data->>'state'<>'cancelled' ORDER BY x.id DESC LIMIT 1 FOR UPDATE;
  IF a.id IS NOT NULL THEN RETURN a.after_data||jsonb_build_object('id',a.entity_id); END IF;
  src:=public.pos_reissue_source_v854(t,i.id);result:=src||jsonb_build_object('id',e,'state','draft','version',1,'reason',reason);
  INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(t,e,'reissue_draft_v854',jsonb_build_object('invoice',to_jsonb(i),'source',src,'request',p_data),result,u);
  RETURN result;
 END IF;
 root:=(p_data->>'draft_id')::uuid;
 IF p_action='reissue_pay_v854' THEN
  e:=(p_data->>'id')::uuid;IF e IS NULL THEN RAISE EXCEPTION '缺少收款識別碼'; END IF;
  SELECT x.* INTO prior FROM public.pos_audit_v77 x WHERE x.tenant_id=t AND x.entity_id=e AND x.action='reissue_checkout_v854' LIMIT 1;
  IF prior.id IS NOT NULL THEN IF prior.before_data IS DISTINCT FROM p_data THEN RAISE EXCEPTION '同一收款請求不可更改'; END IF;RETURN prior.after_data; END IF;
 END IF;
 SELECT x.* INTO a FROM public.pos_audit_v77 x WHERE x.tenant_id=t AND x.entity_id=root AND x.action='reissue_draft_v854' FOR UPDATE;
 IF a.id IS NULL OR a.after_data->>'state'<>'draft' OR (a.after_data->>'version')::integer IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION '重開草稿已更新或已完成，請重新載入'; END IF;
 IF p_action IN('reissue_save_v854','reissue_cancel_v854') THEN
  old:=a.after_data;
  IF p_action='reissue_cancel_v854' THEN result:=old||jsonb_build_object('state','cancelled','version',(old->>'version')::integer+1);
  ELSE
   d:=p_data->'draft';PERFORM public.pos_validate_draft_v77(d);
   IF d->>'ownerId' IS DISTINCT FROM old#>>'{draft,ownerId}' OR d->>'billingPetId' IS DISTINCT FROM old#>>'{draft,billingPetId}' OR d->>'billingAppointmentId' IS NOT NULL THEN RAISE EXCEPTION '不可更換原單飼主／寵物'; END IF;
   IF (SELECT jsonb_agg(x ORDER BY x::text) FROM jsonb_array_elements(d->'lines') x WHERE x->>'stock_kind'='medicine') IS DISTINCT FROM (SELECT jsonb_agg(x ORDER BY x::text) FROM jsonb_array_elements(old#>'{draft,lines}') x WHERE x->>'stock_kind'='medicine') OR (SELECT jsonb_agg(x-'price' ORDER BY x->>'kind') FROM jsonb_array_elements(d->'medicationGroups') x) IS DISTINCT FROM (SELECT jsonb_agg(x-'price' ORDER BY x->>'kind') FROM jsonb_array_elements(old#>'{draft,medicationGroups}') x) THEN RAISE EXCEPTION '更改處方用量請由醫師重新處理，不可在櫃台草稿改藥'; END IF;
   result:=old||jsonb_build_object('draft',d,'version',(old->>'version')::integer+1);
  END IF;
  UPDATE public.pos_audit_v77 x SET after_data=result WHERE x.id=a.id;
  INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(t,root,p_action,old,result,u);
  RETURN result;
 END IF;
 IF p_action<>'reissue_pay_v854' THEN RAISE EXCEPTION '未知工作操作'; END IF;
 SELECT x.* INTO i FROM public.invoices x WHERE x.id=(a.after_data->>'original_invoice_id')::uuid AND x.tenant_id::text=t FOR UPDATE;
 IF i.voided_at IS NULL THEN RAISE EXCEPTION '原單尚未作廢'; END IF;
 IF i.appointment_id_v57 IS NOT NULL AND EXISTS(SELECT 1 FROM public.invoices x WHERE x.tenant_id::text=t AND x.appointment_id_v57=i.appointment_id_v57 AND x.voided_at IS NULL) THEN RAISE EXCEPTION '原掛號已有有效帳單，請先核對，勿再重開'; END IF;
 SELECT coalesce(sum(m.amount),0) INTO refunded FROM public.pos_movements_v77 m WHERE m.tenant_id=t AND m.kind='refund' AND m.reference=i.id::text;
 IF i.checkout_type NOT LIKE '%未付款%' AND i.total_amount>refunded+0.005 THEN RAISE EXCEPTION '原單仍有 % 元已收款未記錄退款；請先核對並記錄原單實際退款，勿再次收取全額',i.total_amount-refunded; END IF;
 SELECT x.* INTO s FROM public.pos_shifts_v77 x WHERE x.tenant_id=t AND x.closed_at IS NULL FOR UPDATE;
 IF s.id IS NULL OR s.id::text IS DISTINCT FROM p_data->>'shift_id' OR (s.opened_at AT TIME ZONE 'Asia/Taipei')::date<>(now() AT TIME ZONE 'Asia/Taipei')::date THEN RAISE EXCEPTION '請先開始今日工作，並確認當班資料'; END IF;
 d:=a.after_data->'draft';PERFORM public.pos_validate_draft_v77(d);
 args:=jsonb_build_object('p_tenant_id',t,'p_owner_id',d->'ownerId','p_pet_id',d->'billingPetId','p_checkout_type',CASE WHEN a.after_data->>'kind'='retail' THEN '商品零售' ELSE '門診收費 ('||(p_data->>'method')||')' END,'p_category',CASE WHEN a.after_data->>'kind'='retail' THEN a.after_data->>'category' ELSE '門診' END,'p_subtotal',d->'subtotal','p_discount',d->'discount','p_total',d->'total','p_lines',d->'lines');
 IF a.after_data->>'kind'<>'retail' THEN args:=args||jsonb_build_object('p_appointment_id',NULL,'p_request_id',e);IF jsonb_array_length(d->'medicationGroups')>0 THEN args:=args||jsonb_build_object('p_medication_groups',d->'medicationGroups');END IF;END IF;
 result:=public.pos_core_v845('direct',jsonb_build_object('id',e,'shift_id',s.id,'method',p_data->'method','tendered',p_data->'tendered','payload',jsonb_build_object('name',CASE WHEN a.after_data->>'kind'='retail' THEN 'checkout_with_inventory' WHEN args ? 'p_medication_groups' THEN 'checkout_clinic_medicine_groups_v64' ELSE 'checkout_clinic_doctor_v57' END,'args',args)));
 new_id:=coalesce(result->>'invoice_id',result#>>'{}')::uuid;
 IF new_id IS NULL OR new_id=i.id OR NOT EXISTS(SELECT 1 FROM public.invoices x WHERE x.id=new_id AND x.tenant_id::text=t AND x.voided_at IS NULL) THEN RAISE EXCEPTION '未取得新帳單，本次收款與庫存全部取消'; END IF;
 -- Restore original medical attribution only for columns present in this installation.
 FOR field IN SELECT c.attname FROM pg_attribute c WHERE c.attrelid='public.invoices'::regclass AND c.attnum>0 AND NOT c.attisdropped AND c.attname IN('appointment_id_v57','clinician_id_v57','clinician_name_v57') LOOP
  EXECUTE format('UPDATE public.invoices SET %1$I=(jsonb_populate_record(NULL::public.invoices,$1)).%1$I WHERE id=$2 AND tenant_id::text=$3',field) USING to_jsonb(i),new_id,t;
 END LOOP;
 old:=a.after_data;UPDATE public.pos_audit_v77 x SET after_data=old||jsonb_build_object('state','paid','new_invoice_id',new_id,'updated_at',now(),'updated_by',u,'dispensing','未調劑','version',(old->>'version')::integer+1) WHERE x.id=a.id;
 result:=jsonb_build_object('invoice_id',new_id,'original_invoice_id',i.id,'draft_id',root);
 INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(t,e,'reissue_checkout_v854',p_data,result,u);
 RETURN result;
END;$_$;

ALTER FUNCTION "public"."pos_work_v854"("p_action" "text", "p_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."preview_clinic_restore_raw_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows_json" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    SET "statement_timeout" TO '60s'
    AS $$
BEGIN
 IF p_rows_json IS NULL OR octet_length(p_rows_json)>5242880 THEN RAISE EXCEPTION '比對資料超過5MB'; END IF;
 RETURN public.preview_clinic_restore_v63(p_expected_tenant,p_table,p_rows_json::jsonb);
END $$;

ALTER FUNCTION "public"."preview_clinic_restore_raw_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows_json" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."preview_clinic_restore_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    SET "statement_timeout" TO '60s'
    AS $$
DECLARE t text:=public.current_tenant_id(); r jsonb; results jsonb:='[]';seen uuid[]:=ARRAY[]::uuid[];
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR p_expected_tenant IS DISTINCT FROM t OR NOT coalesce(private.has_ability(t,'admin'),false) OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=auth.uid() AND tenant_id::text=t AND role='admin') THEN RAISE EXCEPTION '只有本院管理者可比對還原' USING ERRCODE='42501'; END IF;
 IF p_table IS NULL OR p_table NOT IN ('owners','pets','medical_records','legacy_medical_histories') OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows)>100 OR octet_length(p_rows::text)>5242880 THEN RAISE EXCEPTION '一次最多比對100筆、5MB，請縮小範圍'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  IF (r->>'id')::uuid=ANY(seen) THEN RAISE EXCEPTION '還原清單有重複編號'; END IF;seen:=array_append(seen,(r->>'id')::uuid);
  results:=results||jsonb_build_array(private.restore_row_check_v63(t,p_table,r));
 END LOOP;
 RETURN jsonb_build_object('tenant_id',t,'table',p_table,'results',results);
END $$;

ALTER FUNCTION "public"."preview_clinic_restore_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."receive_regulated_lot"("p_kind" "text", "p_id" "uuid", "p_quantity" numeric, "p_lot_no" "text", "p_expiry_date" "date" DEFAULT NULL::"date", "p_supplier_name" "text" DEFAULT NULL::"text", "p_purchase_document_no" "text" DEFAULT NULL::"text", "p_received_at" timestamp with time zone DEFAULT "now"(), "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_tenant text := public.current_tenant_id();
    v_name text;
    v_unit text;
    v_reg_class text;
    v_reportable boolean;
    v_lot_id uuid;
    v_before numeric;
    v_after numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(public.current_tenant_id(), 'admin') THEN RAISE EXCEPTION '此帳號沒有操作權限' USING ERRCODE = '42501'; END IF;
    IF v_tenant IS NULL THEN
        RAISE EXCEPTION 'No tenant context';
    END IF;
    IF p_kind NOT IN ('medicine','item') THEN
        RAISE EXCEPTION 'Invalid item kind';
    END IF;
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;
    IF p_lot_no IS NULL OR btrim(p_lot_no) = '' THEN
        RAISE EXCEPTION 'Lot number is required';
    END IF;

    IF p_kind = 'medicine' THEN
        SELECT name, COALESCE(smallest_unit, unit, '錠'),
               COALESCE(regulatory_class,'未分類'), COALESCE(reportable,false),
               COALESCE(stock_qty,0)
        INTO v_name, v_unit, v_reg_class, v_reportable, v_before
        FROM public.medicines
        WHERE id = p_id AND tenant_id = v_tenant
        FOR UPDATE;
    ELSE
        SELECT name, COALESCE(smallest_unit,'件'),
               COALESCE(regulatory_class,'一般商品'), COALESCE(reportable,false),
               COALESCE(stock_qty,0)
        INTO v_name, v_unit, v_reg_class, v_reportable, v_before
        FROM public.items
        WHERE id = p_id AND tenant_id = v_tenant
        FOR UPDATE;
    END IF;

    IF v_name IS NULL THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    v_after := v_before + p_quantity;

    INSERT INTO public.regulated_lots (
        tenant_id, item_kind, item_id, item_name_snapshot,
        lot_no, expiry_date, supplier_name, received_at,
        qty_received, qty_on_hand, smallest_unit,
        purchase_document_no, notes, is_active
    ) VALUES (
        v_tenant, p_kind, p_id, v_name,
        btrim(p_lot_no), p_expiry_date, NULLIF(btrim(COALESCE(p_supplier_name,'')),''),
        COALESCE(p_received_at,now()),
        p_quantity, p_quantity, v_unit,
        NULLIF(btrim(COALESCE(p_purchase_document_no,'')),''),
        NULLIF(btrim(COALESCE(p_notes,'')),''), true
    )
    ON CONFLICT (tenant_id, item_kind, item_id, lot_no)
    DO UPDATE SET
        expiry_date = COALESCE(EXCLUDED.expiry_date, public.regulated_lots.expiry_date),
        supplier_name = COALESCE(EXCLUDED.supplier_name, public.regulated_lots.supplier_name),
        received_at = EXCLUDED.received_at,
        qty_received = public.regulated_lots.qty_received + EXCLUDED.qty_received,
        qty_on_hand = public.regulated_lots.qty_on_hand + EXCLUDED.qty_on_hand,
        smallest_unit = EXCLUDED.smallest_unit,
        purchase_document_no = COALESCE(EXCLUDED.purchase_document_no, public.regulated_lots.purchase_document_no),
        notes = COALESCE(EXCLUDED.notes, public.regulated_lots.notes),
        is_active = true,
        updated_at = now()
    RETURNING id INTO v_lot_id;

    IF p_kind = 'medicine' THEN
        UPDATE public.medicines SET stock_qty = v_after WHERE id = p_id AND tenant_id = v_tenant;
    ELSE
        UPDATE public.items SET stock_qty = v_after WHERE id = p_id AND tenant_id = v_tenant;
    END IF;

    INSERT INTO public.inventory_movements
        (tenant_id, item_kind, item_id, change_qty, qty_before, qty_after, reason)
    VALUES
        (v_tenant, p_kind, p_id, p_quantity, v_before, v_after,
         '批次入庫' ||
         CASE WHEN p_purchase_document_no IS NOT NULL AND btrim(p_purchase_document_no) <> ''
              THEN '／單號：' || btrim(p_purchase_document_no) ELSE '' END ||
         '／批號：' || btrim(p_lot_no));

    RETURN v_lot_id;
END;
$$;

ALTER FUNCTION "public"."receive_regulated_lot"("p_kind" "text", "p_id" "uuid", "p_quantity" numeric, "p_lot_no" "text", "p_expiry_date" "date", "p_supplier_name" "text", "p_purchase_document_no" "text", "p_received_at" timestamp with time zone, "p_notes" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."release_clinic_visit_v51"("p_pet_id" "uuid", "p_appointment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); c private.clinic_visit_claims_v51;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(t,'admin') THEN RAISE EXCEPTION '只有管理者可解除占用' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM private.clinic_visit_claims_v51 WHERE tenant_id=t AND pet_id=p_pet_id FOR UPDATE;
 IF FOUND AND c.appointment_id IS DISTINCT FROM p_appointment_id THEN RAISE EXCEPTION '占用的看診已改變，請更新後再解除'; END IF;
 UPDATE public.appointments SET status='候診中' WHERE tenant_id=t AND pet_id=p_pet_id AND id=p_appointment_id AND status='診間看診中';
 IF NOT FOUND THEN RAISE EXCEPTION '找不到本院這筆看診中資料'; END IF;
 DELETE FROM private.clinic_visit_claims_v51 WHERE tenant_id=t AND pet_id=p_pet_id;
END $$;

ALTER FUNCTION "public"."release_clinic_visit_v51"("p_pet_id" "uuid", "p_appointment_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."resolve_imaging_share_v76"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $_$
DECLARE s public.imaging_shares_v76; images jsonb; pet_name text; n integer;
BEGIN
 IF p_token IS NULL OR p_token!~'^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO s FROM public.imaging_shares_v76 WHERE token_hash=sha256(convert_to(p_token,'UTF8'))
  AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT name INTO pet_name FROM public.pets WHERE id=s.pet_id AND tenant_id::text=s.tenant_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT count(*),jsonb_agg(jsonb_build_object('id',a.id,'path',a.storage_path,'mime',a.mime_type,
  'study_date',st.study_date,'body_part',coalesce(st.body_part,'')) ORDER BY st.study_date,a.created_at,a.id)
 INTO n,images FROM public.imaging_assets a JOIN public.imaging_studies st ON st.id=a.study_id
 WHERE a.id=ANY(s.asset_ids) AND a.tenant_id::text=s.tenant_id AND st.tenant_id::text=s.tenant_id
  AND st.pet_id=s.pet_id AND st.modality='XRAY' AND a.mime_type IN ('image/jpeg','image/png')
  AND a.file_size BETWEEN 1 AND 52428800
  AND starts_with(a.storage_path,s.tenant_id||'/'||s.pet_id::text||'/'||st.id::text||'/')
  AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='clinic-imaging' AND o.name=a.storage_path);
 IF n<>cardinality(s.asset_ids) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('pet_name',pet_name,'expires_at',s.expires_at,'images',images,
  'valid_for_seconds',least(60,floor(extract(epoch FROM s.expires_at-clock_timestamp()))::integer));
END $_$;

ALTER FUNCTION "public"."resolve_imaging_share_v76"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."restore_missing_clinic_raw_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows_json" "text", "p_backup_sha256" "text", "p_reason" "text", "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    SET "statement_timeout" TO '60s'
    AS $$
BEGIN
 IF p_rows_json IS NULL OR octet_length(p_rows_json)>5242880 THEN RAISE EXCEPTION '還原資料超過5MB'; END IF;
 RETURN public.restore_missing_clinic_rows_v63(p_expected_tenant,p_table,p_rows_json::jsonb,p_backup_sha256,p_reason,p_confirmation);
END $$;

ALTER FUNCTION "public"."restore_missing_clinic_raw_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows_json" "text", "p_backup_sha256" "text", "p_reason" "text", "p_confirmation" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."restore_missing_clinic_rows_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows" "jsonb", "p_backup_sha256" "text", "p_reason" "text", "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    SET "statement_timeout" TO '60s'
    AS $_$
DECLARE t text:=public.current_tenant_id(); r jsonb; report jsonb; result jsonb; canonical jsonb; saved jsonb; columns_sql text; n integer:=0;actor text;ids jsonb:='[]';old_flag text:=current_setting('genblue.restore_row_v63',true);
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR p_expected_tenant IS DISTINCT FROM t OR NOT coalesce(private.has_ability(t,'admin'),false) OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=auth.uid() AND tenant_id::text=t AND role='admin') THEN RAISE EXCEPTION '只有本院管理者可還原' USING ERRCODE='42501'; END IF;
 IF p_confirmation IS DISTINCT FROM '還原缺少資料' OR p_backup_sha256 IS NULL OR p_backup_sha256 !~ '^[0-9a-f]{64}$' OR nullif(btrim(p_reason),'') IS NULL OR length(p_reason)>300 OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 20 OR octet_length(p_rows::text)>5242880 THEN RAISE EXCEPTION '請確認還原原因及範圍，一次最多20筆、5MB'; END IF;
 -- 院別鎖與資料表鎖確保預覽之後再新增／刪除的資料不能被覆蓋，也不能在核對與寫入間更改父資料。
 PERFORM pg_advisory_xact_lock(hashtextextended('restore_v63:'||t,0));
 LOCK TABLE public.owners,public.pets,public.medical_records,public.legacy_medical_histories IN SHARE ROW EXCLUSIVE MODE;
 report:=public.preview_clinic_restore_v63(t,p_table,p_rows);
 FOR result IN SELECT value FROM jsonb_array_elements(report->'results') LOOP
  IF result->>'status' NOT IN ('missing','same') THEN RAISE EXCEPTION '資料已變更或有衝突，本次全部未還原；請重新比對'; END IF;
 END LOOP;
 SELECT string_agg(format('%I',attname),',' ORDER BY attnum) INTO columns_sql FROM pg_attribute WHERE attrelid=to_regclass(format('public.%I',p_table)) AND attnum>0 AND NOT attisdropped AND attgenerated='' AND attidentity='';
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass(format('public.%I',p_table)) AND attnum>0 AND NOT attisdropped AND (attgenerated<>'' OR attidentity<>'')) THEN RAISE EXCEPTION '還原規格需更新：有自動計算或流水號欄位'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  result:=private.restore_row_check_v63(t,p_table,r);IF result->>'status'='same' THEN CONTINUE; END IF;
  IF result->>'status'<>'missing' THEN RAISE EXCEPTION '資料已有變更，本次全部未還原'; END IF;
  PERFORM set_config('genblue.restore_row_v63',jsonb_build_object('table',p_table,'id',r->>'id','tenant_id',t,'system_code',r->>'system_code','row_version',r->>'row_version','edited_at',r->>'edited_at','edited_by',r->>'edited_by')::text,true);
  EXECUTE format('SELECT to_jsonb(x) FROM jsonb_populate_record(NULL::public.%I,$1) x',p_table) INTO canonical USING r;
  EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) RETURNING to_jsonb(%I.*)',p_table,columns_sql,columns_sql,p_table,p_table) INTO saved USING r;
  IF saved IS DISTINCT FROM canonical THEN RAISE EXCEPTION '目前新增規則改變了備份內容，本次全部未還原，請保留訊息核對'; END IF;
  PERFORM set_config('genblue.restore_row_v63',coalesce(old_flag,''),true);ids:=ids||jsonb_build_array(r->>'id');n:=n+1;
 END LOOP;
 IF n>0 THEN
  SELECT coalesce(nullif(btrim(display_name),''),'管理者') INTO actor FROM public.user_profiles WHERE user_id=auth.uid();
  INSERT INTO public.audit_logs(tenant_id,operator,action) VALUES(t,left(actor,100),jsonb_build_object('operation','restore_missing_v63','table',p_table,'inserted',n,'ids',ids,'backup_sha256',p_backup_sha256,'reason',p_reason,'actor_id',auth.uid())::text);
 END IF;
 RETURN jsonb_build_object('tenant_id',t,'table',p_table,'inserted',n,'already_present',jsonb_array_length(p_rows)-n);
END $_$;

ALTER FUNCTION "public"."restore_missing_clinic_rows_v63"("p_expected_tenant" "text", "p_table" "text", "p_rows" "jsonb", "p_backup_sha256" "text", "p_reason" "text", "p_confirmation" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_archive_medical_v53"("p_id" "uuid", "p_pet_id" "uuid", "p_expected_version" bigint, "p_chief" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); u uuid:=auth.uid(); r public.medical_records; c private.clinic_visit_claims_v51;
BEGIN
 IF u IS NULL OR NOT private.has_ability(t,'clinical') THEN RAISE EXCEPTION '沒有本院病歷編輯權限' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_pet_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_chief IS NULL OR length(p_chief)>200000 THEN RAISE EXCEPTION '請提供有效的歸檔資料'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pets WHERE id=p_pet_id AND tenant_id=t) THEN RAISE EXCEPTION '找不到本院寵物' USING ERRCODE='42501'; END IF;
 -- Order locks like claim_clinic_visit: profile then claim, then medical record.
 PERFORM 1 FROM public.user_profiles WHERE user_id=u AND tenant_id=t FOR SHARE;
 SELECT * INTO c FROM private.clinic_visit_claims_v51 WHERE tenant_id=t AND pet_id=p_pet_id FOR UPDATE;
 IF NOT private.is_consulting_doctor_v52(t,u) OR c.clinician_id IS DISTINCT FROM u OR NOT EXISTS(SELECT 1 FROM public.appointments a WHERE a.id=c.appointment_id AND a.tenant_id=t AND a.pet_id=p_pet_id AND a.status='診間看診中') THEN RAISE EXCEPTION '接診權已變更，請保留輸入並重新核對'; END IF;
 SELECT * INTO r FROM public.medical_records WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF r.tenant_id<>t OR r.pet_id IS DISTINCT FROM p_pet_id THEN RAISE EXCEPTION '找不到本院這筆歸檔病歷' USING ERRCODE='42501'; END IF;
  IF r.chief_complaint IS NOT DISTINCT FROM p_chief AND r.prescription_details='[]'::jsonb AND r.status='已完成' THEN RETURN jsonb_build_object('id',r.id,'row_version',r.row_version,'replayed',true); END IF;
  IF r.row_version<>p_expected_version OR r.prescription_details IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION '歸檔病歷已被修改，請保留輸入並核對，不會覆蓋他人的資料' USING ERRCODE='40001'; END IF;
  UPDATE public.medical_records SET chief_complaint=p_chief,status='已完成',row_version=p_expected_version+1 WHERE id=p_id AND tenant_id=t RETURNING * INTO r;
 ELSE
  IF p_expected_version<>0 THEN RAISE EXCEPTION '原歸檔病歷不存在，請保留畫面並重新核對'; END IF;
  INSERT INTO public.medical_records(id,tenant_id,pet_id,status,chief_complaint,prescription_details) VALUES(p_id,t,p_pet_id,'已完成',p_chief,'[]'::jsonb) RETURNING * INTO r;
 END IF;
 RETURN jsonb_build_object('id',r.id,'row_version',r.row_version);
END $$;

ALTER FUNCTION "public"."save_archive_medical_v53"("p_id" "uuid", "p_pet_id" "uuid", "p_expected_version" bigint, "p_chief" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_imaging_upload_v61"("p_study_id" "uuid", "p_asset_id" "uuid", "p_pet_id" "uuid", "p_device_id" "uuid", "p_modality" "text", "p_study_date" timestamp with time zone, "p_body_part" "text", "p_note" "text", "p_filename" "text", "p_mime" "text", "p_size" bigint, "p_extension" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
 tenant text:=public.current_tenant_id(); path text; obj record;
 existing record;
BEGIN
 IF auth.uid() IS NULL OR tenant IS NULL OR NOT private.has_ability(tenant,'clinical') THEN
  RAISE EXCEPTION '沒有影像儲存權限';
 END IF;
 IF p_study_id IS NULL OR p_asset_id IS NULL OR p_pet_id IS NULL
 OR p_modality IS NULL OR p_modality NOT IN ('XRAY','ULTRASOUND')
 OR p_study_date IS NULL OR NOT isfinite(p_study_date)
 OR p_filename IS NULL OR length(p_filename) NOT BETWEEN 1 AND 200
 OR length(coalesce(p_body_part,''))>200 OR length(coalesce(p_note,''))>5000
 OR p_size IS NULL OR p_size NOT BETWEEN 1 AND 52428800 THEN
  RAISE EXCEPTION '影像資料格式或檔案大小不符合限制';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.pets WHERE id=p_pet_id AND tenant_id::text=tenant) THEN
  RAISE EXCEPTION '寵物不屬於目前醫院';
 END IF;
 IF p_device_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.diagnostic_devices WHERE id=p_device_id AND tenant_id::text=tenant
    AND device_type=p_modality AND is_active
 ) THEN RAISE EXCEPTION '儀器不屬於目前醫院或類型不符'; END IF;
 IF p_extension IS NULL OR p_mime IS NULL OR NOT (
 (p_extension='jpg' AND p_mime='image/jpeg') OR
 (p_extension='png' AND p_mime='image/png') OR
 (p_extension='webp' AND p_mime='image/webp') OR
 (p_extension='mp4' AND p_mime='video/mp4') OR
 (p_extension='mov' AND p_mime='video/quicktime') OR
 (p_extension='webm' AND p_mime='video/webm')
 ) THEN RAISE EXCEPTION '不支援此檔案格式'; END IF;
 path:=tenant||'/'||p_pet_id::text||'/'||p_study_id::text||'/'||p_asset_id::text||'.'||p_extension;
 -- 序列化同一次儲存的重試。
 PERFORM pg_advisory_xact_lock(hashtextextended(p_study_id::text,0));
 SELECT a.id,a.storage_path,s.pet_id,s.tenant_id INTO existing
 FROM public.imaging_assets a JOIN public.imaging_studies s ON s.id=a.study_id
 WHERE a.id=p_asset_id;
 IF FOUND THEN
  IF existing.tenant_id=tenant AND existing.pet_id=p_pet_id AND existing.storage_path=path THEN
   RETURN jsonb_build_object('saved',true,'study_id',p_study_id,'asset_id',p_asset_id,'already_saved',true);
  END IF;
  RAISE EXCEPTION '影像識別碼衝突';
 END IF;
 SELECT metadata INTO obj FROM storage.objects WHERE bucket_id='clinic-imaging' AND name=path;
 IF NOT FOUND THEN RAISE EXCEPTION '原始檔尚未上傳完成'; END IF;
 IF (obj.metadata->>'size')::bigint IS DISTINCT FROM p_size
 OR obj.metadata->>'mimetype' IS DISTINCT FROM p_mime THEN
  RAISE EXCEPTION '上傳檔案大小或類型與存檔資料不符';
 END IF;
 INSERT INTO public.imaging_studies(id,tenant_id,pet_id,device_id,modality,study_date,body_part,clinical_note,status)
 VALUES (p_study_id,tenant,p_pet_id,p_device_id,p_modality,p_study_date,nullif(p_body_part,''),nullif(p_note,''),'ready');
 INSERT INTO public.imaging_assets(id,tenant_id,study_id,asset_type,storage_path,mime_type,original_filename,file_size)
 VALUES (p_asset_id,tenant,p_study_id,CASE WHEN p_mime LIKE 'video/%' THEN 'video' ELSE 'image' END,path,p_mime,p_filename,p_size);
 RETURN jsonb_build_object('saved',true,'study_id',p_study_id,'asset_id',p_asset_id,'already_saved',false);
END;
$$;

ALTER FUNCTION "public"."save_imaging_upload_v61"("p_study_id" "uuid", "p_asset_id" "uuid", "p_pet_id" "uuid", "p_device_id" "uuid", "p_modality" "text", "p_study_date" timestamp with time zone, "p_body_part" "text", "p_note" "text", "p_filename" "text", "p_mime" "text", "p_size" bigint, "p_extension" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_pet_temperature"("p_pet_id" "uuid", "p_temperature" numeric) RETURNS TABLE("id" "uuid", "latest_temperature" numeric, "temperature_measured_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
 IF auth.uid() IS NULL OR public.current_tenant_id() IS NULL THEN RAISE EXCEPTION '請先登入' USING ERRCODE='42501'; END IF;
 IF p_temperature IS NULL OR NOT (p_temperature>0 AND p_temperature<=100) THEN RAISE EXCEPTION '體溫需為大於0且不超過100的數值'; END IF;
 RETURN QUERY UPDATE public.pets AS p SET latest_temperature=round(p_temperature,2),temperature_measured_at=now()
 WHERE p.id=p_pet_id AND p.tenant_id::text=public.current_tenant_id()
 RETURNING p.id,p.latest_temperature,p.temperature_measured_at;
END;
$$;

ALTER FUNCTION "public"."save_pet_temperature"("p_pet_id" "uuid", "p_temperature" numeric) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."search_imaging_pets_v61"("p_query" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE tenant text:=public.current_tenant_id(); found jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(tenant,'read') THEN RAISE EXCEPTION '沒有查閱權限'; END IF;
 IF p_query IS NULL OR length(btrim(p_query)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION '請輸入 1 至 100 字搜尋條件'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO found FROM (
 SELECT p.id,p.name,p.species,o.name AS owner_name,o.mobile AS owner_mobile,o.owner_code,o.system_code
 FROM public.pets p JOIN public.owners o ON o.id=p.owner_id AND o.tenant_id::text=tenant
 WHERE p.tenant_id::text=tenant AND NOT EXISTS (
 SELECT 1 FROM regexp_split_to_table(lower(btrim(p_query)),'\s+') AS token
 WHERE strpos(lower(concat_ws(' ',p.name,p.microchip,o.name,o.mobile,o.phone,o.owner_code,o.system_code)),token)=0
 ) ORDER BY p.name,p.id LIMIT 31
 ) r;
 RETURN found;
END;
$$;

ALTER FUNCTION "public"."search_imaging_pets_v61"("p_query" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_appointments_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;

ALTER FUNCTION "public"."set_appointments_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_clinic_multidoctor_v51"("p_enabled" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id();
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(t,'admin') THEN RAISE EXCEPTION '只有管理者可切換多人接診保護' USING ERRCODE='42501'; END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION '請指定是否啟用'; END IF;
 IF NOT p_enabled AND EXISTS(SELECT 1 FROM private.clinic_visit_claims_v51 WHERE tenant_id=t) THEN RAISE EXCEPTION '仍有看診占用，不能停用保護'; END IF;
 INSERT INTO private.clinic_multidoctor_settings_v51 VALUES(t,p_enabled) ON CONFLICT(tenant_id) DO UPDATE SET enabled=EXCLUDED.enabled;
END $$;

ALTER FUNCTION "public"."set_clinic_multidoctor_v51"("p_enabled" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_staff_clinician_v52"("p_user_id" "uuid", "p_enabled" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); member public.user_profiles;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(t,'admin') THEN RAISE EXCEPTION '只有管理者可設定接診醫師' USING ERRCODE='42501'; END IF;
 IF p_enabled IS NULL OR p_user_id IS NULL THEN RAISE EXCEPTION '請指定人員與接診設定'; END IF;
 SELECT * INTO member FROM public.user_profiles WHERE user_id=p_user_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到本院人員' USING ERRCODE='42501'; END IF;
 IF p_enabled AND member.role NOT IN ('admin','doctor','staff') THEN RAISE EXCEPTION '此帳號身分無法設定為接診醫師'; END IF;
 IF NOT p_enabled AND EXISTS(SELECT 1 FROM private.clinic_visit_claims_v51 WHERE tenant_id=t AND clinician_id=p_user_id) THEN RAISE EXCEPTION '此醫師仍有看診中的病患，請先完成看診或確認停止後解除占用'; END IF;
 UPDATE public.user_profiles SET is_consulting_doctor=p_enabled WHERE user_id=p_user_id AND tenant_id=t;
END $$;

ALTER FUNCTION "public"."set_staff_clinician_v52"("p_user_id" "uuid", "p_enabled" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_staff_display_name_v56"("p_user_id" "uuid", "p_display_name" "text", "p_expected_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); member public.user_profiles; n text:=btrim(p_display_name);
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(t,'admin') THEN RAISE EXCEPTION '只有管理者可修改人員姓名' USING ERRCODE='42501'; END IF;
 IF p_user_id IS NULL OR n IS NULL OR char_length(n)<1 OR char_length(n)>50 OR n ~ '[[:cntrl:]]' THEN RAISE EXCEPTION '姓名需為 1 至 50 字，不能包含換行或控制字元'; END IF;
 SELECT * INTO member FROM public.user_profiles WHERE user_id=p_user_id AND tenant_id=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到本院人員' USING ERRCODE='42501'; END IF;
 IF member.display_name IS NOT DISTINCT FROM n THEN RETURN jsonb_build_object('ok',true,'display_name',n,'replayed',true); END IF;
 IF member.display_name IS DISTINCT FROM p_expected_name THEN RETURN jsonb_build_object('ok',false,'reason','conflict','display_name',member.display_name); END IF;
 UPDATE public.user_profiles SET display_name=n WHERE user_id=p_user_id AND tenant_id=t;
 RETURN jsonb_build_object('ok',true,'display_name',n);
END $$;

ALTER FUNCTION "public"."set_staff_display_name_v56"("p_user_id" "uuid", "p_display_name" "text", "p_expected_name" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."staff_clinician_flags_v52"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(t,'admin') THEN RAISE EXCEPTION '只有管理者可讀取接診設定' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id',user_id,'is_consulting_doctor',is_consulting_doctor)),'[]'::jsonb) INTO result FROM public.user_profiles WHERE tenant_id=t;
 RETURN result;
END $$;

ALTER FUNCTION "public"."staff_clinician_flags_v52"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."staff_display_names_v56"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id();
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(t,'admin') THEN RAISE EXCEPTION '只有管理者可讀取人員姓名' USING ERRCODE='42501'; END IF;
 RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id',user_id,'display_name',display_name)),'[]'::jsonb) FROM public.user_profiles WHERE tenant_id=t);
END $$;

ALTER FUNCTION "public"."staff_display_names_v56"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."verify_clinic_visit_v51"("p_pet_id" "uuid", "p_claim_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 SELECT auth.uid() IS NOT NULL AND private.has_ability(public.current_tenant_id(),'clinical') AND private.is_consulting_doctor_v52(public.current_tenant_id(),auth.uid()) AND EXISTS(SELECT 1 FROM private.clinic_visit_claims_v51 c JOIN public.appointments a ON a.id=c.appointment_id AND a.tenant_id=c.tenant_id AND a.pet_id=c.pet_id WHERE c.tenant_id=public.current_tenant_id() AND c.pet_id=p_pet_id AND c.claim_id=p_claim_id AND c.clinician_id=auth.uid() AND a.status='診間看診中');
$$;

ALTER FUNCTION "public"."verify_clinic_visit_v51"("p_pet_id" "uuid", "p_claim_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."void_checkout_with_inventory"("p_invoice_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_inv public.invoices%rowtype; v_mov public.inventory_movements%rowtype;
 v_tenant text; v_before numeric; v_name text;
begin
 v_tenant:=public.current_tenant_id();
 if auth.uid() is null or v_tenant is null then raise exception '請先登入醫院帳號'; end if;
 if NOT coalesce(private.has_ability(v_tenant,'checkout'),false) then raise exception '沒有本院作廢帳單權限' USING ERRCODE='42501'; end if;
 if p_invoice_id is null or length(trim(coalesce(p_reason,'')))<2 then raise exception '請填寫至少兩字的作廢原因'; end if;
 select * into v_inv from public.invoices where id=p_invoice_id and tenant_id=v_tenant for update;
 if not found then raise exception '找不到此醫院的帳單'; end if;
 if v_inv.voided_at is not null then raise exception '這筆帳單已作廢'; end if;
 for v_mov in select * from public.inventory_movements
   where tenant_id=v_tenant and reason='結帳 '||p_invoice_id::text and change_qty<0
   order by id for update loop
   if v_mov.item_kind='item' then
     select stock_qty,name into v_before,v_name from public.items
       where id=v_mov.item_id and tenant_id=v_tenant for update;
     if not found then raise exception '商品「%」已刪除，無法安全回補，請先恢復品項',v_mov.item_name; end if;
     update public.items set stock_qty=coalesce(v_before,0)-v_mov.change_qty
       where id=v_mov.item_id and tenant_id=v_tenant;
   elsif v_mov.item_kind='medicine' then
     select stock_qty,name into v_before,v_name from public.medicines
       where id=v_mov.item_id and tenant_id=v_tenant for update;
     if not found then raise exception '藥品「%」已刪除，無法安全回補，請先恢復品項',v_mov.item_name; end if;
     update public.medicines set stock_qty=coalesce(v_before,0)-v_mov.change_qty
       where id=v_mov.item_id and tenant_id=v_tenant;
   else raise exception '未知的庫存品項類型'; end if;
   insert into public.inventory_movements(tenant_id,item_kind,item_id,item_name,change_qty,qty_before,qty_after,reason)
   values(v_tenant,v_mov.item_kind,v_mov.item_id,v_name,-v_mov.change_qty,
     coalesce(v_before,0),coalesce(v_before,0)-v_mov.change_qty,'作廢 '||p_invoice_id::text||'：'||trim(p_reason));
 end loop;
 update public.invoices set voided_at=now(),void_reason=trim(p_reason),void_actor=auth.uid()
 where id=p_invoice_id and tenant_id=v_tenant;
end $$;

ALTER FUNCTION "public"."void_checkout_with_inventory"("p_invoice_id" "uuid", "p_reason" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."waiting_doctor_state_v54"("p_appointment_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE t text:=public.current_tenant_id(); a public.appointments;
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_ability(t,'appointment') THEN RAISE EXCEPTION '沒有本院掛號權限' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.appointments WHERE id=p_appointment_id AND tenant_id=t;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到本院候診紀錄' USING ERRCODE='42501'; END IF;
 IF a.status<>'候診中' OR EXISTS(SELECT 1 FROM private.clinic_visit_claims_v51 WHERE tenant_id=t AND pet_id=a.pet_id) THEN RAISE EXCEPTION '請先完成掛號／報到；看診中的病患不能直接更換指定醫師'; END IF;
 RETURN jsonb_build_object('appointment',to_jsonb(a));
END $$;

ALTER FUNCTION "public"."waiting_doctor_state_v54"("p_appointment_id" "uuid") OWNER TO "postgres";
