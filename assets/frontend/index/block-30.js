
(()=>{
'use strict';
const $=id=>document.getElementById('oc-'+id),panel=document.getElementById('offlineCloudPanelV1');
let loaded=null,loadedScope=null,preview=null,receipt=null,busy=false,generation=0;
const allowed=()=>!!CURRENT_USER&&CURRENT_PROFILE?.role==='admin'&&!!CURRENT_TENANT_ID;
const scope=()=>JSON.stringify([CURRENT_USER?.id,CURRENT_TENANT_ID]);
const message=s=>{$('message').textContent=s;};
function update(){
 panel.querySelectorAll('input,button').forEach(n=>n.disabled=busy||!allowed());
 $('preview').disabled=busy||!allowed()||!loaded;
 $('commit').disabled=busy||!allowed()||!preview||preview.blocked>0||preview.ready<1||!$('confirm').checked;
 $('receipt').disabled=busy||!allowed()||!receipt;
}
function clear(){generation++;loaded=null;loadedScope=null;preview=null;receipt=null;$('password').value='';$('file').value='';$('confirm').checked=false;$('list').replaceChildren();$('report').textContent='';message('尚未載入。');update();}
window.clearOfflineCloudV1=clear;
function ensure(expected=loadedScope){if(!allowed()||expected!==scope()){clear();throw Error('登入或院別已變更，請重新載入原院備份。');}}
async function action(fn){if(busy)return;busy=true;update();try{if(!allowed())throw Error('請先使用本院管理者登入。');await fn();}catch(e){message((e.message||String(e))+'；原加密備份仍保留。');}finally{busy=false;update();}}
function unbase64(s){if(typeof s!=='string')throw Error('加密備份格式不正確');return Uint8Array.from(atob(s),x=>x.charCodeAt(0));}
async function decrypt(file,password){
 if(!file||file.size>400*1024*1024)throw Error('請選400MB以下的加密應急備份JSON');
 if(password.length<8)throw Error('請填寫應急密碼，至少8碼');
 const envelope=JSON.parse(await file.text());
 if(envelope.format!=='genblue-offline-v1'||envelope.iterations!==210000||!Number.isSafeInteger(envelope.revision)||envelope.revision<1)throw Error('這不是支援的加密應急備份');
 const salt=unbase64(envelope.salt),iv=unbase64(envelope.iv);if(salt.length!==16||iv.length!==12)throw Error('加密備份格式不正確');
 const encoder=new TextEncoder(),key0=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},key0,{name:'AES-GCM',length:256},false,['decrypt']);
 let payload;try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode('genblue-offline-v1')},key,unbase64(envelope.ciphertext))));}catch{throw Error('應急密碼不正確，或加密備份損毀');}
 if(payload.version!==1||payload.tenant_id!==CURRENT_TENANT_ID||!Array.isArray(payload.visits))throw Error('應急備份院別不符，停止載入');
 const ids=new Set();for(const v of payload.visits){if(!v||typeof v!=='object'||v.tenant_id!==payload.tenant_id||typeof v.id!=='string'||ids.has(v.id)||!Array.isArray(v.prescriptions)||v.sync_status!=='pending')throw Error('病歷編號、院別或處方格式不正確');ids.add(v.id);}
 return payload.visits;
}
function selected(){const visits=[...$('list').querySelectorAll('input[type=checkbox]')].filter(n=>n.checked).map(n=>loaded[Number(n.dataset.index)]);if(!visits.length||visits.length>20)throw Error('請勾選1至20筆病歷');if(new TextEncoder().encode(JSON.stringify(visits)).length>5*1024*1024)throw Error('選取內容超過5MB，請減少本次筆數');return visits;}
function selectedKey(){return JSON.stringify(selected());}
function invalidate(){preview=null;$('confirm').checked=false;$('report').textContent='勾選已變更，請重新預覽。';update();}
function cell(row,text,tag='td'){const n=document.createElement(tag);n.textContent=text??'';n.style.cssText='padding:8px;border-bottom:1px solid #ddd;vertical-align:top;white-space:pre-wrap';row.append(n);return n;}
function render(){
 const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;font-size:13px';const head=document.createElement('tr');
 for(const label of ['選取','原看診時間','寵物／飼主','原醫師','病歷及處方'])cell(head,label,'th');table.append(head);
 loaded.forEach((v,index)=>{const tr=document.createElement('tr'),td=cell(tr,''),check=document.createElement('input');check.type='checkbox';check.style.width='auto';check.dataset.index=index;check.disabled=busy;check.setAttribute('aria-label','選取 '+v.pet_name+' 的 '+v.visit_at+' 病歷');check.onchange=invalidate;td.append(check);cell(tr,new Date(v.visit_at).toLocaleString('zh-TW'));cell(tr,(v.pet_name||'')+'／'+(v.owner_name||''));cell(tr,v.doctor);
 const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='展開核對（'+v.prescriptions.length+' 筆用藥）';detail.append(summary);const text=document.createElement('pre');text.style.whiteSpace='pre-wrap';text.textContent='主訴／病歷：'+(v.chief||'')+'\n處置：'+(v.plan||'')+'\n費用備註：'+(v.fee_note||'')+'\n體重：'+(v.weight??'未填')+'\n體溫：'+(v.temperature??'未填')+'\n'+v.prescriptions.map(r=>[r.medicine_name,r.route,'劑量：'+(r.dose||''),'頻率：'+(r.frequency||''),'天數：'+(r.days||''),'總量：'+(r.quantity||''),r.instruction||''].join('｜')).join('\n');detail.append(text);cell(tr,'').append(detail);table.append(tr);});$('list').replaceChildren(table);
}
function validateResponse(report,visits,committed){
 if(!report||report.tenant_id!==CURRENT_TENANT_ID||report.committed!==committed||!Array.isArray(report.results)||report.results.length!==visits.length)throw Error('未確認伺服器結果，請重新預覽核對');
 const expected=new Set(visits.map(v=>v.id)),received=new Set();
 for(const r of report.results){if(!expected.has(r.id)||received.has(r.id)||!['ready','already','blocked'].includes(r.status))throw Error('補回結果編號不符');received.add(r.id);}
 for(const name of ['ready','already','blocked','inserted'])if(!Number.isSafeInteger(report[name])||report[name]<0)throw Error('補回筆數不正確');
 if(report.ready+report.already+report.blocked!==visits.length||report.blocked!==report.results.filter(r=>r.status==='blocked').length||report.already!==report.results.filter(r=>r.status==='already').length||report.ready!==report.results.filter(r=>r.status==='ready').length||report.inserted!==(committed?report.ready:0))throw Error('補回結果筆數不一致');return report;
}
async function rpc(visits,commit){const expected=loadedScope;ensure(expected);const {data,error}=await _supabase.rpc('import_offline_medical_v1',{p_expected_tenant:CURRENT_TENANT_ID,p_visits:visits,p_commit:commit,p_confirmation:commit?'補回離線病歷':''});ensure(expected);if(error)throw Error(error.message||'伺服器尚未確認；請重新預覽');return validateResponse(data,visits,commit);}
$('load').onclick=()=>action(async()=>{const expected=scope(),request=++generation,file=$('file').files[0],password=$('password').value;loaded=null;preview=null;receipt=null;$('confirm').checked=false;$('list').replaceChildren();$('report').textContent='';message('正在解密，尚未寫入雲端…');let visits;try{visits=await decrypt(file,password);}finally{$('password').value='';}ensure(expected);if(request!==generation)return;loaded=visits;loadedScope=expected;render();message('已載入 '+visits.length+' 筆本機病歷，請勾選並展開核對。尚未寫入雲端。');});
$('clear').onclick=clear;$('file').onchange=()=>{preview=null;loaded=null;loadedScope=null;receipt=null;$('list').replaceChildren();$('report').textContent='';$('password').value='';$('confirm').checked=false;update();};
$('preview').onclick=()=>action(async()=>{ensure();preview=null;$('confirm').checked=false;const visits=selected(),key=JSON.stringify(visits);message('正在預覽，沒有寫入病歷…');const report=await rpc(visits,false);preview={...report,key};$('report').textContent=report.results.map(r=>(r.status==='ready'?'可補回':r.status==='already'?'已補回':'停止')+'｜'+(r.pet_name||r.source_pet_name||'')+'｜'+r.doctor+'｜'+r.reason).join('\n');message('預覽完成：可補回 '+report.ready+' 筆、已補回 '+report.already+' 筆、需處理 '+report.blocked+' 筆。');});
$('confirm').onchange=update;
$('commit').onclick=()=>action(async()=>{ensure();if(!preview||preview.key!==selectedKey()||preview.blocked||!preview.ready||!$('confirm').checked)throw Error('請重新預覽並確認');const visits=selected();preview=null;$('confirm').checked=false;message('正在補回，請保持此頁開啟…');const report=await rpc(visits,true);receipt={format:'genblue-offline-import-receipt',version:1,checked_at:new Date().toISOString(),...report};$('report').textContent=report.results.map(r=>r.id+'｜'+(r.status==='already'?'已存在，跳過':'本次已新增')).join('\n');message('已確認補回 '+report.inserted+' 筆；'+report.already+' 筆原已補回。沒有開帳或扣庫存。請下載結果，並到門診歷史病歷核對。');});
$('receipt').onclick=()=>{try{ensure();if(!receipt)return;const url=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='離線病歷補回結果_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){message(e.message);}};
// Wipe decrypted in-memory data as the formal page changes login scope.
let lastScope=scope();setInterval(()=>{const next=scope();if(next!==lastScope){lastScope=next;clear();}else update();},1000);
update();
})();

