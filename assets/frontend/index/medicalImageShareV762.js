
/* v76.2: load persisted images when selecting a pet, including old studies. */
let imagingShareLoadPromiseV762=null;
let imagingShareTargetV762=null;
const imagingShareSelectOriginalV762=selectImagingPetV61;
selectImagingPetV61=function(p){
 const result=imagingShareSelectOriginalV762.apply(this,arguments);
 if(imagingV61.pet?.id===p.id&&!imagingV61.draft&&!imagingV61.busy){
  const target=imagingShareTargetV762;
  const study=target&&target.scope===imagingScopeV61()&&target.pet===p.id?target.study:null;
  imagingShareTargetV762=null;
  const load=imShareLoadV76(study),revision=imShareV76.revision;
  imagingShareLoadPromiseV762=load.then(()=>{
   if(study&&revision===imShareV76.revision&&imagingV61.pet?.id===p.id&&target.scope===imagingScopeV61()){
    [...document.querySelectorAll('#im76-assets .im76-select')].forEach((check,i)=>check.checked=i<20);
    if(imShareV76.assets.length)imShareStatusV76('已帶入這次檢查的 X 光，請確認勾選，再建立 QR Code；不必重新上傳。');
   }
  });
 }
 return result;
};
useCurrentImagingPetV61=async function(studyId=null){
 if(imagingV61.draft||imagingV61.busy){imagingMessageV61('此筆上傳尚未完成，請先完成同一筆存檔。',true);return false;}
 if(!currentPetId){imagingMessageV61('請先從門診選擇寵物，或使用上方搜尋。',true);return false;}
 if(imagingV61.scope!==imagingScopeV61())imagingResetV61();
 const scope=imagingScopeV61(),pet=currentPetId,rev=++imagingV61.searchRevision;
 imagingV61.pet=null;imagingV61.listRevision++;imShareClearV76();
 document.getElementById('im61-results').replaceChildren();document.getElementById('im61-list').replaceChildren();
 document.getElementById('im61-pet').textContent='正在帶入門診寵物與既有影像…';
 try{
  const {data,error}=await _supabase.from('pets').select('id,name,species,owners(name,mobile,owner_code,system_code)').eq('tenant_id',CURRENT_TENANT_ID).eq('id',pet).single();
  if(scope!==imagingScopeV61()||pet!==currentPetId||rev!==imagingV61.searchRevision)return false;
  if(error||!data||data.id!==pet)throw error||Error('找不到此寵物資料。');
  imagingShareTargetV762=studyId?{scope,pet,study:studyId}:null;
  selectImagingPetV61({...data,owner_name:data.owners?.name,owner_mobile:data.owners?.mobile,owner_code:data.owners?.owner_code,system_code:data.owners?.system_code});
  await imagingShareLoadPromiseV762;
  if(scope!==imagingScopeV61()||pet!==currentPetId||rev!==imagingV61.searchRevision)return false;
  imagingMessageV61('已帶入門診寵物。下方可使用既有 X 光建立分享，不必重新上傳。');return true;
 }catch(e){if(scope===imagingScopeV61()&&rev===imagingV61.searchRevision)imagingMessageV61('既有影像帶入失敗：'+e.message,true);return false;}
};
goToImagingFromMedicalV61=async function(studyId=null,expectedPet=currentPetId){
 if(!currentPetId||expectedPet!==currentPetId){alert('目前寵物已變更，請重新開啟影像紀錄。');return false;}
 if(imagingV61.draft||imagingV61.busy){alert('上一筆影像上傳尚未完成，請先完成存檔。');return false;}
 if(imagingV61.scope!==imagingScopeV61())imagingResetV61();
 const scope=imagingScopeV61();
 if(imagingOriginalMedicalNavigationV611()===false)return false;
 const loaded=await useCurrentImagingPetV61(studyId);
 if(loaded&&scope===imagingScopeV61()&&expectedPet===currentPetId){document.getElementById('im76-panel').scrollIntoView({block:'start'});return true;}
 return false;
};
const imagingShareAppendOriginalV762=appendPatientImageRecord;
appendPatientImageRecord=function(container,record,nativeStudy=false){
 imagingShareAppendOriginalV762.apply(this,arguments);
 if(nativeStudy&&record.modality==='XRAY'&&record.pet_id===currentPetId&&record.tenant_id===CURRENT_TENANT_ID){
  const item=container.lastElementChild,scope=imagingScopeV61(),pet=currentPetId;
  const button=imagingElementV61('button','📱 使用這次 X 光建立 QR Code');button.type='button';button.className='btn-secondary';button.style.marginTop='10px';
  button.onclick=()=>{if(scope===imagingScopeV61()&&pet===currentPetId)goToImagingFromMedicalV61(record.id,pet);};item.appendChild(button);
 }
};

