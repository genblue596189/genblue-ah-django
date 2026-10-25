const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const db=new PGlite();await db.exec(`
create role anon;create role authenticated;create role service_role;
create schema booking;create schema auth;create schema private;
create function auth.role() returns text language sql as $$select current_setting('test.role',true)$$;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function public.current_tenant_id() returns text language sql as $$select current_setting('test.tenant',true)$$;
create function private.has_ability(text,text) returns boolean language sql as $$select true$$;
create table public.owners(id uuid primary key,tenant_id text,name text);
create table public.pets(id uuid primary key,tenant_id text,owner_id uuid,name text,species text);
create table public.appointments(id uuid primary key,tenant_id text,pet_id uuid,owner_id uuid,status text);
create table booking.ob_clinics(tenant_id text primary key,slug text,enabled boolean);
create table booking.ob_slots(id uuid primary key,tenant_id text,starts_at timestamptz);
create table booking.ob_requests(id uuid primary key,tenant_id text,slot_id uuid,name text,phone text,pet_name text,species text,status text default 'pending',reviewed_at timestamptz,appointment_id uuid);
create function public.ob_public(p_action text,p_data jsonb) returns jsonb language plpgsql as $$begin insert into booking.ob_requests(id,tenant_id,slot_id,name,phone,pet_name,species) values((p_data->>'request_id')::uuid,'A',(p_data->>'slot_id')::uuid,p_data->>'name',p_data->>'phone',p_data->>'pet_name',p_data->>'species') on conflict do nothing;return jsonb_build_object('reference',p_data->>'request_id','status','pending');end$$;
create function public.ob_staff(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql as $$declare rid uuid;begin
if p_action='list' then return jsonb_build_object('tenant_id',public.current_tenant_id(),'config',jsonb_build_object('tenant_id',public.current_tenant_id()),'requests',coalesce((select jsonb_agg(to_jsonb(r)) from booking.ob_requests r where tenant_id=public.current_tenant_id()),'[]'::jsonb));end if;
if p_action='approve' then select appointment_id into rid from booking.ob_requests where id=(p_data->>'id')::uuid;if rid is null then rid:=gen_random_uuid();insert into public.appointments values(rid,public.current_tenant_id(),(p_data->>'pet_id')::uuid,null,'已預約');end if;update booking.ob_requests set status='approved',reviewed_at=now(),appointment_id=rid where id=(p_data->>'id')::uuid;end if;
if p_action='reject' then update booking.ob_requests set status='rejected',reviewed_at=now() where id=(p_data->>'id')::uuid;end if;
return jsonb_build_object('ok',true);end$$;
insert into booking.ob_clinics values('A','genblue-ah',true),('B','other',true);
insert into public.owners values('00000000-0000-0000-0000-000000000001','A','王'),('00000000-0000-0000-0000-000000000002','B','陳');
insert into public.pets values('00000000-0000-0000-0000-000000000003','A','00000000-0000-0000-0000-000000000001','貓一','貓'),('00000000-0000-0000-0000-000000000004','B','00000000-0000-0000-0000-000000000002','犬二','犬');
insert into booking.ob_slots values('00000000-0000-0000-0000-000000000005','A',now()+interval '2 days');
`);const migration=fs.readFileSync(process.argv[2],'utf8');await db.exec(migration);await db.exec(migration);
const uid='U'+'1'.repeat(32),rid='00000000-0000-0000-0000-000000000006',pet='00000000-0000-0000-0000-000000000003';
async function rpc(name,act,data){const r=await db.query('select public.'+name+'($1,$2::jsonb) as data',[act,JSON.stringify(data)]);return r.rows[0].data;}
await db.exec("set test.role='service_role'");let d=await rpc('ob_line_public_v1','identity',{clinic:'genblue-ah',line_user_id:uid});assert.equal(d.membership,'pending');assert.equal(d.pets.length,0);
const submit={clinic:'genblue-ah',line_user_id:uid,line_name:'測試',request_id:rid,slot_id:'00000000-0000-0000-0000-000000000005',name:'王',phone:'0912345678',pet_name:'貓一',species:'貓'};
await rpc('ob_line_public_v1','submit',submit);await rpc('ob_line_public_v1','submit',submit);assert.equal((await db.query('select count(*)::int n from booking.line_outbox_v1')).rows[0].n,1);
await assert.rejects(()=>rpc('ob_line_public_v1','submit',{...submit,line_user_id:'U'+'2'.repeat(32)}));
await db.exec("set test.tenant='A';set test.uid='00000000-0000-0000-0000-000000000007'");d=await rpc('ob_line_staff_v1','list',{});assert.equal(d.requests[0].membership,'pending');assert.equal(d.requests[0].line_linked,true);
await assert.rejects(()=>rpc('ob_line_staff_v1','approve',{id:rid,pet_id:'00000000-0000-0000-0000-000000000004',verify_member:true}));
await rpc('ob_line_staff_v1','approve',{id:rid,pet_id:pet,verify_member:true});d=await rpc('ob_line_public_v1','identity',{clinic:'genblue-ah',line_user_id:uid});assert.equal(d.membership,'verified');assert.equal(d.pets.length,1);assert.equal(d.pets[0].id,pet);
await db.exec("set test.tenant='B'");d=await rpc('ob_line_staff_v1','list',{});assert.equal(d.requests.length,0);await assert.rejects(()=>rpc('ob_line_staff_v1','reject',{id:rid}));await db.exec("set test.tenant='A'");
const message_id='00000000-0000-0000-0000-000000000008';await rpc('ob_line_staff_v1','message',{id:rid,message_id,text:'您好'});await rpc('ob_line_staff_v1','message',{id:rid,message_id,text:'您好'});await assert.rejects(()=>rpc('ob_line_staff_v1','message',{id:rid,message_id,text:'不同內容'}));
const job=await rpc('ob_line_outbox_v1','claim',{clinic:'genblue-ah'});assert(job.id);assert.equal(job.tenant_id,'A');let ack=await rpc('ob_line_outbox_v1','sent',{id:job.id,lease:'00000000-0000-0000-0000-000000000009'});assert.equal(ack.ok,false);ack=await rpc('ob_line_outbox_v1','sent',{id:job.id,lease:job.lease});assert.equal(ack.ok,true);
await db.exec("set test.role='authenticated'");await assert.rejects(()=>rpc('ob_line_public_v1','identity',{clinic:'genblue-ah',line_user_id:uid}));await assert.rejects(()=>rpc('ob_line_outbox_v1','claim',{clinic:'genblue-ah'}));
console.log('PASS real PostgreSQL: install/rerun; unverified pets private; LINE request ownership; explicit membership; cross-tenant blocked; message idempotency; event queue and lease ownership; service-only RPCs');await db.close();})().catch(e=>{console.error(e);process.exit(1)});
