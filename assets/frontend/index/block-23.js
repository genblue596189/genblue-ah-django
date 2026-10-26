
(() => {
'use strict';
const panel=document.getElementById('online_booking');const db=_supabase;
const scope=()=>CURRENT_USER?.id&&CURRENT_TENANT_ID?CURRENT_USER.id+'|'+CURRENT_TENANT_ID:'';
let activeScope='';
const allowed=()=>!!CURRENT_USER&&(CURRENT_PROFILE?.role==='admin'||(CURRENT_PROFILE?.permission_appointment??['staff','doctor'].includes(CURRENT_PROFILE?.role)));
const $=x=>document.getElementById('ob59-'+x);let state=null,review=null,pet=null,busy=false,searchGeneration=0;
const labelDate=x=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(x));
function message(x){$('message').textContent=x;$('weekly-feedback').textContent=x;}
function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;}
async function rpc(action,data={}){const expected=activeScope;if(!allowed()||!expected||expected!==scope())throw Error('登入狀態已改變，請重新開啟線上預約。');const {data:d,error}=await (action==='calendar'?db.rpc('ob_calendar_v92_2',{p_start:data.start}):db.rpc('ob_staff',{p_action:action,p_data:data}));if(error){if(error.code==='PGRST202'||/Could not find the function|does not exist/.test(error.message))throw Error(action==='calendar'?'請先執行 booking_early_checkin_v92_2.sql，再重新讀取預約日曆。':'原院尚未安裝線上預約資料介面。請先完成套件內的後端設定；現有看診功能可照常使用。');throw Error(error.message);}if(expected!==activeScope||expected!==scope())throw Error('登入狀態已改變，請重新開啟線上預約。');return d;}
async function action(fn){if(busy)return;busy=true;panel.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){message(e.message);}finally{busy=false;panel.querySelectorAll('button').forEach(b=>b.disabled=false);$('approve').disabled=!pet;}}
function closeReview(){searchGeneration++;review=null;pet=null;$('review').hidden=true;$('pet-results').replaceChildren();$('selected-pet').textContent='';$('approve').disabled=true;}
async function load(){const results=await Promise.all([rpc('list'),rpc('calendar',{start:weekV60})]);const [next,calendar]=results;if(calendar.tenant_id!==CURRENT_TENANT_ID)throw Error('院所資料不符，停止顯示。');if(next.config?.tenant_id&&next.config.tenant_id!==CURRENT_TENANT_ID)throw Error('院所資料不符，停止顯示。');state=next;showBookingNoticeV62(next.pending_count);$('app').hidden=false;$('settings').hidden=!state.admin;closeReview();
 if(state.config){$('clinic-name').value=state.config.name;$('slug').value=state.config.slug;$('enabled').checked=state.config.enabled;$('notice').value=state.config.notice;}
 $('public-link').href='https://genblue596189.github.io/genblue-ah/booking.html?clinic='+encodeURIComponent(state.config?.slug||'genblue-ah');
 $('slots').replaceChildren();for(const s of state.slots){const p=document.createElement('p');p.textContent=labelDate(s.starts_at)+'｜名額 '+s.capacity+'｜'+(s.enabled?'開放':'關閉');if(state.admin&&s.enabled){const closeButton=button('關閉時段',()=>action(async()=>{await rpc('close_slot',{id:s.id});await load();message('時段已關閉；已送出的申請保留，請個別處理。');}));closeButton.classList.add('booking-close-v921');p.append(closeButton);}$('slots').append(p);}
 $('requests').replaceChildren();$('history').replaceChildren();const pending=state.requests.filter(r=>r.status==='pending');$('pending-count').textContent='（本頁 '+pending.length+'／共 '+state.pending_count+'）';if(!pending.length)$('requests').textContent='目前沒有待確認申請。';
 renderScheduleV60();await renderCalendarV60(calendar);
 for(const r of state.requests){const box=document.createElement('div');box.className='card request';for(const text of [labelDate(r.starts_at)+'｜'+r.name+'｜'+r.phone,'寵物：'+r.pet_name+'（'+r.species+'）','原登記資訊：'+(r.registered_hint||'未填'),'原因：'+(r.reason||'未填'),'申請編號：'+r.id]){const p=document.createElement('p');p.textContent=text;box.append(p);}
 if(r.status==='pending'){box.append(button('核對寵物並確認',()=>{closeReview();review=r;$('review').hidden=false;$('review-text').textContent=r.name+'／'+r.phone+'／'+r.pet_name+'／'+labelDate(r.starts_at)+'／原登記資訊：'+(r.registered_hint||'未填');$('pet-query').value=r.pet_name;$('review').scrollIntoView({behavior:'smooth'});}));box.append(button('拒絕申請',()=>action(async()=>{if(!confirm('拒絕此申請？請另行聯絡飼主。'))return;await rpc('reject',{id:r.id});await load();message('申請已拒絕，名額已釋出。');})));$('requests').append(box);}
 else{const p=document.createElement('p');p.textContent=r.status==='approved'?'已確認（請聯絡飼主）':r.appointment_id?'已取消':'已拒絕';box.append(p);if(r.status==='approved')box.append(button('取消預約',()=>action(async()=>{if(!confirm('取消此已確認預約？已報到的個案請回院內流程處理。'))return;await rpc('reject',{id:r.id});await load();try{await loadAppointments();}catch(e){message('取消已完成；院內列表更新失敗，請按更新資料。');return;}message('預約已取消，請聯絡飼主。');})));$('history').append(box);}}
}

