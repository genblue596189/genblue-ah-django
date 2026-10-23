
/* v79: scoped deletion, persistent cleanup retry, Storage API for physical files. */
let imagingDeleteBusyV79=false;
function imagingDeleteKeyV79(){return 'genblue-imaging-delete-v79:'+CURRENT_TENANT_ID+':'+CURRENT_USER?.id;}
function imagingDeleteTasksV79(){const data=JSON.parse(localStorage.getItem(imagingDeleteKeyV79())||'[]');if(!Array.isArray(data))throw Error('待清理紀錄格式不符');return data;}
function imagingDeleteWriteV79(tasks){localStorage.setItem(imagingDeleteKeyV79(),JSON.stringify(tasks));}
function imagingDeleteBadgeV79(){const el=document.getElementById('im79-cleanup');if(!el)return;try{const count=imShareAllowedV76()?imagingDeleteTasksV79().length:0;el.hidden=!count;document.getElementById('im79-cleanup-label').textContent='有 '+count+' 筆影像刪除待完成。';}catch{el.hidden=false;document.getElementById('im79-cleanup-label').textContent='無法讀取待清理紀錄，請保留此頁。';}}
function imagingDeleteParamsV79(task,action){return {p_action:action,p_asset_id:task.assetId,p_study_id:task.studyId,p_pet_id:task.petId,p_expected_path:task.path};}
async function imagingDeleteCompleteV79(task,scope){
 if(scope!==imagingScopeV61())throw Error('登入帳號已變更，請登入原帳號後重試');
 const prefix=CURRENT_TENANT_ID+'/'+task.petId+'/'+task.studyId+'/'+task.assetId+'.';
 if(!task.path?.startsWith(prefix)||!['jpg','png','webp','mp4','mov','webm'].includes(task.path.slice(prefix.length)))throw Error('附件路徑不符');
 const {data,error}=await _supabase.rpc('delete_imaging_asset_v79',imagingDeleteParamsV79(task,'delete'));if(error)throw error;
 if(scope!==imagingScopeV61())throw Error('登入帳號已變更，請登入原帳號後重試');
 if(!data?.deleted||data.asset_id!==task.assetId||data.pet_id!==task.petId||data.storage_path!==task.path)throw Error('伺服器尚未確認附件刪除');
 const removed=await _supabase.storage.from('clinic-imaging').remove([task.path]);if(removed.error)throw Error('影像紀錄已刪除，雲端檔案待清理：'+removed.error.message);
 if(scope!==imagingScopeV61())throw Error('登入帳號已變更，請登入原帳號後重試');
 // Storage DELETE can silently skip a policy-filtered object. Confirm absence via listing.
 const slash=task.path.lastIndexOf('/'),folder=task.path.slice(0,slash),name=task.path.slice(slash+1);
 const listed=await _supabase.storage.from('clinic-imaging').list(folder,{search:name,limit:100});if(listed.error)throw Error('檔案清理結果尚未確認：'+listed.error.message);
 if((listed.data||[]).some(obj=>obj.name===name))throw Error('雲端檔案尚未清除，請重試清理');
 if(scope!==imagingScopeV61())throw Error('登入帳號已變更，請登入原帳號後重試');
 imagingDeleteWriteV79(imagingDeleteTasksV79().filter(x=>x.assetId!==task.assetId));imagingDeleteBadgeV79();
}
async function imagingDeleteRefreshV79(scope,petId){
 if(scope!==imagingScopeV61())return;
 if(imagingV61.pet?.id===petId){loadImagingListV61();imShareV76.pending=null;imShareV76.current=null;document.getElementById('im76-qr-modal').hidden=true;await imShareLoadV76();}
 if(scope===imagingScopeV61())refreshOpenCurrentPetHistory('imaging');
}
async function deleteImagingAssetV79(asset){
 if(!imShareAllowedV76()||imagingDeleteBusyV79||imagingV61.busy||imagingV61.draft||imShareV76.busy){imagingMessageV61('請先完成目前的影像上傳或分享操作。',true);return;}
 const scope=imagingScopeV61();imagingDeleteBusyV79=true;imagingV61.busy=true;imagingLockV61(true);document.getElementById('im61-save').disabled=true;
 try{
  const prepared=await _supabase.rpc('delete_imaging_asset_v79',imagingDeleteParamsV79(asset,'prepare'));if(prepared.error)throw prepared.error;if(scope!==imagingScopeV61())return;
  const data=prepared.data;if(data?.asset_id!==asset.assetId||data.pet_id!==asset.petId||data.storage_path!==asset.path)throw Error('附件資料已變更，請更新清單');
  if(!confirm('刪除「'+(data.filename||asset.name||'影像附件')+'」？\n會刪除這個雲端附件，並停止所有包含它的 QR 分享（目前有效 '+data.active_shares+' 份）。\n保留檢查紀錄；已下載到其他裝置的副本不會消失。'))return;
  if(scope!==imagingScopeV61())return;
  // Persist before metadata deletion, so a lost response remains retryable after reload.
  const tasks=imagingDeleteTasksV79();if(!tasks.some(x=>x.assetId===asset.assetId))imagingDeleteWriteV79([...tasks,asset]);imagingDeleteBadgeV79();
  imagingMessageV61('正在刪除影像附件與雲端檔案…');await imagingDeleteCompleteV79(asset,scope);
  imagingMessageV61('影像附件與雲端檔案已刪除，相關 QR 分享已停止。');
 }catch(e){if(scope===imagingScopeV61())imagingMessageV61('刪除尚未全部完成：'+e.message+'。若下方有待完成提示，請按「重試待完成刪除」。',true);}
 finally{if(scope===imagingScopeV61()){imagingV61.busy=false;imagingLockV61(false);document.getElementById('im61-save').disabled=false;imagingDeleteBadgeV79();}imagingDeleteBusyV79=false;try{await imagingDeleteRefreshV79(scope,asset.petId);}catch(e){if(scope===imagingScopeV61())imagingMessageV61('請更新影像清單：'+e.message,true);}}
}
async function retryImagingDeleteV79(){
 if(!imShareAllowedV76()||imagingDeleteBusyV79||imagingV61.busy||imagingV61.draft||imShareV76.busy)return;
 const scope=imagingScopeV61();imagingDeleteBusyV79=true;imagingV61.busy=true;imagingLockV61(true);document.getElementById('im61-save').disabled=true;
 try{for(const task of imagingDeleteTasksV79()){if(scope!==imagingScopeV61())return;await imagingDeleteCompleteV79(task,scope);}imagingMessageV61('待完成刪除已全部處理。');}
 catch(e){if(scope===imagingScopeV61())imagingMessageV61('仍有刪除待完成：'+e.message,true);}
 finally{if(scope===imagingScopeV61()){imagingV61.busy=false;imagingLockV61(false);document.getElementById('im61-save').disabled=false;imagingDeleteBadgeV79();}imagingDeleteBusyV79=false;try{await imagingDeleteRefreshV79(scope,imagingV61.pet?.id);}catch(e){if(scope===imagingScopeV61())imagingMessageV61('請更新影像清單：'+e.message,true);}}
}
function imagingDeleteButtonV79(asset,study){const b=imagingElementV61('button','刪除附件');b.type='button';b.className='btn-danger';const scope=imagingScopeV61();b.onclick=e=>{e?.preventDefault();e?.stopPropagation();if(scope===imagingScopeV61())deleteImagingAssetV79({assetId:asset.id,studyId:study.id,petId:study.pet_id,name:asset.original_filename,path:asset.storage_path});};return b;}
const imagingDeleteSwitchV79=switchTab;switchTab=function(...args){const result=imagingDeleteSwitchV79.apply(this,args);imagingDeleteBadgeV79();return result;};
_supabase.auth.onAuthStateChange(()=>imagingDeleteBadgeV79());imagingDeleteBadgeV79();

