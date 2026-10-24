
var clinicDoctorsV51=[],clinicClaimsV51=new Map(),doctorVisitV51=null,doctorOpeningV51=false,doctorRosterScopeV51='',doctorRosterPromiseV51=null,clinicMultiDoctorEnabledV51=false;
async function clinicDjangoRpcV4(action,params={}){
 const scope=doctorScopeV51(),tenant=CURRENT_TENANT_ID,userId=CURRENT_USER?.id;
 if(!scope)throw Error('請先登入。');
 const {data:{session},error}=await _supabase.auth.getSession();
 if(error)throw error;
 if(!session || session.user.id!==userId || scope!==doctorScopeV51())throw Error('登入身分已變更，請重新登入。');
 const response=await fetch('/api/clinic/'+encodeURIComponent(action)+'/',{
  method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
  body:JSON.stringify(params),cache:'no-store'
 });
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'無法確認醫師／接診狀態，請更新候診核對。');
 if(scope!==doctorScopeV51() || result.tenant_id!==tenant || result.user_id!==userId)throw Error('登入院所或身分已變更，已停止更新畫面。');
 return {data:result.data,error:null};
}
function doctorScopeV51(){return CURRENT_TENANT_ID&&CURRENT_USER?.id?CURRENT_TENANT_ID+'|'+CURRENT_USER.id:'';}
function appointmentDoctorAssignmentV51(){
 const value=document.getElementById('appointmentDoctor').value;
 if(!value)return {doctor:null,assigned_doctor_id:null};
 if(value.startsWith('legacy:'))return {doctor:value.slice(7),assigned_doctor_id:null};
 const doctor=clinicDoctorsV51.find(d=>d.id===value);if(!doctor)throw Error('指定醫師已變更，請更新醫師名單後重新選擇');
 return {doctor:doctor.name,assigned_doctor_id:doctor.id};
}
function setAppointmentDoctorV51(appointment){
 const el=document.getElementById('appointmentDoctor');
 if(appointment.assigned_doctor_id&&[...el.options].some(o=>o.value===appointment.assigned_doctor_id))el.value=appointment.assigned_doctor_id;
 else if(appointment.doctor){const option=document.createElement('option');option.value='legacy:'+appointment.doctor;option.textContent=appointment.doctor+'（舊預約名稱）';el.appendChild(option);el.value=option.value;}
 else el.value='';
}
function renderDoctorChoicesV51(){
 const select=document.getElementById('appointmentDoctor'),previous=select.selectedOptions[0]?.cloneNode(true),value=select.value;
 select.replaceChildren(new Option('不指定／由現場接診',''));
 for(const d of clinicDoctorsV51)select.appendChild(new Option(d.name,d.id));
 if(value){if([...select.options].some(o=>o.value===value))select.value=value;else if(previous){select.appendChild(previous);select.value=value;}}
 const filter=document.getElementById('clinicDoctorFilterV51'),old=filter.value;
 filter.replaceChildren(new Option('全部醫師','all'),new Option('我的與未指定','mine'),new Option('未指定醫師','unassigned'));
 for(const d of clinicDoctorsV51)filter.appendChild(new Option(d.name,d.id));
 filter.value=[...filter.options].some(o=>o.value===old)?old:'all';
 if(doctorRosterScopeV51!==doctorScopeV51()){doctorRosterScopeV51=doctorScopeV51();filter.value=CURRENT_PROFILE?.role==='doctor'?'mine':'all';}
}
async function loadClinicDoctorsV51(){
 const scope=doctorScopeV51();if(!scope)return;
 if(doctorRosterPromiseV51)return doctorRosterPromiseV51;
 doctorRosterPromiseV51=(async()=>{const {data,error}=await clinicDjangoRpcV4('clinic_doctor_state_v51');if(error)throw Error('醫師／看診資料無法讀取：'+error.message);if(scope!==doctorScopeV51())return;
  clinicMultiDoctorEnabledV51=data.enabled===true;document.getElementById('clinicDoctorProtectionV51').textContent=clinicMultiDoctorEnabledV51?'多人接診保護已啟用':'新版接診會確認占用；所有診間更新後，可啟用完整保護。';document.getElementById('clinicDoctorEnableV51').hidden=CURRENT_PROFILE?.role!=='admin'||clinicMultiDoctorEnabledV51;clinicDoctorsV51=data.doctors||[];clinicClaimsV51=new Map((data.claims||[]).map(c=>[c.pet_id,c]));renderDoctorChoicesV51();renderAppointmentTable(activeAppointmentsList);
 })();try{await doctorRosterPromiseV51;}finally{doctorRosterPromiseV51=null;}
}
function filterDoctorWaitingV51(rows){
 const value=document.getElementById('clinicDoctorFilterV51').value,uid=CURRENT_USER?.id;
 const unassigned=p=>!p.assigned_doctor_id&&(!p.doctor||p.doctor==='不指定')&&!clinicClaimsV51.has(p.id);
 return rows.filter(p=>value==='all'||(value==='unassigned'?unassigned(p):value==='mine'?(p.assigned_doctor_id===uid||clinicClaimsV51.get(p.id)?.clinician_id===uid||unassigned(p)):(p.assigned_doctor_id===value||clinicClaimsV51.get(p.id)?.clinician_id===value)));
}
function doctorWaitingLabelV51(pet){const claim=clinicClaimsV51.get(pet.id);return escapeLabText(claim?claim.clinician_name+' · 看診中':pet.doctor||'不指定');}
function doctorVisitOccupiedV51(pet){const claim=clinicClaimsV51.get(pet.id);return !!claim&&claim.clinician_id!==CURRENT_USER?.id;}
function doctorReleaseActionV51(pet){return CURRENT_PROFILE?.role==='admin'&&pet.status==='診間看診中'&&pet.appointment_id?`<button type="button" class="btn-secondary" onclick='releaseDoctorVisitV51(${escapeLabText(JSON.stringify(pet.id))},${escapeLabText(JSON.stringify(pet.appointment_id))})'>解除占用</button>`:'';}
async function verifyDoctorVisitV51(){
 const visit=doctorVisitV51,scope=doctorScopeV51();
 if(!visit||visit.scope!==scope||visit.petId!==currentPetId){alert('請從候診重新確認本次接診權；正在填寫的內容會保留。');return false;}
 try{const {data,error}=await clinicDjangoRpcV4('verify_clinic_visit_v51',{p_pet_id:visit.petId,p_claim_id:visit.claimId});if(error)throw error;
  if(scope!==doctorScopeV51()||visit!==doctorVisitV51||visit.petId!==currentPetId)return false;
  if(data!==true)throw Error('看診已結束或占用已被解除，無法繼續儲存');return true;
 }catch(error){alert('看診權確認失敗：'+error.message+'。請保留輸入並更新候診。');return false;}
}
async function releaseDoctorVisitV51(petId,appointmentId){
 if(CURRENT_PROFILE?.role!=='admin')return;
 if(!confirm('確定解除這筆看診占用並返回候診？請先確認原醫師已停止操作。原醫師尚未儲存的內容不會自動移交。'))return;
 const scope=doctorScopeV51();try{const {error}=await clinicDjangoRpcV4('release_clinic_visit_v51',{p_pet_id:petId,p_appointment_id:appointmentId});if(error)throw error;if(scope!==doctorScopeV51())return;await loadClinicDoctorsV51();await loadAppointments();alert('已解除占用，回到候診。');}catch(error){alert('解除未完成：'+error.message);}
}
const doctorOriginalStartV51=startConsultationById;
async function startDoctorConsultationV51(args,appointmentId=null){
 if(doctorOpeningV51)return;
 const scope=doctorScopeV51(),petId=args[0];if(!scope)return;
 doctorOpeningV51=true;
 try{
  if(doctorVisitV51&&doctorVisitV51.scope===scope&&doctorVisitV51.petId!==petId){
   const {data,error}=await clinicDjangoRpcV4('verify_clinic_visit_v51',{p_pet_id:doctorVisitV51.petId,p_claim_id:doctorVisitV51.claimId});if(error)throw error;
   if(data===true){alert('請先完成原寵物的看診或儲存回候診，再接下一位。');return;}
   if(currentPetId&&(!confirm('原看診已不再占用。接下一位會清空目前未儲存的輸入，請先自行保留內容。')))return;
  }
  const assigned=activeAppointmentsList.find(p=>p.appointment_id===appointmentId);
  if(assigned?.assigned_doctor_id&&assigned.assigned_doctor_id!==CURRENT_USER.id&&!doctorVisitOccupiedV51(assigned)&&!confirm('原指定醫師為「'+(assigned.doctor||'其他醫師')+'」，確定改由你接診？'))return;
  const {data,error}=await clinicDjangoRpcV4('claim_clinic_visit_v51',{p_pet_id:petId,p_appointment_id:appointmentId});if(error)throw error;if(scope!==doctorScopeV51())return;
  if(!data?.ok){await loadClinicDoctorsV51();await loadAppointments();alert(data?.reason==='legacy_busy'?'這筆既有看診由「'+data.name+'」進行中。請先確認狀態；需要時由管理者解除占用。':'這筆已由「'+(data?.name||'其他醫師')+'」看診中，未開啟或清空你的門診。');return;}
  const resume=doctorVisitV51?.scope===scope&&doctorVisitV51.petId===petId&&doctorVisitV51.claimId===data.claim_id&&currentPetId===petId;
  doctorVisitV51={scope,petId,claimId:data.claim_id,appointmentId:data.appointment.id,name:data.name};currentAppointmentId=data.appointment.id;if(typeof nightRememberV93==='function')nightRememberV93(data.appointment);
  clinicClaimsV51.set(petId,{pet_id:petId,appointment_id:data.appointment.id,claim_id:data.claim_id,clinician_id:CURRENT_USER.id,clinician_name:data.name});
  const existing=activeAppointmentsList.find(p=>p.appointment_id===data.appointment.id);
  if(existing)Object.assign(existing,{doctor:data.name,assigned_doctor_id:CURRENT_USER.id,status:'診間看診中'});
  else activeAppointmentsList.push({...waitingPetFromAppointment({id:petId,name:args[2],microchip:args[1],owner_id:args[3],weight:args[4],owner_name:args[5],birthday:args[6],gender:args[7],species:args[8],breed:args[9]},data.appointment),assigned_doctor_id:CURRENT_USER.id});
  if(resume){switchTab('medical');renderAppointmentTable(activeAppointmentsList);}else await doctorOriginalStartV51(...args);
  if(scope===doctorScopeV51()&&currentPetId===petId)document.getElementById('medicalDoctorContextV51').textContent='本次接診：'+data.name+'（已取得看診權）';
 }catch(error){if(scope===doctorScopeV51())alert('接診未完成：'+error.message+'。原門診輸入保留；請更新候診後確認。');}
 finally{doctorOpeningV51=false;}
}
startConsultationById=function(...args){return startDoctorConsultationV51(args,null);};
const doctorOriginalEnsureVitalsV51=ensureMedicalWeightForAction;
ensureMedicalWeightForAction=async function(options){
 const visit=doctorVisitV51,scope=doctorScopeV51();
 if(!await verifyDoctorVisitV51()||!await doctorOriginalEnsureVitalsV51())return false;
 // These callers immediately save through Django, which verifies the live claim
 // again before inserting. Other callers retain the second remote check.
 if(options?.verifiedByMedicalSave===true)return visit===doctorVisitV51&&scope===doctorScopeV51()&&visit?.petId===currentPetId;
 return await verifyDoctorVisitV51();
};
const doctorOriginalRenderV51=renderAppointmentTable;
renderAppointmentTable=function(rows){doctorOriginalRenderV51(filterDoctorWaitingV51(rows));};
// Initialize the filter beside the waiting list, without changing registration fields.
const doctorWaitingToolbarV51=document.createElement('div');doctorWaitingToolbarV51.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0';
doctorWaitingToolbarV51.innerHTML='<label for="clinicDoctorFilterV51">候診醫師</label><select id="clinicDoctorFilterV51" style="width:auto;min-width:160px" onchange="renderAppointmentTable(activeAppointmentsList)"><option value="all">全部醫師</option></select><button type="button" class="btn-secondary" onclick="refreshClinicDataV50()">更新名單／候診</button><small>在人員管理勾選「接診醫師」，並具備病歷編輯權限，才會列入名單。</small><span id="clinicDoctorProtectionV51" style="font-size:.8rem"></span><button id="clinicDoctorEnableV51" hidden type="button" class="btn-secondary" onclick="enableMultiDoctorV51()">啟用多人接診保護</button>';
const doctorWaitingTableV51=document.getElementById('appointmentTableBody').closest('table');doctorWaitingTableV51.parentElement.insertBefore(doctorWaitingToolbarV51,doctorWaitingTableV51);

