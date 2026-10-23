
/* v76.3: explicit dose units for configured calculation routes. */
function formatPrescriptionDoseV763(text,route){
 const value=String(text??'').trim();
 if(!/^(?:\d+(?:\.\d+)?|\.\d+)\s*(?:單位)?$/.test(value))return value;
 const number=value.replace(/\s*單位$/, '');
 const unit=route?.calc==='tablet'?'mg/kg':document.getElementById('prescriptionDoseUnitV91')?.value;
 return unit?number+' '+unit:number;
}
function injectionConcentrationV9113(text){
 const value=String(text||'').normalize('NFKC').replace(/\s/g,'');
 const match=value.match(/^(\d+(?:\.\d+)?|\.\d+)(IU|mg|mcg|μg|ug|g)\/(\d+(?:\.\d+)?|\.\d+)?ml$/i);
 if(!match)return null;const amount=Number(match[1]),volume=match[3]?Number(match[3]):1;
 if(!(amount>0&&volume>0))return null;
 const raw=match[2].toLowerCase(),unit=raw==='iu'?'IU':'mg',factor=raw==='g'?1000:['mcg','μg','ug'].includes(raw)?.001:1;
 return {unit,perMl:amount*factor/volume};
}
function injectionDefaultUnitV9113(med){
 const recommended=String(med?.recommended_dose||'').match(/(IU|mg|ml)\s*\/\s*kg/i);
 if(recommended)return recommended[1].toLowerCase()==='iu'?'IU/kg':recommended[1].toLowerCase()+'/kg';
 return injectionConcentrationV9113(med?.usage_dose||med?.strength)?.unit==='IU'?'IU/kg':'ml/kg';
}
function setInjectionVolumeV9113(volume){
 const result=document.getElementById('calculatedDoseResult'),qty=document.getElementById('medPrescribeQty');
 if(!Number.isFinite(volume)||volume<=0){result.value='請核對劑量單位及規格濃度，無法換算 ml';qty.value='';return;}
 const rounded=Math.round((volume+Number.EPSILON)*1000)/1000;
 if(rounded===0){result.value='用量少於 0.001 ml，請手動核對可量取用量';qty.value='';return;}
 qty.value=String(rounded);qty.step='any';result.value='建議單次用量 '+rounded+' ml';
}
function syncPrescriptionDoseUnitV91(route){
 const select=document.getElementById('prescriptionDoseUnitV91');if(!select)return;
 const med=loadedMedicinesMap[document.getElementById('medSelectDropdown').value];
 const automatic=route?.calc==='ratio'?injectionDefaultUnitV9113(med):route?.calc==='tablet'?'mg/kg':'';
 select.value=automatic;select.disabled=route?.calc==='tablet';
 if(route?.calc==='ratio')document.getElementById('labelRecDoseTitle').textContent='使用劑量（依所選單位換算 ml）';
}

function normalizePrescriptionDoseV91(p){
 const value=String(p.custom_dose??'').trim();
 if(!/^(?:\d+(?:\.\d+)?|\.\d+)\s*(?:單位)?$/.test(value))return value;
 const name=String(p.medicine_name||'').match(/^\[([^\]]+)\]/)?.[1]||'';
 const route=prescriptionRoutesV66.find(r=>r.name===name);
 let unit=route?.calc==='ratio'?'ml/kg':route?.calc==='tablet'?'mg/kg':'';
 if(!unit&&/^口服錠劑[／/]膠囊$/.test(name))unit='mg/kg';
 if(!unit&&/^皮下[／/]肌肉注射$/.test(name))unit='ml/kg';
 if(!unit&&/^口服(?:液|懸浮液)/.test(name)){
  const med=loadedMedicinesMap[p.medicine_id];
  if(medicineStrengthPerUnitV68(med))unit='mg/kg';
 }
 const number=value.replace(/\s*單位$/, '');
 return unit?number+' '+unit:number+'（劑量待確認）';
}

