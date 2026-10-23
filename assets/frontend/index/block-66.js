
// 門診持續提醒：獨立保存於寵物資料，不隨結帳或門診清空刪除。
(function(){
 const panel=document.createElement('details');panel.id='medicalReminderV9120';panel.hidden=true;
 panel.innerHTML='<summary id="reminderTitleV9120">門診提醒備註</summary><p id="reminderTextV9120" role="alert"></p><label for="reminderInputV9120">提醒內容（僅供院內，下次開啟此寵物門診時顯示）</label><textarea id="reminderInputV9120" maxlength="5000" placeholder="例如：尚欠費用、下次補藥或其他需提醒醫師的事項"></textarea><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" id="reminderSaveV9120" class="btn-danger">儲存並啟用提醒</button><button type="button" id="reminderDoneV9120" class="btn-secondary">已處理，停止提醒並收合</button><button type="button" id="reminderRetryV9120" class="btn-secondary">重新讀取</button></div><p id="reminderStatusV9120" role="status" aria-live="polite"></p>';
 document.getElementById('medicalPetProfileCard').before(panel);
 const el=id=>document.getElementById(id+'V9120');
 let revision=0,ctx=null,busy=false;
 const scope=()=>[CURRENT_TENANT_ID,CURRENT_USER?.id,currentPetId].join('|');
 const valid=c=>ctx===c&&c.scope===scope();
 const allowed=()=>medicalEditAllowedV53();
 function controls(){el('reminderSave').disabled=busy||!ctx?.loaded||!allowed();el('reminderDone').disabled=busy||!ctx?.loaded||!allowed()||!ctx?.active;el('reminderInput').disabled=busy||!ctx?.loaded||!allowed();el('reminderRetry').disabled=busy;}
 function render(){panel.dataset.active=String(ctx.active);el('reminderTitle').textContent=ctx.active?'⚠ 門診重要提醒（尚待處理）':ctx.text?'門診提醒備註（已處理，可展開查看／重新啟用）':'門診提醒備註（點此新增）';el('reminderText').textContent=ctx.text;el('reminderInput').value=ctx.text;panel.open=ctx.active;controls();}
 function reset(){revision++;ctx=null;busy=false;panel.hidden=true;el('reminderInput').value='';el('reminderText').textContent='';el('reminderStatus').textContent='';}
 async function load(){reset();if(!currentPetId||!CURRENT_TENANT_ID||!CURRENT_USER?.id)return;const c=ctx={scope:scope(),tenant:CURRENT_TENANT_ID,pet:currentPetId,loaded:false,text:'',active:false},r=revision;panel.hidden=false;panel.open=true;el('reminderTitle').textContent='門診提醒讀取中…';controls();
 try{const {data,error}=await _supabase.from('pets').select('id,medical_reminder_text,medical_reminder_active').eq('tenant_id',c.tenant).eq('id',c.pet).single();if(!valid(c)||r!==revision)return;if(error)throw error;c.text=data.medical_reminder_text||'';c.active=!!data.medical_reminder_active&&!!c.text.trim();c.loaded=true;render();}
 catch(e){if(valid(c)){el('reminderTitle').textContent='⚠ 門診提醒尚未讀取成功';el('reminderStatus').textContent='無法確認是否有提醒：'+e.message+'。若尚未安裝，請先執行 medical_reminder_v91_20.sql，再按重新讀取。';controls();}}
 }
 async function save(active){const c=ctx;if(!c?.loaded||busy||!valid(c)||!allowed())return;const text=active?el('reminderInput').value.trim():c.text;if(active&&!text){el('reminderStatus').textContent='請先輸入提醒內容；已處理請按「已處理」。';return;}if(!active&&el('reminderInput').value.trim()!==c.text){el('reminderStatus').textContent='內容尚有修改，請先儲存，再標示已處理。';return;}
 busy=true;controls();el('reminderStatus').textContent='儲存中…';
 try{const {data,error}=await _supabase.from('pets').update({medical_reminder_text:text,medical_reminder_active:active}).eq('tenant_id',c.tenant).eq('id',c.pet).eq('medical_reminder_text',c.text).eq('medical_reminder_active',c.active).select('id').single();if(!valid(c))return;if(error)throw error;if(!data)throw Error('未確認儲存結果');c.text=text;c.active=active;render();el('reminderStatus').textContent=active?'✓ 已儲存，下次開啟門診會自動展開紅字提醒。':'✓ 已處理，已停止主動提醒並保留備註。';}
 catch(e){if(valid(c)){panel.open=true;el('reminderStatus').textContent='尚未確認儲存：'+e.message+'。若其他人已修改，請先保留目前文字，再重新讀取核對。';}}
 finally{if(valid(c)){busy=false;controls();}}
 }
 el('reminderSave').onclick=()=>save(true);el('reminderDone').onclick=()=>save(false);el('reminderRetry').onclick=load;
 const originalSwitch=switchTab;switchTab=function(tab,...args){const result=originalSwitch.call(this,tab,...args);if(tab==='medical')void load();return result;};
 const originalClear=clearMedicalFormInputs;clearMedicalFormInputs=function(...args){reset();return originalClear.apply(this,args);};
 const originalLogout=logoutSupabase;logoutSupabase=function(...args){reset();return originalLogout.apply(this,args);};
 document.getElementById('genblueVersionV84').textContent=' · v91.20';
})();
