const medicalWeightRequests=new Map();
function medicalWeightScope(){return `${CURRENT_TENANT_ID||''}|${CURRENT_USER?.id||''}|${currentPetId||''}`;}
function setMedicalWeightStatus(text,error=false){
 const el=document.getElementById('medicalWeightSaveStatus');if(el){el.textContent=text;el.style.color=error?'#b91c1c':'#64748b';}
}
function markMedicalWeightDraft(){setMedicalWeightStatus('離開欄位後自動儲存體重。');}
function readMedicalWeightForSave(){
 const raw=document.getElementById('medicalPetWeightInput').value.trim();
 if(raw===''||Number(raw)===0)return null; // 未量或初始0，不覆寫原體重。
 const value=roundPetWeight(raw);
 if(value===null||value<=0)throw new Error('體重需為大於 0 的數字；未量請留空。');
 return value;
}
async function persistMedicalWeight(){
 const tenant=CURRENT_TENANT_ID,user=CURRENT_USER?.id,petId=currentPetId;
 if(!tenant||!user||!petId)throw new Error('請先選擇看診寵物並確認已登入。');
 const scope=medicalWeightScope(),weight=readMedicalWeightForSave();
 if(weight===null){setMedicalWeightStatus('未量體重；保留資料庫原值。');return true;}
 const pending=medicalWeightRequests.get(scope);
 if(pending?.weight===weight)return pending.promise;
 const previous=pending?.promise;
 const promise=(async()=>{
  if(previous)try{await previous;}catch(e){} // 同病患依量測順序写入，舊請求不覆蓋新值。
  if(medicalWeightScope()!==scope)return false;
  setMedicalWeightStatus('體重儲存中…');
  const {data,error}=await _supabase.from('pets').update({weight}).eq('tenant_id',tenant).eq('id',petId).select('id,weight').single();
  if(error||!data||data.id!==petId||Number(data.weight)!==weight)throw error||new Error('未確認體重已寫入，請檢查帳號權限。');
  if(medicalWeightScope()!==scope)return false;
  for(const p of allPetsListForDropdown)if(p.id===petId)p.weight=weight;
  for(const p of activeAppointmentsList)if(p.id===petId||p.pet_id===petId)p.weight=weight;
  for(const owner of globalOwnersPetsData)for(const p of owner.pets||[])if(p.id===petId)p.weight=weight;
  if(readMedicalWeightForSave()===weight){currentPetWeight=weight;medicalStateCache.weight=weight;setMedicalWeightStatus('體重已儲存：'+weight+' kg');}
  renderAppointmentTable(activeAppointmentsList);
  return true;
 })();
 medicalWeightRequests.set(scope,{weight,promise});
 try{return await promise;}finally{if(medicalWeightRequests.get(scope)?.promise===promise)medicalWeightRequests.delete(scope);}
}
async function saveMedicalWeightOnBlur(){
 const scope=medicalWeightScope();
 try{await persistMedicalWeight();}catch(e){if(medicalWeightScope()===scope)setMedicalWeightStatus('體重尚未儲存：'+e.message+'；可按「儲存體重」重試。',true);}
}
async function ensureMedicalWeightForAction(){
 const scope=medicalWeightScope();
 try{
  const weight=readMedicalWeightForSave();
  const ok=await persistMedicalWeight();
  if(!ok||medicalWeightScope()!==scope)return false;
  if(readMedicalWeightForSave()!==weight){alert('儲存期間體重已變更，請再按一次儲存。');return false;}
  if(!await ensureMedicalTemperatureForAction())return false;
  if(medicalWeightScope()!==scope||readMedicalWeightForSave()!==weight)return false;
  return true;
 }catch(e){if(medicalWeightScope()!==scope)return false;setMedicalWeightStatus('體重尚未儲存：'+e.message,true);alert('體重儲存未成功：'+e.message+'。請保留畫面並重試。');return false;}
}
