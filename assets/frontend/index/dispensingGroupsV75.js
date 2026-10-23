
// v75.1: use the existing entry flow, finalize groups only on explicit new/complete actions.
let dispensingStateV75=null;
const dispensingDefaultV75=()=>({id:'ungrouped',name:'第1組',form:'未指定',instruction:'',frequency:'2',days:'5',completed:false});
function dispensingScopeV75(){return JSON.stringify([doctorScopeV51(),currentPetId,currentAppointmentId]);}
function dispensingMetaV75(value){
 if(!value||typeof value!=='object')return dispensingDefaultV75();
 return {id:String(value.id||'ungrouped').slice(0,100),name:String(value.name||'第1組').slice(0,60),form:String(value.form||'未指定').slice(0,20),instruction:String(value.instruction||'').slice(0,500),frequency:String(value.frequency||'2'),days:String(value.days||'5'),completed:!!value.completed};
}
function dispensingNowV75(){
 const scope=dispensingScopeV75();if(!dispensingStateV75||dispensingStateV75.scope!==scope)dispensingStateV75={scope,active:'ungrouped',groups:new Map([['ungrouped',dispensingDefaultV75()]])};return dispensingStateV75;
}
function dispensingRowMetaV75(row){try{return dispensingMetaV75(JSON.parse(row.dataset.dispensingGroupV75||'null'));}catch{return dispensingDefaultV75();}}
function dispensingGroupLabelV75(g){return g.name+(g.form!=='未指定'?' · '+g.form:'');}
function dispensingImportV75(group){
 const state=dispensingNowV75();
 // New drugs belong to the current group; do not replace that group with defaults.
 if(!group||typeof group!=='object')return state.groups.get(state.active)||state.groups.get('ungrouped');
 const g=dispensingMetaV75(group),existing=state.groups.get(g.id);
 if(!existing){state.groups.set(g.id,g);return g;}
 if(g.id==='ungrouped'&&existing.name==='第1組'&&!dispensingRowsV75().some(row=>dispensingRowMetaV75(row).id===g.id))Object.assign(existing,g);
 return existing;
}
function dispensingOptionV75(select,g){const o=document.createElement('option');o.value=g.id;o.textContent=dispensingGroupLabelV75(g);select.append(o);}
function dispensingRowsV75(){return [...document.querySelectorAll('#prescriptionItemsContainer .prescription-item-row')];}
function updateDispensingRowsMetaV75(g){for(const row of dispensingRowsV75())if(dispensingRowMetaV75(row).id===g.id)row.dataset.dispensingGroupV75=JSON.stringify(g);}
function renderDispensingControlsV75(){
 const state=dispensingNowV75(),group=state.groups.get(state.active)||state.groups.get('ungrouped'),rows=dispensingRowsV75(),count=new Set(rows.map(row=>dispensingRowMetaV75(row).id)).size;
 const label=document.getElementById('dispensingCurrentV75');if(!label)return;
 label.textContent=group.completed?'本組已完成，可繼續儲存或收費':'目前開藥：'+dispensingGroupLabelV75(group);
 const hasRows=rows.some(row=>dispensingRowMetaV75(row).id===group.id);
 document.getElementById('dispensingNewV75').disabled=!hasRows;
 document.getElementById('dispensingFinishV75').disabled=!hasRows||group.completed;
 for(const row of rows){const move=row.querySelector('.dispensing-move-v75');if(!move)continue;const g=dispensingRowMetaV75(row);move.replaceChildren();for(const option of state.groups.values())dispensingOptionV75(move,option);move.value=g.id;move.hidden=count<2;}
}
function createDispensingGroupV75(){
 if(!medicalEditAllowedV53()){alert('此帳號沒有處方編輯權限。');return;}
 if(!currentPetId)return;
 const state=dispensingNowV75(),rows=dispensingRowsV75();if(!rows.some(row=>dispensingRowMetaV75(row).id===state.active))return;
 const previous=state.groups.get(state.active);previous.completed=true;updateDispensingRowsMetaV75(previous);
 const n=new Set(rows.map(row=>dispensingRowMetaV75(row).id)).size+1;
 const group={...dispensingDefaultV75(),id:crypto.randomUUID(),name:'第'+n+'組',frequency:previous.frequency,days:previous.days};
 state.groups.set(group.id,group);state.active=group.id;
 dispensingResetOriginalV75();document.getElementById('medFrequencyDetail').value=group.frequency;document.getElementById('medDays').value=group.days;resetPrescriptionEntryAfterAdd();renderDispensingDraftV75();collectCurrentMedicalState();
}
function finishDispensingGroupV75(){
 // Only an explicit completion starts the next group; adding drugs never advances it.
 return createDispensingGroupV75();
}
function selectDispensingGroupV75(id){
 if(!medicalEditAllowedV53())return;
 const state=dispensingNowV75(),g=state.groups.get(id);if(!g)return;
 state.active=id;g.completed=false;updateDispensingRowsMetaV75(g);resetPrescriptionEntryAfterAdd();
 document.getElementById('medPrescribeNote').value=g.instruction||'一天兩次，連續5天，飯後服用';
 document.getElementById('medFrequencyDetail').value=g.frequency;document.getElementById('medDays').value=g.days;
 renderDispensingDraftV75();collectCurrentMedicalState();
}
function renderDispensingDraftV75(){
 const container=document.getElementById('prescriptionItemsContainer');if(!container)return;
 const rows=dispensingRowsV75(),state=dispensingNowV75(),groups=new Map();
 for(const row of rows){const g=dispensingImportV75(dispensingRowMetaV75(row));row.dataset.dispensingGroupV75=JSON.stringify(g);if(!groups.has(g.id))groups.set(g.id,[]);groups.get(g.id).push(row);}
 container.replaceChildren();
 if(groups.size===1&&state.groups.get(groups.keys().next().value).completed===false&&groups.has(state.active)){
  for(const row of rows)container.append(row);
 }else{
  for(const [id,items] of groups){const g=state.groups.get(id),section=document.createElement(g.completed?'details':'section');section.className='dispensing-card-v75';section.dataset.dispensingCardV75=id;
   const title=document.createElement(g.completed?'summary':'h4');title.textContent=dispensingGroupLabelV75(g)+' · '+items.length+' 種藥'+(g.completed?'（點開查看／修改）':'');section.append(title);
   const tools=document.createElement('div');tools.className='dispensing-group-tools-v75';const name=document.createElement('input');name.type='text';name.maxLength=60;name.value=g.name;name.placeholder='組別名稱（可自行修改）';name.setAttribute('aria-label','修改 '+g.name+' 名稱');
   name.addEventListener('input',()=>{if(!medicalEditAllowedV53())return;g.name=name.value.trim().slice(0,60)||'未命名組別';updateDispensingRowsMetaV75(g);title.textContent=dispensingGroupLabelV75(g)+' · '+items.length+' 種藥'+(g.completed?'（點開查看／修改）':'');renderDispensingControlsV75();collectCurrentMedicalState();});tools.append(name);
   if(g.completed){const resume=document.createElement('button');resume.type='button';resume.className='btn-secondary';resume.textContent='繼續開這組';resume.onclick=()=>selectDispensingGroupV75(id);tools.append(resume);}
   section.append(tools);for(const row of items)section.append(row);container.append(section);
  }
 }
 renderDispensingControlsV75();
}
function collectPrescriptionDetailsV75(){const details=dispensingRowsV75().map(row=>({medicine_name:row.querySelector('input[type="text"]').value,medicine_id:row.dataset.medicineId||'',billing_kind:row.dataset.billingKind||'',custom_dose:normalizePrescriptionDoseV91({custom_dose:row.querySelector('.prescribe-custom-dose').value,medicine_name:row.querySelector('input[type="text"]').value}),quantity:row.querySelector('.prescribe-qty').value,instruction:row.querySelector('.prescribe-note').value,dispensing_group:dispensingRowMetaV75(row)}));if(details.some(p=>/劑量待確認|單位/.test(p.custom_dose)||/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(p.custom_dose))){alert('請在處方清單補上正確劑量單位，例如 mg/kg、ml/kg 或 ml，再儲存或結帳。');throw Error('處方劑量單位尚未確認');}return details;}
const dispensingMakeOriginalV75=makePrescriptionDraftRowV65;
makePrescriptionDraftRowV65=function(p){
 const row=dispensingMakeOriginalV75(p),g=dispensingImportV75(p.dispensing_group);row.dataset.dispensingGroupV75=JSON.stringify(g);
 const move=document.createElement('select');move.className='dispensing-move-v75';move.hidden=true;move.setAttribute('aria-label','移動此藥到組別');
 move.addEventListener('change',()=>{if(!medicalEditAllowedV53())return;const group=dispensingNowV75().groups.get(move.value);if(!group)return;row.dataset.dispensingGroupV75=JSON.stringify(group);renderDispensingDraftV75();collectCurrentMedicalState();});row.insertBefore(move,row.querySelector('button'));
 row.querySelector('button').addEventListener('click',()=>{renderDispensingDraftV75();collectCurrentMedicalState();});return row;
};
const dispensingAddOriginalV75=addDetailedPrescriptionItem;
addDetailedPrescriptionItem=function(...args){
 if(!medicalEditAllowedV53()){alert('此帳號沒有處方編輯權限。');return;}
 const state=dispensingNowV75(),g=state.groups.get(state.active),frequencyBefore=document.getElementById('medFrequencyDetail').value,daysBefore=document.getElementById('medDays').value,before=new Set(dispensingRowsV75());const result=dispensingAddOriginalV75.apply(this,args);
 for(const row of dispensingRowsV75())if(!before.has(row)){g.completed=false;if(row.dataset.billingKind!=='injection')g.instruction=row.querySelector('.prescribe-note').value;g.frequency=frequencyBefore;g.days=daysBefore;row.dataset.dispensingGroupV75=JSON.stringify(g);}
 updateDispensingRowsMetaV75(g);renderDispensingDraftV75();collectCurrentMedicalState();return result;
};
const dispensingCollectOriginalV75=collectCurrentMedicalState;
collectCurrentMedicalState=function(...args){const result=dispensingCollectOriginalV75.apply(this,args),state=dispensingNowV75();medicalStateCache.dispensingGroupsV75=[...state.groups.values()].map(g=>({...g}));medicalStateCache.dispensingActiveV75=state.active;return result;};
const dispensingRestoreOriginalV75=restoreMedicalState;
restoreMedicalState=function(...args){const state=dispensingNowV75();for(const g of medicalStateCache.dispensingGroupsV75||[]){const meta=dispensingMetaV75(g);state.groups.set(meta.id,meta);}state.active=medicalStateCache.dispensingActiveV75||state.active;const result=dispensingRestoreOriginalV75.apply(this,args);renderDispensingDraftV75();return result;};
const dispensingResetOriginalV75=resetPrescriptionSharedSettingsForVisit;
resetPrescriptionSharedSettingsForVisit=function(...args){dispensingStateV75=null;const result=dispensingResetOriginalV75.apply(this,args);renderDispensingControlsV75();return result;};
const dispensingCopyOriginalV75=applyPrescriptionCopyV65;
applyPrescriptionCopyV65=function(...args){const before=new Set(dispensingRowsV75()),result=dispensingCopyOriginalV75.apply(this,args),added=dispensingRowsV75().filter(row=>!before.has(row)),state=dispensingNowV75();if(added.length){state.active=dispensingRowMetaV75(added[added.length-1]).id;for(const row of added){const g=state.groups.get(dispensingRowMetaV75(row).id);g.completed=g.id!==state.active;updateDispensingRowsMetaV75(g);}}renderDispensingDraftV75();collectCurrentMedicalState();return result;};
const dispensingHistoryOriginalV75=medicalPrescriptionListV53;
medicalPrescriptionListV53=function(prescriptions,detail){
 const groups=new Map();for(const p of Array.isArray(prescriptions)?prescriptions:[]){const g=dispensingMetaV75(p.dispensing_group);if(!groups.has(g.id))groups.set(g.id,{g,items:[]});groups.get(g.id).items.push(p);}
 const wrapper=document.createElement('div');for(const {g,items} of groups.values()){const h=document.createElement('p');h.className='dispensing-history-v75';h.textContent=dispensingGroupLabelV75(g);wrapper.append(h,dispensingHistoryOriginalV75(items,detail));}return wrapper;
};
// Keep stock quantities and billing categories intact, include the dispensing label in drug detail.
const dispensingBillingOriginalV75=prepareMedicationGroupsV64;
prepareMedicationGroupsV64=function(prescriptions){return dispensingBillingOriginalV75(prescriptions.map(p=>({...p,medicine_name:p.medicine_name+(p.dispensing_group&&(p.dispensing_group.id!=='ungrouped'||p.dispensing_group.name!=='一般處方'||p.dispensing_group.form!=='未指定')?' 【'+dispensingGroupLabelV75(dispensingMetaV75(p.dispensing_group))+'】':'')})));};
function filterRxDispensingV75(){
 const id=document.getElementById('rxDispensingSelectV75').value;
 for(const row of document.querySelectorAll('#rxTableBody tr[data-rx-group-v75]'))row.classList.toggle('rx-hidden-v75',id!=='all'&&row.dataset.rxGroupV75!==id);
 const option=document.getElementById('rxDispensingSelectV75').selectedOptions[0];document.getElementById('rxDispensingTitleV75').textContent=id==='all'?'各組分開配藥':option?.textContent||'';
}
const dispensingRxOriginalV75=renderRxModalTable;
renderRxModalTable=function(prescriptions){
 const groups=new Map();for(const p of Array.isArray(prescriptions)?prescriptions:[]){const g=dispensingMetaV75(p.dispensing_group);if(!groups.has(g.id))groups.set(g.id,{g,items:[]});groups.get(g.id).items.push(p);}
 const ordered=[...groups.values()].flatMap(x=>x.items);dispensingRxOriginalV75(ordered);
 const select=document.getElementById('rxDispensingSelectV75');select.replaceChildren();const all=document.createElement('option');all.value='all';all.textContent='全部組別（分組顯示）';select.append(all);for(const {g} of groups.values())dispensingOptionV75(select,g);select.value='all';
 const rows=[...document.querySelectorAll('#rxTableBody .rx-editable-row')],body=document.getElementById('rxTableBody');let index=0;
 for(const {g,items} of groups.values()){
  const header=document.createElement('tr');header.className='rx-group-header-v75';header.dataset.rxGroupV75=g.id;const cell=document.createElement('td');cell.colSpan=6;
  const label=document.createElement('strong');label.textContent=dispensingGroupLabelV75(g);cell.append(label);
  const instructions=[...new Set(items.filter(p=>p.billing_kind!=='injection').map(p=>String(p.instruction||'')))];
  const common=instructions.length===1?instructions[0]:'';if(common){const note=document.createElement('span');note.textContent='｜'+common;cell.append(note);}
  header.append(cell);body.insertBefore(header,rows[index]);
  for(const p of items){rows[index].dataset.rxGroupV75=g.id;rows[index].dataset.dispensingGroupV75=JSON.stringify(g);index++;}
 }
 filterRxDispensingV75();
};
const dispensingRxAddOriginalV75=addRxModalRow;
addRxModalRow=function(){
 const select=document.getElementById('rxDispensingSelectV75');if(select.value==='all'&&select.options.length>2){alert('請先選擇要列印的組別，再新增列印用藥。');return;}
 const id=select.value==='all'?(select.options[1]?.value||'ungrouped'):select.value;dispensingRxAddOriginalV75();const rows=document.querySelectorAll('#rxTableBody .rx-editable-row'),row=rows[rows.length-1];row.dataset.rxGroupV75=id;filterRxDispensingV75();
};
renderDispensingControlsV75();

