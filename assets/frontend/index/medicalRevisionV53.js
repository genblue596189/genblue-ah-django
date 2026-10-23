
var medicalEditV53=null,medicalEditRequestV53=0;
function medicalEditAllowedV53(){return CURRENT_PROFILE?.role==='admin'||(CURRENT_PROFILE?.permission_clinical??(CURRENT_PROFILE?.role==='doctor'));}
function medicalEditScopeV53(){return doctorScopeV51()+'|'+(currentPetId||'');}
function medicalEditStatusV53(text,failed=false){const node=document.getElementById('medicalEditStatusV53');node.textContent=text;node.style.color=failed?'#b45309':'#047857';}
function medicalEditValidV53(state){return state===medicalEditV53&&state.scope===medicalEditScopeV53()&&state.petId===currentPetId;}
function medicalEditBusyV53(busy){for(const id of ['medicalEditTextV53','medicalEditReasonV53','medicalEditSaveV53','medicalEditCloseV53','medicalEditLatestV53','medicalEditAdoptV53'])document.getElementById(id).disabled=busy;}
function closeMedicalEditV53(){if(medicalEditV53?.saving)return;if(medicalEditV53&&medicalEditDirtyV53()&&!confirm('目前修正尚未儲存，確定關閉？'))return;medicalEditRequestV53++;medicalEditV53=null;document.getElementById('medicalEditModalV53').style.display='none';}
function medicalEditDirtyV53(){return medicalEditV53&&(document.getElementById('medicalEditTextV53').value!==medicalEditV53.original||document.getElementById('medicalEditReasonV53').value.trim());}
function medicalEditChangesV53(changes){const node=document.getElementById('medicalEditChangesV53');node.replaceChildren();for(const change of changes||[]){const li=document.createElement('li');li.textContent=new Date(change.changed_at).toLocaleString('zh-TW')+' · '+change.actor_name+' · '+change.reason;node.append(li);}if(!node.childNodes.length){const li=document.createElement('li');li.textContent='尚無透過此功能儲存的修正紀錄。';node.append(li);}}
async function openMedicalEditV53(recordId){
 if(!medicalEditAllowedV53()){alert('此帳號沒有病歷編輯權限。');return;}
 if(medicalEditV53?.saving)return;
 if(medicalEditV53&&medicalEditDirtyV53()&&!confirm('開啟另一筆病歷會替換尚未儲存的修正，確定繼續？'))return;
 const request=++medicalEditRequestV53,scope=medicalEditScopeV53(),petId=currentPetId;if(!petId){alert('請先選擇寵物。');return;}
 try{
  const {data,error}=await _supabase.rpc('get_medical_text_v53',{p_record_id:recordId});if(error)throw error;
  if(request!==medicalEditRequestV53||scope!==medicalEditScopeV53())return;
  if(!data?.record||data.record.pet_id!==petId||!Number.isSafeInteger(Number(data.record.row_version))||Number(data.record.row_version)<1)throw Error('病歷或版本不符，請更新歷史紀錄後再開啟。');
  const record=data.record;medicalEditV53={scope,petId,recordId,version:Number(record.row_version),original:record.chief_complaint||'',saving:false,conflict:false,latest:null,attempt:null};
  document.getElementById('medicalEditHeadingV53').textContent=(currentPetName||'此寵物')+' · '+new Date(record.created_at).toLocaleString('zh-TW')+' · 版本 '+record.row_version;
  document.getElementById('medicalEditTextV53').value=medicalEditV53.original;document.getElementById('medicalEditReasonV53').value='';
  document.getElementById('medicalEditCompareV53').hidden=true;medicalEditChangesV53(data.changes);medicalEditStatusV53('修正病歷文字；原處方、收費與庫存保持原樣。');medicalEditBusyV53(false);
  document.getElementById('medicalEditModalV53').style.display='flex';
 }catch(e){if(request===medicalEditRequestV53&&scope===medicalEditScopeV53())alert('無法開啟病歷修正：'+e.message+'。請確認已安裝 v53 SQL。');}
}
async function saveMedicalEditV53(){
 const state=medicalEditV53;if(!state||state.saving)return;if(!medicalEditValidV53(state)){medicalEditStatusV53('目前病患或登入身分已改變，請保留輸入並關閉此視窗重新開啟。',true);return;}
 if(state.conflict){medicalEditStatusV53('請先查看並採用最新內容，再重新修正；目前輸入仍保留。',true);return;}
 const chief=document.getElementById('medicalEditTextV53').value,reason=document.getElementById('medicalEditReasonV53').value.trim();if(!reason||reason.length>500||chief.length>200000){medicalEditStatusV53('請填寫修正原因（最多500字）；病歷文字最多200,000字。',true);return;}
 if(chief===state.original){medicalEditStatusV53('病歷文字沒有變更，無需儲存。');return;}
 const fingerprint=JSON.stringify([state.version,chief,reason]);if(state.attempt?.fingerprint!==fingerprint)state.attempt={fingerprint,id:crypto.randomUUID()};
 state.saving=true;medicalEditBusyV53(true);medicalEditStatusV53('正在儲存修正…');
 try{
  const {data,error}=await _supabase.rpc('amend_medical_text_v53',{p_record_id:state.recordId,p_expected_version:state.version,p_chief:chief,p_reason:reason,p_request_id:state.attempt.id});if(error)throw error;if(!medicalEditValidV53(state))return;
  if(!data?.ok){if(data?.reason==='conflict'){state.conflict=true;medicalEditStatusV53('另一位同事已更新這筆病歷，這次沒有覆蓋；你的輸入仍保留。請按「查看最新版本」核對。',true);return;}throw Error('未確認病歷已儲存。');}
  const version=Number(data.row_version);if(!Number.isSafeInteger(version)||version<1)throw Error('未取得有效的儲存版本，請保留畫面並重試。');
  state.version=version;state.original=chief;state.attempt=null;document.getElementById('medicalEditReasonV53').value='';medicalEditStatusV53('✓ 病歷修正已儲存（版本 '+version+'）');
  try{await loadAllMedicalRecords(state.petId,{preserveDrafts:true});if(!medicalEditValidV53(state))return;const r=await _supabase.rpc('get_medical_text_v53',{p_record_id:state.recordId});if(r.error)throw r.error;if(medicalEditValidV53(state))medicalEditChangesV53(r.data?.changes);}catch(e){if(medicalEditValidV53(state))medicalEditStatusV53('✓ 修正已儲存；歷史列表暫未更新，請稍後按更新資料。',true);}
 }catch(e){if(medicalEditValidV53(state))medicalEditStatusV53('儲存未確認：'+e.message+'。目前輸入保留，請核對或重試。',true);}
 finally{state.saving=false;if(state===medicalEditV53)medicalEditBusyV53(false);}
}
async function viewLatestMedicalV53(){
 const state=medicalEditV53;if(!state||state.saving)return;if(!medicalEditValidV53(state)){medicalEditStatusV53('病患或登入身分已改變，請重新開啟修正。',true);return;}
 state.saving=true;medicalEditBusyV53(true);
 try{const {data,error}=await _supabase.rpc('get_medical_text_v53',{p_record_id:state.recordId});if(error)throw error;if(!medicalEditValidV53(state))return;if(data?.record?.pet_id!==state.petId)throw Error('病歷病患不符');state.latest=data.record;document.getElementById('medicalEditLatestTextV53').value=data.record.chief_complaint||'';document.getElementById('medicalEditLatestLabelV53').textContent='資料庫最新內容（版本 '+data.record.row_version+'）';document.getElementById('medicalEditCompareV53').hidden=false;medicalEditChangesV53(data.changes);medicalEditStatusV53('最新版本已列在下方，目前修正輸入沒有變更。');}
 catch(e){if(medicalEditValidV53(state))medicalEditStatusV53('最新版本載入失敗：'+e.message+'；目前輸入仍保留。',true);}finally{state.saving=false;if(state===medicalEditV53)medicalEditBusyV53(false);}
}
function adoptLatestMedicalV53(){
 const state=medicalEditV53;if(!state||state.saving||!state.latest||!medicalEditValidV53(state))return;
 if(!confirm('這會以最新病歷文字替換目前尚未儲存的修正，並清空修正原因。請先保留需要的文字，確定採用最新內容？'))return;
 const version=Number(state.latest.row_version);if(!Number.isSafeInteger(version)||version<1){medicalEditStatusV53('版本不符，請重新載入最新內容。',true);return;}
 state.version=version;state.original=state.latest.chief_complaint||'';state.conflict=false;state.attempt=null;document.getElementById('medicalEditTextV53').value=state.original;document.getElementById('medicalEditReasonV53').value='';document.getElementById('medicalEditCompareV53').hidden=true;medicalEditStatusV53('已採用最新內容，請重新修正並填寫原因。');
}
async function saveArchiveMedicalV53(attempt,tenant,petId,chief){
 const visit=doctorVisitV51;if(!visit||visit.petId!==petId||tenant!==CURRENT_TENANT_ID)throw Error('無法確認這次歸檔接診權，請保留輸入。');const result=await medicalDjangoRequestV5('archive',{pet_id:petId,appointment_id:visit.appointmentId,claim_id:visit.claimId,request_id:attempt.id,expected_version:attempt.version||0,chief});const data=result.data,error=null;if(error)throw error;if(!data?.id||data.id!==attempt.id||!Number.isSafeInteger(Number(data.row_version)))throw Error('未確認歸檔病歷已儲存。');attempt.version=Number(data.row_version);return data;
}

