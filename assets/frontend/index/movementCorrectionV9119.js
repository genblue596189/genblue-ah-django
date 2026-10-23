
let correctionOffsetV9119=0,correctionRequestV9119=0;
const correctionPanelV9119=document.createElement('details');correctionPanelV9119.className='pos-panel-v77';correctionPanelV9119.id='movementCorrectionPanelV9119';correctionPanelV9119.hidden=true;
correctionPanelV9119.innerHTML='<summary>管理者：撤銷誤記退款／現金異動</summary><p>僅用於沒有實際發生或重複登錄的款項。撤銷後有效金額為零，保留原內容與原因。實際已退還的款項請勿撤銷；金額填錯時，先撤銷錯誤紀錄，再登錄正確款項。</p><p>查詢日期依異動時間；更正影響原班別工作日。已下班也可更正，原結算保留，需重新核對受影響工作日。</p><label>起始日 <input type="date" id="correctionStartV9119"></label><label>結束日 <input type="date" id="correctionEndV9119"></label><button type="button" id="correctionSearchV9119" class="btn-secondary">查詢異動</button><p id="correctionStatusV9119" role="status" aria-live="polite"></p><div id="correctionRowsV9119"></div><button type="button" id="correctionPreviousV9119" class="btn-secondary" hidden>上一頁</button><button type="button" id="correctionNextV9119" class="btn-secondary" hidden>下一頁</button>';
document.getElementById('posMovementCardV77').after(correctionPanelV9119);
for(const id of ['correctionStartV9119','correctionEndV9119']){document.getElementById(id).value=posTaipeiDateV845();document.getElementById(id).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();void correctionLoadV9119(0);}};}
async function correctionRpcV9119(action,data){
 const scope=posScopeNowV77();if(!scope||CURRENT_PROFILE?.role!=='admin')throw Error('只有管理者可更正異動');
 const {data:result,error}=await _supabase.rpc('pos_movement_correction_v9119',{p_action:action,p_data:data});
 if(scope!==posScopeNowV77())throw Error('登入身分已變更');if(error){const failure=Error(error.message);failure.code=error.code;throw failure;}return result;
}
function correctionMessageV9119(message,error=false){const out=document.getElementById('correctionStatusV9119');out.textContent=message;out.style.color=error?'#b45309':'#15803d';}
async function correctionLoadV9119(offset=0){
 const request=++correctionRequestV9119,scope=posScopeNowV77();const box=document.getElementById('correctionRowsV9119');box.replaceChildren();
 for(const id of ['correctionPreviousV9119','correctionNextV9119'])document.getElementById(id).hidden=true;
 correctionMessageV9119('正在查詢…');
 try{
  const result=await correctionRpcV9119('list',{start:document.getElementById('correctionStartV9119').value,end:document.getElementById('correctionEndV9119').value,offset});
  if(request!==correctionRequestV9119||scope!==posScopeNowV77())return;
  if(result.tenant_id!==String(CURRENT_TENANT_ID)||!Array.isArray(result.rows))throw Error('異動查詢回覆不完整');
  correctionOffsetV9119=offset;
  for(const m of result.rows.slice(0,50)){
   const row=document.createElement('div');row.className='pos-panel-v77';
   const original=m.original||m,kind=({refund:'退款',in:'補入零鈔',out:'取出現金'})[m.kind];
   row.append(posNodeV77('p',new Date(m.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+'｜'+kind+'｜'+m.method+'｜原金額 '+posMoneyV77(original.amount)),posNodeV77('p','原原因：'+original.reason+'｜帳單／憑證：'+(m.reference||'—')),posNodeV77('p','紀錄：'+m.id+'｜工作日：'+m.business_date));
   if(m.corrected_at){const text=posNodeV77('p','已撤銷誤記｜有效金額 0｜原因：'+m.correction_reason+'｜操作人：'+m.corrected_by);text.style.color='#b45309';row.append(text);}
   else{
    const reason=document.createElement('input');reason.type='text';reason.placeholder='請填撤銷原因，例如：同筆退款重複登錄';reason.setAttribute('aria-label','撤銷原因');reason.style.width='min(100%,480px)';
    const button=posNodeV77('button','撤銷這筆誤記');button.type='button';button.className='btn-danger';
    const key=posKeyV77('movement-correction:'+m.id),pending=JSON.parse(sessionStorage.getItem(key)||'null');if(pending){reason.value=pending.reason;reason.readOnly=true;button.textContent='核對上次撤銷（不重複執行）';}
    let busy=false;
    button.onclick=async()=>{
     if(busy)return;const old=JSON.parse(sessionStorage.getItem(key)||'null'),why=(old?.reason||reason.value).trim();if(why.length<2){correctionMessageV9119('請填寫撤銷原因。',true);reason.focus();return;}
     if(!old&&!confirm('撤銷誤記 '+kind+' '+posMoneyV77(m.amount)+'（'+m.method+'）？\n紀錄：'+m.id+'\n原因：'+why+'\n請確認此筆沒有實際發生，或為重複登錄。撤銷後需重新核對工作日 '+m.business_date+'。'))return;
     busy=true;button.disabled=true;reason.disabled=true;button.textContent='正在核對撤銷…';
     try{
      const data=old||{id:crypto.randomUUID(),movement_id:m.id,expected_amount:Number(m.amount),reason:why};sessionStorage.setItem(key,JSON.stringify(data));
      const response=await correctionRpcV9119('void',data);if(response?.ok!==true||response.movement_id!==m.id)throw Error('未收到撤銷確認');
      sessionStorage.removeItem(key);button.textContent='已撤銷誤記';
      await correctionLoadV9119(correctionOffsetV9119);
      const results=await Promise.allSettled([posRefreshV77({fresh:true,required:true}),posBankLoadV845(true)]);
      const message='✓ 已撤銷誤記 '+posMoneyV77(response.original_amount)+'；有效金額為零。請重新清點並核對工作日 '+response.business_date+'。原帳單狀態與庫存不變。';
      if(scope===posScopeNowV77())correctionMessageV9119(message+(results.some(x=>x.status==='rejected')?' 部分畫面尚未更新，請按更新資料，勿重複撤銷。':''));
     }catch(error){const rejected=['P0001','22P02','22003','22007','42501','PGRST202'].includes(error.code);if(rejected)sessionStorage.removeItem(key);if(scope===posScopeNowV77()){correctionMessageV9119('尚未確認撤銷：'+error.message+'。請核對原紀錄；重試會沿用同一筆更正。若尚未安裝，請先執行 pos_movement_correction_v91_19.sql。',true);button.textContent=rejected?'撤銷這筆誤記':'核對上次撤銷（不重複執行）';button.disabled=false;reason.disabled=false;reason.readOnly=!rejected;}}
     finally{busy=false;}
    };row.append(reason,button);
   }box.append(row);
  }
  document.getElementById('correctionPreviousV9119').hidden=offset===0;document.getElementById('correctionNextV9119').hidden=result.rows.length<=50;
  correctionMessageV9119(result.rows.length?'已列出異動，請核對日期、金額及帳單號後再撤銷。':'此期間沒有退款、補入或取出紀錄。');
 }catch(error){if(request===correctionRequestV9119&&scope===posScopeNowV77())correctionMessageV9119('查詢未完成：'+error.message+'。請先執行 pos_movement_correction_v91_19.sql。',true);}
}
document.getElementById('correctionSearchV9119').onclick=()=>correctionLoadV9119(0);
document.getElementById('correctionPreviousV9119').onclick=()=>correctionLoadV9119(Math.max(0,correctionOffsetV9119-50));
document.getElementById('correctionNextV9119').onclick=()=>correctionLoadV9119(correctionOffsetV9119+50);
const correctionSwitchOriginalV9119=switchTab;
switchTab=function(tab,...args){
 const result=correctionSwitchOriginalV9119.call(this,tab,...args);correctionPanelV9119.hidden=CURRENT_PROFILE?.role!=='admin';
 if(correctionPanelV9119.hidden){correctionRequestV9119++;correctionPanelV9119.open=false;document.getElementById('correctionRowsV9119').replaceChildren();correctionMessageV9119('');}
 return result;
};
document.getElementById('genblueVersionV84').textContent=' · v91.19';
