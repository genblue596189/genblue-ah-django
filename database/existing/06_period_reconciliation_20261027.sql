-- 期間費用管理者核對：沿用 pos_audit_v77，不建立收款或修改帳單。
-- 可重複執行；先在測試院確認後再套用至正式院。
BEGIN;
CREATE OR REPLACE FUNCTION public.period_reconcile_v20261027(p_action text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '30s' AS $$
DECLARE
 t text:=public.current_tenant_id(); u uuid:=auth.uid(); report jsonb; item jsonb; updated jsonb:='[]'::jsonb;
 audit public.pos_audit_v77; prior public.pos_audit_v77; invoice_id uuid; request_id uuid;
 input_report jsonb; status text; reason text; method text; amount numeric; total numeric;
 s jsonb; issues integer; unknown numeric; billed numeric; paid numeric; net numeric; due numeric;
 unchanged boolean; excluded_tests integer:=0; new_item jsonb; key text; response jsonb;
BEGIN
 IF u IS NULL OR t IS NULL OR NOT coalesce(private.has_ability(t,'checkout'),false) THEN
  RAISE EXCEPTION '需要本院收費權限' USING ERRCODE='42501';
 END IF;
 IF p_action NOT IN ('report','confirm_paid','exclude_test','revoke') OR jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION '核對請求格式不正確'; END IF;
 input_report:=CASE WHEN p_action='report' THEN p_data ELSE p_data->'report' END;
 IF jsonb_typeof(input_report)<>'object' THEN RAISE EXCEPTION '請先查詢期間費用'; END IF;
 IF p_action<>'report' THEN
  IF NOT coalesce(private.has_ability(t,'admin'),false) THEN RAISE EXCEPTION '只有管理者可以核對與撤銷' USING ERRCODE='42501'; END IF;
  invoice_id:=(p_data->>'invoice_id')::uuid; request_id:=(p_data->>'request_id')::uuid;
  IF invoice_id IS NULL OR request_id IS NULL THEN RAISE EXCEPTION '核對資料不完整'; END IF;
  reason:=btrim(coalesce(p_data->>'reason',''));
  IF length(reason)<2 OR length(reason)>500 THEN RAISE EXCEPTION '請填寫2至500字的核對原因'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t||':'||invoice_id::text,0));
  SELECT * INTO prior FROM public.pos_audit_v77 a WHERE a.tenant_id=t AND a.entity_id=invoice_id AND a.action='period_reconciliation_20261027' AND a.after_data->>'request_id'=request_id::text ORDER BY a.id DESC LIMIT 1;
  IF prior.id IS NOT NULL THEN
   IF prior.actor<>u OR prior.before_data IS DISTINCT FROM p_data OR prior.after_data->>'action'<>p_action THEN RAISE EXCEPTION '相同核對編號不可更改內容'; END IF;
  END IF;
 END IF;
 report:=public.period_fees_v932('report',input_report);
 IF report->>'tenant_id' IS DISTINCT FROM t THEN RAISE EXCEPTION '院所資料不符'; END IF;
 IF p_action<>'report' AND prior.id IS NULL THEN
  SELECT x.value INTO item FROM jsonb_array_elements(report->'invoices') x WHERE x.value->>'id'=invoice_id::text;
  IF item IS NULL THEN RAISE EXCEPTION '此帳單不在目前查詢範圍，請重新查詢'; END IF;
  SELECT * INTO audit FROM public.pos_audit_v77 a WHERE a.tenant_id=t AND a.entity_id=invoice_id AND a.action='period_reconciliation_20261027' ORDER BY a.id DESC LIMIT 1;
  IF coalesce(audit.id::text,'') IS DISTINCT FROM coalesce(p_data->>'expected_audit_id','') THEN RAISE EXCEPTION '核對狀態已變更，請重新查詢'; END IF;
  IF p_action='revoke' THEN
   IF audit.id IS NULL OR audit.after_data->>'status' NOT IN ('paid','test') THEN RAISE EXCEPTION '沒有可撤銷的核對'; END IF;
   response:=jsonb_build_object('status','revoked','request_id',request_id,'action',p_action,'reason',reason,'prior_audit_id',audit.id::text);
  ELSE
   IF audit.id IS NOT NULL AND audit.after_data->>'status' IN ('paid','test') THEN RAISE EXCEPTION '已有核對紀錄，請先撤銷'; END IF;
   IF item->>'voided_at' IS NOT NULL OR item->>'issue' IS DISTINCT FROM '舊帳單標示已付，但缺少對應金流紀錄' OR (item->>'refunded')::numeric<>0 OR item->'payments'<>'[]'::jsonb THEN RAISE EXCEPTION '帳單狀態已變更或不適用此核對，請重新查詢'; END IF;
   IF p_data->>'invoice_hash' IS DISTINCT FROM pg_catalog.md5(item::text) THEN RAISE EXCEPTION '帳單內容已變更，請重新查詢'; END IF;
   total:=(item->>'total')::numeric;
   IF p_action='confirm_paid' THEN
    amount:=(p_data->>'amount')::numeric;method:=p_data->>'method';
    IF amount IS NULL OR amount<=0 OR amount>total OR amount<>pg_catalog.round(amount,2) OR method IS NULL OR method NOT IN ('現金','信用卡','轉帳','行動支付','其他') THEN RAISE EXCEPTION '請核對實收金額和付款方式'; END IF;
    status:='paid';
   ELSE status:='test'; amount:=0;method:=NULL; END IF;
   response:=jsonb_build_object('status',status,'amount',amount,'method',method,'reason',reason,'request_id',request_id,'action',p_action,'invoice_hash',pg_catalog.md5(item::text));
  END IF;
  INSERT INTO public.pos_audit_v77(tenant_id,entity_id,action,before_data,after_data,actor) VALUES(t,invoice_id,'period_reconciliation_20261027',p_data,response,u);
 END IF;
 s:=report->'summary'; issues:=(s->>'issue_count')::int; unknown:=(s->>'unknown')::numeric; billed:=(s->>'billed')::numeric;paid:=(s->>'paid')::numeric;net:=(s->>'net')::numeric;due:=(s->>'due')::numeric;
 FOR item IN SELECT x.value FROM jsonb_array_elements(report->'invoices') x LOOP
  invoice_id:=(item->>'id')::uuid;
  SELECT * INTO audit FROM public.pos_audit_v77 a WHERE a.tenant_id=t AND a.entity_id=invoice_id AND a.action='period_reconciliation_20261027' ORDER BY a.id DESC LIMIT 1;
  new_item:=item||jsonb_build_object('invoice_hash',pg_catalog.md5(item::text));
  IF audit.id IS NOT NULL THEN
   status:=audit.after_data->>'status'; unchanged:=status IN ('paid','test') AND audit.after_data->>'invoice_hash'=pg_catalog.md5(item::text) AND item->>'issue'='舊帳單標示已付，但缺少對應金流紀錄' AND item->>'voided_at' IS NULL;
   new_item:=new_item||jsonb_build_object('reconciliation',jsonb_build_object('audit_id',audit.id::text,'status',CASE WHEN status IN ('paid','test') AND NOT unchanged THEN 'stale' ELSE status END,'original_status',status,'reason',audit.after_data->>'reason','actor',audit.actor,'at',audit.created_at,'method',audit.after_data->>'method'));
   IF unchanged THEN
    total:=(item->>'total')::numeric;issues:=issues-1;unknown:=unknown-total;
    IF status='test' THEN
     billed:=billed-total;excluded_tests:=excluded_tests+1;new_item:=new_item||jsonb_build_object('issue','','test_excluded',true,'net',NULL,'due',NULL);
    ELSE
     amount:=(audit.after_data->>'amount')::numeric;
     paid:=paid+amount;net:=net+amount;due:=due+greatest(total-amount,0);
     new_item:=new_item||jsonb_build_object('issue','','paid',amount,'net',amount,'due',greatest(total-amount,0),'manual_verified',true);
    END IF;
   END IF;
  END IF;
  updated:=updated||jsonb_build_array(new_item);
 END LOOP;
 s:=s||jsonb_build_object('issue_count',issues,'invoice_count',(s->>'invoice_count')::int-excluded_tests,'excluded_test_count',excluded_tests,'unknown',unknown,'billed',billed,'paid',paid,'net',net,'due',due,'receipt_allowed',issues=0 AND (s->>'voided_residual')::numeric=0 AND (s->>'unassigned_refund_count')::int=0 AND paid>0);
 report:=report||jsonb_build_object('invoices',updated,'summary',s);
 key:=pg_catalog.md5((report-'as_of'-'revision')::text);
 RETURN report||jsonb_build_object('revision',key);
END $$;
REVOKE ALL ON FUNCTION public.period_reconcile_v20261027(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.period_reconcile_v20261027(text,jsonb) TO authenticated, service_role;
COMMIT;
