
/* One clinic snapshot plus private original files. ZIP STORE; no ZIP64 or compression. */
const backupMimeExtensionsV62={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm'};
const backupCRCtableV62=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function backupCRCV62(bytes){let n=0xffffffff;for(const b of bytes)n=backupCRCtableV62[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
async function backupHashBytesV62(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
function backupScopeV62(){return CURRENT_TENANT_ID+'|'+(CURRENT_USER?.id||'')+'|'+CURRENT_PROFILE?.role;}
function validateBookingBackupV62(snapshot){
 const names=['ob_clinics','ob_slots','ob_requests','ob_weekly_v60','ob_closed_days_v60'];
 if(!snapshot.booking_tables||Object.keys(snapshot.booking_tables).sort().join('|')!==names.sort().join('|'))throw Error('線上預約備份範圍不完整');
 let total=0;for(const name of names){const t=snapshot.booking_tables[name];if(t.source_schema!=='booking'||!Array.isArray(t.rows)||t.row_count!==t.rows.length||!Array.isArray(t.columns)||!t.columns.length||!Array.isArray(t.constraints))throw Error('線上預約結構不完整');
 const columns=t.columns.map(x=>x.name).sort().join('|'),pk=t.constraints.find(x=>x.kind==='p')?.definition?.match(/PRIMARY KEY \(([^)]+)\)/),keys=new Set();if(!pk)throw Error('預約資料缺少主鍵');const fields=pk[1].split(',').map(x=>x.trim().replaceAll('"',''));
 for(const row of t.rows){if(String(row.tenant_id)!==snapshot.tenant_id||Object.keys(row).sort().join('|')!==columns)throw Error('線上預約有其他醫院資料或缺欄位');const key=JSON.stringify(fields.map(k=>row[k]));if(fields.some(k=>row[k]==null)||keys.has(key))throw Error('線上預約主鍵有誤');keys.add(key);}total+=t.row_count;}
 const b=snapshot.booking_tables,slots=new Set(b.ob_slots.rows.map(x=>x.id)),appointments=new Set(snapshot.tables.appointments.rows.map(x=>x.id));
 for(const r of b.ob_requests.rows)if(!slots.has(r.slot_id)||(r.appointment_id&&!appointments.has(r.appointment_id)))throw Error('線上預約有找不到對應時段或掛號的關聯');
 return total;
}
function validateStorageBackupV62(snapshot){
 const a=snapshot.attachments;if(a?.mode!=='private_storage_v62'||!Array.isArray(a.objects)||a.object_count!==a.objects.length||a.object_count>1000)throw Error('影像原始檔清單不完整或超過此版 1000 檔限制');
 const paths=new Map(),ids=new Set(),pets=new Set(snapshot.tables.pets.rows.map(x=>x.id));let size=0;
 for(const o of a.objects){if(o.bucket!=='clinic-imaging'||typeof o.path!=='string'||o.path.split('/').length!==4||o.path.split('/')[0]!==snapshot.tenant_id||!pets.has(o.path.split('/')[1])||!Number.isSafeInteger(o.size)||o.size<1||o.size>50*1048576||!backupMimeExtensionsV62[o.mime]||!o.path.endsWith('.'+backupMimeExtensionsV62[o.mime])||typeof o.object_id!=='string'||typeof o.updated_at!=='string'||paths.has(o.path)||ids.has(o.object_id))throw Error('影像檔案清單有大小、格式、重複或跨院錯誤');paths.set(o.path,o);ids.add(o.object_id);size+=o.size;}
 if(size!==a.total_bytes)throw Error('影像總大小不符');
 for(const row of snapshot.tables.imaging_assets.rows){const o=paths.get(row.storage_path);if(!o||o.size!==Number(row.file_size)||o.mime!==row.mime_type||!o.linked||row.preview_storage_path)throw Error('影像紀錄缺少對應的原始檔');}
 return paths;
}
class BackupZipWriterV62{
 constructor(stream){this.stream=stream;this.parts=[];this.entries=[];this.offset=0;this.limit=stream?2*1024*1024*1024:512*1024*1024;}
 async write(bytes){if(this.offset+bytes.byteLength>this.limit)throw Error(this.stream?'本版 ZIP 超過 2 GB，請分階段升級大型備份。':'此瀏覽器的記憶體備份超過 512 MB，請使用電腦 Chrome／Edge 的直接儲存功能。');if(this.stream)await this.stream.write(bytes);else this.parts.push(bytes);this.offset+=bytes.byteLength;}
 async add(name,bytes){if(!/^(snapshot\.json|manifest\.json|files\/[0-9]{6}\.(jpg|png|webp|mp4|mov|webm))$/.test(name)||this.entries.some(e=>e.name===name))throw Error('備份 ZIP 路徑有誤');const encoded=new TextEncoder().encode(name),crc=backupCRCV62(bytes),offset=this.offset,h=new Uint8Array(30+encoded.length),d=new DataView(h.buffer);d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x800,true);d.setUint16(12,0x21,true);d.setUint32(14,crc,true);d.setUint32(18,bytes.length,true);d.setUint32(22,bytes.length,true);d.setUint16(26,encoded.length,true);h.set(encoded,30);await this.write(h);await this.write(bytes);this.entries.push({name,encoded,crc,size:bytes.length,offset});}
 async finish(){const start=this.offset;for(const e of this.entries){const h=new Uint8Array(46+e.encoded.length),d=new DataView(h.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,0x21,true);d.setUint32(16,e.crc,true);d.setUint32(20,e.size,true);d.setUint32(24,e.size,true);d.setUint16(28,e.encoded.length,true);d.setUint32(42,e.offset,true);h.set(e.encoded,46);await this.write(h);}const size=this.offset-start,h=new Uint8Array(22),d=new DataView(h.buffer);d.setUint32(0,0x06054b50,true);d.setUint16(8,this.entries.length,true);d.setUint16(10,this.entries.length,true);d.setUint32(12,size,true);d.setUint32(16,start,true);await this.write(h);if(this.stream){await this.stream.close();return null;}return new Blob(this.parts,{type:'application/zip'});}
 async abort(){if(this.stream)try{await this.stream.abort();}catch{}this.parts=[];}
}

// v85_1: page table data while preserving raw JSON numbers and consistency.
function backupRawRowsV851(raw){
 const marker=raw.indexOf('"rows"'),colon=raw.indexOf(':',marker),end=raw.lastIndexOf('}');
 if(marker<0||colon<0||end<colon)throw Error('備份分批回覆缺少資料列');
 const array=raw.slice(colon+1,end).trim();if(!array.startsWith('[')||!array.endsWith(']')||!Array.isArray(JSON.parse(array)))throw Error('備份分批資料列不完整');return array;
}
function backupManifestKeyV851(m){
 const groups={};for(const key of ['tables','private_tables','booking_tables']){groups[key]={};for(const name of Object.keys(m[key]||{}).sort()){const {rows,...meta}=m[key][name];groups[key][name]=meta;}}
 return JSON.stringify({tenant_id:m.tenant_id,format:m.format,format_version:m.format_version,table_count:m.table_count,total_rows:m.total_rows,groups,attachments:m.attachments});
}
async function backupReadPagedV851(tenant,signal,ensure,progress){
 const readManifest=async()=>{const {data,error}=await _supabase.rpc('genblue_backup_manifest_v851',{p_expected_tenant:tenant}).abortSignal(signal);ensure();if(error)throw Error(error.message+'；請確認已執行 backup_pharmacy_v91_34.sql 備份更新');if(typeof data!=='string')throw Error('備份清單格式不符');const m=JSON.parse(data);if(m.tenant_id!==tenant||m.format_version!==3)throw Error('備份院所或版本不符');if(!Object.prototype.hasOwnProperty.call(m.tables||{},'pharmacy_jobs_v9133'))throw Error('備份範圍尚未包含配藥室，請先執行 backup_pharmacy_v91_34.sql，再重新備份');return m;};
 progress('正在讀取備份範圍與資料筆數…');const manifest=await readManifest(),initialKey=backupManifestKeyV851(manifest),rawGroups={},sections=[['tables','public'],['private_tables','private'],['booking_tables','booking']];let done=0;
 for(const [group,schema] of sections){if(!manifest[group]||typeof manifest[group]!=='object')throw Error('備份缺少 '+group);rawGroups[group]={};for(const [name,table]of Object.entries(manifest[group])){
  if(!Number.isSafeInteger(table.row_count)||table.row_count<0||!/^[a-f0-9]{32}$/.test(table.signature)||!Array.isArray(table.rows)||table.rows.length)throw Error('備份清單資料不完整：'+name);
  let offset=0,limit=50,failedAttempts=0;const pieces=[];
  while(offset<table.row_count){ensure();progress('正在備份 '+name+'：'+offset.toLocaleString()+'／'+table.row_count.toLocaleString()+' 筆（全部已讀 '+done.toLocaleString()+' 筆）');
   let reply;
   try{reply=await _supabase.rpc('genblue_backup_page_v851',{p_expected_tenant:tenant,p_schema:schema,p_table:name,p_signature:table.signature,p_offset:offset,p_limit:limit}).abortSignal(signal);}
   catch(error){reply={error};}
   ensure();if(signal.aborted)throw Error('備份已取消');
   const {data,error}=reply;
   if(error){
    throw Error(name+' 第 '+offset+' 筆讀取未完成：'+(error.message||String(error))+'；本次已停止，不自動重試。');
   }
   failedAttempts=0;
   if(typeof data!=='string')throw Error('備份分批格式不符');const page=JSON.parse(data),raw=backupRawRowsV851(data);
   if(page.tenant_id!==tenant||page.schema!==schema||page.table!==name||page.signature!==table.signature||page.total!==table.row_count||page.offset!==offset||!Array.isArray(page.rows)||page.rows.length!==Math.min(limit,table.row_count-offset))throw Error('備份分批院所／筆數不符：'+name);
   pieces.push(raw.slice(1,-1));offset+=page.rows.length;done+=page.rows.length;if(offset<table.row_count){await new Promise(resolve=>setTimeout(resolve,250));ensure();if(signal.aborted)throw Error('備份已取消');}
  }
  const {rows,signature,...meta}=table;const head=JSON.stringify(meta);rawGroups[group][name]=head.slice(0,-1)+',"rows":['+pieces.join(',')+']}';
 }}
 if(done!==manifest.total_rows)throw Error('完整備份總筆數不符');
 progress('正在核對分批期間資料是否變動…');const finalManifest=await readManifest();if(backupManifestKeyV851(finalManifest)!==initialKey)throw Error('備份期間資料已變動，這次未完成；請於較少操作時重新備份');
 const parts=[];for(const [key,value]of Object.entries(manifest)){if(rawGroups[key])parts.push(JSON.stringify(key)+':{'+Object.entries(rawGroups[key]).map(([n,s])=>JSON.stringify(n)+':'+s).join(',')+'}');else parts.push(JSON.stringify(key)+':'+JSON.stringify(value));}
 ensure();return '{'+parts.join(',')+'}';
}

startClinicDataBackup=async function(options={}){
 if(clinicBackupBusy)return;if(CURRENT_PROFILE?.role!=='admin'||!CURRENT_TENANT_ID){alert('只有本院管理者可以備份。');return;}
 const tenant=CURRENT_TENANT_ID,scope=backupScopeV62(),status=document.getElementById('clinicBackupStatus'),button=document.getElementById('clinicBackupStart'),progress=document.getElementById('clinicBackupProgress'),link=document.getElementById('clinicBackupDownload');
 cancelClinicBackup();clinicBackupBusy=true;button.disabled=true;progress.hidden=false;progress.removeAttribute('value');status.style.color='#475569';status.textContent='請選擇備份檔儲存位置…';
 const controller=new AbortController();clinicBackupController=controller;let writer;
 const ensure=()=>{if(controller.signal.aborted||scope!==backupScopeV62())throw Error('備份已取消或登入身分已改變');};
 const timer=setTimeout(()=>controller.abort(),1800000);
 let stage='準備備份',stageStarted=Date.now();const setStage=text=>{stage=text;stageStarted=Date.now();status.textContent=text;if(typeof options.onProgress==='function')options.onProgress(text);};
 try{
 let handle;if(!options.scheduledArchiveV72&&typeof window.showSaveFilePicker==='function')handle=await window.showSaveFilePicker({suggestedName:'genblue_'+tenant.replace(/[^A-Za-z0-9_-]/g,'_')+'_'+new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14)+'_含影像.zip',types:[{description:'院內資料與影像備份',accept:{'application/zip':['.zip']}}]});
 ensure();setStage('正在取得本院資料、線上預約與原始檔清單…');
 const data=await backupReadPagedV851(tenant,controller.signal,ensure,setStage);ensure();if(typeof data!=='string')throw Error('備份函式版本不符');const snapshot=JSON.parse(data);validateClinicBackupSnapshot(snapshot,tenant);if(snapshot.format_version!==3)throw Error('請安裝 v62 備份 SQL');if(!snapshot.tables.imaging_shares_v76)throw Error('請先執行 v76.4 備份範圍更新 SQL，納入影像 QR 分享資料後再備份');if(!CLINIC_BACKUP_POS_TABLES_V843.every(name=>Object.prototype.hasOwnProperty.call(snapshot.tables,name)))throw Error('請先執行 v84_3 備份範圍更新 SQL，納入待付款與交班資料後再備份');
 const files=snapshot.attachments.objects;
 const estimated=snapshot.attachments.total_bytes+new TextEncoder().encode(data).length+1048576;
 if(estimated>(handle?2*1024*1024*1024:512*1024*1024))throw Error(handle?'備份超過本版 2 GB 限制。':'備份超過 512 MB，請在電腦 Chrome／Edge 使用直接儲存功能。');
 writer=new BackupZipWriterV62(handle?await handle.createWritable():null);
 ensure();const snapshotBytes=new TextEncoder().encode(data),manifest={format:'genblue-clinic-media-archive',format_version:1,tenant_id:tenant,snapshot_at:snapshot.snapshot_at,snapshot_sha256:await backupHashBytesV62(snapshotBytes),snapshot_size:snapshotBytes.length,file_count:files.length,files:[]};
 ensure();await writer.add('snapshot.json',snapshotBytes);
 let completed=0;for(const [i,obj]of files.entries()){
 ensure();setStage('正在備份圖片／影片 '+(i+1)+'／'+files.length+'（已核對 '+(completed/1048576).toFixed(1)+' MB）…');
 const {data:signed,error}=await _supabase.storage.from(obj.bucket).createSignedUrl(obj.path,3600);if(error)throw Error(error.message);ensure();const url=new URL(signed.signedUrl);if(url.protocol!=='https:'||url.origin!==new URL(SUPABASE_URL).origin)throw Error('檔案網址不符預期');
 const response=await fetch(url.href,{signal:controller.signal});if(!response.ok)throw Error('檔案下載失敗：HTTP '+response.status);const bytes=new Uint8Array(await response.arrayBuffer());ensure();if(bytes.length!==obj.size)throw Error('原始檔大小不符，備份停止');
 const archive_path='files/'+String(i+1).padStart(6,'0')+'.'+backupMimeExtensionsV62[obj.mime],sha256=await backupHashBytesV62(bytes);ensure();await writer.add(archive_path,bytes);manifest.files.push({...obj,archive_path,sha256});completed+=bytes.length;progress.value=10+75*(i+1)/Math.max(files.length,1);
 }
 setStage('正在再次核對原始檔版本…');
 const {data:verified,error:verifyError}=await _supabase.rpc('genblue_check_backup_objects_v62',{p_expected_tenant:tenant,p_objects:files}).abortSignal(controller.signal);if(verifyError||verified!==true)throw Error(verifyError?.message||'原始檔版本核對失敗');ensure();
 await writer.add('manifest.json',new TextEncoder().encode(JSON.stringify(manifest)));ensure();const blob=await writer.finish();ensure();
 if(options.scheduledArchiveV72)return {blob,snapshot};
 noteManualBackupV74(tenant,scope,blob?'download':'written','',snapshot.snapshot_at);
 showClinicBackupSummary(snapshot);showPrivateBackupSummaryV53({...snapshot,format_version:2});const row=document.createElement('tr');for(const value of ['圖片／影片原始檔',files.length+' 檔（'+(completed/1048576).toFixed(1)+' MB）']){const td=document.createElement('td');td.textContent=value;row.appendChild(td);}document.getElementById('clinicBackupSummaryBody').appendChild(row);
 if(blob){clinicBackupDownloadUrl=URL.createObjectURL(blob);link.href=clinicBackupDownloadUrl;link.download='genblue_'+tenant.replace(/[^A-Za-z0-9_-]/g,'_')+'_'+new Date(snapshot.snapshot_at).toISOString().replace(/[^0-9]/g,'').slice(0,14)+'_含影像.zip';link.hidden=false;link.click();}
 progress.value=100;status.style.color='#059669';status.textContent='備份已'+(blob?'產生並開始下載':'寫入所選檔案')+'：'+snapshot.table_count+' 張表、'+snapshot.total_rows.toLocaleString()+' 筆、'+files.length+' 個原始檔。請用下方「檢查備份檔」核對 ZIP；此版尚未提供自動還原。';
 }catch(e){await writer?.abort();if(options.scheduledArchiveV72){const detail=stage+'（此階段 '+Math.round((Date.now()-stageStarted)/1000)+' 秒）：'+e.message;status.style.color='#dc2626';status.textContent='本次備份未完成：'+detail;progress.hidden=true;throw Error(detail);}noteManualBackupV74(tenant,scope,'failed',controller.signal.aborted||e.name==='AbortError'?'已取消':e.message);if(typeof window.pauseScheduledBackupV926==='function')await window.pauseScheduledBackupV926(e.message);progress.hidden=true;link.hidden=true;status.style.color='#dc2626';status.textContent='本次備份未完成：'+(controller.signal.aborted||e.name==='AbortError'?'已取消。':e.message)+' 未完成檔案請勿當作有效備份。';}
 finally{clearTimeout(timer);clinicBackupBusy=false;button.disabled=false;if(clinicBackupController===controller)clinicBackupController=null;}
};
const backupCoreV926=startClinicDataBackup;
startClinicDataBackup=async function(options={}){
 const tenant=CURRENT_TENANT_ID,scope=backupScopeV62();
 const run=async()=>{if(scope!==backupScopeV62())throw Error('登入身分已變更');return backupCoreV926(options);};
 if(!navigator.locks?.request)return run();
 return navigator.locks.request('genblue-backup-transfer:'+tenant,{ifAvailable:true},async lock=>{
  if(!lock){const message='同一瀏覽器已有備份進行中，本次未啟動。';if(options.scheduledArchiveV72)throw Error(message);document.getElementById('clinicBackupStatus').textContent=message;return;}
  return run();
 });
};
async function readZipEntriesV62(file){
 if(file.size>2*1024*1024*1024||file.size<22)throw Error('ZIP 大小超過此版限制或格式有誤');
 const tail=new Uint8Array(await file.slice(Math.max(0,file.size-65557)).arrayBuffer()),dv=new DataView(tail.buffer);let end=-1;
 for(let i=tail.length-22;i>=0;i--)if(dv.getUint32(i,true)===0x06054b50&&i+22+dv.getUint16(i+20,true)===tail.length){end=i;break;}if(end<0)throw Error('找不到完整 ZIP 結尾');
 const count=dv.getUint16(end+10,true),size=dv.getUint32(end+12,true),offset=dv.getUint32(end+16,true);if(size>2*1048576||count>1002||dv.getUint16(end+4,true)||dv.getUint16(end+6,true)||dv.getUint16(end+8,true)!==count||offset+size!==file.size-tail.length+end)throw Error('不支援多磁碟 ZIP 或結構有誤');
 const central=new Uint8Array(await file.slice(offset,offset+size).arrayBuffer()),view=new DataView(central.buffer),entries=new Map();let p=0;
 for(let i=0;i<count;i++){if(p+46>central.length||view.getUint32(p,true)!==0x02014b50)throw Error('ZIP 目錄不完整');const length=view.getUint16(p+28,true),extra=view.getUint16(p+30,true),comment=view.getUint16(p+32,true),name=new TextDecoder('utf-8',{fatal:true}).decode(central.subarray(p+46,p+46+length));if(p+46+length+extra+comment>central.length||entries.has(name)||view.getUint16(p+10,true)!==0||view.getUint16(p+8,true)!==0x800||view.getUint32(p+20,true)!==view.getUint32(p+24,true)||!(/^(snapshot\.json|manifest\.json|files\/[0-9]{6}\.(jpg|png|webp|mp4|mov|webm))$/.test(name)))throw Error('ZIP 具有不支援的內容或重複路徑');if(view.getUint32(p+24,true)>(name==='snapshot.json'?512*1048576:name==='manifest.json'?16*1048576:50*1048576))throw Error('ZIP 內部檔案超過限制');entries.set(name,{offset:view.getUint32(p+42,true),size:view.getUint32(p+24,true),crc:view.getUint32(p+16,true)});p+=46+length+extra+comment;}
 if(p!==central.length)throw Error('ZIP 目錄有多餘內容');
 const read=async name=>{const e=entries.get(name);if(!e)throw Error('備份缺少 '+name);if(e.offset+30>offset)throw Error('ZIP 原始檔位置有誤');const h=new Uint8Array(await file.slice(e.offset,e.offset+30).arrayBuffer()),v=new DataView(h.buffer);if(v.getUint32(0,true)!==0x04034b50||v.getUint16(8,true)!==0||v.getUint32(18,true)!==e.size||v.getUint32(14,true)!==e.crc)throw Error('ZIP 檔頭與目錄不一致');const length=v.getUint16(26,true),extra=v.getUint16(28,true),start=e.offset+30+length+extra;if(start+e.size>offset)throw Error('ZIP 原始檔不完整');const filename=new TextDecoder().decode(await file.slice(e.offset+30,e.offset+30+length).arrayBuffer());if(filename!==name)throw Error('ZIP 路徑不一致');const bytes=new Uint8Array(await file.slice(start,start+e.size).arrayBuffer());if(backupCRCV62(bytes)!==e.crc)throw Error(name+' 的 ZIP 校驗碼不符');return bytes;};
 return {entries,read};
}
const previousBackupCheckV62=checkClinicBackupFile;
checkClinicBackupFile=async function(event){
 const file=event.target.files?.[0];if(!file)return;if(!/\.zip$/i.test(file.name))return previousBackupCheckV62(event);
 const status=document.getElementById('clinicBackupCheckStatus'),scope=backupScopeV62();if(CURRENT_PROFILE?.role!=='admin'){status.textContent='請先登入本院管理者';return;}
 status.style.color='#475569';status.textContent='正在核對 ZIP 與檔案校驗碼…';
 const ensure=()=>{if(scope!==backupScopeV62())throw Error('登入身分已改變');};
 try{const zip=await readZipEntriesV62(file);ensure();const manifest=JSON.parse(new TextDecoder().decode(await zip.read('manifest.json')));if(manifest.format!=='genblue-clinic-media-archive'||manifest.format_version!==1||manifest.tenant_id!==CURRENT_TENANT_ID||!Array.isArray(manifest.files)||manifest.file_count!==manifest.files.length||manifest.file_count>1000||zip.entries.size!==manifest.files.length+2)throw Error('備份清單範圍不符');
 const bytes=await zip.read('snapshot.json');if(bytes.length!==manifest.snapshot_size||await backupHashBytesV62(bytes)!==manifest.snapshot_sha256)throw Error('院內資料校驗碼不符');ensure();const snapshot=JSON.parse(new TextDecoder().decode(bytes));validateClinicBackupSnapshot(snapshot,CURRENT_TENANT_ID);if(snapshot.format_version!==3)throw Error('ZIP 資料版本不符');
 const objects=snapshot.attachments.objects;if(objects.length!==manifest.files.length)throw Error('影像筆數不一致');let total=0;const seen=new Set();
 for(let i=0;i<objects.length;i++){ensure();const o=objects[i],m=manifest.files[i];for(const key of ['bucket','path','object_id','updated_at','etag','size','mime','linked'])if(m[key]!==o[key])throw Error('原始檔清單與資料快照不一致');const expected='files/'+String(i+1).padStart(6,'0')+'.'+backupMimeExtensionsV62[m.mime];if(m.archive_path!==expected||seen.has(expected))throw Error('原始檔 ZIP 路徑有誤');seen.add(expected);status.textContent='正在核對原始檔 '+(i+1)+'／'+objects.length+'…';const bytes=await zip.read(expected);if(bytes.length!==m.size||await backupHashBytesV62(bytes)!==m.sha256)throw Error('圖片／影片校驗碼不符：'+expected);total+=bytes.length;}
 ensure();if(total!==snapshot.attachments.total_bytes)throw Error('原始檔總大小不符');showClinicBackupSummary(snapshot);showPrivateBackupSummaryV53({...snapshot,format_version:2});status.style.color='#059669';status.textContent='備份檔檢查通過：'+snapshot.total_rows.toLocaleString()+' 筆資料、'+objects.length+' 個原始檔，醫院 '+snapshot.tenant_id+'。這是完整性檢查；此份真實資料的隔離還原演練尚待完成。';
 }catch(e){status.style.color='#dc2626';status.textContent='備份檔檢查失敗：'+e.message;}
 finally{event.target.value='';}
};

