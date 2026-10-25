-- Run once in Supabase SQL Editor before deploying this update.
BEGIN;
CREATE OR REPLACE FUNCTION public.pos_family_pending_v20261025(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE tenant text:=public.current_tenant_id()::text; actor uuid:=auth.uid(); profile jsonb;
 prior public.pos_requests_v77; q public.pos_pending_v77; e jsonb; result jsonb;
 rows jsonb:='[]'; total numeric:=0; sub numeric:=0; discount numeric:=0; owner_id text;
 request_id uuid:=(p_data->>'id')::uuid;
BEGIN
 IF actor IS NULL OR tenant IS NULL OR request_id IS NULL THEN RAISE EXCEPTION '請先登入有效院所'; END IF;
 SELECT to_jsonb(u) INTO profile FROM public.user_profiles u WHERE u.user_id=actor AND u.tenant_id::text=tenant;
 IF profile IS NULL OR NOT coalesce(profile->>'role'='admin' OR coalesce((profile->>'permission_checkout')::boolean,profile->>'role'='staff' OR (profile->>'role'='doctor' AND coalesce((profile->>'can_checkout')::boolean,false))),false) THEN RAISE EXCEPTION '沒有結帳權限'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('pos_v77:'||tenant,0));
 SELECT * INTO prior FROM public.pos_requests_v77 x WHERE x.id=request_id;
 IF prior.id IS NOT NULL THEN
  IF prior.tenant_id<>tenant OR prior.payload IS DISTINCT FROM p_data THEN RAISE EXCEPTION '相同收款請求不可更改內容'; END IF;
  RETURN prior.result;
 END IF;
 IF jsonb_typeof(p_data->'entries') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION '請選擇待付款帳單'; END IF;
 IF jsonb_array_length(p_data->'entries') NOT BETWEEN 1 AND 20 OR p_data->>'method' IS NULL OR p_data->>'method' NOT IN ('現金','信用卡','轉帳','行動支付') THEN RAISE EXCEPTION '收款資料不正確'; END IF;
 IF (SELECT count(DISTINCT x->>'pending_id') FROM jsonb_array_elements(p_data->'entries') x)<>jsonb_array_length(p_data->'entries') OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_data->'entries') x)<>jsonb_array_length(p_data->'entries') THEN RAISE EXCEPTION '帳單或收款識別碼重複'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p_data->'entries') ORDER BY value->>'pending_id' LOOP
  IF (e->>'id')::uuid=request_id OR EXISTS(SELECT 1 FROM public.pos_requests_v77 x WHERE x.id=(e->>'id')::uuid) THEN RAISE EXCEPTION '收款識別碼已使用'; END IF;
  SELECT * INTO q FROM public.pos_pending_v77 x WHERE x.id=(e->>'pending_id')::uuid AND x.tenant_id=tenant FOR UPDATE;
  IF q.id IS NULL OR q.state<>'pending' OR q.version IS DISTINCT FROM (e->>'version')::integer THEN RAISE EXCEPTION '帳單已更新或已收款，請更新後重新核對'; END IF;
  IF owner_id IS NOT NULL AND owner_id IS DISTINCT FROM q.draft->>'ownerId' THEN RAISE EXCEPTION '只能選擇同一飼主'; END IF;
  owner_id:=q.draft->>'ownerId';
  IF owner_id IS NULL THEN RAISE EXCEPTION '缺少飼主資料'; END IF;
  total:=total+(q.draft->>'total')::numeric;sub:=sub+(q.draft->>'subtotal')::numeric;discount:=discount+(q.draft->>'discount')::numeric;
 END LOOP;
 IF total IS NULL OR total::text IN ('NaN','Infinity','-Infinity') OR total<0 THEN RAISE EXCEPTION '總額不正確'; END IF;
 IF p_data->>'method'='現金' AND (coalesce(p_data->>'tendered','') IN ('','NaN','Infinity','-Infinity') OR (p_data->>'tendered')::numeric<total) THEN RAISE EXCEPTION '收到現金不足或不正確'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p_data->'entries') ORDER BY value->>'pending_id' LOOP
  SELECT * INTO q FROM public.pos_pending_v77 x WHERE x.id=(e->>'pending_id')::uuid AND x.tenant_id=tenant;
  result:=public.pos_v77('pay',jsonb_build_object('id',e->'id','pending_id',e->'pending_id','version',e->'version','method',p_data->'method','shift_id',p_data->'shift_id','tendered',CASE WHEN p_data->>'method'='現金' THEN q.draft->'total' ELSE 'null'::jsonb END));
  rows:=rows||jsonb_build_array(jsonb_build_object('pending_id',q.id,'invoice_id',result->'invoice_id','draft',q.draft));
 END LOOP;
 result:=jsonb_build_object('request_id',request_id,'owner_id',owner_id,'invoices',rows,'total',total,'subtotal',sub,'discount',discount,'created_at',now());
 INSERT INTO public.pos_requests_v77(id,tenant_id,payload,result,actor) VALUES(request_id,tenant,p_data,result,actor);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.pos_family_pending_v20261025(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_family_pending_v20261025(jsonb) TO authenticated;
COMMIT;
