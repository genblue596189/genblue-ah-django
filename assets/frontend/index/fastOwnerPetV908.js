
let ownerPetScopeV908='',ownerPetLocalV908=new Map(),ownerFormV908=null,ownerSaveV908=false;
const ownerFieldsV908=['intOwnerCode','intOwnerName','intOwnerMobile','intOwnerPhone','intOwnerEmail','intOwnerAddress','intOwnerNotes'];
function ownerScopeV908(){return CURRENT_TENANT_ID&&CURRENT_USER?.id?String(CURRENT_TENANT_ID)+'|'+CURRENT_USER.id:'';}
function ownerPrepareV908(){const scope=ownerScopeV908();if(scope!==ownerPetScopeV908){ownerPetScopeV908=scope;ownerPetLocalV908=new Map();ownerFormV908=null;}return scope;}
function ownerMergeRowsV908(rows){
 ownerPrepareV908();const index=new Map(rows.map((o,i)=>[o.id,i]));
 for(const [id,local] of ownerPetLocalV908){const pos=index.get(id),old=pos===undefined?null:rows[pos],pets=new Map((old?.pets||[]).map(p=>[p.id,p])),seen=new Set(pets.keys());for(const p of local.pets||[])if(!pets.has(p.id))pets.set(p.id,p);const merged={...local,...old,pets:[...pets.values()]};if(pos===undefined){index.set(id,rows.length);rows.push(merged);}else rows[pos]=merged;if(old&&(local.pets||[]).every(p=>seen.has(p.id)))ownerPetLocalV908.delete(id);}
 return rows;
}
function ownerCacheUpsertV908(owner,pet){
 if(!ownerScopeV908()||owner.tenant_id&&String(owner.tenant_id)!==String(CURRENT_TENANT_ID)||pet.tenant_id!==CURRENT_TENANT_ID||pet.owner_id!==owner.id)throw Error('新增資料院所／飼主不符');
 ownerPrepareV908();const group=globalOwnersPetsData.find(g=>g.owner.id===owner.id),old=allOwnersListForDropdown.find(o=>o.id===owner.id),merged={...old,...group?.owner,...owner};
 const pets=new Map([...(old?.pets||[]),...(group?.pets||[]),...(ownerPetLocalV908.get(owner.id)?.pets||[])].map(p=>[p.id,p]));pets.set(pet.id,pet);merged.pets=[...pets.values()];const additions=new Map((ownerPetLocalV908.get(owner.id)?.pets||[]).map(p=>[p.id,p]));additions.set(pet.id,pet);ownerPetLocalV908.set(owner.id,{...merged,pets:[...additions.values()]});
 if(group){group.owner=merged;group.pets=merged.pets;}else globalOwnersPetsData.push({owner:merged,pets:merged.pets});
 const ownerIndex=allOwnersListForDropdown.findIndex(o=>o.id===owner.id);if(ownerIndex<0)allOwnersListForDropdown.push(merged);else allOwnersListForDropdown[ownerIndex]=merged;
 const entry={...pet,microchip:pet.microchip||'',weight:roundPetWeight(pet.weight)||0,birthday:pet.birthday||'',owner_id:owner.id,owner_name:merged.name,owner_mobile:merged.mobile||'',owner_phone:merged.phone||'',owner_code:merged.owner_code||'',system_code:merged.system_code||'',owner_system_code:merged.system_code||''};
 const petIndex=allPetsListForDropdown.findIndex(p=>p.id===pet.id);if(petIndex<0)allPetsListForDropdown.push(entry);else allPetsListForDropdown[petIndex]=entry;
 const label='[新:'+(merged.system_code||'待產生')+'] '+(merged.owner_code?'[舊:'+merged.owner_code+'] ':'')+merged.name+' ('+(merged.mobile||'')+')';
 const select=document.getElementById('invoiceOwnerSelect');if(select&&!Array.from(select.options).some(o=>o.value===owner.id)){const option=new Option(label,owner.id);select.add(option);}
 const list=document.getElementById('checkoutOwnerDatalist');if(list&&!Array.from(list.options).some(o=>o.dataset.ownerId===owner.id)){const option=document.createElement('option');option.value=label;option.dataset.ownerId=owner.id;list.append(option);}
 filterIntegratedTable();return entry;
}
function ownerFormRenderV908(){
 const owner=ownerFormV908?.owner;for(const id of ownerFieldsV908)document.getElementById(id).readOnly=!!owner;
 const note=document.getElementById('sameOwnerStatusV908');if(note)note.textContent=owner?'目前新增至：'+owner.name+'｜新編號：'+(owner.system_code||'未記錄')+'。再新增寵物會使用同一位飼主。':'新飼主建檔：先填飼主資料，再填第一隻寵物。';
 document.querySelectorAll('#owners_pets button[onclick^="saveIntegratedOwnerAndPet"],#sameOwnerNewV908,#differentOwnerV908').forEach(b=>b.disabled=ownerSaveV908);
}
function ownerClearPetV908(){
 for(const id of ['intPetName','intPetMicrochip','intPetBirthday','intPetWeight','newBreedCustomInput'])document.getElementById(id).value='';
 document.getElementById('intPetGender').selectedIndex=-1;document.getElementById('petBirthdayLabel').innerText='出生日期 (日曆選單)';document.getElementById('intPetName').focus();
}
function differentOwnerV908(){
 if(ownerSaveV908)return;if(ownerFormV908?.request){alert('上筆建立結果尚未完整確認，請先按原儲存按鈕核對；不要另建同一筆。');return;}
 if(document.getElementById('intPetName').value.trim()&&!confirm('清空目前尚未儲存的寵物欄位，改建另一位飼主？'))return;
 ownerFormV908=null;for(const id of ownerFieldsV908)document.getElementById(id).value='';ownerClearPetV908();ownerFormRenderV908();document.getElementById('intOwnerName').focus();
}
async function ownerConfirmedInsertV908(table,payload,scope){
 const valid=()=>scope===ownerScopeV908();
 if(table==='owners'||table==='pets'){
  const {data:{session},error}=await _supabase.auth.getSession();if(!valid())throw Error('登入已變更，請回原院所核對建立結果');
  if(error||!session?.access_token)throw Error('登入已失效，請重新登入');
  const response=await fetch('/api/records/'+table+'/',{method:'POST',credentials:'omit',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const result=await response.json();if(!valid())throw Error('登入已變更，請回原院所核對建立結果');
  if(!response.ok){const failure=Error(result.error||'建檔結果尚未確認');failure.code=result.code;throw failure;}
  if(result.tenant_id!==CURRENT_TENANT_ID||result.user_id!==CURRENT_USER?.id||result.data?.id!==payload.id||result.data?.tenant_id!==payload.tenant_id)throw Error('沒有取得正確的已儲存資料');
  return result.data;
 }
 const result=await _supabase.from(table).insert([payload]).select('*').single();if(!valid())throw Error('登入已變更，請回原院所核對建立結果');
 if(result.error){
  // Same UUID on retries prevents duplicate records after a lost response.
  const check=await _supabase.from(table).select('*').eq('tenant_id',payload.tenant_id).eq('id',payload.id).maybeSingle();if(!valid())throw Error('登入已變更');
  if(check.error||!check.data)throw result.error;
  return check.data;
 }
 if(!result.data||result.data.id!==payload.id||result.data.tenant_id!==payload.tenant_id)throw Error('沒有取得正確的已儲存資料');return result.data;
}
async function saveIntegratedOwnerAndPet(actionType){
 if(ownerSaveV908)return;const scope=ownerPrepareV908();if(!scope){alert('請先登入');return;}
 if(CURRENT_PROFILE?.role!=='admin'&&!(CURRENT_PROFILE?.permission_operational??CURRENT_PROFILE?.role==='staff')){alert('此帳號沒有飼主／寵物建檔權限');return;}
 const value=id=>document.getElementById(id).value.trim();
 if(!value('intOwnerName')||!value('intOwnerMobile')||!value('intPetName')||!value('intPetGender')){alert('請填飼主姓名、手機、寵物名字及性別。');return;}
 const weight=value('intPetWeight');if(weight&&(!Number.isFinite(Number(weight))||Number(weight)<0)){alert('體重請填非負數值');return;}
 const ownerInput={owner_code:value('intOwnerCode')||null,name:value('intOwnerName'),mobile:value('intOwnerMobile'),phone:value('intOwnerPhone'),email:value('intOwnerEmail'),address:value('intOwnerAddress'),notes:value('intOwnerNotes')||null};
 const petInput={name:value('intPetName'),microchip:value('intPetMicrochip')||null,birthday:value('intPetBirthday')||null,species:value('intPetSpecies'),breed:value('intPetBreed'),gender:value('intPetGender'),weight:weight?roundPetWeight(weight):null};
 ownerFormV908=ownerFormV908||{scope,owner:null,request:null};const ctx=ownerFormV908;
 if(ctx.scope!==scope){alert('院所已變更，請重新填寫');return;}
 const key=JSON.stringify([ownerInput,petInput]);if(ctx.request&&(ctx.request.key!==key||ctx.request.actionType!==actionType)){alert('上筆建立結果待確認；請保留原欄位，先按原儲存按鈕核對，避免重複建檔。');return;}
 ctx.request=ctx.request||{key,actionType,owner:{id:crypto.randomUUID(),tenant_id:CURRENT_TENANT_ID,...ownerInput},pet:{id:crypto.randomUUID(),tenant_id:CURRENT_TENANT_ID,...petInput},petRow:null,appointmentId:crypto.randomUUID()};const request=ctx.request;
 ownerSaveV908=true;ownerFormRenderV908();
 try{
  if(!ctx.owner)ctx.owner=await ownerConfirmedInsertV908('owners',request.owner,scope);
  if(scope!==ownerScopeV908())return;request.pet.owner_id=ctx.owner.id;ownerFormRenderV908();
  if(!request.petRow)request.petRow=await ownerConfirmedInsertV908('pets',request.pet,scope);
  if(scope!==ownerScopeV908())return;
  const pet=ownerCacheUpsertV908(ctx.owner,request.petRow);
  if(actionType==='save_and_waiting'){
   const active=await _supabase.from('appointments').select('*').eq('tenant_id',CURRENT_TENANT_ID).eq('pet_id',pet.id).in('status',['候診中','診間看診中']).limit(1);if(active.error)throw active.error;if(scope!==ownerScopeV908())return;
   let appointment=active.data?.[0];if(!appointment){const now=new Date().toISOString();appointment=await ownerConfirmedInsertV908('appointments',{id:request.appointmentId,tenant_id:CURRENT_TENANT_ID,pet_id:pet.id,owner_id:ctx.owner.id,scheduled_at:now,checked_in_at:now,status:'候診中',notes:'[來院目的] 看診',session:document.getElementById('appointmentSession')?.value||'上午診',doctor:null,assigned_doctor_id:null},scope);}
   if(scope!==ownerScopeV908())return;if(appointment.pet_id!==pet.id)throw Error('掛號寵物資料不符');
   if(!activeAppointmentsList.some(p=>p.appointment_id===appointment.id))activeAppointmentsList.push(waitingPetFromAppointment(pet,appointment));renderAppointmentTable(activeAppointmentsList);
  }
  if(actionType==='save_and_consult'){
   // Keep the confirmed UUIDs and form until the new patient's consultation is actually open.
   await startConsultationById(pet.id,pet.microchip,pet.name,pet.owner_id,pet.weight,pet.owner_name,pet.birthday,pet.gender,pet.species,pet.breed);
   if(scope!==ownerScopeV908())return;
   if(currentPetId!==pet.id||!document.getElementById('medical').classList.contains('active'))return;
   ctx.request=null;ownerFormV908=null;
   for(const id of ownerFieldsV908)document.getElementById(id).value='';
   for(const id of ['intPetName','intPetMicrochip','intPetBirthday','intPetWeight','newBreedCustomInput'])document.getElementById(id).value='';
   document.getElementById('intPetSpecies').value='貓';onSpeciesChanged();
   document.getElementById('intPetBreed').selectedIndex=-1;
   document.getElementById('intPetGender').selectedIndex=-1;
   document.getElementById('petBirthdayLabel').innerText='出生日期 (日曆選單)';
   ownerFormRenderV908();
  }
  else {ctx.request=null;ownerClearPetV908();ownerFormRenderV908();}
  if(actionType==='save_and_consult'){ /* Form cleared only after successful navigation above. */ }
  else if(actionType==='save_and_waiting'){switchTab('appointments');alert('已建立並儲存掛號；同飼主資料已保留，可回「飼主與寵物」繼續新增。');}
  else {document.getElementById('sameOwnerStatusV908').textContent='已建立「'+pet.name+'」。飼主 '+ctx.owner.name+'｜新編號 '+(ctx.owner.system_code||'未記錄')+'；請填下一隻寵物，或按「改建另一位飼主」。';document.getElementById('intPetName').focus();}
 }catch(e){
  if(scope===ownerScopeV908()){
   // A PostgreSQL rejected write is safe to edit; a transport error remains frozen.
   if((e.code==='GB_RECORD_REJECTED'||/^(?:22[0-9A-Z]{3}|23[0-9A-Z]{3}|42501|P0001)$/.test(e.code||''))&&!request.petRow)ctx.request=null;
   alert('尚未完成全部步驟：'+e.message+'。已建立的飼主會保留，不會重建；若屬連線不明，請以原欄位重試核對。');
  }
 }finally{ownerSaveV908=false;ownerFormRenderV908();}
}
function ownerPetMountV908(){
 const button=document.querySelector('#owners_pets button[onclick="saveIntegratedOwnerAndPet(\'save_only\')"]');
 const extra=document.createElement('button');extra.id='sameOwnerNewV908';extra.type='button';extra.className='btn-success';extra.style.cssText='background:#1d4ed8;color:white;padding:12px 20px';extra.textContent='🐾 儲存並同飼主新增下一隻';extra.onclick=()=>saveIntegratedOwnerAndPet('save_and_another');button.parentElement.append(extra);
 const different=document.createElement('button');different.id='differentOwnerV908';different.type='button';different.className='btn-secondary';different.textContent='＋ 改建另一位飼主';different.onclick=differentOwnerV908;button.parentElement.append(different);
 const note=document.createElement('p');note.id='sameOwnerStatusV908';note.setAttribute('role','status');note.style.cssText='padding:10px;border:1px solid #cbd5e1;border-radius:8px;color:#1e40af';button.parentElement.after(note);ownerPrepareV908();ownerFormRenderV908();
 document.getElementById('genblueVersionV84').textContent=' · v90.8';
}
const ownerLogoutBeforeV908=logoutSupabase;
logoutSupabase=function(...args){ownerFormV908=null;ownerPetLocalV908=new Map();ownerPetScopeV908='';for(const id of ownerFieldsV908)document.getElementById(id).value='';ownerFormRenderV908();return ownerLogoutBeforeV908.apply(this,args);};
addPetToOwnerPrompt=function(ownerId){return openQuickNewPet(ownerId);};
ownerPetMountV908();
