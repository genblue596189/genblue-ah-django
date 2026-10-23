
/* v78.1: refresh share candidates only after the server confirms an upload. */
async function imShareRefreshAfterUploadV781(scope,petId,assetId,studyId){
 if(scope!==imagingScopeV61()||imagingV61.pet?.id!==petId)return;
 const shareScope=imShareScopeV76();
 if(imShareV76.busy){imagingMessageV61('影像已儲存。分享建立完成後，按「更新可分享的 X 光」即可讀取新圖。');return;}
 const selected=new Set([...document.querySelectorAll('#im76-assets .im76-select:checked')].map(el=>el.value));
 try{
  const load=imShareLoadV76(null,studyId),revision=imShareV76.revision;await load;
  if(scope!==imagingScopeV61()||shareScope!==imShareScopeV76()||revision!==imShareV76.revision||imagingV61.pet?.id!==petId)return;
  const checks=[...document.querySelectorAll('#im76-assets .im76-select')];
  let count=0;for(const check of checks){check.checked=selected.has(check.value)&&count<20;if(check.checked)count++;}
  const added=checks.find(check=>check.value===assetId);
  if(added){if(!added.checked&&count<20)added.checked=true;imShareV76.pending=null;imShareStatusV76(added.checked?'新圖片已出現在清單並勾選，請確認後建立 QR Code。':'新圖片已出現在清單；已勾選 20 張，請調整後再建立 QR Code。');}
  else imagingMessageV61('影像已儲存。分享清單未讀到新圖，請按「更新可分享的 X 光」重試；不用重新登入。');
 }catch(e){if(scope===imagingScopeV61()&&shareScope===imShareScopeV76())imagingMessageV61('影像已儲存，分享清單更新失敗：'+e.message+'。請按「更新可分享的 X 光」重試。',true);}
}

