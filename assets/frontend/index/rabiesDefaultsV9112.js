
const rabiesDefaultFieldsV9112={product:'rabiesProduct',manufacturer:'rabiesManufacturer',batch:'rabiesBatch',expiry_date:'rabiesExpiry',doctor:'rabiesDoctor'};
let rabiesDefaultScopeV9112='';
function rabiesDefaultKeyV9112(){return CURRENT_TENANT_ID&&CURRENT_USER?.id?'genblue-rabies-defaults-v1:'+JSON.stringify([CURRENT_TENANT_ID,CURRENT_USER.id]):'';}
function rabiesDefaultStatusV9112(text){document.getElementById('rabiesDefaultStatusV9112').textContent=text;}
function rabiesDefaultScopeCheckV9112(){
 const key=rabiesDefaultKeyV9112();
 if(key!==rabiesDefaultScopeV9112){for(const id of Object.values(rabiesDefaultFieldsV9112))document.getElementById(id).value='';document.getElementById('rabiesTag').value='';rabiesDefaultScopeV9112=key;}
 return key;
}
function rememberRabiesDefaultsV9112(details=null){
 const key=rabiesDefaultKeyV9112();if(!key)return false;
 const data={};for(const [field,id] of Object.entries(rabiesDefaultFieldsV9112))data[field]=String(details?details[field]??'':document.getElementById(id).value).trim();
 try{localStorage.setItem(key,JSON.stringify(data));rabiesDefaultScopeV9112=key;rabiesDefaultStatusV9112('已記住常用資料；下次自動帶入，犬牌號碼不保留。');return true;}
 catch(error){rabiesDefaultStatusV9112('常用資料未能記住；本次施打紀錄請依原流程儲存。');return false;}
}
function applyRabiesDefaultsV9112(){
 const key=rabiesDefaultScopeCheckV9112();if(!key)return;
 try{const data=JSON.parse(localStorage.getItem(key)||'null');if(!data||typeof data!=='object')return;
  for(const [field,id] of Object.entries(rabiesDefaultFieldsV9112)){const input=document.getElementById(id);if(!input.value&&typeof data[field]==='string')input.value=data[field];}
  rabiesDefaultStatusV9112('已帶入常用資料，請核對批號、效期與施打醫師；犬牌號碼另填。');
 }catch(error){rabiesDefaultStatusV9112('常用資料無法讀取，請重新填寫。');}
}
function clearRabiesDefaultsV9112(){
 const key=rabiesDefaultScopeCheckV9112();
 try{if(key)localStorage.removeItem(key);}catch(error){rabiesDefaultStatusV9112('常用資料未能清除，請重試。');return;}
 for(const id of Object.values(rabiesDefaultFieldsV9112))document.getElementById(id).value='';
 rabiesDefaultStatusV9112('已清空常用資料，請輸入新批次，並按「記住常用資料」。');document.getElementById('rabiesProduct').focus();
}
const rabiesSyncOriginalV9112=syncRabiesForm;
syncRabiesForm=function(...args){rabiesDefaultScopeCheckV9112();rabiesSyncOriginalV9112.apply(this,args);if(document.getElementById('rabiesRecordEnabled').checked)applyRabiesDefaultsV9112();};
const rabiesPanelV9112=document.createElement('div');rabiesPanelV9112.style.cssText='grid-column:1/-1;margin:10px 0';
for(const [label,action] of [['記住常用資料',()=>rememberRabiesDefaultsV9112()],['清空常用資料／換批',clearRabiesDefaultsV9112]]){const button=document.createElement('button');button.type='button';button.className='btn-secondary';button.textContent=label;button.onclick=action;button.style.marginRight='8px';rabiesPanelV9112.append(button);}
const hint=document.createElement('p');hint.textContent='同一帳號在此瀏覽器下次自動帶入；更換疫苗批次或施打醫師時請修改。每次成功儲存施打紀錄後，也會更新常用資料。';hint.style.fontSize='.85rem';rabiesPanelV9112.append(hint);
const status=document.createElement('p');status.id='rabiesDefaultStatusV9112';status.setAttribute('role','status');rabiesPanelV9112.append(status);document.getElementById('rabiesExtraFields').append(rabiesPanelV9112);
document.getElementById('rabiesRecordEnabled').addEventListener('change',()=>syncRabiesForm());
rabiesDefaultScopeCheckV9112();
document.getElementById('genblueVersionV84').textContent=' · v91.13';
