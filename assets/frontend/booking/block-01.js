
'use strict';
// 僅有公開函式網址；無管理金鑰或員工帳號。
const API=window.GENBLUE_CONFIG.supabaseUrl+'/functions/v1/online-booking';
const clinic=new URLSearchParams(location.search).get('clinic')||'genblue-ah';
const $=id=>document.getElementById(id);let token='',widget=null,busy=false,lastFingerprint='',requestID='';let availableSlots=[];let lookupToken='',lookupWidget=null,lookupBusy=false;
const dateLabel=x=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(x));
function bookingHoursStateV9131(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const value=kind=>parts.find(p=>p.type===kind).value;
 const hour=Number(value('hour')),open=hour>=9&&hour<21;
 const day=value('year')+'-'+value('month')+'-'+value('day');
 const nextDay=hour>=21?new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10):day;
 const next=nextDay.replaceAll('-','/')+' 09:00';
 return {open,message:open?'':(hour<9?'目前尚未開放線上預約申請。':'今日線上預約申請已截止。')+'\n申請受理時間：每日09:00至21:00前（台灣時間）。\n下次開放申請：'+next+'（台灣時間）。\n上午時段須於前一天21:00前申請。您仍可查詢既有預約；取消或改期請來電或透過 LINE 訊息通知本院。'};
}
function bookingAcceptingNowV9127(now=new Date()){return bookingHoursStateV9131(now).open;}
function updateBookingHoursV9127(){
 const state=bookingHoursStateV9131();
 $('submit').disabled=busy||!token||!state.open;
 $('submit').textContent=state.open?'送出預約申請':'目前非受理時間，請於開放後送出';
 $('booking-hours-status').textContent=state.message;
 $('booking-hours-status').hidden=state.open;
}
function turnstileReady(){lookupWidget=turnstile.render('#lookup-captcha',{sitekey:window.bookingSiteKey,action:'booking',callback:t=>{lookupToken=t;$('lookup-submit').disabled=lookupBusy;},'expired-callback':()=>{lookupToken='';$('lookup-submit').disabled=true;},'error-callback':()=>{lookupToken='';$('lookup-submit').disabled=true;}});widget=turnstile.render('#captcha',{sitekey:window.bookingSiteKey,action:'booking',callback:t=>{token=t;updateBookingHoursV9127();},'expired-callback':()=>{token='';$('submit').disabled=true;},'error-callback':()=>{token='';$('submit').disabled=true;$('message').textContent='驗證未完成，請重新整理後再試。';}});}
async function load(){try{const r=await fetch(API+'?clinic='+encodeURIComponent(clinic),{signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.error||'無法讀取時段');await initializeBookingLineV1(d);$('title').textContent=d.name+'｜線上預約';$('notice').textContent=d.notice;
 if(!d.slots.length){$('message').textContent='目前沒有可預約時段，您仍可查詢既有申請。';}
 availableSlots=d.slots;
 const days=[...new Set(d.slots.map(s=>taiwanDay(s.starts_at)))].sort();
 if(days.length){$('booking-date').min=days[0];$('booking-date').max=days.at(-1);$('booking-date').value=days[0];renderTimes();}

 $('form').hidden=!d.slots.length;
 }catch(e){$('notice').textContent='目前無法使用線上預約';$('message').textContent=e.message+'。請聯絡醫院。';}finally{try{const r=await fetch(API+'?clinic='+encodeURIComponent(clinic)+'&mode=lookup',{signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||!d.site_key)throw Error('查詢驗證無法載入');window.bookingSiteKey=d.site_key;const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=turnstileReady&render=explicit';script.async=true;script.onerror=()=>{$('lookup-result').textContent='驗證服務無法載入，請稍後再試。';};document.head.append(script);}catch(e){$('lookup-result').textContent='目前無法載入查詢驗證，請稍後再試或聯絡醫院。';}}}
function taiwanDay(x){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(x));return ['year','month','day'].map(k=>p.find(v=>v.type===k).value).join('-');}
function renderTimes(){const slots=availableSlots.filter(s=>taiwanDay(s.starts_at)===$('booking-date').value);$('slot').replaceChildren(new Option('請選擇時間',''));for(const s of slots)$('slot').append(new Option(dateLabel(s.starts_at)+'（尚有 '+s.remaining+' 個名額）',s.id));$('date-hint').textContent=slots.length?'請選擇下方時間；送出後需由醫院確認。':'這天休診、已額滿或未開放，請改選其他日期。';}
$('booking-date').onchange=renderTimes;
$('form').onsubmit=async e=>{e.preventDefault();if(!bookingAcceptingNowV9127()){updateBookingHoursV9127();$('message').textContent=bookingHoursStateV9131().message;$('booking-hours-status').scrollIntoView({block:'center',behavior:'smooth'});return;}if(busy||!token)return;busy=true;$('submit').disabled=true;$('message').textContent='正在送出，請稍候…';
 const draft={clinic,slot_id:$('slot').value,name:$('name').value.trim(),phone:$('phone').value.trim(),pet_name:$('pet').value.trim(),species:$('species').value,...(bookingLineV1.petId?{pet_id:bookingLineV1.petId}:{}),reason:$('reason').value.trim(),registered_hint:$('registered-hint').value.trim()};
 const fingerprint=JSON.stringify(draft);if(lastFingerprint!==fingerprint){requestID=crypto.randomUUID();lastFingerprint=fingerprint;}
 try{const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...draft,...(bookingLineV1.ready&&liff.isLoggedIn()?{id_token:liff.getIDToken()}:{}),request_id:requestID,token,consent:$('consent').checked,website:$('website').value}),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.error||'送出失敗');
 $('form').hidden=true;$('message').textContent='';$('success').hidden=false;$('success').textContent=(d.status==='approved'?'醫院已確認此申請。':d.status==='rejected'?'此申請已由醫院取消，請聯絡醫院。':'已收到申請，尚待醫院確認。')+'\n申請編號：'+d.reference+'\n時段：'+$('slot').selectedOptions[0].textContent+(d.status==='pending'?'\n時段暫時保留，待醫院確認後才成立。':'')+'\n請記下申請編號，並使用下方查詢查看狀態；如需確認或變更，請聯絡醫院。';$('success').style.whiteSpace='pre-wrap';$('lookup-reference').value=d.reference;$('lookup-phone').value=draft.phone;
 }catch(e){
 const state=bookingHoursStateV9131(),duplicate=/已有本日預約|此寵物已有同時段申請/.test(e.message),hours=/申請受理時間|上午時段須/.test(e.message);
 const network=e.name==='TimeoutError'||e.name==='AbortError'||e instanceof TypeError||navigator.onLine===false;
 $('message').textContent=!state.open?state.message:hours?e.message:duplicate?'您已有本日預約申請，請勿重複送出。如需取消或更改時間，請來電或透過 LINE 訊息通知本院。':network?'連線未完成，請保留原填寫內容，稍後以同一份申請重試，避免重複建立。':e.message+'。請核對申請內容或聯絡醫院。';
 updateBookingHoursV9127();
 }
 finally{busy=false;token='';if(widget!==null)turnstile.reset(widget);$('submit').disabled=true;}};
$('lookup-form').onsubmit=async e=>{e.preventDefault();if(lookupBusy||!lookupToken)return;lookupBusy=true;$('lookup-submit').disabled=true;$('lookup-result').textContent='查詢中…';try{const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'status',clinic,reference:$('lookup-reference').value.trim(),phone:$('lookup-phone').value.trim(),token:lookupToken,website:'',consent:true}),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.error||'查詢失敗');const labels={pending:'待醫院確認：時段暫時保留，尚未成立。',approved:'醫院已確認：預約已成立。',rejected:'申請未通過，請聯絡醫院。',cancelled:'預約已取消。'};$('lookup-result').textContent=(labels[d.status]||'請聯絡醫院確認。')+'\n預約時間：'+dateLabel(d.starts_at);}catch(e){$('lookup-result').textContent=e.message;}finally{lookupBusy=false;lookupToken='';if(lookupWidget!==null)turnstile.reset(lookupWidget);$('lookup-submit').disabled=true;}};
setInterval(updateBookingHoursV9127,15000);document.addEventListener('visibilitychange',updateBookingHoursV9127);


