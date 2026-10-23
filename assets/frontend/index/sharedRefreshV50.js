
var clinicRefreshBusyV50=false;
function clinicRefreshScopeV50(){return CURRENT_TENANT_ID&&CURRENT_USER?.id?CURRENT_TENANT_ID+'|'+CURRENT_USER.id:'';}
function clinicRefreshStatusV50(text,error=false){const el=document.getElementById('clinicRefreshStatusV50');el.textContent=text;el.style.color=error?'#b42318':'#476343';}
async function refreshOwnerPetCacheV50(scope,tenant){
 const generation=++ownerPetCacheGenerationV50;const owners=[];let last=null;
 for(;;){
  let q=_supabase.from('owners').select('*, pets(*)').eq('tenant_id',tenant).order('id',{ascending:true});
  if(last)q=q.gt('id',last);
  const {data,error}=await q.limit(400);if(error)throw error;
  if(scope!==clinicRefreshScopeV50())throw Error('登入或醫院已變更，更新已取消');
 if(generation!==ownerPetCacheGenerationV50)throw Error('已有較新的飼主資料讀取，請稍後重試');
  const page=data||[];owners.push(...page);
  if(page.length<400)break;
  const next=page[page.length-1].id;if(next===last)throw Error('飼主資料分頁未前進，請重試');last=next;
 }
 if(scope!==clinicRefreshScopeV50())throw Error('登入或醫院已變更，更新已取消');
 if(generation!==ownerPetCacheGenerationV50)throw Error('已有較新的飼主資料讀取，請稍後重試');
 // Commit only a complete read; do not rebuild clinical selectors or reset forms.
 if(typeof ownerMergeRowsV908==='function')ownerMergeRowsV908(owners);
 globalOwnersPetsData=owners.map(owner=>({owner,pets:owner.pets||[]}));
 allOwnersListForDropdown=owners;
 allPetsListForDropdown=owners.flatMap(owner=>(owner.pets||[]).map(p=>({...p,weight:roundPetWeight(p.weight)||0,
  owner_id:owner.id,owner_name:owner.name,owner_mobile:owner.mobile||'',owner_phone:owner.phone||'',
  owner_code:owner.owner_code||'',system_code:owner.system_code||'',owner_system_code:owner.system_code||''})));
 filterIntegratedTable();
 const status=document.getElementById('ownerPetLoadStatus');if(status)status.textContent='已更新 '+owners.length+' 位飼主';
 // Updating suggestion options does not change the selected owner or shopping cart.
 const list=document.getElementById('checkoutOwnerDatalist');if(list){list.replaceChildren();for(const owner of owners){const opt=document.createElement('option');opt.dataset.ownerId=owner.id;opt.value='[新:'+(owner.system_code||'待產生')+'] '+(owner.owner_code?'[舊:'+owner.owner_code+'] ':'')+owner.name+' ('+(owner.mobile||'無手機')+')';list.appendChild(opt);}}
}
async function refreshAppointmentsV50(scope,tenant){
 const request=++appointmentsLoadRequest;const rows=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await _supabase.from('appointments').select('id, tenant_id, pet_id, owner_id, scheduled_at, session, doctor, assigned_doctor_id, status, notes, checked_in_at, pets(id,name,microchip,birthday,species,gender,weight,breed,owner_id,owners(name))')
   .eq('tenant_id',tenant).in('status',['已預約','候診中','診間看診中']).order('scheduled_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+999);
  if(error)throw error;if(scope!==clinicRefreshScopeV50())throw Error('登入或醫院已變更，更新已取消');
  rows.push(...(data||[]));if(!data||data.length<1000)break;
 }
 if(request!==appointmentsLoadRequest)throw Error('已有較新的候診讀取，請稍後重試');
 const ids=new Set(rows.map(a=>a.pet_id)),local=activeAppointmentsList.filter(p=>!p.appointment_id&&!ids.has(p.id));
 activeAppointmentsList=[...local,...rows.map(a=>({...a.pets,id:a.pet_id,owner_id:a.owner_id||a.pets?.owner_id||'',owner_name:a.pets?.owners?.name||'關聯飼主',appointment_id:a.id,appointment_time:a.scheduled_at,session:a.session||'上午診',doctor:a.doctor||'',assigned_doctor_id:a.assigned_doctor_id||null,status:a.status,check_in_time:a.checked_in_at?new Date(a.checked_in_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'',time:new Date(a.scheduled_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}))];
 renderAppointmentTable(activeAppointmentsList);
}
async function refreshClinicDataV50(){
 if(clinicRefreshBusyV50)return;
 const scope=clinicRefreshScopeV50(),tenant=CURRENT_TENANT_ID;
 if(!scope){clinicRefreshStatusV50('請先登入。',true);return;}
 clinicRefreshBusyV50=true;const btn=document.getElementById('clinicRefreshButtonV50');btn.disabled=true;btn.textContent='更新中…';clinicRefreshStatusV50('正在更新候診、飼主及寵物資料，正在填寫的內容會保留。');
 try{
  const {data,error}=await _supabase.auth.getSession();if(error)throw error;
  if(!data?.session||data.session.user?.id!==CURRENT_USER.id)throw Error('登入已失效或帳號已變更，請先儲存正在填寫的內容，再重新登入');
  if(scope!==clinicRefreshScopeV50())return;
  await loadClinicDoctorsV51();if(scope!==clinicRefreshScopeV50())return;
  const jobs=[['飼主／寵物',()=>refreshOwnerPetCacheV50(scope,tenant)],['候診',()=>refreshAppointmentsV50(scope,tenant)]];
  const canReadInventory=CURRENT_PROFILE?.role==='admin'||CURRENT_PROFILE?.permission_clinical===true||CURRENT_PROFILE?.permission_operational===true||CURRENT_PROFILE?.role==='doctor';
  if(canReadInventory){jobs.push(['藥品',()=>loadMedicines({preserveDrafts:true,scope})],['商品',()=>loadItems({preserveDrafts:true,scope})]);}
  const results=await Promise.allSettled(jobs.map(j=>j[1]()));
  if(scope!==clinicRefreshScopeV50())return;
  const failed=results.map((r,i)=>r.status==='rejected'?jobs[i][0]+'：'+r.reason.message:'').filter(Boolean);
  // Refresh only read-only history panels already open, keeping the active pet/form.
  if(document.getElementById('medical').classList.contains('active')&&currentPetId){
   try{await loadAllMedicalRecords(currentPetId,{preserveDrafts:true});}catch(e){failed.push('病歷紀錄：'+e.message);}
   if(scope!==clinicRefreshScopeV50())return;
   for(const kind of ['rapid','cbc','bio','imaging'])refreshOpenCurrentPetHistory(kind);
   if(document.getElementById('medicalVaccineHistoryPanel').open)void loadPetVaccines();
   if(document.getElementById('medicalBillingPanel').open)void loadMedicalBillingHistory(false);
  }
  if(failed.length)clinicRefreshStatusV50('部分資料尚未更新；原輸入保留。'+failed.join('；'),true);
  else clinicRefreshStatusV50('候診、飼主及寵物'+(canReadInventory?'、藥品／商品':'')+'已更新 · '+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})+'（病歷、處方與購物車保留）');
 }catch(error){if(scope===clinicRefreshScopeV50())clinicRefreshStatusV50('更新未完成：'+error.message+'。原輸入保留，可重試。',true);}
 finally{clinicRefreshBusyV50=false;btn.disabled=false;btn.textContent='↻ 更新資料';}
}

