
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
async function load(){try{const r=await fetch(API+'?clinic='+encodeURIComponent(clinic),{signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.error||'無法讀取時段');$('title').textContent=d.name+'｜線上預約';$('notice').textContent=d.notice;
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
 const draft={clinic,slot_id:$('slot').value,name:$('name').value.trim(),phone:$('phone').value.trim(),pet_name:$('pet').value.trim(),species:$('species').value,reason:$('reason').value.trim(),registered_hint:$('registered-hint').value.trim()};
 const fingerprint=JSON.stringify(draft);if(lastFingerprint!==fingerprint){requestID=crypto.randomUUID();lastFingerprint=fingerprint;}
 try{const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...draft,request_id:requestID,token,consent:$('consent').checked,website:$('website').value}),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.error||'送出失敗');
 $('form').hidden=true;$('message').textContent='';$('success').hidden=false;$('success').textContent=(d.status==='approved'?'醫院已確認此申請。':d.status==='rejected'?'此申請已由醫院取消，請聯絡醫院。':'已收到申請，尚待醫院確認。')+'\n申請編號：'+d.reference+'\n時段：'+$('slot').selectedOptions[0].textContent+(d.status==='pending'?'\n時段暫時保留，待醫院確認後才成立。':'')+'\n請記下申請編號，並使用下方查詢查看狀態；如需確認或變更，請聯絡醫院。';$('success').style.whiteSpace='pre-wrap';$('lookup-reference').value=d.reference;$('lookup-phone').value=draft.phone;
 }catch(e){
 const state=bookingHoursStateV9131(),duplicate=/已有本日預約|此寵物已有同時段申請/.test(e.message),hours=/申請受理時間|上午時段須/.test(e.message);
 const network=e.name==='TimeoutError'||e.name==='AbortError'||e instanceof TypeError||navigator.onLine===false;
 $('message').textContent=!state.open?state.message:hours?e.message:duplicate?'您已有本日預約申請，請勿重複送出。如需取消或更改時間，請來電或透過 LINE 訊息通知本院。':network?'連線未完成，請保留原填寫內容，稍後以同一份申請重試，避免重複建立。':e.message+'。請核對申請內容或聯絡醫院。';
 updateBookingHoursV9127();
 }
 finally{busy=false;token='';if(widget!==null)turnstile.reset(widget);$('submit').disabled=true;}};
$('lookup-form').onsubmit=async e=>{e.preventDefault();if(lookupBusy||!lookupToken)return;lookupBusy=true;$('lookup-submit').disabled=true;$('lookup-result').textContent='查詢中…';try{const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'status',clinic,reference:$('lookup-reference').value.trim(),phone:$('lookup-phone').value.trim(),token:lookupToken,website:'',consent:true}),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.error||'查詢失敗');const labels={pending:'待醫院確認：時段暫時保留，尚未成立。',approved:'醫院已確認：預約已成立。',rejected:'申請未通過，請聯絡醫院。',cancelled:'預約已取消。'};$('lookup-result').textContent=(labels[d.status]||'請聯絡醫院確認。')+'\n預約時間：'+dateLabel(d.starts_at);}catch(e){$('lookup-result').textContent=e.message;}finally{lookupBusy=false;lookupToken='';if(lookupWidget!==null)turnstile.reset(lookupWidget);$('lookup-submit').disabled=true;}};
updateBookingHoursV9127();setInterval(updateBookingHoursV9127,15000);document.addEventListener('visibilitychange',updateBookingHoursV9127);
load();
