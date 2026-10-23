
/* v61: private patient images/videos; no fee or checkout mutation. */
const imagingV61={pet:null,draft:null,busy:false,scope:'',searchRevision:0,listRevision:0};
function imagingScopeV61(){return CURRENT_TENANT_ID&&CURRENT_USER?.id?CURRENT_TENANT_ID+'|'+CURRENT_USER.id:'';}
function imagingMessageV61(message,error=false){const e=document.getElementById('im61-status');e.textContent=message;e.style.color=error?'#b42318':'#476343';}
function imagingElementV61(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
function imagingLockV61(lock){for(const id of ['im61-search','im61-search-button','im61-current','im61-modality','im61-device','im61-date','im61-body','im61-note','im61-file'])document.getElementById(id).disabled=lock;document.getElementById('im61-results').hidden=lock;}
function imagingResetV61(){imagingV61.pet=null;imagingV61.draft=null;imagingV61.busy=false;imagingV61.scope=imagingScopeV61();imagingV61.searchRevision++;imagingV61.listRevision++;imagingLockV61(false);document.getElementById('im61-form').reset();document.getElementById('im61-results').replaceChildren();document.getElementById('im61-list').replaceChildren();document.getElementById('im61-pet').textContent='尚未選擇寵物';document.getElementById('im61-save').disabled=false;document.getElementById('im61-save').textContent='上傳並儲存';imagingMessageV61('請先核對寵物與飼主，再選擇檔案。');}
function imagingLocalNowV61(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);}
async function openImagingV61(){
 if(imagingV61.scope!==imagingScopeV61())imagingResetV61();
 if(!imagingV61.draft)document.getElementById('im61-date').value=imagingLocalNowV61();
 const scope=imagingScopeV61();if(!scope)return;
 try{const {data,error}=await _supabase.from('diagnostic_devices').select('id,name,device_type').eq('tenant_id',CURRENT_TENANT_ID).eq('is_active',true).in('device_type',['XRAY','ULTRASOUND']);if(error)throw error;if(scope!==imagingScopeV61())return;imagingV61.devices=data||[];imagingDevicesV61();}catch(e){if(scope===imagingScopeV61())imagingMessageV61('儀器清單讀取失敗：'+e.message,true);}
 if(imagingV61.pet)loadImagingListV61();
}
function imagingDevicesV61(){const el=document.getElementById('im61-device'),old=el.value;el.replaceChildren(new Option('未指定儀器',''));for(const d of imagingV61.devices||[])if(d.device_type===document.getElementById('im61-modality').value)el.add(new Option(d.name,d.id));if([...el.options].some(o=>o.value===old))el.value=old;}
async function searchImagingPetV61(){
 if(imagingV61.draft||imagingV61.busy)return;
 const q=document.getElementById('im61-search').value.trim(),scope=imagingScopeV61(),rev=++imagingV61.searchRevision;
 if(!q){imagingMessageV61('請輸入寵物、飼主、電話或病歷號。',true);return;}
 try{imagingMessageV61('搜尋中…');const {data,error}=await _supabase.rpc('search_imaging_pets_v61',{p_query:q});if(error)throw error;if(scope!==imagingScopeV61()||rev!==imagingV61.searchRevision)return;const box=document.getElementById('im61-results');box.hidden=false;box.replaceChildren();for(const p of (data||[]).slice(0,30)){const b=imagingElementV61('button',p.name+'（'+(p.species||'未填')+'）｜飼主：'+(p.owner_name||'未填')+'｜'+(p.owner_mobile||'無電話')+'｜新：'+(p.system_code||'未填')+'／舊：'+(p.owner_code||'未填'));b.type='button';b.className='btn-secondary';b.style.cssText='display:block;width:100%;text-align:left;margin:6px 0;';b.onclick=()=>{if(scope===imagingScopeV61())selectImagingPetV61(p);};box.appendChild(b);}imagingMessageV61(data?.length>30?'符合超過 30 筆，請加上飼主姓名或電話縮小範圍。':data?.length?'請點選正確的寵物。':'找不到符合資料。');}catch(e){if(scope===imagingScopeV61()&&rev===imagingV61.searchRevision)imagingMessageV61('搜尋失敗：'+e.message,true);}
}
function selectImagingPetV61(p){if(imagingV61.draft||imagingV61.busy)return;imagingV61.pet=p;document.getElementById('im61-pet').textContent='寵物：'+p.name+'（'+(p.species||'未填')+'）｜飼主：'+(p.owner_name||'未填')+'｜新：'+(p.system_code||'未填')+'／舊：'+(p.owner_code||'未填');document.getElementById('im61-results').replaceChildren();document.getElementById('im61-search').value='';imagingMessageV61('已選擇寵物，請選擇檔案並核對檢查時間。');loadImagingListV61();}
async function useCurrentImagingPetV61(){
 if(imagingV61.draft||imagingV61.busy){imagingMessageV61('此筆上傳尚未完成，請先完成同一筆存檔。',true);return;}
 if(!currentPetId){imagingMessageV61('請先從門診選擇寵物，或使用上方搜尋。',true);return;}
 const scope=imagingScopeV61(),pet=currentPetId,rev=++imagingV61.searchRevision;
 // 清除上一隻寵物，讀取完成前不能把檔案存到舊個案。
 imagingV61.pet=null;imagingV61.listRevision++;
 document.getElementById('im61-results').replaceChildren();
 document.getElementById('im61-list').replaceChildren();
 document.getElementById('im61-pet').textContent='正在帶入目前門診寵物與飼主…';
 imagingMessageV61('正在讀取目前門診寵物資料…');
 try{const {data,error}=await _supabase.from('pets').select('id,name,species,owners(name,mobile,owner_code,system_code)').eq('tenant_id',CURRENT_TENANT_ID).eq('id',pet).single();if(error)throw error;if(scope!==imagingScopeV61()||pet!==currentPetId||rev!==imagingV61.searchRevision)return;selectImagingPetV61({...data,owner_name:data.owners?.name,owner_mobile:data.owners?.mobile,owner_code:data.owners?.owner_code,system_code:data.owners?.system_code});}catch(e){if(scope===imagingScopeV61()&&rev===imagingV61.searchRevision){document.getElementById('im61-pet').textContent='寵物資料尚未帶入';imagingMessageV61('寵物資料讀取失敗：'+e.message,true);}}
}
function goToImagingFromMedicalV61(){if(!currentPetId){alert('請先選擇看診寵物。');return;}if(goToDiagnosticExchangeFromMedical()===false)return;requestAnimationFrame(()=>document.getElementById('im61-card').scrollIntoView({block:'start'}));}
const imagingOriginalMedicalNavigationV611=goToDiagnosticExchangeFromMedical;
goToDiagnosticExchangeFromMedical=function(){
 if(imagingV61.draft||imagingV61.busy){
  if(imagingV61.draft?.params.p_pet_id!==currentPetId){alert('上一筆影像尚未完成，請先完成存檔，再切換門診寵物。');return false;}
 }
 const result=imagingOriginalMedicalNavigationV611();
 if(result!==false&&!imagingV61.draft&&!imagingV61.busy)useCurrentImagingPetV61();
 return result;
};
const imagingFormatsV61={jpg:['image/jpeg','jpg'],jpeg:['image/jpeg','jpg'],png:['image/png','png'],webp:['image/webp','webp'],mp4:['video/mp4','mp4'],mov:['video/quicktime','mov'],webm:['video/webm','webm']};
function imagingFileInfoV61(file){const ext=file?.name.split('.').pop().toLowerCase(),format=imagingFormatsV61[ext];if(!format)throw new Error('請選擇 JPG、PNG、WebP、MP4、MOV 或 WebM。');if(!file.size||file.size>50*1024*1024)throw new Error('單一檔案需大於 0 且不超過 50 MB。');if(file.name.length>200)throw new Error('檔名請縮短至 200 字以內。');if(file.type&&file.type!==format[0]&&file.type!=='application/octet-stream')throw new Error('檔案內容類型與副檔名不符。');return {mime:format[0],ext:format[1]};}
async function saveImagingV61(event){
 event?.preventDefault();if(imagingV61.busy)return;
 const scope=imagingScopeV61();if(!scope)return;
 try{
 if(!imagingV61.draft){
 if(!imagingV61.pet)throw new Error('請先選擇寵物。');
 const form=document.getElementById('im61-form');if(!form.reportValidity())return;
 const file=document.getElementById('im61-file').files[0];if(!file)throw new Error('請先選擇檔案。');
 const {mime,ext}=imagingFileInfoV61(file),studyId=crypto.randomUUID(),assetId=crypto.randomUUID(),date=new Date(document.getElementById('im61-date').value);if(Number.isNaN(date.getTime()))throw new Error('請填寫正確檢查時間。');
 imagingV61.draft={scope,file,uploaded:false,path:CURRENT_TENANT_ID+'/'+imagingV61.pet.id+'/'+studyId+'/'+assetId+'.'+ext,params:{p_study_id:studyId,p_asset_id:assetId,p_pet_id:imagingV61.pet.id,p_device_id:document.getElementById('im61-device').value||null,p_modality:document.getElementById('im61-modality').value,p_study_date:date.toISOString(),p_body_part:document.getElementById('im61-body').value.trim(),p_note:document.getElementById('im61-note').value.trim(),p_filename:file.name,p_mime:mime,p_size:file.size,p_extension:ext}};
 }
 const d=imagingV61.draft;if(d.scope!==scope)throw new Error('登入帳號已變更，請重新開啟影像頁。');
 imagingV61.busy=true;imagingLockV61(true);document.getElementById('im61-save').disabled=true;
 if(!d.uploaded){imagingMessageV61('正在上傳 '+d.file.name+'（'+(d.file.size/1048576).toFixed(1)+' MB）…請保持頁面開啟。');
 const {error}=await _supabase.storage.from('clinic-imaging').upload(d.path,d.file,{contentType:d.params.p_mime,upsert:false});
 if(scope!==imagingScopeV61())return;
 // 上次請求結果不明但檔案已存在時，沿用固定路徑並交由 RPC 核對。
 if(error&& !['409','Duplicate'].includes(String(error.statusCode))&&!/already exists|duplicate/i.test(error.message))throw error;
 d.uploaded=true;
 }
 imagingMessageV61('原始檔已上傳，正在儲存寵物影像紀錄…');
 const {data,error}=await _supabase.rpc('save_imaging_upload_v61',d.params);if(scope!==imagingScopeV61())return;if(error)throw error;if(!data?.saved)throw new Error('伺服器尚未確認存檔完成。');
 imagingV61.draft=null;imagingLockV61(false);document.getElementById('im61-file').value='';document.getElementById('im61-note').value='';document.getElementById('im61-body').value='';document.getElementById('im61-date').value=imagingLocalNowV61();document.getElementById('im61-save').textContent='上傳並儲存';imagingMessageV61('已儲存，可繼續為同一隻寵物上傳下一個檔案。');
 loadImagingListV61();refreshOpenCurrentPetHistory('imaging');loadDiagnosticExchangeCenter();
 if(d.params.p_modality==='XRAY')await imShareRefreshAfterUploadV781(scope,d.params.p_pet_id,d.params.p_asset_id,d.params.p_study_id);
 }catch(e){if(scope===imagingScopeV61()){imagingMessageV61('尚未確認完成：'+e.message+(imagingV61.draft?'。請按「重試同一筆」；保留此頁，不會重複建立紀錄。':''),true);if(imagingV61.draft)document.getElementById('im61-save').textContent='重試同一筆';}}
 finally{if(scope===imagingScopeV61()){imagingV61.busy=false;document.getElementById('im61-save').disabled=false;}}
}
async function appendPrivateImageAssetsV61(container,study){
 const scope=imagingScopeV61(),tenant=CURRENT_TENANT_ID;
 const status=imagingElementV61('p','讀取影像檔案…');container.appendChild(status);
 try{
 const {data,error}=await _supabase.from('imaging_assets').select('id,study_id,storage_path,mime_type,original_filename,file_size').eq('tenant_id',tenant).eq('study_id',study.id).order('created_at',{ascending:true});if(error)throw error;if(scope!==imagingScopeV61()||!container.isConnected)return;
 status.remove();if(!data?.length){container.appendChild(imagingElementV61('p','此檢查尚無附件。'));return;}
 for(const asset of data){const row=imagingElementV61('div');row.style.cssText='padding:10px 0;';row.appendChild(imagingElementV61('p',(asset.original_filename||'影像附件')+'｜'+((asset.file_size||0)/1048576).toFixed(1)+' MB'));
 const prefix=tenant+'/'+study.pet_id+'/'+study.id+'/';
 if(!asset.storage_path?.startsWith(prefix)){row.appendChild(imagingElementV61('p','這是舊版附件路徑，尚未接通私人檔案預覽。'));container.appendChild(row);continue;}
 const btn=imagingElementV61('button','開啟／重新載入影像');btn.type='button';btn.className='btn-secondary';const preview=imagingElementV61('div');
 btn.onclick=async()=>{btn.disabled=true;try{const {data:signed,error}=await _supabase.storage.from('clinic-imaging').createSignedUrl(asset.storage_path,3600);if(error)throw error;if(scope!==imagingScopeV61()||!row.isConnected)return;const url=new URL(signed.signedUrl);if(url.protocol!=='https:'||url.origin!==new URL(SUPABASE_URL).origin)throw new Error('檔案網址不符預期');preview.replaceChildren();const media=imagingElementV61(asset.mime_type?.startsWith('video/')?'video':'img');media.src=url.href;media.style.cssText='display:block;max-width:100%;max-height:550px;margin:10px 0;background:#111;';if(media.tagName==='VIDEO'){media.controls=true;media.preload='metadata';media.playsInline=true;}else media.alt='寵物檢查影像';media.onerror=()=>{const p=imagingElementV61('p','瀏覽器無法預覽此編碼，請下載原始檔，用電腦播放器開啟。');preview.appendChild(p);};preview.appendChild(media);const a=imagingElementV61('a','下載原始檔／另開視窗');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.download=asset.original_filename||'';preview.appendChild(a);}catch(e){if(scope===imagingScopeV61()){preview.replaceChildren(imagingElementV61('p','開啟失敗：'+e.message));}}finally{btn.disabled=false;}};
 row.append(btn,preview);if(imShareAllowedV76())row.appendChild(imagingDeleteButtonV79(asset,study));container.appendChild(row);
 }
 }catch(e){if(scope===imagingScopeV61()&&container.isConnected)status.textContent='影像附件讀取失敗：'+e.message;}
}
async function loadImagingListV61(){
 const pet=imagingV61.pet,scope=imagingScopeV61(),rev=++imagingV61.listRevision,box=document.getElementById('im61-list');
 if(!pet){box.textContent='請先選擇寵物。';return;}box.textContent='讀取中…';
 try{const {data,error}=await _supabase.from('imaging_studies').select('*').eq('tenant_id',CURRENT_TENANT_ID).eq('pet_id',pet.id).order('study_date',{ascending:false}).limit(50);if(error)throw error;if(scope!==imagingScopeV61()||rev!==imagingV61.listRevision)return;box.replaceChildren();if(!data?.length)box.textContent='此寵物尚無影像紀錄。';for(const study of data||[]){const detail=imagingElementV61('details');detail.className='legacy-archive';detail.appendChild(imagingElementV61('summary',(study.modality==='XRAY'?'X 光':'超音波')+'｜'+new Date(study.study_date).toLocaleString('zh-TW')+'｜'+(study.body_part||'未填部位')));const content=imagingElementV61('div');content.style.padding='12px';content.appendChild(imagingElementV61('p','備註：'+(study.clinical_note||'未填')));detail.appendChild(content);let loaded=false;detail.ontoggle=()=>{if(detail.open&&!loaded){loaded=true;appendPrivateImageAssetsV61(content,study);}};box.appendChild(detail);}if(data?.length===50)box.appendChild(imagingElementV61('p','此頁顯示最近 50 筆；門診「影像／附件」可查阅全部紀錄。'));}catch(e){if(scope===imagingScopeV61()&&rev===imagingV61.listRevision)box.textContent='影像紀錄讀取失敗：'+e.message;}
}
const imagingPreviousSwitchV61=switchTab;
switchTab=function(tabId){imagingPreviousSwitchV61(tabId);if(tabId==='diagnostic_exchange'||tabId==='lab_tests')openImagingV61();};
const imagingPreviousLogoutV61=logoutSupabase;
logoutSupabase=async function(...args){const result=await imagingPreviousLogoutV61.apply(this,args);imagingResetV61();return result;};

