// verify_jwt=false. Public forms require Turnstile; LINE identity is verified server-side.
const env=(k:string)=>Deno.env.get(k)||'';
const origins=env('BOOKING_ALLOWED_ORIGINS').split(',').map(x=>x.trim()).filter(Boolean);
const hostnames=env('TURNSTILE_ALLOWED_HOSTNAMES').split(',').map(x=>x.trim()).filter(Boolean);
const lineClinic=()=>env('LINE_BOOKING_CLINIC')||'genblue-ah';
const safe=['目前未開放線上預約','請核對預約資料','此時段已停止受理','此時段已額滿，請改選時段','已有待處理預約，請聯絡醫院','識別碼已使用，請重新整理','查無符合的申請，請核對申請編號與聯絡電話','請從醫院LINE預約入口登入後重試','LINE登入已失效，請重新登入','預約服務尚未完成設定'];
const json=(data:unknown,status:number,origin:string)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':origin,'vary':'Origin','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'}});
async function rpcNamed(name:string,action:string,data:Record<string,unknown>){
 const key=env('SUPABASE_SERVICE_ROLE_KEY');
 const r=await fetch(env('SUPABASE_URL')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({p_action:action,p_data:data}),signal:AbortSignal.timeout(12000)});
 const d=await r.json();if(!r.ok)throw Error(safe.includes(d.message)?d.message:'暫時無法受理，請稍後再試或聯絡醫院');return d;
}
const rpc=(a:string,d:Record<string,unknown>)=>rpcNamed('ob_public',a,d);
async function body(req:Request){
 const reader=req.body?.getReader();if(!reader)throw Error('請核對預約資料');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw Error('請核對預約資料');}chunks.push(value);}
 const bytes=new Uint8Array(size);let off=0;for(const c of chunks){bytes.set(c,off);off+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
async function identity(token:unknown){
 if(typeof token!=='string'||!token||token.length>4096)throw Error('請從醫院LINE預約入口登入後重試');
 const r=await fetch('https://api.line.me/oauth2/v2.1/verify',{method:'POST',body:new URLSearchParams({id_token:token,client_id:env('LINE_LOGIN_CHANNEL_ID')}),signal:AbortSignal.timeout(10000)});
 const d=await r.json();if(!r.ok||d.aud!==env('LINE_LOGIN_CHANNEL_ID')||d.iss!=='https://access.line.me'||!/^U[0-9a-f]{32}$/i.test(d.sub||'')||!Number.isFinite(d.exp)||d.exp<=Date.now()/1000)throw Error('LINE登入已失效，請重新登入');
 return {line_user_id:d.sub,line_name:typeof d.name==='string'?d.name.slice(0,100):''};
}
const dateLabel=(x:string)=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(x));
export async function dispatch(limit=10){
 if(!env('LINE_CHANNEL_ACCESS_TOKEN')||!/^U[0-9a-f]{32}$/i.test(env('LINE_NOTIFY_USER_ID'))||!/^https:\/\//.test(env('BOOKING_REVIEW_URL')))return {configured:false};
 let sent=0,failed=0;
 for(let i=0;i<limit;i++){
  const job=await rpcNamed('ob_line_outbox_v1','claim',{clinic:lineClinic()});if(!job)break;
  try{
   // Superseded decisions are never delivered later as an obsolete approval.
   if(job.kind==='status'&&job.body.status!==job.status){await rpcNamed('ob_line_outbox_v1','sent',{id:job.id,lease:job.lease});continue;}
   const to=job.kind==='staff'?env('LINE_NOTIFY_USER_ID'):job.line_user_id;
   if(!to)throw Error('missing_line_identity');
   const labels:Record<string,string>={approved:'預約已核准',rejected:'預約未通過或已取消，請聯絡醫院確認',cancelled:'預約已取消'};
   const text=job.kind==='staff'?'有新的預約待審核\n'+dateLabel(job.starts_at)+'｜'+job.pet_name+'\n請登入手機審核頁：\n'+env('BOOKING_REVIEW_URL'):
    job.kind==='custom'?job.body.text:'吉布動物醫院｜'+(labels[job.status]||'預約狀態已更新')+'\n'+dateLabel(job.starts_at)+'｜'+job.pet_name+'\n申請編號：'+job.request_id;
   const response=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{authorization:'Bearer '+env('LINE_CHANNEL_ACCESS_TOKEN'),'content-type':'application/json','X-Line-Retry-Key':job.id},body:JSON.stringify({to,messages:[{type:'text',text}]}),signal:AbortSignal.timeout(10000)});
   if(!response.ok&&!(response.status===409&&response.headers.has('x-line-accepted-request-id')))throw Error('line_http_'+response.status);
   await rpcNamed('ob_line_outbox_v1','sent',{id:job.id,lease:job.lease});sent++;
  }catch(e){await rpcNamed('ob_line_outbox_v1','failed',{id:job.id,lease:job.lease,error:e instanceof Error&&/^line_http_\d+$|^missing_line_identity$/.test(e.message)?e.message:'notification_unconfirmed'});failed++;}
 }
 return {configured:true,sent,failed};
}
function dispatchLater(){EdgeRuntime.waitUntil(dispatch(5).catch(()=>{}));}
export async function handler(req:Request){
 const origin=req.headers.get('origin')||'';
 // Scheduled worker / authenticated backend only. No token is exposed to the browser.
 if(req.method==='POST'&&!origin&&env('LINE_DISPATCH_SECRET')&&req.headers.get('authorization')==='Bearer '+env('LINE_DISPATCH_SECRET')){
  try{return json(await dispatch(20),200,'');}catch{return json({error:'通知工作未完成，佇列保留'},503,'');}
 }
 if(!origins.includes(origin))return json({error:'不允許此來源'},403,'');
 if(req.method==='OPTIONS')return json({},200,origin);
 if(!['GET','POST'].includes(req.method))return json({error:'不支援此操作'},405,origin);
 if(!env('TURNSTILE_SITE_KEY')||!env('TURNSTILE_SECRET_KEY')||!hostnames.length||!env('SUPABASE_SERVICE_ROLE_KEY'))return json({error:'預約服務尚未完成設定'},503,origin);
 try{
  const url=new URL(req.url);
  if(req.method==='GET'){
   const clinic=url.searchParams.get('clinic')||'';if(!/^[a-z0-9-]{3,60}$/.test(clinic))return json({error:'院所網址有誤'},400,origin);
   const config={site_key:env('TURNSTILE_SITE_KEY'),liff_id:clinic===lineClinic()?env('LINE_LIFF_ID'):'',line_required:clinic===lineClinic()&&env('LINE_REQUIRE_LOGIN')==='true'};
   if(url.searchParams.get('mode')==='lookup')return json(config,200,origin);
   return json({...await rpc('slots',{clinic}),...config},200,origin);
  }
  if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'資料格式有誤'},400,origin);
  const b=await body(req);if(!b||typeof b!=='object'||Array.isArray(b)||b.website||b.consent!==true)return json({error:'請核對填寫內容'},400,origin);
  const lookup=b.action==='status',member=b.action==='identity';if(b.action&&!['status','identity'].includes(b.action))return json({error:'不支援此操作'},400,origin);
  const limits:Record<string,number>=member?{clinic:60,token:2048,id_token:4096}:lookup?{clinic:60,reference:36,phone:30,token:2048}:{clinic:60,request_id:36,slot_id:36,name:100,phone:30,pet_name:100,species:10,reason:1000,token:2048};
  for(const [k,max]of Object.entries(limits))if(typeof b[k]!=='string'||b[k].length>max)return json({error:'請核對填寫內容'},400,origin);
  if(!/^[a-z0-9-]{3,60}$/.test(b.clinic))return json({error:'請核對填寫內容'},400,origin);
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(lookup&&!uuid.test(b.reference))return json({error:'申請編號格式不符，請聯絡醫院確認'},400,origin);
  if(!lookup&&!member&&(!uuid.test(b.request_id)||!uuid.test(b.slot_id)))return json({error:'預約識別資料有誤，請重新整理頁面'},400,origin);
  if(!b.token.trim())return json({error:'未收到驗證結果，請重新整理頁面後再驗證'},400,origin);
  const phone=member?'':b.phone.replace(/[\s()+-]/g,'');if(!member&&!/^\d{8,15}$/.test(phone))return json({error:'請核對聯絡電話'},400,origin);
  if(!lookup&&!member&&(!b.name.trim()||!b.pet_name.trim()||!['犬','貓','其他'].includes(b.species)||b.registered_hint!==undefined&&(typeof b.registered_hint!=='string'||b.registered_hint.length>150)))return json({error:'請核對填寫內容'},400,origin);
  const check=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env('TURNSTILE_SECRET_KEY'),response:b.token}),signal:AbortSignal.timeout(10000)});const proof=await check.json();
  if(!check.ok||!proof.success||proof.action!=='booking'||!hostnames.includes(proof.hostname))return json({error:'驗證逾時或失敗，請重新驗證'},400,origin);
  if(lookup)return json(await rpc('status',{clinic:b.clinic,reference:b.reference,phone}),200,origin);
  const useLine=b.clinic===lineClinic()&&!!env('LINE_LIFF_ID');
  if(member){if(!useLine)throw Error('預約服務尚未完成設定');return json(await rpcNamed('ob_line_public_v1','identity',{clinic:b.clinic,...await identity(b.id_token)}),200,origin);}
  if(useLine&&env('LINE_REQUIRE_LOGIN')==='true'&&!b.id_token)throw Error('請從醫院LINE預約入口登入後重試');
  const data={clinic:b.clinic,request_id:b.request_id,slot_id:b.slot_id,name:b.name.trim(),phone,pet_name:b.pet_name.trim(),species:b.species,reason:b.reason.trim(),registered_hint:(b.registered_hint||'').trim()};
  const result=useLine&&b.id_token?await rpcNamed('ob_line_public_v1','submit',{...data,...await identity(b.id_token),...(typeof b.pet_id==='string'&&uuid.test(b.pet_id)?{pet_id:b.pet_id}:{})}):await rpc('submit',data);
  dispatchLater();return json(result,200,origin);
 }catch(e){const m=e instanceof Error?e.message:'';return json({error:safe.includes(m)?m:'暫時無法受理，請稍後再試或聯絡醫院'},400,origin);}
}
Deno.serve(handler);
