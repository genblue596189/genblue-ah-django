// One clinic-wide standard; only the current administration fee is editable by doctors.
function vaccineFeeValue20261026(raw){
 if(raw===null||raw===undefined||String(raw).trim()==='')return null;
 const n=Number(raw);if(!Number.isFinite(n)||n<0||n>99999999.99||Math.abs(n*100-Math.round(n*100))>0.000001)throw Error('費用請填0至99,999,999.99，最多兩位小數。');return n;
}
function selectedVaccineFee20261026(){
 const select=document.getElementById('vacTypeSelect');if(!select.value||vaccineTypesFeeScope20261026!==CURRENT_TENANT_ID+'|'+CURRENT_USER?.id)return null;
 return vaccineFeeValue20261026(select.selectedOptions[0]?.dataset.defaultFee);
}
function updateVaccineFeeHint20261026(){
 const hint=document.getElementById('vaccineFeeHint20261026'),select=document.getElementById('vacTypeSelect');
 if(!select.value){hint.textContent='選擇疫苗後帶入院內標準費用，可修改本次收費。';return;}
 let standard;try{standard=selectedVaccineFee20261026();}catch{standard=null;}
 if(standard===null){hint.textContent='此疫苗尚未設定標準費用，請填本次金額；免費請填 0。';return;}
 const raw=document.getElementById('vacServiceFee').value;
 hint.textContent='院內標準 NT$ '+standard.toLocaleString('zh-TW')+(raw!==''&&Number(raw)!==standard?'｜本次已調整，標準價不變。':'｜可依優惠調整本次收費。');
}
function applyVaccineFee20261026(){
 const input=document.getElementById('vacServiceFee');let standard;try{standard=selectedVaccineFee20261026();}catch{standard=null;}
 input.value=standard===null?'':String(standard);updateVaccineFeeHint20261026();
}
function renderVaccineFeeSettings20261026(){
 const panel=document.getElementById('vaccineFeeSettings20261026');if(!panel)return;
 panel.hidden=CURRENT_PROFILE?.role!=='admin';if(panel.hidden){document.getElementById('vaccineFeeEditor20261026').replaceChildren();return;}
 if(!panel.open)return;
 const box=document.getElementById('vaccineFeeEditor20261026');
 // Retain unsaved edits when details toggles or a save response arrives.
 if(box.dataset.scope===vaccineTypesFeeScope20261026&&box.children.length)return;
 box.replaceChildren();box.dataset.scope=vaccineTypesFeeScope20261026;
 if(vaccineTypesFeeScope20261026!==CURRENT_TENANT_ID+'|'+CURRENT_USER?.id){box.textContent='請先重新讀取疫苗種類。';return;}
 for(const item of vaccineTypesFeeRows20261026){
  const row=document.createElement('div');row.style.cssText='display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0';
  const label=document.createElement('label');label.textContent=item.name+'（'+item.target+'）';label.style.flex='1';
  const input=document.createElement('input');input.type='number';input.min='0';input.max='99999999.99';input.step='0.01';input.placeholder='尚未設定';input.value=item.default_fee==null?'':String(item.default_fee);input.setAttribute('aria-label',item.name+'標準費用');input.style.width='160px';
  const button=document.createElement('button');button.type='button';button.textContent='儲存標準費用';
  let saving=false,expected=item.default_fee??null;
  button.onclick=async()=>{
   if(saving||CURRENT_PROFILE?.role!=='admin')return;const scope=CURRENT_TENANT_ID+'|'+CURRENT_USER?.id,tenant=CURRENT_TENANT_ID;
   if(scope!==vaccineTypesFeeScope20261026)return;
   let fee;try{fee=vaccineFeeValue20261026(input.value);if(fee===null)throw Error('請填標準費用，免費請填 0。');}catch(e){document.getElementById('vaccineFeeSettingsStatus20261026').textContent=e.message;return;}
   saving=true;button.disabled=true;input.disabled=true;
   try{
    let q=_supabase.from('vaccine_types').update({default_fee:fee}).eq('tenant_id',tenant).eq('id',item.id);
    q=expected===null?q.is('default_fee',null):q.eq('default_fee',expected);
    const {data,error}=await q.select('id,default_fee').single();
    if(scope!==CURRENT_TENANT_ID+'|'+CURRENT_USER?.id)return;
    if(error||!data?.id)throw Error(error?.message||'未確認更新；可能已由其他管理者修改，請重新讀取核對。');
    expected=data.default_fee;item.default_fee=data.default_fee;
    for(const option of document.getElementById('vacTypeSelect').options)if(option.dataset.vaccineTypeId===item.id)option.dataset.defaultFee=String(data.default_fee);
    // Never overwrite an in-progress administration's actual fee on catalog update.
    updateVaccineFeeHint20261026();document.getElementById('vaccineFeeSettingsStatus20261026').textContent=item.name+'標準費用已儲存，下次選擇時自動帶入。';
   }catch(e){if(scope===CURRENT_TENANT_ID+'|'+CURRENT_USER?.id)document.getElementById('vaccineFeeSettingsStatus20261026').textContent='儲存未確認：'+e.message;}
   finally{saving=false;button.disabled=false;input.disabled=false;}
  };
  row.append(label,input,button);box.append(row);
 }
}
document.getElementById('vacTypeSelect').addEventListener('change',applyVaccineFee20261026);
document.getElementById('vacServiceFee').addEventListener('input',updateVaccineFeeHint20261026);
