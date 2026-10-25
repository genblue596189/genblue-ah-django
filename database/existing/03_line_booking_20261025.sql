-- Additive migration. Existing booking slots, checks and approval logic remain authoritative.
BEGIN;
CREATE TABLE IF NOT EXISTS booking.line_members_v1 (
 tenant_id text NOT NULL, line_user_id text NOT NULL, owner_id uuid NOT NULL,
 verified_by uuid NOT NULL, verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,line_user_id), FOREIGN KEY(owner_id) REFERENCES public.owners(id)
);
CREATE TABLE IF NOT EXISTS booking.line_requests_v1 (
 request_id uuid PRIMARY KEY REFERENCES booking.ob_requests(id),tenant_id text NOT NULL,
 line_user_id text NOT NULL,line_name text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS booking.line_outbox_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id text NOT NULL,request_id uuid NOT NULL REFERENCES booking.ob_requests(id),
 event_key text NOT NULL UNIQUE,kind text NOT NULL,body jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,attempts integer NOT NULL DEFAULT 0,
 first_attempt_at timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),lease uuid,last_error text
);
ALTER TABLE booking.line_members_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking.line_requests_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking.line_outbox_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking.line_members_v1,booking.line_requests_v1,booking.line_outbox_v1 FROM PUBLIC,anon,authenticated;
GRANT ALL ON booking.line_members_v1,booking.line_requests_v1,booking.line_outbox_v1 TO service_role;

CREATE OR REPLACE FUNCTION booking.line_event_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO booking.line_outbox_v1(tenant_id,request_id,event_key,kind) VALUES(NEW.tenant_id,NEW.id,NEW.id||':new','staff') ON CONFLICT DO NOTHING;
 ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected','cancelled') AND EXISTS(SELECT 1 FROM booking.line_requests_v1 l WHERE l.request_id=NEW.id AND l.tenant_id=NEW.tenant_id) THEN
  INSERT INTO booking.line_outbox_v1(tenant_id,request_id,event_key,kind,body) VALUES(NEW.tenant_id,NEW.id,NEW.id||':'||NEW.status||':'||coalesce(NEW.reviewed_at::text,''),'status',jsonb_build_object('status',NEW.status)) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS line_event_v1 ON booking.ob_requests;
CREATE TRIGGER line_event_v1 AFTER INSERT OR UPDATE OF status ON booking.ob_requests FOR EACH ROW EXECUTE FUNCTION booking.line_event_v1();

CREATE OR REPLACE FUNCTION public.ob_line_public_v1(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t text;uid text:=p_data->>'line_user_id';own uuid;result jsonb;rid uuid;prior booking.line_requests_v1;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT c.tenant_id INTO t FROM booking.ob_clinics c WHERE c.slug=p_data->>'clinic' AND c.enabled FOR UPDATE;
 IF t IS NULL OR uid IS NULL OR uid !~ '^U[0-9a-fA-F]{32}$' THEN RAISE EXCEPTION '目前未開放線上預約'; END IF;
 SELECT m.owner_id INTO own FROM booking.line_members_v1 m JOIN public.owners o ON o.id=m.owner_id AND o.tenant_id=t WHERE m.tenant_id=t AND m.line_user_id=uid;
 IF p_action='identity' THEN
  RETURN jsonb_build_object('membership',CASE WHEN own IS NULL THEN 'pending' ELSE 'verified' END,'pets',CASE WHEN own IS NULL THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'species',p.species)) FROM public.pets p WHERE p.tenant_id=t AND p.owner_id=own),'[]'::jsonb) END);
 ELSIF p_action<>'submit' THEN RAISE EXCEPTION '不支援此操作'; END IF;
 rid:=(p_data->>'request_id')::uuid;
 SELECT * INTO prior FROM booking.line_requests_v1 WHERE request_id=rid;
 IF prior.request_id IS NOT NULL AND (prior.tenant_id<>t OR prior.line_user_id<>uid) THEN RAISE EXCEPTION '識別碼已使用，請重新整理'; END IF;
 IF prior.request_id IS NULL AND EXISTS(SELECT 1 FROM booking.ob_requests WHERE id=rid) THEN RAISE EXCEPTION '識別碼已使用，請重新整理'; END IF;
 IF p_data->>'pet_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.pets p WHERE p.id=(p_data->>'pet_id')::uuid AND p.tenant_id=t AND p.owner_id=own AND p.name=p_data->>'pet_name') THEN RAISE EXCEPTION '請核對預約資料'; END IF;
 result:=public.ob_public('submit',p_data-'line_user_id'-'line_name'-'pet_id');
 INSERT INTO booking.line_requests_v1(request_id,tenant_id,line_user_id,line_name) VALUES(rid,t,uid,left(coalesce(p_data->>'line_name',''),100)) ON CONFLICT DO NOTHING;
 RETURN result||jsonb_build_object('membership',CASE WHEN own IS NULL THEN 'pending' ELSE 'verified' END);