const bookingLineV1={ready:false,petId:null,pets:[],required:false};
async function initializeBookingLineV1(config){
 if(!config.liff_id)return;bookingLineV1.required=config.line_required===true;$('line-membership').hidden=false;
 try{
  const bounded=p=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('LINE載入逾時，請重新整理')),8000);Promise.resolve(p).then(resolve,reject).finally(()=>clearTimeout(timer));});
  if(!window.liff)await bounded(new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://static.line-scdn.net/liff/edge/2/sdk.js';s.onload=resolve;s.onerror=()=>reject(Error('LINE元件無法載入'));document.head.append(s);}));
  await bounded(liff.init({liffId:config.liff_id}));bookingLineV1.ready=true;
  if(!liff.isLoggedIn()){$('line-status').textContent='請使用LINE登入以便辨識會員及接收預約通知。';$('line-login').hidden=false;}
  else{$('line-status').textContent='LINE已登入。首次會員資格由院方人工核對；已綁定者可按下方按鍵查詢寵物。';$('line-check').hidden=false;}
 }catch(e){$('line-status').textContent=e.message+'，請稍後重新整理或聯絡醫院。';}
}
$('line-login').onclick=()=>{if(bookingLineV1.ready)liff.login({redirectUri:location.origin+'/booking.html?clinic='+encodeURIComponent(clinic)});};
$('line-check').onclick=async()=>{
 if(busy||!bookingLineV1.ready||!liff.isLoggedIn())return;
 if(!token){$('line-status').textContent='請先完成預約表單下方的驗證，再按會員核對。';return;}
 busy=true;$('line-check').disabled=true;updateBookingHoursV9127();
 try{const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'identity',clinic,token,id_token:liff.getIDToken(),website:'',consent:true}),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.error||'會員核對未完成');bookingLineV1.pets=d.pets||[];
 $('line-status').textContent=d.membership==='verified'?'已確認會員，請選擇旗下寵物。':'會員待確認：請填寫原登記飼主姓名或病歷號，由院方核對後確認。';
 $('member-pets-label').hidden=!bookingLineV1.pets.length;$('member-pets').replaceChildren(new Option('請選擇寵物',''));for(const p of bookingLineV1.pets)$('member-pets').append(new Option(p.name+'（'+p.species+'）',p.id));
 }catch(e){$('line-status').textContent=e.message;}finally{busy=false;token='';if(widget!==null)turnstile.reset(widget);$('line-check').disabled=false;updateBookingHoursV9127();}
};
$('member-pets').onchange=()=>{const pet=bookingLineV1.pets.find(p=>p.id===$('member-pets').value);bookingLineV1.petId=pet?.id||null;if(pet){$('pet').value=pet.name;$('species').value=['犬','貓'].includes(pet.species)?pet.species:'其他';}};
for(const id of ['pet','species'])$(id).addEventListener('input',()=>{bookingLineV1.petId=null;$('member-pets').value='';});
$('form').addEventListener('submit',e=>{if(bookingLineV1.required&&(!bookingLineV1.ready||!liff.isLoggedIn())){e.preventDefault();e.stopImmediatePropagation();$('message').textContent='請先使用LINE登入。';}},true);
updateBookingHoursV9127();load();
