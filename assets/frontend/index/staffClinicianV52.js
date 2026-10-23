
function appendStaffClinicianV52(card,member,flags,loadError){
 const wrap=document.createElement('div');wrap.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:14px 0;padding:12px;border:1px solid #dbe4d6;border-radius:10px;background:#f6f8f2';
 const label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:8px;font-weight:600';
 const check=document.createElement('input');check.type='checkbox';check.checked=flags?.get(member.user_id)===true;check.disabled=!flags;check.setAttribute('aria-label',(member.display_name||'此人員')+'：接診醫師');
 label.append(check,document.createTextNode('接診醫師'));wrap.append(label);
 const save=document.createElement('button');save.type='button';save.className='btn-secondary';save.textContent='儲存接診設定';save.disabled=!flags;
 const status=document.createElement('span');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style.fontSize='.85rem';
 const setStatus=(text,color)=>{status.textContent=text;status.style.color=color;};
 if(loadError)setStatus(loadError,'#b45309');
 check.addEventListener('change',()=>setStatus('⚠ 尚未儲存','#b45309'));
 save.addEventListener('click',async()=>{
  const enabled=check.checked,scope=doctorScopeV51();save.disabled=true;check.disabled=true;save.textContent='儲存中…';setStatus('正在儲存…','#475569');
  try{
   const r=await _supabase.rpc('set_staff_clinician_v52',{p_user_id:member.user_id,p_enabled:enabled});if(r.error)throw r.error;
   if(scope!==doctorScopeV51())return;
   flags.set(member.user_id,enabled);setStatus('✓ 接診設定已儲存','#047857');
   try{await loadClinicDoctorsV51();}catch(e){setStatus('✓ 已儲存；醫師名單更新失敗，請按更新資料','#b45309');}
  }catch(e){if(scope===doctorScopeV51())setStatus('儲存失敗：'+(e.message||String(e)),'#dc2626');}
  finally{save.disabled=false;check.disabled=false;save.textContent='儲存接診設定';}
 });
 wrap.append(save,status);card.append(wrap);
 const note=document.createElement('p');note.style.cssText='font-size:.82rem;color:#65715e;margin:0 0 12px';
 note.textContent=member.role==='admin'?'管理者可同時勾選接診醫師，管理權限保持不變。':'勾選後，還需具備「病歷編輯」權限，才會列入候診醫師名單並可接診。';card.append(note);
}

