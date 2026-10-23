
// v91.33: cloud pharmacy handoff; the existing POS remains the only payment path.
const pharmacyV9133={scope:'',data:null,busy:false,request:0,dialog:null,checked:new Map(),offset:0};
function pharmacyScopeV9133(){return CURRENT_TENANT_ID&&CURRENT_USER?.id?CURRENT_TENANT_ID+'|'+CURRENT_USER.id:'';}
function pharmacyKeyV9133(){return 'genblue-pharmacy-send:'+pharmacyScopeV9133();}
function pharmacyNodeV9133(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function pharmacyMessageV9133(text){document.getElementById('pharmacyMessageV9133').textContent=text;}
async function pharmacyRpcV9133(action,data={}){
 const scope=pharmacyScopeV9133();if(!scope)throw Error('請先登入');
 const {data:reply,error}=await _supabase.rpc('pharmacy_room_v9133',{p_action:action,p_data:data});
 if(scope!==pharmacyScopeV9133())throw Error('登入已變更，請重新核對');
 if(error){const e=Error(error.code==='PGRST202'?'請先執行 pharmacy_room_v91_33.sql，再重新登入。':error.message);e.code=error.code;throw e;}
 if(reply?.tenant_id!==CURRENT_TENANT_ID)throw Error('配藥室院所回覆不符');return reply;
}
async function pharmacyActionV9133(fn){if(pharmacyV9133.busy)return;pharmacyV9133.busy=true;document.querySelectorAll('#pharmacy button,#pharmacySendModalV9133 button').forEach(b=>b.disabled=true);try{await fn();}catch(e){pharmacyMessageV9133('尚未確認完成：'+e.message);alert(e.message+'。請保留資料，重新讀取核對。');}finally{pharmacyV9133.busy=false;document.querySelectorAll('#pharmacy button,#pharmacySendModalV9133 button').forEach(b=>b.disabled=false);}}
function pharmacyButtonV9133(label,fn,kind='secondary'){const b=pharmacyNodeV9133('button',label);b.type='button';b.className='btn-'+kind;b.onclick=()=>pharmacyActionV9133(fn);return b;}
function pharmacyPrescriptionV9133(rx){
 const box=pharmacyNodeV9133('div'),groups=new Map();
 for(const p of rx||[]){const meta=p.dispensing_group||{},key=meta.id||'ungrouped';if(!groups.has(key))groups.set(key,{meta,rows:[]});groups.get(key).rows.push(p);}
 for(const {meta,rows} of groups.values()){
  box.append(pharmacyNodeV9133('h4',(meta.name||'處方組別')+'｜配製劑型：'+(meta.form||'未指定')+(planTextV94(meta)?'｜'+planTextV94(meta):'')));
  box.append(pharmacyNodeV9133('p','頻率：'+(meta.frequency||'依醫囑')+'｜天數：'+(meta.days||'依醫囑')+'｜配製／交代：'+(meta.instruction||'依各藥品醫囑')));
  box.append(medicalPrescriptionListV53(rows,true));
 }
 return box;
}
function pharmacyDateV9133(value){return new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});}
async function pharmacyLoadV9133(){
 const scope=pharmacyScopeV9133(),revision=++pharmacyV9133.request;
 const data=await pharmacyRpcV9133('list',{query:document.getElementById('pharmacySearchV9133').value.trim(),filter:document.getElementById('pharmacyFilterV9133').value,offset:pharmacyV9133.offset});if(scope!==pharmacyScopeV9133()||revision!==pharmacyV9133.request)return;
 pharmacyV9133.scope=scope;pharmacyV9133.data=data;pharmacyRenderV9133();pharmacyMessageV9133(document.getElementById('pharmacyFilterV9133').value==='active'&&data.jobs.some(j=>j.state==='ready')?'請先執行 pharmacy_queue_v92_3.sql，更新目前待辦的筆數與分頁範圍。已配好的單據暫不顯示於此頁；櫃台單據保留。':'已同步配藥室。目前待辦只列待配藥、配藥中與退回；已配好送櫃台的單據請切換篩選查詢。每15秒更新。');
}
function pharmacyRenderV9133(){
 const state=pharmacyV9133.data;if(!state||pharmacyV9133.scope!==pharmacyScopeV9133())return;
 const query=document.getElementById('pharmacySearchV9133').value.trim().toLowerCase(),filter=document.getElementById('pharmacyFilterV9133').value;
 const box=document.getElementById('pharmacyQueueV9133');box.replaceChildren();
 const labels={waiting:'待配藥',preparing:'配藥中',returned:'退回醫師確認',ready:'配藥完成／已送櫃台',handed:'已交藥',cancelled:'已撤回'};
 const jobs=state.jobs.filter(j=>(filter==='active'?['waiting','preparing','returned'].includes(j.state):filter==='all'||j.state===filter)&&(!query||[j.bill.ownerName,j.bill.billingPetName,j.doctor_name,j.prepared_name].join(' ').toLowerCase().includes(query)));
 document.getElementById('pharmacyCountV9133').textContent='待配藥 '+(state.counts?.waiting??0)+'｜配藥中 '+(state.counts?.preparing??0)+'｜退回 '+(state.counts?.returned??0)+'｜符合 '+(state.total??jobs.length)+' 筆，每頁100筆，目前第 '+(Math.floor(pharmacyV9133.offset/100)+1)+' 頁';
 for(const j of jobs){
  const card=pharmacyNodeV9133('section');card.className='card pharmacy-job-v9133';card.dataset.state=j.state;
  card.append(pharmacyNodeV9133('h3',j.bill.billingPetName+' ／ '+j.bill.ownerName),pharmacyNodeV9133('strong',labels[j.state]+(j.payment_state==='paid'?'｜已收款':'｜尚未收款')),pharmacyNodeV9133('p','開方醫師：'+j.doctor_name+'｜送單：'+pharmacyDateV9133(j.created_at)+'｜版本 '+j.version));
  if(j.prepared_name)card.append(pharmacyNodeV9133('p','配藥負責人：'+j.prepared_name));
  if(j.reason){const p=pharmacyNodeV9133('p','原因：'+j.reason);p.style.color='#b91c1c';card.append(p);}
  const chief=pharmacyNodeV9133('p',j.chief);chief.style.whiteSpace='pre-wrap';card.append(chief);
  card.append(pharmacyPrescriptionV9133(j.prescription));
  const actions=pharmacyNodeV9133('div');actions.className='pharmacy-actions-v9133';
  const change=async(action,extra={})=>{await pharmacyRpcV9133(action,{id:j.id,version:j.version,...extra});await pharmacyLoadV9133();if((action==='complete'||action==='handed')&&(state.cashier||state.clinical||state.admin))await posRefreshV77();};
  if(state.worker&&j.state==='waiting')actions.append(pharmacyButtonV9133('開始配藥／接單',()=>change('claim'),'warning'));
  if(state.worker&&j.state==='preparing'&&(j.prepared_by===CURRENT_USER.id||state.admin)){
   const check=pharmacyNodeV9133('input');check.type='checkbox';const checkKey=j.id+':'+j.version;check.checked=pharmacyV9133.checked.get(checkKey)||false;check.onchange=()=>pharmacyV9133.checked.set(checkKey,check.checked);const label=pharmacyNodeV9133('label');label.append(check,document.createTextNode('已逐項核對寵物、藥名、劑量、數量、頻率、天數與配製方式'));actions.append(label);
   actions.append(pharmacyButtonV9133('配藥完成，交櫃台收費',async()=>{if(!check.checked)throw Error('請先完成核對並勾選');if(!confirm('確認此版本處方已完成配製並交櫃台？'))return;await change('complete',{checked:true});},'success'));
  }
  if(state.worker&&['waiting','preparing'].includes(j.state)&&(j.state==='waiting'||j.prepared_by===CURRENT_USER.id||state.admin))actions.append(pharmacyButtonV9133('退回醫師確認',async()=>{const reason=prompt('請填寫需醫師確認的原因（不會自行更改處方）');if(!reason?.trim())return;await change('return',{reason:reason.trim()});},'danger'));
  if((state.admin||(state.clinical&&j.doctor_id===CURRENT_USER.id))&&['waiting','returned','ready'].includes(j.state)&&j.payment_state!=='paid')actions.append(pharmacyButtonV9133('撤回並回門診重開',async()=>{
   const expected=pharmacyScopeV9133();const reason=prompt('撤回後原配藥單停止作業。請填寫撤回原因');if(!reason?.trim())return;
   await change('cancel',{reason:reason.trim()});
   if(expected!==pharmacyScopeV9133())throw Error('登入已變更');
   const savedServices=(j.bill.serviceCharges||[]).filter(s=>s.tenantId===CURRENT_TENANT_ID&&s.petId===j.bill.billingPetId&&s.ownerId===j.bill.ownerId);
   if(savedServices.length){const local=readServiceDrafts(),ids=new Set(local.map(s=>s.id));writeServiceDrafts([...local,...savedServices.filter(s=>!ids.has(s.id)).map(s=>({...s,state:'ready'}))]);}
   const {data:p,error}=await _supabase.from('pets').select('*,owners(name)').eq('tenant_id',CURRENT_TENANT_ID).eq('id',j.bill.billingPetId).single();if(error)throw error;if(expected!==pharmacyScopeV9133())throw Error('登入已變更，請重新核對');
   await startConsultationById(p.id,p.microchip||'',p.name,p.owner_id,p.weight,p.owners?.name||'',p.birthday,p.gender,p.species,p.breed);
   if(currentPetId===p.id&&document.getElementById('medical').classList.contains('active')){document.getElementById('medicalDiagnosis').value=j.chief;await openPrescriptionCopyV65(j.record_id);}
  }));
  if((state.worker||state.cashier)&&j.state==='ready'&&j.payment_state==='paid')actions.append(pharmacyButtonV9133('確認已交藥',async()=>{if(confirm('確認核對飼主與寵物後已交藥？'))await change('handed');},'success'));
  if(state.cashier&&j.state==='ready'&&j.payment_state==='pending')actions.append(pharmacyButtonV9133('前往櫃台待付款',async()=>{switchTab('posTabV77');await posRefreshV77();}));
  card.append(actions);
  const history=pharmacyNodeV9133('details');history.append(pharmacyNodeV9133('summary','交接紀錄（點此展開）'));
  for(const e of j.events||[])history.append(pharmacyNodeV9133('p',pharmacyDateV9133(e.at)+'｜'+e.name+'｜'+({'claim':'接單','complete':'配藥完成','return':'退回醫師','cancel':'撤回','handed':'交藥'}[e.action]||e.action)+(e.reason?'｜'+e.reason:'')));
  card.append(history);box.append(card);
 }
 if(!jobs.length)box.textContent='目前沒有符合條件的配藥單。';
 document.getElementById('pharmacyAdminV9133').hidden=!state.admin;
}
async function pharmacyOpenSendV9133(){
 if(medicalSaveBusy||pharmacyV9133.busy)return;
 try{
  if(!medicalEditAllowedV53()||!currentPetId||!currentAppointmentId||!doctorVisitV51?.claimId)throw Error('請先從候診接診並開立處方');
  if(familyBillHasContentV74()||familyHasAppointmentV74(currentAppointmentId))throw Error('請先完成或處理收費頁現有帳單');
  const pending=sessionStorage.getItem(pharmacyKeyV9133());if(pending)throw Error('上次送單結果待核對，請到配藥室按「核對上次送單」');
  const rx=collectPrescriptionDetailsV75();if(!rx.length)throw Error('沒有處方可送配藥室；無需配藥請沿用原收費流程');
  const groups=prepareMedicationGroupsV64(rx),scope=pharmacyScopeV9133(),pet=currentPetId,appointment=currentAppointmentId;
  const service=readServiceDrafts().filter(x=>x.tenantId===CURRENT_TENANT_ID&&x.petId===pet&&x.state==='ready');
  if(readServiceDrafts().some(x=>x.tenantId===CURRENT_TENANT_ID&&x.petId===pet&&x.state==='saving'))throw Error('檢驗或疫苗仍在儲存，請先核對');
  const box=document.getElementById('pharmacySendBodyV9133');box.replaceChildren();box.append(pharmacyNodeV9133('p','將 '+currentPetName+' 的完整處方送至配藥室。請先確認門診與藥費；配藥人員不能修改醫囑。'));
  box.append(pharmacyPrescriptionV9133(rx));
  const fee=(label,value)=>{const l=pharmacyNodeV9133('label',label+' '),i=pharmacyNodeV9133('input');i.type='number';i.min='0';i.step='.01';i.value=value;i.required=true;l.append(i);box.append(l);return i;};
  const exam=fee('門診診察費','250'),prices=groups.map(g=>fee(medicationGroupLabelsV64[g.kind]+'總費用（不收費請填0）',''));
  for(const item of service)box.append(pharmacyNodeV9133('p',item.name+'：'+posMoneyV77(item.amount)+'（一併送櫃台）'));
  pharmacyV9133.dialog={scope,pet,appointment,rx,groups,service,exam,prices};document.getElementById('pharmacySendModalV9133').style.display='flex';
 }catch(e){alert(e.message);}
}
function pharmacyCloseSendV9133(){if(pharmacyV9133.busy)return;document.getElementById('pharmacySendModalV9133').style.display='none';pharmacyV9133.dialog=null;}
async function pharmacyFinishSendV9133(request){
 const scope=pharmacyScopeV9133();const reply=await pharmacyRpcV9133('send',request);
 if(reply.job?.id!==request.id)throw Error('未取得送單確認');
 sessionStorage.removeItem(pharmacyKeyV9133());
 if(scope===pharmacyScopeV9133()){
  const ids=request.draft.serviceIds||[];try{writeServiceDrafts(readServiceDrafts().filter(x=>!ids.includes(x.id)));}catch(e){alert('送單已成功，但本機檢驗／疫苗待收暫存未清理。請核對配藥單，勿再次加入同項費用。');}
  document.getElementById('pharmacySendModalV9133').style.display='none';pharmacyV9133.dialog=null;
  if(currentPetId===request.draft.billingPetId&&currentAppointmentId===request.draft.billingAppointmentId){doctorVisitV51=null;clearMedicalFormInputs();currentAppointmentId=null;}
  try{switchTab('pharmacy');await pharmacyLoadV9133();await posRefreshV77();await loadAppointments();}catch(e){alert('送單已成功，畫面暫未同步。請到配藥室重新讀取，勿另建相同處方。');return;}
  alert('已送配藥室。尚未收款或扣庫存，配藥完成後櫃台才能接手。');
 }
}
async function pharmacySubmitV9133(){
 const x=pharmacyV9133.dialog;if(!x||x.scope!==pharmacyScopeV9133()||x.pet!==currentPetId||x.appointment!==currentAppointmentId)throw Error('目前門診已變更，請關閉後重開');
 if(medicalSaveBusy)throw Error('門診正在儲存');
 const previous=sessionStorage.getItem(pharmacyKeyV9133());
 if(previous){if(!confirm('上次送單結果尚未確認，將核對原先送出的內容；後續修改不會另送。'))return;await pharmacyFinishSendV9133(JSON.parse(previous));return;}
 medicalSaveBusy=true;
 try{
  const money=i=>{if(!/^\d+(?:\.\d{1,2})?$/.test(i.value.trim()))throw Error('請填費用，免費請填0，最多兩位小數');const n=Number(i.value);if(n>100000000)throw Error('費用過大，請核對');return n;};
  const exam=money(x.exam),groups=x.groups.map((g,i)=>({kind:g.kind,drugs:g.drugs.map(({label,...d})=>d),price:money(x.prices[i])}));
  if(!await ensureMedicalWeightForAction())return;
  if(x.scope!==pharmacyScopeV9133()||x.pet!==currentPetId||x.appointment!==currentAppointmentId)throw Error('目前門診已變更');
  const currentRx=collectPrescriptionDetailsV75();if(JSON.stringify(currentRx)!==JSON.stringify(x.rx))throw Error('處方已變更，請關閉視窗後重新核對');
  const chief=medicalChiefComplaintWithTemperature();if(chief===null)return;
  const nowServices=readServiceDrafts().filter(s=>s.tenantId===CURRENT_TENANT_ID&&s.petId===x.pet&&s.state==='ready');if(JSON.stringify(nowServices)!==JSON.stringify(x.service))throw Error('待收費項目已變更，請重開送單視窗');
  const pet=allPetsListForDropdown.find(p=>p.id===x.pet)||{};
  const lines=[{item_name:'一般門診診察費',quantity:1,unit_price:exam,stock_kind:'',stock_id:''},...x.service.map(s=>({item_name:s.name,quantity:1,unit_price:Number(s.amount),stock_kind:'',stock_id:''}))];
  const subtotal=lines.reduce((n,l)=>n+l.quantity*l.unit_price,0)+groups.reduce((n,g)=>n+g.price,0);
  const draft={ownerId:currentOwnerId,ownerName:pet.owner_name||currentOwnerId,billingPetId:x.pet,billingPetName:currentPetName,billingAppointmentId:x.appointment,serviceCharges:JSON.parse(JSON.stringify(x.service)),serviceIds:x.service.map(s=>s.id),serviceRows:x.service.map((s,i)=>({index:i+1,id:s.id})),medicationGroups:groups,lines,subtotal,total:subtotal,discount:0,paymentMethod:'現金'};
  const priced=nightApplyDraftV93(draft,x.nightV93);const request={id:crypto.randomUUID(),claim_id:doctorVisitV51.claimId,draft:priced,prescription:x.rx,chief};sessionStorage.setItem(pharmacyKeyV9133(),JSON.stringify(request));
  try{await pharmacyFinishSendV9133(request);}catch(e){if(posRejectedV77(e))sessionStorage.removeItem(pharmacyKeyV9133());throw e;}
 }finally{medicalSaveBusy=false;}
}
async function pharmacyRecoverV9133(){const text=sessionStorage.getItem(pharmacyKeyV9133());if(!text)throw Error('沒有待核對的送單');await pharmacyFinishSendV9133(JSON.parse(text));}
async function pharmacyStaffV9133(){
 const {staff}=await pharmacyRpcV9133('staff'),box=document.getElementById('pharmacyStaffV9133');box.replaceChildren();
 for(const p of staff){const label=pharmacyNodeV9133('label'),check=pharmacyNodeV9133('input');check.type='checkbox';check.checked=p.enabled;
 check.onchange=()=>pharmacyActionV9133(async()=>{const value=check.checked;try{await pharmacyRpcV9133('permission',{user_id:p.id,enabled:value});pharmacyMessageV9133('已儲存 '+p.name+' 的配藥權限；該人員重新讀取配藥室即可使用。');}catch(e){check.checked=!value;throw e;}});
 label.append(check,document.createTextNode(p.name+'（'+p.role+'） 配藥人員'));box.append(label);
 }
}
(function(){
 const style=pharmacyNodeV9133('style');style.textContent='.pharmacy-actions-v9133{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;align-items:center}.pharmacy-actions-v9133 input[type=checkbox],#pharmacyStaffV9133 input{width:auto}.pharmacy-job-v9133[data-state=returned]{border:2px solid #b91c1c}.pharmacy-job-v9133[data-state=preparing]{border:2px solid #c2410c}#pharmacySendBodyV9133 label,#pharmacyStaffV9133 label{display:block;margin:10px 0}#pharmacySendBodyV9133 input{max-width:180px}#medicalPrescriptionActionsV909 #pharmacySendV9133{background:#c2410c!important;color:white!important;border-color:#9a3412!important}';document.head.append(style);
 const nav=pharmacyNodeV9133('li','💊 配藥室');nav.id='nav-pharmacy';nav.onclick=()=>switchTab('pharmacy');document.getElementById('nav-medical').after(nav);
 const tab=pharmacyNodeV9133('div');tab.id='pharmacy';tab.className='tab-content';
 tab.innerHTML='<h1>配藥室</h1><p>醫師送單 → 配藥人員接單與核對 → 配藥完成送櫃台 → 收費、交藥。不同寵物分別配藥；尚未完成配藥不能收款。</p><div class="card"><div class="pharmacy-actions-v9133"><input type="search" id="pharmacySearchV9133" placeholder="飼主、寵物或醫師，Enter搜尋"><select id="pharmacyFilterV9133"><option value="active">目前待辦（待配藥／配藥中／退回）</option><option value="waiting">待配藥</option><option value="preparing">配藥中</option><option value="returned">退回醫師</option><option value="ready">已配好／已送櫃台（含未付款）</option><option value="all">全部待辦與已送櫃台＋最近一天交藥／撤回</option></select></div><b id="pharmacyCountV9133"></b><p id="pharmacyMessageV9133" role="status" aria-live="polite"></p></div><details id="pharmacyAdminV9133" class="card" hidden><summary>管理者：配藥人員權限與紀錄匯出</summary><div id="pharmacyStaffV9133"></div></details><div id="pharmacyQueueV9133"></div>';
 document.getElementById('medical').parentElement.append(tab);
 const toolbar=tab.querySelector('.pharmacy-actions-v9133');toolbar.append(pharmacyButtonV9133('搜尋／更新',async()=>{pharmacyV9133.offset=0;await pharmacyLoadV9133();}),pharmacyButtonV9133('上一頁',async()=>{if(pharmacyV9133.offset===0)return;pharmacyV9133.offset=Math.max(0,pharmacyV9133.offset-100);await pharmacyLoadV9133();}),pharmacyButtonV9133('下一頁',async()=>{if(pharmacyV9133.offset+100>=(pharmacyV9133.data?.total||0))return;pharmacyV9133.offset+=100;await pharmacyLoadV9133();}),pharmacyButtonV9133('核對上次送單（不重複建立）',pharmacyRecoverV9133));
 const admin=document.getElementById('pharmacyAdminV9133');admin.append(pharmacyButtonV9133('讀取／指派配藥人員',pharmacyStaffV9133),pharmacyButtonV9133('匯出配藥室紀錄',async()=>{const d=await pharmacyRpcV9133('export'),url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'})),a=pharmacyNodeV9133('a');a.href=url;a.download='genblue_配藥室_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}));
 document.getElementById('pharmacySearchV9133').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();pharmacyV9133.offset=0;void pharmacyActionV9133(pharmacyLoadV9133);}};
 document.getElementById('pharmacyFilterV9133').onchange=()=>{pharmacyV9133.offset=0;void pharmacyActionV9133(pharmacyLoadV9133);};
 const modal=pharmacyNodeV9133('div');modal.id='pharmacySendModalV9133';modal.className='modal-overlay';modal.style.display='none';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','確認送配藥室處方與費用');
 const content=pharmacyNodeV9133('div');content.className='modal-content pharmacy-confirm-panel-v9137';
 const title=pharmacyNodeV9133('h2','確認處方與費用，再送配藥室');title.id='pharmacyConfirmTitleV9137';modal.setAttribute('aria-labelledby',title.id);
 const body=pharmacyNodeV9133('div');body.id='pharmacySendBodyV9133';
 const actions=pharmacyNodeV9133('div');actions.className='pharmacy-confirm-actions-v9137';
 const close=pharmacyNodeV9133('button','返回門診繼續修改');close.type='button';close.className='pharmacy-confirm-back-v9137';close.onclick=pharmacyCloseSendV9133;
 actions.append(close,pharmacyButtonV9133('確認傳送至配藥室',pharmacySubmitV9133,'success'));content.append(title,body,actions);modal.append(content);document.body.append(modal);
 const send=pharmacyNodeV9133('button','💊 傳送至配藥室');send.id='pharmacySendV9133';send.type='button';send.onclick=pharmacyOpenSendV9133;document.getElementById('medicalPrescriptionActionsV909').append(send);
 const beforeSwitch=switchTab;switchTab=function(tab,...args){const result=beforeSwitch.call(this,tab,...args);if(tab==='pharmacy')void pharmacyActionV9133(pharmacyLoadV9133);return result;};
 // Existing cashier list receives only pharmacy-completed bills. Non-pharmacy bills are unchanged.
 const posBefore=posRpcV77;posRpcV77=async function(action,...args){const data=await posBefore.call(this,action,...args);if(action==='list'&&Array.isArray(data.pending)){data.pharmacy_holds_v9133=data.pending.filter(q=>q.draft?.pharmacy_v9133&&q.dispensing==='未調劑');data.pending=data.pending.filter(q=>!q.draft?.pharmacy_v9133||q.dispensing!=='未調劑');}return data;};
 const beforeWaiting=renderAppointmentTable;renderAppointmentTable=function(rows,...args){const ids=new Set((posStateV77?.pharmacy_holds_v9133||[]).map(q=>q.appointment_id));return beforeWaiting.call(this,rows.filter(p=>!ids.has(p.appointment_id)),...args);};
 const logoutBefore=logoutSupabase;logoutSupabase=function(...args){pharmacyV9133.request++;pharmacyV9133.scope='';pharmacyV9133.offset=0;pharmacyV9133.data=null;pharmacyV9133.dialog=null;pharmacyV9133.checked.clear();document.getElementById('pharmacyQueueV9133').replaceChildren();document.getElementById('pharmacyStaffV9133').replaceChildren();modal.style.display='none';return logoutBefore.apply(this,args);};
 setInterval(()=>{if(!document.hidden&&document.getElementById('pharmacy').classList.contains('active')&&!pharmacyV9133.busy)void pharmacyLoadV9133().catch(e=>pharmacyMessageV9133('配藥室暫未同步：'+e.message+'；請按更新，勿重複送單。'));},15000);
 const pollCounts=()=>{if(!pharmacyScopeV9133()||document.hidden)return;void pharmacyRpcV9133('counts').then(d=>{nav.textContent='💊 配藥室'+((d.waiting||d.returned)?'（待配 '+(d.waiting||0)+'／退回 '+(d.returned||0)+'）':'');nav.style.color=d.returned?'#b91c1c':'';}).catch(()=>{});};
 setInterval(pollCounts,30000);setTimeout(pollCounts,2000);
 document.getElementById('genblueVersionV84').textContent=' · v91.34';
})();

