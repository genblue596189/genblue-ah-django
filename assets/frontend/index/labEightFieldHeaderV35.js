
// Both CBC and chemistry share the same eight print header fields. Print-only edits do not modify medical records.
let labPrintHeaderContext=null;
function labPrintHeaderValues(rep){
 const cached=allPetsListForDropdown.find(p=>p.id===rep.pet_id)||{};
 const pet={...cached,...(rep.pets||{})}, source=rep.report_data?._skyla;
 const species=getLabReportSpecies(rep);
 const measured=rep.report_data?._print_header||{};
 const w=measured.weight??pet.weight;
 const weight=w!==null&&w!==undefined&&Number.isFinite(Number(w))&&Number(w)>0?String(Math.round(Number(w)*100)/100):'';
 return {hospital:'吉布動物醫院',type:rep.test_type,time:source?`${source.exam_date} ${source.exam_time}`:new Date(rep.created_at).toLocaleString('zh-TW',{hour12:false}),pet:pet.name||'',species:species==='dog'?'犬':species==='cat'?'貓':pet.species||'',weight,doctor:measured.doctor||'',instrument:source?.model||measured.instrument||'',patient:source?.patient_id||cached.owner_code||cached.system_code||'',scope:`${CURRENT_TENANT_ID}|${CURRENT_USER?.id||''}`,id:rep.id};
}
const labHeaderOriginalOpen=openLabDetailModal;
openLabDetailModal=function(rep){
 labHeaderOriginalOpen(rep);
 const values=labPrintHeaderValues(rep);labPrintHeaderContext=values;
 const box=document.createElement('div');box.id='labPrintHeaderOptions';box.style.cssText='margin:12px 0;padding:12px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc';
 const heading=document.createElement('b');heading.textContent='列印抬頭確認（CBC／血清生化共用）';box.appendChild(heading);
 const note=document.createElement('p');note.style.cssText='font-size:12px;color:#64748b;margin:6px 0';note.textContent='以下修改只用於這次列印。體重若帶入目前資料，請核對當次檢測體重；未知資料可留空。';box.appendChild(note);
 const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px';
 const fields=[['hospital','抬頭'],['time','檢測時間'],['pet','寵物名'],['species','種類'],['weight','體重（kg）'],['doctor','醫師（可選）'],['instrument','儀器'],['patient','病患編號']];
 for(const [key,labelText] of fields){
  const label=document.createElement('label');label.style.fontSize='13px';label.textContent=labelText;
  let input;
  if(key==='doctor'){
   input=document.createElement('select');const names=new Set();
   for(const o of document.getElementById('appointmentDoctor')?.options||[])if(o.value)names.add(o.textContent);
   const director=document.getElementById('clinicDirectorSet')?.value?.trim();if(director)names.add(director);
   if(CURRENT_PROFILE?.role==='doctor'&&CURRENT_PROFILE.display_name)names.add(CURRENT_PROFILE.display_name);
   if(values.doctor)names.add(values.doctor);
   const empty=document.createElement('option');empty.value='';empty.textContent='不指定';input.appendChild(empty);
   for(const name of names){const o=document.createElement('option');o.value=name;o.textContent=name;input.appendChild(o);}
  }else{input=document.createElement('input');input.type=key==='weight'?'number':'text';input.maxLength=120;if(key==='weight'){input.min='0';input.step='0.01';}if(key==='hospital')input.readOnly=true;}
  input.id='labPrintHeader_'+key;input.value=values[key];input.style.cssText='width:100%;box-sizing:border-box;margin-top:4px;padding:7px';label.appendChild(input);grid.appendChild(label);
 }
 box.appendChild(grid);document.querySelector('#detailModalBody .lab-report-actions').before(box);
};
function labPrintEightFieldHeader(doc){
 if(!labPrintHeaderContext||labPrintHeaderContext.scope!==`${CURRENT_TENANT_ID}|${CURRENT_USER?.id||''}`)throw new Error('登入或院別已變更，請重新開啟報告。');
 const value=key=>document.getElementById('labPrintHeader_'+key)?.value.trim()||'';
 const w=value('weight');if(w&&(!Number.isFinite(Number(w))||Number(w)<=0))throw new Error('體重請填大於零的數值，或留空。');
 const head=doc.createElement('div');head.className='lab-report-meta';
 for(const [label,text] of [['檢測時間',value('time')],['寵物名',value('pet')],['種類',value('species')],['體重',w?`${Math.round(Number(w)*100)/100} kg`:'未填'],['醫師',value('doctor')||'未指定'],['儀器',value('instrument')],['病患編號',value('patient')]]){
  const p=doc.createElement('p'),b=doc.createElement('b');b.textContent=label+'：';p.append(b,doc.createTextNode(text||'未填'));head.appendChild(p);
 }
 return head;
}

