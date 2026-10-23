
// v65: read historical prescriptions into the current draft only.
let prescriptionCopyRequestV65=0,prescriptionCopyStateV65=null;
function prescriptionCopyScopeV65(){return JSON.stringify([CURRENT_TENANT_ID,CURRENT_USER?.id,currentPetId,currentAppointmentId]);}
function closePrescriptionCopyV65(){prescriptionCopyRequestV65++;prescriptionCopyStateV65=null;document.getElementById('prescriptionCopyModalV65').style.display='none';}
function makePrescriptionDraftRowV65(p){
 p={...p,custom_dose:normalizePrescriptionDoseV91(p)};
 const row=document.createElement('div');row.className='list-row prescription-item-row';row.dataset.medicineId=p.medicine_id||'';row.dataset.billingKind=p.billing_kind||prescriptionKindV66(p.medicine_name);
 for(const [value,type,cls,style,title] of [[p.medicine_name,'text','','flex:2;background:#fff','藥品與劑型'],[p.custom_dose,'text','prescribe-custom-dose','flex:1.2','使用劑量'],[p.quantity,'number','prescribe-qty','flex:.8','數量'],[p.instruction,'text','prescribe-note','flex:2','用法說明']]){
  const input=document.createElement('input');input.type=type;input.value=value??'';input.className=cls;input.style.cssText=style;input.title=title;if(!cls)input.readOnly=true;if(type==='number'){input.step=row.dataset.billingKind==='injection'?'any':'0.1';input.min=row.dataset.billingKind==='injection'?'0.001':'0.1';}row.append(input);
 }
 const remove=document.createElement('button');remove.type='button';remove.className='btn-danger';remove.textContent='刪除';remove.addEventListener('click',()=>row.remove());row.append(remove);return row;
}
async function openPrescriptionCopyV65(recordId=null){
 if(!medicalEditAllowedV53()){alert('此帳號沒有處方編輯權限。');return;}
 if(!currentPetId||!CURRENT_USER){alert('請先選擇本次看診寵物。');return;}
 const request=++prescriptionCopyRequestV65,scope=prescriptionCopyScopeV65(),petId=currentPetId,tenant=CURRENT_TENANT_ID;
 prescriptionCopyStateV65=null;
 const modal=document.getElementById('prescriptionCopyModalV65'),body=document.getElementById('prescriptionCopyBodyV65'),status=document.getElementById('prescriptionCopyStatusV65'),apply=document.getElementById('prescriptionCopyApplyV65');
 body.replaceChildren();apply.disabled=true;status.textContent='正在讀取此寵物的歷史處方…';modal.style.display='flex';
 const valid=()=>request===prescriptionCopyRequestV65&&scope===prescriptionCopyScopeV65();
 try{
  let query=_supabase.from('medical_records').select('id,pet_id,tenant_id,created_at,prescription_details').eq('tenant_id',tenant).eq('pet_id',petId);
  if(recordId)query=query.eq('id',recordId);
  const {data,error}=await query.not('prescription_details','is',null).not('prescription_details','eq','[]').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1);if(!valid())return;if(error)throw error;
  const record=(data||[]).find(r=>Array.isArray(r.prescription_details)&&r.prescription_details.length);
  if(!record){status.textContent=recordId?'這次病歷沒有可複製的處方。':'此寵物尚無可複製的歷史處方。';return;}
  const entries=record.prescription_details.map(p=>({...p}));
  const ids=[...new Set(entries.map(p=>p.medicine_id).filter(Boolean))];
  const names=[...new Set(entries.filter(p=>!p.medicine_id).map(p=>String(p.medicine_name||'').replace(/^\[[^\]]+\]\s*/,'')))].filter(Boolean);
  const results=await Promise.all([ids.length?_supabase.from('medicines').select('*').eq('tenant_id',tenant).in('id',ids):Promise.resolve({data:[]}),names.length?_supabase.from('medicines').select('*').eq('tenant_id',tenant).in('name',names):Promise.resolve({data:[]})]);
  if(!valid())return;for(const r of results)if(r.error)throw r.error;
  const medicines=[...new Map([...results[0].data,...results[1].data].map(m=>[m.id,m])).values()],byId=new Map(medicines.map(m=>[m.id,m]));
  const table=document.createElement('table');table.style.cssText='width:100%;font-size:.9rem';
  const head=document.createElement('tr');for(const label of ['選取','藥品／劑型','原劑量','原數量','用法','核對']){const th=document.createElement('th');th.textContent=label;head.append(th);}table.append(head);
  const choices=[];
  for(const p of entries){
   const name=String(p.medicine_name||'').replace(/^\[[^\]]+\]\s*/,'');let med=p.medicine_id?byId.get(p.medicine_id):null;
   if(!p.medicine_id){const matches=medicines.filter(m=>m.name===name);if(matches.length===1)med=matches[0];}
   let reason='可複製';if(!med)reason='藥品不存在或無法唯一對應，請重新選藥';else if(!String(p.medicine_name||'').trim())reason='缺藥品名稱';else if(!Number.isFinite(Number(p.quantity))||Number(p.quantity)<=0)reason='原數量無效，請重新開立';
   const eligible=reason==='可複製';if(eligible&&!p.medicine_id)reason='依唯一相同藥名對應，請核對規格';
   const row=document.createElement('tr'),cell=document.createElement('td'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=eligible;checkbox.disabled=!eligible;cell.append(checkbox);row.append(cell);
   for(const value of [p.medicine_name,normalizePrescriptionDoseV91(p),medicalHistoryQuantityV913(p),p.instruction,reason]){const td=document.createElement('td');td.textContent=value??'';td.style.whiteSpace='pre-wrap';row.append(td);}table.append(row);
   choices.push({p,med,checkbox,eligible});
  }
  body.append(table);prescriptionCopyStateV65={request,scope,record,choices};
  status.textContent='來源：'+new Date(record.created_at).toLocaleString('zh-TW')+'｜'+currentPetName+'。照原劑量與數量帶入，不按本次體重自動重算；請確認療程與本次體重。';
  apply.disabled=!choices.some(c=>c.eligible);
 }catch(error){if(!valid())return;status.textContent='處方讀取失敗：'+(error.message||String(error))+'。關閉後可重試。';}
}
function applyPrescriptionCopyV65(){
 const state=prescriptionCopyStateV65;if(!state||state.scope!==prescriptionCopyScopeV65()||state.request!==prescriptionCopyRequestV65){closePrescriptionCopyV65();alert('看診對象已變更，請重新選擇處方。');return;}
 if(!medicalEditAllowedV53()){closePrescriptionCopyV65();alert('此帳號沒有處方編輯權限。');return;}
 const selected=state.choices.filter(c=>c.eligible&&c.checkbox.checked);if(!selected.length){alert('請至少勾選一筆用藥。');return;}
 const container=document.getElementById('prescriptionItemsContainer'),fragment=document.createDocumentFragment();
 for(const c of selected){const p={...c.p,medicine_id:c.med.id};loadedMedicinesMap[c.med.id]=c.med;fragment.append(makePrescriptionDraftRowV65(p));}
 container.append(fragment);collectCurrentMedicalState();closePrescriptionCopyV65();
 document.getElementById('prescriptionCopyFeedbackV65').textContent='已加入 '+selected.length+' 筆歷史用藥，請核對後儲存本次病歷。';container.scrollIntoView({block:'nearest',behavior:'smooth'});
}