$('reload').onclick=()=>action(async()=>{await load();message('已重新讀取。');});

$('config').onsubmit=e=>{e.preventDefault();action(async()=>{await rpc('settings',{name:$('clinic-name').value.trim(),slug:$('slug').value.trim(),enabled:$('enabled').checked,notice:$('notice').value.trim()});await load();message('院所設定已儲存。');});};
$('slot-form').onsubmit=e=>{e.preventDefault();action(async()=>{const dt=new Date($('slot-date').value+'T'+$('slot-time').value+':00+08:00');await rpc('slot',{starts_at:dt.toISOString(),capacity:1});await load();message('時段已儲存。');});};
$('cancel-review').onclick=closeReview;
$('search-form').onsubmit=async e=>{e.preventDefault();if(busy||!review)return;const gen=++searchGeneration;pet=null;$('approve').disabled=true;$('selected-pet').textContent='';$('pet-results').textContent='查詢中…';
 try{const q=$('pet-query').value.trim().replace(/[\\%_(),.]/g,'');if(!q)throw Error('請輸入姓名或電話');
 const tenant=state.config?.tenant_id;if(!tenant)throw Error('請管理者先儲存院所設定');
 const found=await rpc('search_pets',{query:q});if(gen!==searchGeneration)return;if(found.tenant_id!==tenant)throw Error('院所資料不符');const result={data:found.pets};$('pet-results').replaceChildren();
 if(!result.data.length)$('pet-results').textContent='找不到；新病患請先在院內系統建立。';
 for(const p of result.data.slice(0,50)){const o=p.owners;const text=p.name+'（'+p.species+'）｜'+o.name+'｜'+(o.mobile||o.phone||'無電話')+'｜系統碼 '+(o.system_code||'無')+'｜舊號 '+(o.owner_code||'無')+'｜晶片 '+(p.microchip||'無');$('pet-results').append(button(text,()=>{pet=p;$('selected-pet').textContent='選擇：'+text;$('approve').disabled=false;}));}
 if(result.data.length>50){const p=document.createElement('p');p.textContent='結果較多，最多顯示50筆；請增加關鍵字核對。';$('pet-results').append(p);}
 }catch(e){if(gen===searchGeneration)$('pet-results').textContent=e.message;}};
