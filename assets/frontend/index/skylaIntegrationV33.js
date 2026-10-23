
/* v39 Skyla direct receive + binary file import; explicit patient selection and save. */
var skylaLive={port:null,reader:null,writer:null,task:null,scope:'',bytes:[],inFrame:false,stopping:false,connecting:false};
var skylaPending=null,skylaSelected=null,skylaSaveBusy=false,skylaReadGeneration=0;
function skylaScope(){return CURRENT_TENANT_ID&&CURRENT_USER?.id?CURRENT_TENANT_ID+'|'+CURRENT_USER.id:'';}
function skylaClinicalAllowed(){return !!skylaScope()&&(CURRENT_PROFILE?.role==='admin'||(CURRENT_PROFILE?.permission_clinical??(CURRENT_PROFILE?.role==='doctor')));}
function skylaStatus(message,error=false){const n=document.getElementById('skylaReceiveStatus');n.textContent=message;n.style.color=error?'#b42318':'#476343';}
async function skylaDigest(text){const bytes=new TextEncoder().encode(text);const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function skylaRecordId(report,tenant){const h=await skylaDigest(tenant+'|skyla-solution|'+report.raw_text);return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);}
function skylaClearDraft(){skylaPending=null;skylaSelected=null;document.getElementById('skylaPetSearch').value='';document.getElementById('skylaPetResults').replaceChildren();document.getElementById('skylaChosenPet').textContent='尚未選擇寵物';document.getElementById('skylaClinicalReview').checked=false;document.getElementById('skylaExchangeFee').value='';document.getElementById('dxSelectedPetId').value='';document.getElementById('skylaNativeSavePanel').hidden=true;}
function skylaResetPreview(){skylaClearDraft();resetSkylaExchangeAfterSave();}
async function skylaLoadBytes(bytes,name){
 const scope=skylaScope(),generation=++skylaReadGeneration;
 if(!scope)throw Error('請先登入醫院帳號。');
 if(skylaPending||pendingSkylaPdf){if(!confirm('目前有尚未儲存的報告，確定改讀另一份？'))return false;}
 const report=SkylaSolutionParser.parse(bytes);
 const hash=await skylaDigest(report.raw_text),id=await skylaRecordId(report,CURRENT_TENANT_ID);
 if(scope!==skylaScope()||generation!==skylaReadGeneration)throw Error('登入狀態已改變，請重新接收。');
 pendingSkylaPdf=null;pendingSkylaTransfer=null;skylaResetPreview();
 skylaPending={report,bytes:Uint8Array.from(bytes),name,hash,id,scope};
 document.getElementById('dxSkylaSavePanel').style.display='none';
 document.getElementById('skylaNativeSavePanel').hidden=false;
 document.getElementById('dxImportKind').value='BIOCHEM';
 const info=document.getElementById('dxFileInfo');info.style.display='block';
 info.textContent=`${report.model}｜${report.panel}｜${report.date} ${report.time}｜儀器病患編號 ${report.patient_id}｜${report.species||report.species_raw}｜${report.total} 項。請選擇正確寵物，不會自動歸檔。`;
 document.getElementById('dxImportPreviewWrap').style.display='block';
 document.getElementById('dxImportPreviewHead').innerHTML='<tr><th>項目</th><th>結果</th><th>單位</th><th>儀器參考範圍</th><th>儀器標記</th></tr>';
 const body=document.getElementById('dxImportPreviewBody');body.replaceChildren();
 for(const r of report.rows){const tr=document.createElement('tr');if(r.flag)tr.style.color='#b42318';for(const value of [r.code,r.value===''?'未提供結果':r.value,r.unit||'—',r.reference||'—',r.result_status==='not_reported'?'原儀器結果空白':r.flag==='h'?'偏高':r.flag==='l'?'偏低':r.flag==='u'?'儀器 U 標記（請核對）':'—']){const td=document.createElement('td');td.textContent=value;tr.appendChild(td);}body.appendChild(tr);}
 document.getElementById('dxRawFileText').textContent=report.raw_text;
 skylaStatus(`已接收 ${report.total} 項，請核對、選寵物並填本次費用；尚未儲存。`);
 return true;
}
const skylaOriginalPreviewDiagnosticFile=previewDiagnosticFile;
previewDiagnosticFile=async function(event){
 const file=event.target.files?.[0];if(!file)return;
 if(/\.bin$/i.test(file.name)){
  try{if(file.size>524288)throw Error('BIN 超過 512 KB，請選單份報告。');await skylaLoadBytes(new Uint8Array(await file.arrayBuffer()),file.name);}
  catch(e){skylaResetPreview();skylaStatus('原始報告未接受：'+(e.message||String(e)),true);alert(e.message||String(e));event.target.value='';}
 }else{
  if(skylaPending&&!confirm('目前有尚未儲存的 Skyla 報告，確定切換檔案？')){event.target.value='';return;}
  skylaClearDraft();++skylaReadGeneration;await skylaOriginalPreviewDiagnosticFile(event);
 }
};
function skylaSearchPets(){
 skylaSelected=null;document.getElementById('dxSelectedPetId').value='';document.getElementById('skylaChosenPet').textContent='尚未選擇寵物';document.getElementById('skylaClinicalReview').checked=false;
 const box=document.getElementById('skylaPetResults');box.replaceChildren();
 const query=document.getElementById('skylaPetSearch').value.trim().toLowerCase(),tokens=query.split(/\s+/).filter(Boolean);if(!tokens.length){box.textContent='請輸入寵物名、飼主、電話或新舊編號。';return;}
 const scope=skylaScope(),pending=skylaPending;if(!pending||pending.scope!==scope)return;
 const matches=allPetsListForDropdown.filter(p=>{const hay=[p.name,p.owner_name,p.owner_code,p.owner_system_code,p.owner_mobile,p.owner_phone,p.microchip].filter(Boolean).join(' ').toLowerCase();return tokens.every(t=>hay.includes(t));});
 for(const pet of matches.slice(0,30)){
  const button=document.createElement('button');button.type='button';button.className='btn-secondary';button.style.cssText='display:block;width:100%;text-align:left;margin:4px 0;';
  button.textContent=`${pet.name}（${pet.species||'物種未填'}）｜飼主：${pet.owner_name||'未填'}｜新編號：${pet.owner_system_code||'—'}｜舊號：${pet.owner_code||'—'}｜晶片：${pet.microchip||'無'}`;
  button.onclick=()=>{if(scope!==skylaScope()||skylaPending!==pending)return;skylaSelected={id:pet.id,ownerId:pet.owner_id,scope,hash:pending.hash};document.getElementById('dxSelectedPetId').value=pet.id;document.getElementById('skylaChosenPet').textContent='已選：'+button.textContent;box.replaceChildren();};box.appendChild(button);
 }
 if(!matches.length)box.textContent='沒有符合的寵物；若背景資料仍在載入，請稍後再搜尋。';
 if(matches.length>30){const p=document.createElement('p');p.textContent=`找到 ${matches.length} 隻，先列 30 隻；請加上飼主姓名或編號縮小範圍。`;box.appendChild(p);}
}
function skylaInvalidatePet(){skylaSelected=null;document.getElementById('dxSelectedPetId').value='';document.getElementById('skylaChosenPet').textContent='尚未選擇寵物';document.getElementById('skylaPetResults').replaceChildren();document.getElementById('skylaClinicalReview').checked=false;}
function skylaDownloadRaw(){if(!skylaPending)return;const url=URL.createObjectURL(new Blob([skylaPending.bytes],{type:'application/octet-stream'}));const a=document.createElement('a');a.href=url;a.download='Skyla_'+skylaPending.report.patient_id+'_'+skylaPending.report.date+'.bin';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function skylaStopReceive(){
 skylaLive.stopping=true;
 try{if(skylaLive.reader)await skylaLive.reader.cancel();if(skylaLive.task)await skylaLive.task;}
 catch(e){skylaStatus('停止接收：'+(e.message||e),true);}
}
async function skylaConnectReceive(){
 if(skylaLive.connecting||skylaLive.port)return;
 if(!skylaClinicalAllowed()){alert('請使用具檢驗操作權限的醫院帳號登入。');return;}
 if(!navigator.serial||!window.isSecureContext){alert('此瀏覽器／開啟方式無法使用串列埠。請改用電腦 Chrome 或 Edge；也可先上傳 v2 的 capture.bin。');return;}
 if(skylaPending||pendingSkylaPdf){alert('請先儲存或清空目前待核對的報告，再開始接收。');return;}
 skylaLive.connecting=true;skylaLive.stopping=false;const scope=skylaScope();let port;
 try{
  port=await navigator.serial.requestPort();
  if(scope!==skylaScope())throw Error('登入已改變，未開啟連線。');
  await port.open({baudRate:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none',bufferSize:65536});
  skylaLive.port=port;skylaLive.scope=scope;skylaLive.bytes=[];skylaLive.inFrame=false;
  skylaLive.writer=port.writable.getWriter();skylaLive.reader=port.readable.getReader();
  document.getElementById('skylaConnectButton').disabled=true;document.getElementById('skylaStopButton').disabled=false;
  skylaStatus('已連線，請在 Skyla 儀器 Recall 選擇歷史結果並輸出。接收一筆後會自動停止。');
  skylaLive.task=skylaReadPort();
 }catch(e){try{skylaLive.reader?.releaseLock();}catch(_){}try{skylaLive.writer?.releaseLock();}catch(_){}skylaLive.reader=null;skylaLive.writer=null;if(port)try{await port.close();}catch(_){}skylaLive.port=null;document.getElementById('skylaConnectButton').disabled=false;document.getElementById('skylaStopButton').disabled=true;skylaStatus('無法連線：'+(e.message||String(e))+'；請確認其他接收程式已關閉。',true);}
 finally{skylaLive.connecting=false;}
}
async function skylaReadPort(){
 let receiveError='';
 try{
  while(!skylaLive.stopping&&skylaLive.scope===skylaScope()){
   const {value,done}=await skylaLive.reader.read();if(done)break;
   for(const b of value){
    if(skylaLive.scope!==skylaScope())throw Error('登入已改變，已停止接收。');
    if(!skylaLive.inFrame){
     if(b!==1){if(b===5)throw Error('儀器送出不同握手訊號；請使用 v2 工具保存原始資料。');continue;}
     skylaLive.bytes=[1];skylaLive.inFrame=true;await skylaLive.writer.write(new Uint8Array([6]));
    }else if(b===1&&skylaLive.bytes.length===1){await skylaLive.writer.write(new Uint8Array([6]));}
    else{
     skylaLive.bytes.push(b);if(skylaLive.bytes.length>524288)throw Error('資料超過單份報告上限，已停止。');
     if(b===4){
      // Copy the entire captured report before replying; parsing cannot alter it.
      const bytes=Uint8Array.from(skylaLive.bytes);await skylaLive.writer.write(new Uint8Array([6]));
      skylaLive.stopping=true;await skylaLoadBytes(bytes,'Skyla 直接接收');break;
     }
    }
   }
  }
 }catch(e){receiveError='接收未完成：'+(e.message||String(e))+'；未寫入病歷。';skylaStatus(receiveError,true);}
 finally{
  try{skylaLive.reader?.releaseLock();}catch(_){}skylaLive.reader=null;
  try{skylaLive.writer?.releaseLock();}catch(_){}skylaLive.writer=null;
  try{await skylaLive.port?.close();}catch(e){skylaStatus('關閉連線失敗，請關閉此頁釋放連接埠：'+e.message,true);}
  skylaLive.port=null;skylaLive.task=null;skylaLive.inFrame=false;skylaLive.bytes=[];
  document.getElementById('skylaConnectButton').disabled=false;document.getElementById('skylaStopButton').disabled=true;
  if(!skylaPending)skylaStatus(receiveError||'接收已停止，尚無可儲存的完整報告。',true);
 }
}
async function skylaSaveReport(){
 if(skylaSaveBusy)return;
 const pending=skylaPending,scope=skylaScope(),selected=skylaSelected;
 if(!skylaClinicalAllowed()){alert('目前帳號沒有檢驗操作權限。');return;}
 if(!pending||pending.scope!==scope||!selected||selected.scope!==scope||selected.hash!==pending.hash){alert('請重新搜尋並點選正確寵物。');return;}
 const pet=allPetsListForDropdown.find(p=>p.id===selected.id&&p.owner_id===selected.ownerId);
 if(!pet?.owner_id){alert('寵物或飼主資料已改變，請重新搜尋。');return;}
 const sp=['犬','狗','dog','canine'].includes(String(pet.species).toLowerCase())?'犬':['貓','cat','feline'].includes(String(pet.species).toLowerCase())?'貓':'';
 if(!sp||!pending.report.species||sp!==pending.report.species){alert('儀器報告物種與所選寵物不符或未辨識，未儲存。');return;}
 if(!document.getElementById('skylaClinicalReview').checked){alert('請先核對報告並勾選確認。');return;}
 const rawFee=document.getElementById('skylaExchangeFee').value.trim(),fee=Number(rawFee);
 if(!rawFee||!Number.isFinite(fee)||fee<0||fee>99999999.99||Math.abs(fee*100-Math.round(fee*100))>.000001){alert('請填本次檢驗費用；不收費請填 0，最多兩位小數。');return;}
 const tenant=CURRENT_TENANT_ID;
 if(!confirm(`將 ${pending.report.date} ${pending.report.time} 的 ${pending.report.total} 項 Skyla 生化結果存入：\n${pet.name}（${sp}）／飼主 ${pet.owner_name||'未填'}\n儀器編號 ${pending.report.patient_id}\n本次費用 NT$ ${rawFee}\n確認身分與數值皆正確？`))return;
 skylaSaveBusy=true;document.getElementById('skylaNativeSaveButton').disabled=true;
 let charge=null,committed=false;
 try{
  const prior=await _supabase.from('lab_reports').select('id,pet_id,report_data').eq('tenant_id',tenant).eq('id',pending.id);
  if(prior.error)throw Error('無法確認既有報告：'+prior.error.message);
  if(scope!==skylaScope()||skylaPending!==pending||!skylaClinicalAllowed())throw Error('登入、權限或待存報告已改變，未儲存。');
  if(prior.data?.length){
   const existing=prior.data[0];
   if(existing.pet_id!==pet.id){alert('同一份 Skyla 原始報告已存到另一隻寵物，已阻擋重複歸檔。請先核對既有紀錄。');return;}
   const draft=readServiceDrafts(tenant).find(d=>d.recordId===pending.id&&d.petId===pet.id&&d.state==='saving');
   if(draft)finishServiceCharge(draft,pending.id);
   alert('這份報告已儲存，未重複新增或收費。');skylaResetPreview();skylaStatus('已確認既有報告，未重複儲存。');await loadLabReportsList();return;
  }
  // An authoritative successful lookup found no record: discard only stale drafts of this exact import.
  for(const draft of readServiceDrafts(tenant).filter(d=>d.recordId===pending.id&&d.state==='saving'))cancelServiceCharge(draft);
  const data={_species:sp};for(const row of pending.report.rows)data[row.key]=row.value;
  data._skyla={format:pending.report.format,fingerprint:pending.hash,model:pending.report.model,panel:pending.report.panel,firmware:pending.report.firmware,patient_id:pending.report.patient_id,patient_name:pending.report.patient_name,owner_name:pending.report.owner_name,exam_date:pending.report.date,exam_time:pending.report.time,species:pending.report.species,sample_type:pending.report.sample_type,pr_code:pending.report.pr_code,rows:pending.report.rows,raw_text:pending.report.raw_text,imported_at:new Date().toISOString()};
  // Reuse the existing charge draft workflow, keeping its original field intact.
  const feeField=document.getElementById('labServiceFee'),oldFee=feeField.value;feeField.value=rawFee;
  try{charge=prepareServiceCharge('labServiceFee',pet.id,'lab','檢驗：Skyla '+pending.report.panel);}finally{feeField.value=oldFee;}
  charge.recordId=pending.id;
  const drafts=readServiceDrafts(tenant);const local=drafts.find(d=>d.id===charge.id);local.recordId=pending.id;writeServiceDrafts(drafts,tenant);
  const response=await _supabase.from('lab_reports').insert([{id:pending.id,tenant_id:tenant,pet_id:pet.id,test_type:'血液生化',report_data:data,notes:`Skyla Solution 直接接收；儀器病患編號：${pending.report.patient_id}；原始檢驗日期時間：${pending.report.date} ${pending.report.time}；套組：${pending.report.panel}；由人員核對病患與報告。來源識別：${pending.hash}`}]);
  if(response.error){if(response.error.code){cancelServiceCharge(charge);charge=null;}if(response.error.code==='23505'){alert('同一報告已由另一個頁面儲存，未重複新增或收費。請核對既有報告。');return;}throw Error(response.error.message);}
  committed=true;finishServiceCharge(charge,pending.id);
  if(scope===skylaScope()&&skylaPending===pending){skylaResetPreview();skylaStatus('Skyla 報告已儲存；選寵物、費用與預覽已清空。');}
  await loadLabReportsList();alert('Skyla 生化報告已儲存，本次費用已加入該寵物的待收費項目。');
 }catch(e){alert((committed?'報告已儲存，但待收費／畫面更新失敗，請核對帳單，勿重複登記。':'尚未確認儲存完成。若為連線中斷，請保留畫面後再次核對既有報告。')+'\n'+(e.message||String(e)));}
 finally{skylaSaveBusy=false;document.getElementById('skylaNativeSaveButton').disabled=false;}
}
const skylaOriginalBuildLabReportHtml=buildLabReportHtml;
buildLabReportHtml=function(rep){
 const source=rep.report_data?._skyla;if(!source?.rows?.length)return skylaOriginalBuildLabReportHtml(rep);
 const esc=escapeLabText;
 const head=`<div class="lab-report-meta"><p><b>檢驗寵物：</b>${esc(rep.pets?.name||allPetsListForDropdown.find(p=>p.id===rep.pet_id)?.name||'未知寵物')}（${esc(source.species)}）</p><p><b>檢驗日期時間：</b>${esc(source.exam_date)} ${esc(source.exam_time)}（儀器原始時間）</p><p><b>系統登錄時間：</b>${esc(new Date(rep.created_at).toLocaleString())}</p><p><b>儀器／套組：</b>${esc(source.model)}／${esc(source.panel)}</p><p><b>儀器病患編號：</b>${esc(source.patient_id)}（已由人員選擇寵物）</p><p><b>備註：</b>${esc(rep.notes||'')}</p></div>`;
 const rows=source.rows.map(r=>`<tr><th>${esc(r.code)}</th><td class="${r.flag?'lab-abnormal':''}">${esc((rep.report_data[r.key]??r.value)===''?'未提供結果':(rep.report_data[r.key]??r.value))} ${r.flag==='h'?'(高)':r.flag==='l'?'(低)':r.flag==='u'?'(儀器 U 標記，請核對)':''}</td><td>${esc(r.unit||'—')}</td><td>${esc(r.reference||'—')}</td></tr>`).join('');
 return head+'<table class="lab-report-table"><thead><tr><th>項目</th><th>結果</th><th>單位</th><th>儀器參考範圍</th></tr></thead><tbody>'+rows+'</tbody></table><p class="lab-report-note">保留儀器當次結果、符號、單位、參考範圍及高低標記。</p>';
};
window.addEventListener('beforeunload',event=>{if(skylaPending||skylaLive.port){event.preventDefault();event.returnValue='';}});
setInterval(()=>{if((skylaLive.port&&skylaLive.scope!==skylaScope()))void skylaStopReceive();if(skylaPending&&skylaPending.scope!==skylaScope()){++skylaReadGeneration;skylaResetPreview();skylaStatus('登入已變更，請重新接收或選擇原始檔。');}},500);

