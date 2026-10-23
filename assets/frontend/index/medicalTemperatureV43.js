const medicalTemperatureRequests=new Map();
let medicalTemperatureRevision=0;
function setMedicalTemperatureStatus(text,error=false){const el=document.getElementById('medicalTemperatureSaveStatus');if(el){el.textContent=text;el.style.color=error?'#b91c1c':'#64748b';}}
function markMedicalTemperatureDraft(){medicalTemperatureRevision++;setMedicalTemperatureStatus('離開欄位後自動儲存體溫。');}
function readMedicalTemperatureForSave(){
 const el=document.getElementById('medicalTemperatureInput'),raw=el.value.trim();
 if(el.validity?.badInput)throw new Error('請填有效體溫數字。');
 if(raw==='')return null;
 const value=Number(raw);if(!Number.isFinite(value)||value<=0||value>100)throw new Error('體溫需為大於0且不超過100的數值；未量請留空。');
 const rounded=roundPetWeight(value);if(rounded<=0)throw new Error('體溫數值太小，請重新確認。');return rounded;
}
async function persistMedicalTemperature(){
 const tenant=CURRENT_TENANT_ID,user=CURRENT_USER?.id,petId=currentPetId;
 if(!tenant||!user||!petId)throw new Error('請先登入並選擇看診寵物。');
 const scope=medicalWeightScope(),temperature=readMedicalTemperatureForSave();
 if(temperature===null){setMedicalTemperatureStatus('未量體溫；保留上次量測。');return true;}
 const pending=medicalTemperatureRequests.get(scope);
 if(pending?.temperature===temperature)return pending.promise;
 const previous=pending?.promise;
 const promise=(async()=>{
  if(previous)try{await previous;}catch(e){}
  if(medicalWeightScope()!==scope)return false;
  setMedicalTemperatureStatus('體溫儲存中…');
  const {data,error}=await _supabase.rpc('save_pet_temperature',{p_pet_id:petId,p_temperature:temperature}).single();
  if(error||!data||data.id!==petId||Number(data.latest_temperature)!==temperature||!data.temperature_measured_at)throw error||new Error('未確認體溫已寫入，請核對 SQL 與帳號權限。');
  if(medicalWeightScope()!==scope)return false;
  for(const p of allPetsListForDropdown)if(p.id===petId){p.latest_temperature=temperature;p.temperature_measured_at=data.temperature_measured_at;}
  for(const owner of globalOwnersPetsData)for(const p of owner.pets||[])if(p.id===petId){p.latest_temperature=temperature;p.temperature_measured_at=data.temperature_measured_at;}
  if(readMedicalTemperatureForSave()===temperature){document.getElementById('medicalTemperatureInput').value=String(temperature);medicalStateCache.temperature=String(temperature);setMedicalTemperatureStatus('體溫已儲存：'+temperature+' °C');}
  return true;
 })();
 medicalTemperatureRequests.set(scope,{temperature,promise});
 try{return await promise;}finally{if(medicalTemperatureRequests.get(scope)?.promise===promise)medicalTemperatureRequests.delete(scope);}
}
async function saveMedicalTemperatureOnBlur(){const scope=medicalWeightScope();try{await persistMedicalTemperature();}catch(e){if(medicalWeightScope()===scope)setMedicalTemperatureStatus('體溫尚未儲存：'+e.message+'；可按「儲存體溫」重試。',true);}}
async function ensureMedicalTemperatureForAction(){
 const scope=medicalWeightScope();
 try{const temperature=readMedicalTemperatureForSave();const ok=await persistMedicalTemperature();if(!ok||medicalWeightScope()!==scope)return false;if(readMedicalTemperatureForSave()!==temperature){alert('儲存期間體溫已變更，請再按一次儲存。');return false;}return true;}
 catch(e){if(medicalWeightScope()===scope){setMedicalTemperatureStatus('體溫尚未儲存：'+e.message,true);alert('體溫儲存未成功：'+e.message+'。請保留畫面並重試。');}return false;}
}
async function loadLastTemperatureMeasurement(){
 const scope=medicalWeightScope(),revision=++medicalTemperatureRevision,tenant=CURRENT_TENANT_ID,petId=currentPetId;
 setMedicalTemperatureStatus('');
 try{
  const {data,error}=await _supabase.from('pets').select('id,latest_temperature,temperature_measured_at').eq('tenant_id',tenant).eq('id',petId).single();
  if(scope!==medicalWeightScope()||revision!==medicalTemperatureRevision||document.getElementById('medicalTemperatureInput').value.trim())return;
  if(error){setMedicalTemperatureStatus('無法讀取上次體溫，請確認已執行體溫儲存 SQL。',true);return;}
  if(data?.latest_temperature!==null&&data?.latest_temperature!==undefined){
   const when=data.temperature_measured_at?new Date(data.temperature_measured_at).toLocaleString('zh-TW',{hour12:false}):'';
   setMedicalTemperatureStatus('上次已存：'+Number(data.latest_temperature)+' °C'+(when?'（'+when+'）':'')+'；本次未量請留空。');
  }
 }catch(e){if(scope===medicalWeightScope()&&revision===medicalTemperatureRevision)setMedicalTemperatureStatus('上次體溫讀取失敗：'+e.message,true);}
}
