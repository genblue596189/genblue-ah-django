
/* v76: selected private JPG/PNG X-rays; capability lives in memory only. */
const imShareV76={scope:'',pet:'',revision:0,assets:[],pending:null,current:null,busy:false};
function imShareAllowedV76(){return !!(CURRENT_USER?.id&&CURRENT_TENANT_ID&&(CURRENT_PROFILE?.role==='admin'||(CURRENT_PROFILE?.permission_clinical??CURRENT_PROFILE?.role==='doctor')));}
function imShareScopeV76(){return imagingScopeV61()+'|'+(imagingV61.pet?.id||'');}
function imShareStatusV76(text,error=false){const e=document.getElementById('im76-status');e.textContent=text;e.style.color=error?'#b42318':'#476343';}
function imShareClearV76(){imShareV76.revision++;imShareV76.scope=imShareScopeV76();imShareV76.pet='';imShareV76.assets=[];imShareV76.pending=null;imShareV76.current=null;imShareV76.busy=false;for(const id of ['im76-assets','im76-history'])document.getElementById(id).replaceChildren();document.getElementById('im76-qr-modal').hidden=true;document.getElementById('im76-qr-image').removeAttribute('src');document.getElementById('im76-link').value='';document.getElementById('im76-create').disabled=false;for(const el of document.querySelectorAll('#im76-days,#im76-load'))el.disabled=false;document.getElementById('im76-copy-status').textContent='';imShareStatusV76('先選擇寵物，再按「讀取可分享的 X 光」。');}
function imShareEnsureV76(){if(imShareV76.scope!==imShareScopeV76())imShareClearV76();return imShareScopeV76();}
function imShareDateV76(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('zh-TW'):'日期未填';}
async function imShareLoadV76(studyId=null,extraStudyId=null){
 const scope=imShareEnsureV76(),pet=imagingV61.pet;
 if(!imShareAllowedV76()||!pet){imShareStatusV76('請先選擇寵物，並確認有看診權限。',true);return;}
 if(imShareV76.busy)return;
 const rev=++imShareV76.revision;imShareV76.assets=[];imShareV76.pending=null;const box=document.getElementById('im76-assets');box.replaceChildren();imShareStatusV76('正在讀取 X 光影像…');
 try{
  let studyQuery=_supabase.from('imaging_studies').select('id,pet_id,tenant_id,study_date,body_part,modality').eq('tenant_id',CURRENT_TENANT_ID).eq('pet_id',pet.id).eq('modality','XRAY');if(studyId)studyQuery=studyQuery.eq('id',studyId);const studies=await studyQuery.order('study_date',{ascending:false}).limit(50);
  if(studies.error)throw studies.error;if(scope!==imShareScopeV76()||rev!==imShareV76.revision)return;
  const byStudy=new Map((studies.data||[]).filter(s=>s.pet_id===pet.id&&s.tenant_id===CURRENT_TENANT_ID&&s.modality==='XRAY').map(s=>[s.id,s]));
  // Include a just-uploaded backdated study even when it is outside the latest 50.
  if(extraStudyId&&!byStudy.has(extraStudyId)){
   const extra=await _supabase.from('imaging_studies').select('id,pet_id,tenant_id,study_date,body_part,modality').eq('tenant_id',CURRENT_TENANT_ID).eq('pet_id',pet.id).eq('modality','XRAY').eq('id',extraStudyId).maybeSingle();
   if(extra.error)throw extra.error;if(scope!==imShareScopeV76()||rev!==imShareV76.revision)return;
   const study=extra.data;if(study&&study.pet_id===pet.id&&study.tenant_id===CURRENT_TENANT_ID&&study.modality==='XRAY')byStudy.set(study.id,study);
  }
  if(!byStudy.size){imShareStatusV76('此寵物尚無 X 光。請先選 X 光並上傳 JPG／PNG。');await imShareHistoryV76(scope,rev);return;}
  const assets=await _supabase.from('imaging_assets').select('id,study_id,tenant_id,storage_path,mime_type,original_filename,file_size').eq('tenant_id',CURRENT_TENANT_ID).in('study_id',[...byStudy.keys()]).in('mime_type',['image/jpeg','image/png']).order('created_at',{ascending:false}).limit(1001);
  if(assets.error)throw assets.error;if(scope!==imShareScopeV76()||rev!==imShareV76.revision)return;
  const list=(assets.data||[]).filter(a=>{const s=byStudy.get(a.study_id);return s&&a.tenant_id===CURRENT_TENANT_ID&&['image/jpeg','image/png'].includes(a.mime_type)&&a.storage_path?.startsWith(CURRENT_TENANT_ID+'/'+pet.id+'/'+s.id+'/')&&a.file_size>0&&a.file_size<=52428800;}).slice(0,1000);
  imShareV76.assets=list;imShareV76.pet=pet.id;
  for(const a of list){const s=byStudy.get(a.study_id),label=imagingElementV61('label'),check=imagingElementV61('input');check.type='checkbox';check.value=a.id;check.className='im76-select';check.style.width='auto';check.onchange=()=>{imShareV76.pending=null;};label.style.cssText='display:flex;gap:10px;align-items:center;padding:10px;border-bottom:1px solid #dfe6d7';label.append(check,imagingElementV61('span',imShareDateV76(s.study_date)+'｜'+(s.body_part||'未填部位')+'｜'+(a.original_filename||'X 光影像')));if(imShareAllowedV76())label.appendChild(imagingDeleteButtonV79(a,s));box.appendChild(label);}
  imShareStatusV76(list.length?'請勾選本次要給飼主的影像，最多 20 張。'+(assets.data?.length>1000?'此處顯示最新 1000 張。':''):'沒有可分享的 JPG／PNG X 光附件。');await imShareHistoryV76(scope,rev);
 }catch(e){if(scope===imShareScopeV76()&&rev===imShareV76.revision)imShareStatusV76('讀取失敗：'+e.message,true);}
}
async function imShareHistoryV76(scope=imShareScopeV76(),rev=imShareV76.revision){
 const pet=imagingV61.pet;if(!pet)return;
 const result=await _supabase.rpc('manage_imaging_share_v76',{p_action:'list',p_data:{pet_id:pet.id}});
 if(scope!==imShareScopeV76()||rev!==imShareV76.revision)return;
 const box=document.getElementById('im76-history');box.replaceChildren();
 if(result.error){box.textContent='分享紀錄尚未啟用或讀取失敗：'+result.error.message;return;}
 for(const share of result.data?.shares||[]){const row=imagingElementV61('div');row.style.cssText='display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0';const expired=new Date(share.expires_at)<=new Date();row.appendChild(imagingElementV61('span',imShareDateV76(share.created_at)+'｜'+share.image_count+' 張｜'+(share.revoked_at?'已停止':expired?'已到期':'到期 '+imShareDateV76(share.expires_at))));if(!share.revoked_at&&!expired){const b=imagingElementV61('button','停止分享');b.type='button';b.className='btn-danger';b.onclick=()=>imShareRevokeV76(share.id,scope);row.appendChild(b);}box.appendChild(row);}
}
function imShareLinkV76(token){const url=new URL('imaging-share.html',location.href);if(!['http:','https:'].includes(url.protocol))throw Error('請先把 index.html 與 imaging-share.html 放到網站，再建立 QR Code。');url.search='';url.hash=token;return url.href;}
function imShareQRDataV76(url){if(typeof qrcode!=='function')throw Error('QR Code 元件未載入，請重新整理。');const q=qrcode(0,'M');q.addData(url,'Byte');q.make();const n=q.getModuleCount(),scale=8,quiet=4,canvas=document.createElement('canvas');canvas.width=canvas.height=(n+quiet*2)*scale;const ctx=canvas.getContext('2d');if(!ctx)throw Error('瀏覽器無法產生 QR Code。');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(q.isDark(y,x))ctx.fillRect((x+quiet)*scale,(y+quiet)*scale,scale,scale);return canvas.toDataURL('image/png');}
function imShareShowV76(result,token,pet,scope){if(scope!==imShareScopeV76())return;const link=imShareLinkV76(token),png=imShareQRDataV76(link);imShareV76.current={...result,link,png,petName:pet.name,scope};document.getElementById('im76-qr-image').src=png;document.getElementById('im76-link').value=link;document.getElementById('im76-qr-caption').textContent=pet.name+'｜'+result.image_count+' 張 X 光｜到期 '+imShareDateV76(result.expires_at);document.getElementById('im76-qr-modal').hidden=false;}
async function imShareCreateV76(){
 const scope=imShareEnsureV76(),pet=imagingV61.pet;
 if(imShareV76.busy)return;if(!imShareAllowedV76()||!pet||imShareV76.pet!==pet.id){imShareStatusV76('請先讀取此寵物的可分享影像。',true);return;}
 const ids=[...document.querySelectorAll('#im76-assets input.im76-select:checked')].map(c=>c.value).sort();
 if(!ids.length||ids.length>20){imShareStatusV76('請選擇 1 至 20 張 X 光影像。',true);return;}
 const days=Number(document.getElementById('im76-days').value);if(![1,7,30].includes(days))return;
 imShareV76.busy=true;document.getElementById('im76-create').disabled=true;for(const el of document.querySelectorAll('#im76-assets input,#im76-days,#im76-load'))el.disabled=true;
 try{
  const key=JSON.stringify({pet_id:pet.id,asset_ids:ids,days});
  if(imShareV76.pending&&imShareV76.pending.key!==key)imShareV76.pending=null;
  const token=imShareV76.pending?.token||Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');const link=imShareLinkV76(token);
  imShareQRDataV76(link); // validate local renderer before creating a share
  imShareStatusV76('正在確認分享頁與服務…');
  const health=await fetch(SUPABASE_URL+'/functions/v1/imaging-share-v76',{cache:'no-store'});const h=await health.json();if(!health.ok||h.service!=='imaging-share-v76'||!h.ready)throw Error('請先部署 imaging-share-v76 分享服務。');
  const page=await fetch(new URL('imaging-share.html',location.href),{cache:'no-store'});if(!page.ok||!(await page.text()).includes('imagingShareViewerV76'))throw Error('網站還沒有 imaging-share.html，請先上傳分享頁。');
  if(scope!==imShareScopeV76())return;
  if(!imShareV76.pending)imShareV76.pending={key,token,data:{pet_id:pet.id,asset_ids:ids,days,token}};
  imShareStatusV76('正在建立影像分享…');
  const {data,error}=await _supabase.rpc('manage_imaging_share_v76',{p_action:'create',p_data:imShareV76.pending.data});
  if(scope!==imShareScopeV76())return;if(error)throw error;if(!data?.id||data.pet_id!==pet.id||data.image_count!==ids.length)throw Error('伺服器尚未確認分享。');
  imShareShowV76(data,imShareV76.pending.token,pet,scope);imShareV76.pending=null;imShareStatusV76('QR Code 已建立。可複製連結、下載或列印給飼主。');await imShareHistoryV76(scope);
 }catch(e){if(scope===imShareScopeV76())imShareStatusV76('尚未完成：'+e.message+(imShareV76.pending?'。可按原按鈕重試同一份分享。':''),true);}
 finally{if(scope===imShareScopeV76()){imShareV76.busy=false;document.getElementById('im76-create').disabled=false;for(const el of document.querySelectorAll('#im76-assets input,#im76-days,#im76-load'))el.disabled=false;}}
}
async function imShareRevokeV76(id,scope){if(scope!==imShareScopeV76()||!imShareAllowedV76()||!confirm('停止這份影像分享？飼主將無法重新開啟。'))return;try{const {error}=await _supabase.rpc('manage_imaging_share_v76',{p_action:'revoke',p_data:{id}});if(scope!==imShareScopeV76())return;if(error)throw error;if(imShareV76.current?.id===id){document.getElementById('im76-qr-modal').hidden=true;imShareV76.current=null;}imShareStatusV76('已停止分享。已開啟或下載的影像不會從飼主裝置消失。');await imShareHistoryV76(scope);}catch(e){if(scope===imShareScopeV76())imShareStatusV76('停止分享失敗：'+e.message,true);}}
async function imShareCopyV76(){const s=imShareV76.current;if(!s||s.scope!==imShareScopeV76())return;try{await navigator.clipboard.writeText(s.link);document.getElementById('im76-copy-status').textContent='已複製連結';}catch{document.getElementById('im76-link').select();document.getElementById('im76-copy-status').textContent='請按 Ctrl+C 複製連結';}}
function imShareDownloadV76(){const s=imShareV76.current;if(!s||s.scope!==imShareScopeV76())return;const a=imagingElementV61('a');a.href=s.png;a.download='X光影像_QRCode.png';a.click();}
function imSharePrintV76(){const s=imShareV76.current;if(!s||s.scope!==imShareScopeV76())return;const frame=document.createElement('iframe');frame.style.cssText='position:fixed;width:0;height:0;border:0';document.body.appendChild(frame);const doc=frame.contentDocument;doc.open();doc.write('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>X 光影像分享</title><style>body{font-family:sans-serif;text-align:center;padding:30px}img{width:280px;height:280px}p{font-size:18px;overflow-wrap:anywhere}</style><\/head><body><\/body><\/html>');doc.close();const h=doc.createElement('h1');h.textContent='X 光影像分享';const p=doc.createElement('p');p.textContent=s.petName+'｜'+s.image_count+' 張｜到期 '+imShareDateV76(s.expires_at);const img=doc.createElement('img');img.alt='影像分享 QR Code';img.onload=()=>{frame.contentWindow.focus();frame.contentWindow.print();};img.src=s.png;const tip=doc.createElement('p');tip.textContent='請用手機相機掃描 QR Code 查看影像。';doc.body.append(h,p,img,tip);frame.contentWindow.onafterprint=()=>frame.remove();setTimeout(()=>frame.remove(),120000);}
const imShareSelectOriginalV76=selectImagingPetV61;selectImagingPetV61=function(...args){const result=imShareSelectOriginalV76.apply(this,args);imShareEnsureV76();return result;};
const imShareResetOriginalV76=imagingResetV61;imagingResetV61=function(...args){const result=imShareResetOriginalV76.apply(this,args);imShareClearV76();return result;};
const imShareLogoutOriginalV76=logoutSupabase;logoutSupabase=async function(...args){imShareClearV76();return imShareLogoutOriginalV76.apply(this,args);};
_supabase.auth.onAuthStateChange(()=>{if(imShareV76.scope!==imShareScopeV76())imShareClearV76();});

const imShareCurrentOriginalV76=useCurrentImagingPetV61;useCurrentImagingPetV61=async function(...args){imShareClearV76();const result=await imShareCurrentOriginalV76.apply(this,args);imShareEnsureV76();return result;};

