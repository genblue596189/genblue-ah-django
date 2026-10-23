let rapidDefaultFeeSaveBusy=false,rapidNewTypeSaveBusy=false;
function parseRapidDefaultFee(raw,allowBlank=false){
 const value=String(raw??'').trim();
 if(value===''&&allowBlank)return null;
 if(!/^\d+(?:\.\d{1,2})?$/.test(value)||!Number.isFinite(Number(value))||Number(value)>99999999.99)throw new Error('請填零或正數的費用，最多小數點兩位；免費填 0。');
 return Number(value);
}
function applyRapidDefaultFee(force=false){
 const field=document.getElementById('rapidServiceFee'),note=document.getElementById('rapidDefaultFeeDisplay');
 if(!field)return;
 const rt=loadedRapidTypesMap[document.getElementById('rapidTestItem').value];
 const key=rt?`${CURRENT_TENANT_ID}|${CURRENT_USER?.id||''}|${rt.id}`:'';
 if(force||field.dataset.rapidFeeType!==key){
  const raw=rt?.default_fee;
  field.value=raw!==null&&raw!==undefined&&Number.isFinite(Number(raw))&&Number(raw)>=0?String(Number(raw)):'';
  field.dataset.rapidFeeType=key;
 }
 if(note)note.textContent=!rt?'尚未選擇快篩項目':rt.default_fee===null||rt.default_fee===undefined?'尚未設定預設費用；請管理者在上方設定。':'NT$ '+Number(rt.default_fee).toLocaleString()+'（結帳時可修改）';
}
async function saveRapidDefaultFee(){
 if(rapidDefaultFeeSaveBusy)return;
 if(CURRENT_PROFILE?.role!=='admin'){alert('只有管理者可以儲存預設費用。');return;}
 const tenant=CURRENT_TENANT_ID,user=CURRENT_USER?.id;
 const rt=loadedRapidTypesMap[document.getElementById('rapidFeeSettingType').value];
 if(!rt||!tenant||!user){alert('請先選擇快篩項目。');return;}
 let fee;try{fee=parseRapidDefaultFee(document.getElementById('rapidFeeSettingValue').value);}catch(e){alert(e.message);return;}
 rapidDefaultFeeSaveBusy=true;
 try{
  const {data,error}=await _supabase.from('rapid_types').update({default_fee:fee}).eq('tenant_id',tenant).eq('id',rt.id).select('id,default_fee').single();
  if(error||!data)throw error||new Error('未更新任何資料');
  if(tenant!==CURRENT_TENANT_ID||user!==CURRENT_USER?.id)return;
  rt.default_fee=data.default_fee;
  if(loadedRapidTypesMap[document.getElementById('rapidTestItem').value]?.id===rt.id)applyRapidDefaultFee(true);
  alert('此快篩的預設費用已儲存，下次選用會自動帶入。');
 }catch(e){alert('預設費用儲存失敗：'+e.message+'；請確認已執行快篩預設費用 SQL。');}
 finally{rapidDefaultFeeSaveBusy=false;}
}

function refreshRapidFeeSettings(){
 const select=document.getElementById('rapidFeeSettingType');if(!select)return;
 const old=select.value;select.replaceChildren(new Option('-- 選擇既有快篩 --',''));
 for(const rt of Object.values(loadedRapidTypesMap))select.add(new Option(rt.name,rt.name));
 select.value=loadedRapidTypesMap[old]?old:'';selectRapidFeeSetting();
}
function selectRapidFeeSetting(){
 const rt=loadedRapidTypesMap[document.getElementById('rapidFeeSettingType').value];
 document.getElementById('rapidFeeSettingValue').value=rt?.default_fee??'';
}