async function enableMultiDoctorV51(){
 if(CURRENT_PROFILE?.role!=='admin')return;
 if(!confirm('請確認所有診間電腦都已改用 v52 或更新版本。啟用後，舊版無法直接接診或新增門診病歷。確定啟用多人接診保護？'))return;
 const scope=doctorScopeV51();try{const {error}=await _supabase.rpc('set_clinic_multidoctor_v51',{p_enabled:true});if(error)throw error;if(scope===doctorScopeV51())await loadClinicDoctorsV51();}catch(e){alert('啟用未完成：'+e.message);}
}
const doctorOriginalDirectCheckoutV51=directCheckoutFromAppointment;
directCheckoutFromAppointment=async function(...args){const scope=doctorScopeV51();try{await loadClinicDoctorsV51();if(scope!==doctorScopeV51())return;const c=clinicClaimsV51.get(args[0]);if(c&&c.clinician_id!==CURRENT_USER?.id){alert('此寵物仍由「'+c.clinician_name+'」看診中，請先由原醫師完成看診。');return;}return doctorOriginalDirectCheckoutV51(...args);}catch(e){alert('無法確認看診狀態：'+e.message);}};

const doctorOriginalClearMedicalV51=clearMedicalFormInputs;
clearMedicalFormInputs=function(){doctorOriginalClearMedicalV51();document.getElementById('medicalDoctorContextV51').textContent='';void loadClinicDoctorsV51().catch(e=>clinicRefreshStatusV50('看診名單尚未更新：'+e.message,true));};