END $$;
REVOKE ALL ON FUNCTION public.ob_line_public_v1(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ob_line_public_v1(text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.ob_line_staff_v1(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t text:=public.current_tenant_id();r booking.ob_requests;l booking.line_requests_v1;own uuid;bound uuid;result jsonb;key uuid;
BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT coalesce(private.has_ability(t,'appointment'),false) THEN RAISE EXCEPTION '沒有預約管理權限' USING ERRCODE='42501'; END IF;
 IF p_action='search_pets' THEN RETURN public.ob_staff(p_action,p_data); END IF;
 IF p_action='list' THEN
  result:=public.ob_staff('list','{}');
  RETURN result||jsonb_build_object('requests',coalesce((SELECT jsonb_agg(x.r||jsonb_build_object('line_name',lr.line_name,'line_linked',lr.request_id IS NOT NULL,'membership',CASE WHEN m.owner_id IS NULL THEN 'pending' ELSE 'verified' END,'verified_owner_id',m.owner_id,'notifications',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'sent',n.sent_at IS NOT NULL,'attempts',n.attempts,'error',n.last_error)) FROM booking.line_outbox_v1 n WHERE n.request_id=lr.request_id AND n.tenant_id=t),'[]'::jsonb))) FROM jsonb_array_elements(result->'requests') AS x(r) LEFT JOIN booking.line_requests_v1 lr ON lr.request_id=(x.r->>'id')::uuid AND lr.tenant_id=t LEFT JOIN booking.line_members_v1 m ON m.tenant_id=t AND m.line_user_id=lr.line_user_id),'[]'::jsonb));
 END IF;
 PERFORM 1 FROM booking.ob_clinics WHERE tenant_id=t FOR UPDATE;
 SELECT * INTO r FROM booking.ob_requests WHERE tenant_id=t AND id=(p_data->>'id')::uuid FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION '找不到預約申請'; END IF;
 SELECT * INTO l FROM booking.line_requests_v1 WHERE request_id=r.id AND tenant_id=t;
 IF p_action='approve' THEN
  SELECT p.owner_id INTO own FROM public.pets p JOIN public.owners o ON o.id=p.owner_id AND o.tenant_id=t WHERE p.id=(p_data->>'pet_id')::uuid AND p.tenant_id=t;
  IF own IS NULL THEN RAISE EXCEPTION '請選本院寵物'; END IF;
  SELECT owner_id INTO bound FROM booking.line_members_v1 WHERE tenant_id=t AND line_user_id=l.line_user_id;
  IF bound IS NOT NULL AND bound<>own THEN RAISE EXCEPTION 'LINE已綁定另一飼主，請核對；不可自動覆蓋'; END IF;
  IF r.status='approved' AND NOT EXISTS(SELECT 1 FROM public.appointments a WHERE a.id=r.appointment_id AND a.tenant_id=t AND a.pet_id=(p_data->>'pet_id')::uuid) THEN RAISE EXCEPTION '此申請已連結其他寵物，請重新核對'; END IF;
  result:=public.ob_staff('approve',p_data);
  IF coalesce((p_data->>'verify_member')::boolean,false) THEN
   IF l.request_id IS NULL THEN RAISE EXCEPTION '此申請未綁定LINE，不能確認LINE會員'; END IF;
   INSERT INTO booking.line_members_v1(tenant_id,line_user_id,owner_id,verified_by) VALUES(t,l.line_user_id,own,auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  RETURN result;
 ELSIF p_action='reject' THEN RETURN public.ob_staff('reject',p_data);
 ELSIF p_action='message' THEN
  IF l.request_id IS NULL OR length(trim(coalesce(p_data->>'text',''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION '請填寫回覆，且申請須已連結LINE'; END IF;
  key:=(p_data->>'message_id')::uuid;IF key IS NULL THEN RAISE EXCEPTION '缺少訊息識別碼'; END IF;
  IF EXISTS(SELECT 1 FROM booking.line_outbox_v1 n WHERE n.id=key AND (n.tenant_id<>t OR n.request_id<>r.id OR n.kind<>'custom' OR n.body IS DISTINCT FROM jsonb_build_object('text',trim(p_data->>'text')))) THEN RAISE EXCEPTION '訊息識別碼已使用'; END IF;
  INSERT INTO booking.line_outbox_v1(id,tenant_id,request_id,event_key,kind,body) VALUES(key,t,r.id,key::text,'custom',jsonb_build_object('text',trim(p_data->>'text'))) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok',true,'queued',true);
 ELSE RAISE EXCEPTION '不支援此操作'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.ob_line_staff_v1(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ob_line_staff_v1(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.ob_line_outbox_v1(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n booking.line_outbox_v1;r booking.ob_requests;l booking.line_requests_v1;ts timestamptz;lease_id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF p_action='claim' THEN
  SELECT * INTO n FROM booking.line_outbox_v1 q WHERE q.tenant_id=(SELECT c.tenant_id FROM booking.ob_clinics c WHERE c.slug=p_data->>'clinic') AND q.sent_at IS NULL AND q.attempts<8 AND q.next_attempt_at<=now() AND (q.first_attempt_at IS NULL OR q.first_attempt_at>now()-interval '23 hours') ORDER BY q.created_at,q.id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF n.id IS NULL THEN RETURN NULL; END IF;
  lease_id:=gen_random_uuid();
  UPDATE booking.line_outbox_v1 SET lease=lease_id,attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),next_attempt_at=now()+interval '90 seconds' WHERE id=n.id;
  SELECT * INTO r FROM booking.ob_requests WHERE id=n.request_id AND tenant_id=n.tenant_id;
  SELECT * INTO l FROM booking.line_requests_v1 WHERE request_id=r.id AND tenant_id=n.tenant_id;
  SELECT starts_at INTO ts FROM booking.ob_slots WHERE id=r.slot_id AND tenant_id=n.tenant_id;
  RETURN jsonb_build_object('id',n.id,'lease',lease_id,'kind',n.kind,'body',n.body,'tenant_id',n.tenant_id,'request_id',r.id,'status',r.status,'starts_at',ts,'pet_name',r.pet_name,'name',r.name,'line_user_id',l.line_user_id);
 ELSIF p_action IN ('sent','failed') THEN
  UPDATE booking.line_outbox_v1 SET sent_at=CASE WHEN p_action='sent' THEN now() ELSE sent_at END,last_error=CASE WHEN p_action='failed' THEN left(p_data->>'error',120) ELSE NULL END,next_attempt_at=now()+interval '5 minutes' WHERE id=(p_data->>'id')::uuid AND lease=(p_data->>'lease')::uuid AND sent_at IS NULL;
  RETURN jsonb_build_object('ok',FOUND);
 ELSE RAISE EXCEPTION '不支援此操作'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.ob_line_outbox_v1(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ob_line_outbox_v1(text,jsonb) TO service_role;
COMMIT;