$('approve').onclick=()=>action(async()=>{
 if(!review||!pet)return;
 if(!confirm('確認將此申請連到 '+pet.owners.name+' 的 '+pet.name+'？確認成功後，此時段會停止接受新申請。'))return;
 const selected={id:review.id,pet_id:pet.id,slot_id:review.slot_id};
 await rpc('approve',{id:selected.id,pet_id:selected.pet_id});
 let closed=false;
 try{await load();closed=state.slots.some(s=>s.id===selected.slot_id&&s.enabled===false);}
 catch(e){message('預約已確認；畫面更新未完成：'+e.message+'。請按重新讀取核對，勿重複建立預約。');return;}
 const closing=closed?'此時段已自動關閉，不再接受新申請。':'尚未確認此時段已關閉，請管理者執行 booking_auto_close_v91_24.sql，並重新讀取核對。';
 try{await loadAppointments();}catch(e){message('預約已確認；'+closing+' 院內列表更新失敗，請按更新資料。');return;}
 message('預約已確認並寫入院內預約；'+closing+' 請聯絡飼主，到院報到後才會進入候診。');
});
$('export').onclick=()=>action(async()=>{const d=await rpc('export');const url=globalThis.URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='線上預約資料_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>globalThis.URL.revokeObjectURL(url),5000);message('線上預約資料已送往瀏覽器下載；請確認下載檔。');});

let calendarV60=null,weekV60=weekStartV60(dayV60(new Date())),selectedDayV60=dayV60(new Date());
function dayV60(x){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(x));return ['year','month','day'].map(k=>p.find(v=>v.type===k).value).join('-');}
function addDaysV60(x,n){const d=new Date(x+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function weekStartV60(x){const d=new Date(x+'T12:00:00Z');return addDaysV60(x,-((d.getUTCDay()+6)%7));}
function timeV60(x){return new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(x));}
function ruleRowV60(r={dow:1,start:'09:00',end:'12:00'}){
 const row=document.createElement('div');row.className='weekly-row-v60';const dow=document.createElement('select');dow.setAttribute('aria-label','星期');
 ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'].forEach((x,i)=>dow.append(new Option(x,i)));dow.value=r.dow;
 const inputs=['start','end'].map((k,i)=>{const label=document.createElement('label');label.textContent=i?'結束':'開始';const input=document.createElement('input');input.type='time';input.step='1800';input.required=true;input.value=r[k];label.append(input);return {label,input};});
 row.append(dow,...inputs.map(x=>x.label),button('移除',()=>row.remove()));$('weekly-rows').append(row);
}
function renderScheduleV60(){const w=state.weekly;$('weekly-enabled').checked=!!w?.enabled;$('weekly-capacity').value=1;$('weekly-rows').replaceChildren();for(const r of w?.rules||[])ruleRowV60(r);}
$('add-rule').onclick=()=>ruleRowV60();
$('weekly-form').addEventListener('invalid',()=>message('尚未儲存：請確認時間欄位完整，使用00或30分鐘。'),true);
$('weekly-form').onsubmit=e=>{e.preventDefault();action(async()=>{
 message('正在儲存每週排程…');
 const rules=[...$('weekly-rows').children].map(row=>({dow:Number(row.querySelector('select').value),start:row.querySelectorAll('input')[0].value,end:row.querySelectorAll('input')[1].value}));
 if($('weekly-enabled').checked&&!rules.length)throw Error('請至少新增一段每週開放時間');
 await rpc('weekly_save',{enabled:$('weekly-enabled').checked,capacity:1,rules});await load();message('每週排程已儲存，已更新未來30天。原本的申請與已確認預約保留。');
});};
async function renderCalendarV60(prefetched=null){calendarV60=prefetched||await rpc('calendar',{start:weekV60});if(calendarV60.tenant_id!==CURRENT_TENANT_ID)throw Error('院所資料不符，停止顯示。');$('calendar-date').value=selectedDayV60;$('calendar-grid').replaceChildren();
 for(let i=0;i<7;i++){const day=addDaysV60(weekV60,i),pending=calendarV60.requests.filter(r=>dayV60(r.starts_at)===day&&r.status==='pending').length,apps=calendarV60.appointments.filter(a=>dayV60(a.starts_at)===day).length;
  const b=button('',()=>{selectedDayV60=day;renderCalendarDaysV60();});b.className='calendar-day-v60';b.dataset.day=day;
  const title=document.createElement('strong');title.textContent=day.slice(5)+' '+['日','一','二','三','四','五','六'][new Date(day+'T12:00Z').getUTCDay()];
  const p=document.createElement('span');p.className='pending-v60';p.textContent='待審核 '+pending;
  const c=document.createElement('span');c.className='confirmed-v60';c.textContent='院內預約 '+apps;
  const h=document.createElement('span'),hasAvailable=calendarV60.slots.some(s=>dayV60(s.starts_at)===day&&bookingSlotStatusV921(s).kind==='open');h.textContent=state.closed_days?.includes(day)?'整天休診':hasAvailable?'有可預約時段':'目前無可預約時段';h.className=hasAvailable&&!state.closed_days?.includes(day)?'booking-slot-open-v921':'booking-slot-closed-v921';
  b.append(title,p,c,h);$('calendar-grid').append(b);
 }renderCalendarDaysV60();
}
function beginReviewV60(r){closeReview();review=r;$('review').hidden=false;$('review-text').textContent=r.name+'／'+r.phone+'／'+r.pet_name+'／'+labelDate(r.starts_at)+'／原登記資訊：'+(r.registered_hint||'未填');$('pet-query').value=r.pet_name;$('review').scrollIntoView({behavior:'smooth'});}
async function restoreSlotV9126(slot){
 const expected=activeScope;
 if(!state.admin||!allowed()||!expected||expected!==scope())throw Error('請管理者重新開啟線上預約管理。');
 if(Number(slot.used)>=1)throw Error('此時段已有預約或待審核申請，請先核對並處理原預約。');
 if(!confirm('恢復 '+labelDate(slot.starts_at)+' 接受新預約申請？已提早報到者的原預約、候診與病歷均保留。系統仍會核對其他預約及待審核申請。'))return;
 const {data,error}=await db.rpc('ob_restore_slot_v91_26',{p_slot_id:slot.id});
 if(expected!==activeScope||expected!==scope())throw Error('登入已變更，請重新開啟核對恢復結果。');
 if(error)throw Error(error.code==='PGRST202'?'尚未安裝恢復時段功能，請先執行 booking_restore_slot_v91_26.sql。':error.message);
 if(!data?.ok||data.slot_id!==slot.id||data.enabled!==true)throw Error('尚未確認時段已恢復，請重新讀取核對。');
 try{await load();}catch(e){message('此時段已恢復，畫面更新未完成，請按重新讀取核對。');return;}
 message('此時段已恢復接受新申請，每格限1位；原預約與已報到紀錄保留。');
}
// v92_1：燈號依是否額滿判斷；操作按鈕不再用綠色表示關閉。
function bookingSlotStatusV921(slot){
 const used=Number(slot.used),capacity=Number(slot.capacity),valid=slot.used!=null&&slot.capacity!=null&&Number.isFinite(used)&&used>=0&&Number.isFinite(capacity)&&capacity>0;
 if(valid&&used>=capacity)return {kind:'full',label:'● 已額滿，停止新申請'};
 if(!slot.enabled)return {kind:'closed',label:'● 已停止新申請'};
 if(valid)return {kind:'open',label:'● 可接受新申請'};
 return {kind:'closed',label:'● 名額待核對'};
}
function earlyCheckinV922(appointment,slotStart){
 const checked=Date.parse(appointment.checked_in_at),start=Date.parse(slotStart);
 return ['候診中','診間看診中','已完成'].includes(appointment.status)&&Number.isFinite(checked)&&Number.isFinite(start)&&checked<start&&checked<=Date.now();
}
function renderCalendarDaysV60(){if(!calendarV60)return;$('calendar-date').value=selectedDayV60;
 for(const b of $('calendar-grid').children)b.classList.toggle('selected',b.dataset.day===selectedDayV60);
 $('day-title').textContent=selectedDayV60+' 的預約與時段';$('day-controls').hidden=!state.admin;$('day-info').replaceChildren();
 const slots=calendarV60.slots.filter(s=>dayV60(s.starts_at)===selectedDayV60),reqs=calendarV60.requests.filter(r=>dayV60(r.starts_at)===selectedDayV60),apps=calendarV60.appointments.filter(a=>dayV60(a.starts_at)===selectedDayV60);
 const times=[...new Set([...slots.map(s=>s.starts_at),...reqs.map(r=>r.starts_at),...apps.map(a=>a.starts_at)])].sort((a,b)=>new Date(a)-new Date(b));
 if(!times.length){$('day-info').textContent='這天沒有開放時段或預約。';return;}
 const covered=new Set();
 for(const dt of times){const s=slots.find(x=>new Date(x.starts_at).getTime()===new Date(dt).getTime());
  // Native appointments inside a slot are rendered with their real time there.
  if(!s&&slots.some(x=>new Date(dt)>=new Date(x.starts_at)&&new Date(dt)<new Date(new Date(x.starts_at).getTime()+1800000)))continue;
  const row=document.createElement('div');row.className='slot-v60';const left=document.createElement('div');left.className='time-v60';left.textContent=timeV60(dt);
  const info=document.createElement('div');info.className='events-v60';
  if(s){const status=bookingSlotStatusV921(s),p=document.createElement('p');p.className='booking-slot-status-v921 booking-slot-'+status.kind+'-v921';p.textContent=status.label+'｜已占 '+s.used+'／名額 '+s.capacity+(Number(s.used)>Number(s.capacity)?'（超過目前名額，請安排）':'');info.append(p);}
  const lo=new Date(dt).getTime(),hi=lo+(s?1800000:1),earlyAppointments=s?apps.filter(a=>new Date(a.starts_at).getTime()>=lo&&new Date(a.starts_at).getTime()<hi&&earlyCheckinV922(a,s.starts_at)):[];
  for(const r of reqs.filter(x=>new Date(x.starts_at).getTime()>=lo&&new Date(x.starts_at).getTime()<hi&&x.status==='pending')){const p=document.createElement('p');p.className='pending-v60';p.textContent='待審核｜'+r.pet_name+'｜聯絡人 '+r.name;info.append(p,button('核對並審核',()=>beginReviewV60(r)));}
  for(const a of apps.filter(x=>new Date(x.starts_at).getTime()>=lo&&new Date(x.starts_at).getTime()<hi)){if(covered.has(a.id))continue;covered.add(a.id);const p=document.createElement('p');p.className='confirmed-v60';p.textContent=timeV60(a.starts_at)+'｜'+(a.pet_name||'未指定寵物')+'｜'+(a.owner_name||'未指定飼主')+'｜'+a.status+(earlyAppointments.some(x=>x.id===a.id)?'（已提早報到，不占此時段名額）':'');info.append(p);}
  if(s&&state.admin&&s.enabled){const closeButton=button('關閉此時段',()=>action(async()=>{await rpc('close_slot',{id:s.id});await load();message('此時段停止新申請；原本申請與預約保留。');}));closeButton.classList.add('booking-close-v921');info.append(closeButton);}
  if(s&&state.admin&&!s.enabled){
   if(Number(s.used)>=1){const note=document.createElement('small');note.textContent='已有預約／待審核申請，請先處理原預約後再恢復。';info.append(note);}
   else {const restoreButton=button(earlyAppointments.length?'重新開放此時段':'恢復此時段',()=>action(()=>restoreSlotV9126(s)));restoreButton.classList.add('booking-restore-v9128');info.append(restoreButton);}
  }
  row.append(left,info);$('day-info').append(row);
 }
}
function moveWeekV60(n){action(async()=>{weekV60=addDaysV60(weekV60,n);selectedDayV60=weekV60;await renderCalendarV60();});}
$('prev-week').onclick=()=>moveWeekV60(-7);$('next-week').onclick=()=>moveWeekV60(7);
$('this-week').onclick=()=>action(async()=>{selectedDayV60=dayV60(new Date());weekV60=weekStartV60(selectedDayV60);await renderCalendarV60();});
$('calendar-date').onchange=()=>action(async()=>{if(!$('calendar-date').value)return;selectedDayV60=$('calendar-date').value;weekV60=weekStartV60(selectedDayV60);await renderCalendarV60();});
for(const [id,closed] of [['close-day',true],['open-day',false]])$(id).onclick=()=>action(async()=>{if(!confirm((closed?'停止':'恢復')+selectedDayV60+' 的新預約申請？既有預約不會取消。'))return;await rpc('closed_day',{day:selectedDayV60,closed});await load();message(closed?'整天已休診；請另外處理既有申請與預約。':'已恢復每週開放規則。');});


let bookingNoticeScopeV62='',bookingNoticeBusyV62=false;
function showBookingNoticeV62(n,error=false){
 const badge=document.getElementById('booking-nav-count-v62'),home=document.getElementById('booking-home-alert-v62');
 badge.hidden=!n&&!error;badge.textContent=error?'!':String(n);home.hidden=!n&&!error;home.classList.toggle('has-pending',!error&&n>0);
 document.getElementById('booking-home-text-v62').textContent=error?'線上預約提醒暫時無法更新，請點此查看':n+' 筆線上預約待確認，點此查看';
}
async function pollBookingNoticeV62(){
 const expected=allowed()?scope():'';
 if(expected!==bookingNoticeScopeV62){bookingNoticeScopeV62=expected;showBookingNoticeV62(0);}
 if(!expected||bookingNoticeBusyV62||document.hidden)return;
 bookingNoticeBusyV62=true;
 try{const {data,error}=await db.rpc('ob_staff',{p_action:'pending_count',p_data:{}});if(expected!==scope()||expected!==bookingNoticeScopeV62||!allowed())return;
  if(error||data?.tenant_id!==CURRENT_TENANT_ID)throw Error('提醒更新失敗');showBookingNoticeV62(Number(data.pending_count)||0);
 }catch(e){if(expected===scope()&&expected===bookingNoticeScopeV62&&allowed())showBookingNoticeV62(0,true);}
 finally{bookingNoticeBusyV62=false;}
}
setInterval(pollBookingNoticeV62,30000);document.addEventListener('visibilitychange',pollBookingNoticeV62);window.addEventListener('focus',pollBookingNoticeV62);

function clear(){bookingNoticeScopeV62='';showBookingNoticeV62(0);calendarV60=null;$('calendar-grid').replaceChildren();$('day-info').replaceChildren();$('weekly-rows').replaceChildren();activeScope='';state=null;closeReview();$('app').hidden=true;for(const id of ['requests','history','slots'])$(id).replaceChildren();$('public-link').removeAttribute('href');$('clinic-name').value='';$('notice').value='';$('enabled').checked=false;message('請重新開啟線上預約。');}
window.openOnlineBookingV59=()=>{if(!allowed()){clear();message('此帳號沒有掛號／預約管理權限。');return;}if(busy)return;if(activeScope!==scope())clear();activeScope=scope();action(async()=>{await load();message('已讀取本院線上預約。確認後請以電話或 LINE 聯絡飼主。');});};
db.auth.onAuthStateChange((_event,session)=>{if(!session||activeScope&&session.user.id!==activeScope.split('|')[0])clear();if(session)setTimeout(pollBookingNoticeV62,0);});
setTimeout(pollBookingNoticeV62,1500);
})();
