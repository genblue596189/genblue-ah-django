
const prescriptionRouteDefaultsV66=[
{name:'口服藥',kind:'oral',calc:'tablet'},
{name:'皮下注射',kind:'injection',calc:'ratio'},
{name:'肌肉注射',kind:'injection',calc:'ratio'},
{name:'靜脈注射',kind:'injection',calc:'ratio'},
{name:'外用藥',kind:'other',calc:'manual'},
{name:'霧化',kind:'other',calc:'manual'}
];
let prescriptionRoutesV66=[...prescriptionRouteDefaultsV66],prescriptionRouteSavingV66=false;
function singlePrescriptionRouteV9111(name){return !/[\/／、+＋]|或|及|與/.test(name);}
function simpleRouteV944(name){if(/^口服|^oral$/i.test(name))return '口服藥';if(/^(外用|眼藥|耳藥)/.test(name))return '外用藥';if(/^霧化/.test(name))return '霧化';return prescriptionRouteDefaultsV66.some(r=>r.name===name)?name:'';}
function renderPrescriptionRoutesV66(custom=[]){
 const select=document.getElementById('medRouteDetailSelect'),previous=simpleRouteV944(select.value);
 prescriptionRoutesV66=[...prescriptionRouteDefaultsV66];select.replaceChildren(new Option('-- 請選擇給藥途徑 --',''));for(const r of prescriptionRoutesV66)select.add(new Option(r.name,r.name));select.value=previous;
}
function prescriptionRouteV66(){
 const route=prescriptionRoutesV66.find(x=>x.name===document.getElementById('medRouteDetailSelect').value);
 const med=loadedMedicinesMap[document.getElementById('medSelectDropdown').value];
 if(route?.name==='口服藥')return {...route,calc:medicineStrengthPerUnitV68(med)?'tablet':'manual',preparedFromSolid:!!medicineStrengthPerUnitV68(med)};
 return route;
}
function prescriptionKindV66(name){return prescriptionRoutesV66.find(x=>x.name===simpleRouteV944(String(name||'').match(/^\[([^\]]+)\]/)?.[1]||''))?.kind||'';}
function openPrescriptionRouteAddV66(){if(!medicalEditAllowedV53()){alert('此帳號沒有處方編輯權限。');return;}document.getElementById('routeAddStatusV66').textContent='新增後同院共用；自訂方式請手填劑量與數量。';document.getElementById('routeAddModalV66').style.display='flex';document.getElementById('routeAddNameV66').focus();}
async function savePrescriptionRouteV66(){
 if(prescriptionRouteSavingV66)return;if(!medicalEditAllowedV53()){alert('此帳號沒有處方編輯權限。');return;}
 const name=document.getElementById('routeAddNameV66').value.trim(),kind=document.getElementById('routeAddKindV66').value,status=document.getElementById('routeAddStatusV66');
 if(!name||name.length>30||/[\[\]\r\n]/.test(name)){status.textContent='名稱請填 1～30 字，不含中括號或換行。';return;}
 if(!singlePrescriptionRouteV9111(name)){status.textContent='請只新增一種給藥方式，合併方式請分開建立。';return;}
 if(prescriptionRoutesV66.some(x=>x.name===name)){status.textContent='此方式已存在，直接在下拉選單選用即可。';return;}
 const tenant=CURRENT_TENANT_ID,user=CURRENT_USER?.id;prescriptionRouteSavingV66=true;document.getElementById('routeAddSaveV66').disabled=true;status.textContent='儲存中…';
 try{const {data,error}=await _supabase.rpc('add_prescription_route_v66',{p_name:name,p_kind:kind});if(tenant!==CURRENT_TENANT_ID||user!==CURRENT_USER?.id)return;if(error)throw error;if(!Array.isArray(data))throw Error('儲存回應不完整，請重新載入核對。');renderPrescriptionRoutesV66(data);status.textContent='已儲存，其他醫師重新載入後可選用。';document.getElementById('routeAddNameV66').value='';if(document.getElementById('routeAddModalV66').style.display==='flex'){document.getElementById('medRouteDetailSelect').value=name;preservePrescriptionRouteForVisit=true;onRouteDetailChanged();}}
 catch(error){if(tenant===CURRENT_TENANT_ID&&user===CURRENT_USER?.id)status.textContent='未儲存：'+(error.message||error)+'。請確認已執行 v66 SQL，或稍後重试。';}
 finally{prescriptionRouteSavingV66=false;document.getElementById('routeAddSaveV66').disabled=false;}
}
renderPrescriptionRoutesV66();