function validateClinicPrivateBackupV53(snapshot){
 const expected=['clinic_visit_claims_v51','clinic_multidoctor_settings_v51','medical_amendments_v53'];
 if(!snapshot.private_tables||Object.keys(snapshot.private_tables).sort().join('|')!==expected.slice().sort().join('|'))throw Error('備份缺少多人接診／病歷修正資料。');
 const pets=new Set(snapshot.tables.pets.rows.map(r=>r.id)),appointments=new Set(snapshot.tables.appointments.rows.map(r=>r.id)),records=new Set(snapshot.tables.medical_records.rows.map(r=>r.id));let total=0;
 for(const name of expected){const table=snapshot.private_tables[name];if(table.source_schema!=='private'||!Array.isArray(table.rows)||!Number.isSafeInteger(table.row_count)||table.row_count!==table.rows.length)throw Error(name+' 備份結構或筆數不符');const keys=new Set();
  for(const row of table.rows){if(!row||Array.isArray(row)||String(row.tenant_id)!==snapshot.tenant_id)throw Error(name+' 具有非本院資料');const key=name==='medical_amendments_v53'?row.request_id:name==='clinic_visit_claims_v51'?row.claim_id:row.tenant_id;if(typeof key!=='string'||!key||keys.has(key))throw Error(name+' 備份主鍵有誤');keys.add(key);
   if(name==='medical_amendments_v53'&&(!records.has(row.medical_record_id)||typeof row.actor_name!=='string'||typeof row.reason!=='string'||!Number.isSafeInteger(Number(row.previous_version))||!Number.isSafeInteger(Number(row.saved_version))))throw Error('病歷修正備份缺少病歷關聯或修正資料');
   if(name==='clinic_visit_claims_v51'&&(!pets.has(row.pet_id)||(row.appointment_id&&!appointments.has(row.appointment_id))))throw Error('接診占用備份缺少病患或候診關聯');
   if(name==='clinic_multidoctor_settings_v51'&&typeof row.enabled!=='boolean')throw Error('多人接診保護設定備份不符');
  }total+=table.row_count;
 }return total;
}

