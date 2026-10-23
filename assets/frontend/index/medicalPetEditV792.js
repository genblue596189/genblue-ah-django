
/* v79.2: jump from a consultation to the exact patient's owner/pet editor. */
let medicalPetEditContextV792=null,medicalPetEditBusyV792=false;
function medicalPetEditScopeV792(){return CURRENT_TENANT_ID+'|'+CURRENT_USER?.id;}
function medicalPetEditValidV792(ctx){return !!ctx&&ctx.scope===medicalPetEditScopeV792()&&ctx.petId===currentPetId&&ctx.ownerId===currentOwnerId;}
function medicalPetEditStatusV792(text,error=false){const el=document.getElementById('med792-status');el.textContent=text;el.style.color=error?'#b42318':'#476343';}
function medicalPetEditRenderV792(owner,pet){
 const ctx=medicalPetEditContextV792;if(!medicalPetEditValidV792(ctx))return;
 document.getElementById('med792-context').hidden=false;
 document.getElementById('med792-patient').textContent='目前門診：'+pet.name+'｜飼主：'+owner.name+'｜新編號：'+(owner.system_code||'未填')+'／舊病歷號：'+(owner.owner_code||'未填');
 document.getElementById('med792-chip').value=pet.microchip||'';
 document.getElementById('ownerPetTableSearch').value=owner.system_code||owner.owner_code||owner.name||pet.name;
 const group={owner,pets:[pet]};
 const index=globalOwnersPetsData.findIndex(x=>x.owner.id===owner.id);
 if(index<0)globalOwnersPetsData.push(group);else{const existing=globalOwnersPetsData[index];const pets=existing.pets.map(p=>p.id===pet.id?pet:p);if(!pets.some(p=>p.id===pet.id))pets.push(pet);globalOwnersPetsData[index]={owner,pets};}
 // Render only this verified patient; identical names never pick a different animal.
 ++integratedSearchRequest;renderIntegratedTable([group]);
 medicalPetEditStatusV792('可直接新增或修改晶片號碼；其他寵物資料可按下方「改」。');
}
async function goToOwnerPetFromMedicalV792(){
 if(medicalPetEditBusyV792)return;
 if(!currentPetId||!currentOwnerId){alert('請先選擇看診寵物。');return;}
 if(!imShareAllowedV76()){alert('此帳號沒有修改寵物資料的權限。');return;}
 const ctx={scope:medicalPetEditScopeV792(),tenant:CURRENT_TENANT_ID,petId:currentPetId,ownerId:currentOwnerId};medicalPetEditBusyV792=true;
 const btn=document.getElementById('med792-open');btn.disabled=true;
 try{
  const [p,o]=await Promise.all([
   _supabase.from('pets').select('*').eq('tenant_id',ctx.tenant).eq('id',ctx.petId).eq('owner_id',ctx.ownerId).single(),
   _supabase.from('owners').select('*').eq('tenant_id',ctx.tenant).eq('id',ctx.ownerId).single()
  ]);
  if(!medicalPetEditValidV792(ctx))return;
  if(p.error||o.error||!p.data||!o.data)throw p.error||o.error||Error('找不到目前寵物或飼主');
  if(p.data.id!==ctx.petId||p.data.owner_id!==ctx.ownerId||p.data.tenant_id!==ctx.tenant||o.data.id!==ctx.ownerId||o.data.tenant_id!==ctx.tenant)throw Error('寵物與飼主資料不符');
  collectCurrentMedicalState();ctx.chip=p.data.microchip??null;medicalPetEditContextV792=ctx;
  switchTab('owners_pets');medicalPetEditRenderV792(o.data,p.data);document.getElementById('med792-context').scrollIntoView({block:'start'});document.getElementById('med792-chip').focus();
 }catch(e){if(medicalPetEditValidV792(ctx))alert('無法帶入寵物資料：'+e.message);}
 finally{medicalPetEditBusyV792=false;btn.disabled=false;}
}
function syncMedicalPetChipV792(pet){
 currentPetMicrochip=pet.microchip||'';
 document.getElementById('cardPetChip').textContent=currentPetMicrochip||'無晶片';
 document.getElementById('medicalPetNameInfo').value=currentPetName+(currentPetMicrochip?' (晶片: '+currentPetMicrochip+')':'');
 for(const list of [allPetsListForDropdown,activeAppointmentsList])for(const p of list)if(p.id===pet.id)p.microchip=pet.microchip;
 for(const group of globalOwnersPetsData)for(const p of group.pets)if(p.id===pet.id)p.microchip=pet.microchip;
 const result=globalSearchMatches.get(pet.id);if(result)result.microchip=pet.microchip;
}
async function saveMedicalPetChipV792(){
 const ctx=medicalPetEditContextV792;if(medicalPetEditBusyV792)return;
 if(!medicalPetEditValidV792(ctx)){medicalPetEditStatusV792('目前門診已變更，請重新從門診帶入正確寵物。',true);return;}
 if(!imShareAllowedV76()){medicalPetEditStatusV792('沒有修改寵物資料的權限。',true);return;}
 const chip=document.getElementById('med792-chip').value.trim()||null;
 if(chip===ctx.chip){medicalPetEditStatusV792('晶片號碼沒有變更。');return;}
 const btn=document.getElementById('med792-save');btn.disabled=true;medicalPetEditBusyV792=true;
 try{
  let request=_supabase.from('pets').update({microchip:chip}).eq('tenant_id',ctx.tenant).eq('id',ctx.petId).eq('owner_id',ctx.ownerId);
  request=ctx.chip===null?request.is('microchip',null):request.eq('microchip',ctx.chip);
  const {data,error}=await request.select('id,tenant_id,owner_id,microchip').single();
  if(!medicalPetEditValidV792(ctx))return;
  if(error||!data)throw error||Error('資料可能已被其他人修改，請重新從門診帶入確認');
  if(data.id!==ctx.petId||data.tenant_id!==ctx.tenant||data.owner_id!==ctx.ownerId||data.microchip!==chip)throw Error('伺服器尚未確認儲存結果');
  ctx.chip=data.microchip;syncMedicalPetChipV792(data);medicalPetEditStatusV792('晶片號碼已儲存，門診卡片已同步更新。');
  await filterIntegratedTable();
 }catch(e){if(medicalPetEditValidV792(ctx))medicalPetEditStatusV792('尚未確認儲存：'+e.message+'。可重新按門診的「修改寵物資料」核對。',true);}
 finally{medicalPetEditBusyV792=false;btn.disabled=false;}
}
async function backToMedicalFromPetEditV792(){
 const ctx=medicalPetEditContextV792;if(medicalPetEditBusyV792)return;
 if(!medicalPetEditValidV792(ctx)){alert('原看診已變更，請從候診清單開啟正確病患。');return;}
 // Re-read the chip in case the existing full pet editor was used.
 try{const {data,error}=await _supabase.from('pets').select('id,tenant_id,owner_id,microchip').eq('tenant_id',ctx.tenant).eq('id',ctx.petId).eq('owner_id',ctx.ownerId).single();if(!medicalPetEditValidV792(ctx))return;if(error)throw error;if(data&&data.id===ctx.petId&&data.tenant_id===ctx.tenant&&data.owner_id===ctx.ownerId){ctx.chip=data.microchip??null;syncMedicalPetChipV792(data);}}
 catch(e){if(medicalPetEditValidV792(ctx))medicalPetEditStatusV792('晶片同步未完成：'+e.message+'；返回後可再開啟確認。',true);}
 if(medicalPetEditValidV792(ctx))switchTab('medical');
}
const medicalPetEditSwitchV792=switchTab;switchTab=function(...args){if(medicalPetEditContextV792&&!medicalPetEditValidV792(medicalPetEditContextV792)){medicalPetEditContextV792=null;document.getElementById('med792-context').hidden=true;}return medicalPetEditSwitchV792.apply(this,args);};
const medicalPetEditLogoutV792=logoutSupabase;logoutSupabase=async function(...args){medicalPetEditContextV792=null;document.getElementById('med792-context').hidden=true;return medicalPetEditLogoutV792.apply(this,args);};

