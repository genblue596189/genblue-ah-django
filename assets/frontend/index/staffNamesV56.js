
function appendStaffNameV56(card,member,names,errorMessage){
 const wrap=document.createElement('div');wrap.className='staff-name-v56';wrap.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:12px 0;padding:12px;background:#f6f8f2;border-radius:10px';
 const label=document.createElement('label');label.textContent='顯示姓名 ';const input=document.createElement('input');input.type='text';input.maxLength=50;input.value=member.display_name||'';input.style.cssText='width:190px;max-width:100%;box-sizing:border-box';input.setAttribute('aria-label','修改 '+(member.display_name||'此人員')+' 的顯示姓名');label.append(input);
 const save=document.createElement('button');save.type='button';save.className='btn-secondary';save.textContent='儲存姓名';
 const status=document.createElement('span');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style.fontSize='.85rem';
 const show=(message,color='#65715e')=>{status.textContent=message;status.style.color=color;};
 let expected=names?.get(member.user_id)??null;const available=!!names?.has(member.user_id);input.disabled=save.disabled=!available;
 if(!available)show(errorMessage||'找不到人員姓名，請重新載入','#b45309');
 input.addEventListener('input',()=>show('⚠ 姓名尚未儲存','#b45309'));
 save.addEventListener('click',async()=>{
  const next=input.value.trim(),scope=doctorScopeV51();if(!next||[...next].length>50||/[\x00-\x1f\x7f]/.test(next)){show('請輸入 1 至 50 字的姓名，不可換行','#dc2626');return;}
  input.disabled=save.disabled=true;save.textContent='儲存中…';show('正在儲存姓名…');
  try{
   const r=await _supabase.rpc('set_staff_display_name_v56',{p_user_id:member.user_id,p_display_name:next,p_expected_name:expected});if(r.error)throw r.error;if(scope!==doctorScopeV51())return;
   if(r.data?.ok!==true){if(r.data?.reason==='conflict'){show('其他管理者已改為「'+(r.data.display_name||'未命名')+'」。你的輸入已保留；請重新載入人員清單後確認。','#b45309');return;}throw Error('未收到姓名儲存確認');}
   expected=r.data.display_name;names.set(member.user_id,expected);member.display_name=expected;input.value=expected;card.querySelector('.staff-card-identity strong').textContent=expected;
   if(member.user_id===CURRENT_USER?.id)CURRENT_PROFILE.display_name=expected;
   show('✓ 姓名已儲存','#047857');
   try{await loadClinicDoctorsV51();}catch(e){show('✓ 姓名已儲存；請按更新資料更新候診醫師名稱','#b45309');}
  }catch(e){if(scope===doctorScopeV51())show('未能確認儲存：'+(e.message||String(e))+'；可再次按儲存姓名確認。','#dc2626');}
  finally{input.disabled=save.disabled=!available;save.textContent='儲存姓名';}
 });
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(!save.disabled)save.click();}});
 wrap.append(label,save,status);card.append(wrap);
}
// Current queue names follow the stable account ID. Completed history keeps its original name snapshot.
const originalDoctorCardTextV56=doctorCardTextV55;
doctorCardTextV55=function(pet){
 if(pet.status==='已完成')return originalDoctorCardTextV56(pet);
 const c=clinicClaimsV51.get(pet.id),active=c&&c.appointment_id===pet.appointment_id?c:null;
 const current=clinicDoctorsV51.find(d=>d.id===(active?.clinician_id||pet.assigned_doctor_id))?.name;
 if(current)return (active||pet.status==='診間看診中'?'接診醫師：':'指定醫師：')+current;
 return originalDoctorCardTextV56(pet);
};

