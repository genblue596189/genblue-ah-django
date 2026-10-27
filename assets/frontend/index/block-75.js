
// v93_2: period statements are read-only views of existing invoices and cash records.
function periodEscapeV932(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function periodMoneyV932(n){return n===null||n===undefined?'待核對':'NT$ '+Number(n).toLocaleString('zh-TW',{maximumFractionDigits:2});}
function periodDateV932(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});}
function periodWarningsV932(d){const s=d.summary,out=[];if(s.issue_count)out.push(s.issue_count+'張帳單的付款或退款需核對；待核對金額不計入可確認實付淨額。');if(s.unassigned_refund_count)out.push('區間起日起，全院有'+s.unassigned_refund_count+'筆退款未對應完整原帳單號，無法判斷是否屬本寵物；須先核對才可列印彙總收據。');if(s.voided_residual)out.push('作廢帳單仍有收退款差額 '+periodMoneyV932(s.voided_residual)+'，請先處理。');return out;}
function periodReceiptBlockedV20261027(d){
 if(!d)return '請先搜尋並選定寵物，再按「查詢費用」。';
 if(d.summary.receipt_allowed)return '';
 const warnings=periodWarningsV932(d);
 if(!(Number(d.summary.paid)>0))warnings.push('目前沒有可確認的已收款紀錄。');
 if(!warnings.length)warnings.push('收退款尚未符合列印條件，請先核對帳單。');
 return '目前無法列印已收款彙總收據：'+warnings.join(' ')+' 請展開下方「待核對」帳單查看原因；需要完整清單可按「列印期間明細」。';
}
function periodDocumentV932(d,receipt=false){
 const e=periodEscapeV932,m=n=>e(periodMoneyV932(n)),date=v=>e(periodDateV932(v)),s=d.summary;
 if(receipt&&!s.receipt_allowed)throw Error('收退款仍需核對或尚無已收款，不能列印已收款彙總收據');
 const title=receipt?'已收款彙總收據（原單彙整）':'期間費用明細';
 const rows=d.invoices.filter(i=>!receipt||(!i.test_excluded&&!i.voided_at&&!i.issue&&i.paid>0));
 const body=rows.map(i=>{
  const state=i.test_excluded?'測試帳單（不計入期間彙總）':i.voided_at?'已作廢（不計費用）':i.issue?'待核對':i.due>0?(i.paid>0?'部分付款':'未付款'):'已付款';
  const items=(i.items||[]).map(x=>'<tr><td>'+e(x.name)+'</td><td>'+e(x.quantity)+'</td><td>'+m(x.unit_price)+'</td><td>'+m(x.subtotal)+'</td></tr>').join('');
  const payments=i.manual_verified?'管理者核對歷史已收款（非本日收款）：'+e(i.reconciliation?.method||'')+' '+m(i.paid)+'；原因：'+e(i.reconciliation?.reason||''):(i.payments||[]).map(p=>date(p.date)+' '+e(p.method)+' '+m(p.allocated)).join('；')||'無對應金流';
  const refunds=(i.refunds||[]).map(p=>date(p.date)+' '+e(p.method)+' '+m(p.amount)).join('；')||'無';
  return '<section class="invoice"><h3>'+date(i.event_at)+'｜'+e(state)+'</h3><p>原帳單：'+e(i.id)+'<br>開單：'+date(i.created_at)+(i.family_id?'<br>合併收款批次：'+e(i.family_id):'')+'</p><table><thead><tr><th>項目</th><th>數量</th><th>單價</th><th>原價小計</th></tr></thead><tbody>'+items+'</tbody></table><p>折扣 '+m(i.discount)+'｜帳單金額 '+m(i.total)+'｜已收款 '+m(i.paid)+'｜退款 '+m(i.refunded)+'｜實付淨額 '+m(i.net)+'｜未付款 '+m(i.due)+'</p><p class="small">收款：'+payments+'<br>退款：'+refunds+'</p>'+(i.issue?'<p class="warning">'+e(i.issue)+'</p>':'')+(i.voided_at?'<p>作廢日期：'+date(i.voided_at)+'；原因：'+e(i.void_reason)+'</p>':'')+'</section>';
 }).join('');
 const pending=receipt?'':d.pending.map(q=>'<section class="invoice"><h3>'+date(q.event_at)+'｜雲端待付款（不列入已收款）</h3><p>待付款單：'+e(q.id)+'｜'+e(q.dispensing)+'</p><table><thead><tr><th>項目</th><th>數量</th><th>金額</th></tr></thead><tbody>'+(q.items||[]).map(x=>'<tr><td>'+e(x.item_name||x.name)+'</td><td>'+e(x.quantity)+'</td><td>'+m(Number(x.quantity)*Number(x.unit_price))+'</td></tr>').join('')+'</tbody></table><p>待付金額（含原單折扣）：'+m(q.total)+'</p></section>').join('');
 return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>'+e(title)+'</title><style>@page{size:A4;margin:13mm}body{font-family:"Microsoft JhengHei",sans-serif;color:#18251b;font-size:11px;line-height:1.6}h1{font-size:21px;margin:4px 0}h2{font-size:15px}h3{font-size:12px;margin:12px 0 4px}p{margin:4px 0;overflow-wrap:anywhere}.invoice{border-top:1px solid #b6bfb6;padding-top:4px;margin-top:12px}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th,td{border-bottom:1px solid #ddd;padding:5px;text-align:right;overflow-wrap:anywhere}th:first-child,td:first-child{text-align:left;width:52%}tr{break-inside:avoid}h3{break-after:avoid}.summary{padding:9px;background:#f1f5ed;border:1px solid #b6bfb6}.warning{color:#a12618;font-weight:bold}.small,footer{font-size:10px;color:#485449}footer{border-top:1px solid #bbb;margin-top:15px;padding-top:6px}</style></head><body><h2>'+e(d.clinic.name||'動物醫院')+'</h2><p>'+e(d.clinic.phone||'')+' '+e(d.clinic.address||'')+'</p><h1>'+e(title)+'</h1><p>飼主：'+e(d.owner.name)+'｜寵物：'+e(d.pet.name)+'（'+e(d.pet.species)+'）｜病歷號：'+e(d.owner.system_code||d.owner.owner_code||'—')+'</p><p>範圍：'+e(d.from)+'～'+e(d.to)+'；'+(d.basis==='visit'?'依就診日，無掛號則依開單日':'依帳單建立日')+'。收退款累計至 '+date(d.as_of)+'（台灣時間）。僅限本寵物及目前飼主名下帳單。</p><div class="summary">'+(receipt?'本次彙總已收款 '+m(s.paid)+'｜扣除退款 '+m(s.refunded)+'｜彙總實付淨額 <b>'+m(s.net)+'</b>':'期間費用（含未付款） '+m(s.billed)+'｜可核對已收款 '+m(s.paid)+'｜對應退款 '+m(s.refunded)+'｜可核對實付淨額 '+m(s.net)+'｜未付款 '+m(s.due)+'｜待核對 '+m(s.unknown))+'</div>'+periodWarningsV932(d).map(w=>'<p class="warning">'+e(w)+'</p>').join('')+'<p class="small">作廢或確認為測試的帳單不計入期間費用；未付款不列入收據合計。'+(receipt?'部分付款帳單僅彙整已收到的款項。':'待核對項目未作付款推定。')+'</p>'+body+pending+'<footer>本表依既有帳單及收退款紀錄彙整，未新增收款、未扣庫存。彙總收據與原收據請勿重複計入費用。退款可發生於所選期間之後，已依查詢時點一併扣除。</footer></body></html>';
}
(function(){
 const el=id=>document.getElementById(id),node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;},scope=()=>posScopeNowV77();
 const allowed=()=>!!scope()&&(CURRENT_PROFILE?.role==='admin'||(CURRENT_PROFILE?.permission_checkout??(CURRENT_PROFILE?.role==='staff'||(CURRENT_PROFILE?.role==='doctor'&&CURRENT_PROFILE?.can_checkout===true))));
 const panel=node('details');panel.id='periodFeePanelV932';panel.className='card';panel.hidden=true;
 panel.innerHTML='<summary style="font-weight:bold;font-size:1.05rem">期間費用明細／彙總收據</summary><p>搜尋並選定一隻寵物，查詢目前飼主名下的期間帳單。只查詢與列印，不會重新收款或扣庫存。</p><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="periodSearchV932" type="search" placeholder="寵物／飼主／電話／病歷號，Enter搜尋" aria-label="搜尋期間費用寵物"><button id="periodSearchButtonV932" type="button">搜尋</button></div><p id="periodSelectedV932" role="status">尚未選定寵物。</p><div id="periodMatchesV932"></div><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:12px 0"><label>日期依據 <select id="periodBasisV932"><option value="visit">就診日（無掛號則依開單日）</option><option value="issued">帳單建立日</option></select></label><label>起日 <input id="periodFromV932" type="date"></label><label>迄日 <input id="periodToV932" type="date"></label><button id="periodLoadV932" type="button" style="background:#52794c">查詢費用</button><button id="periodPrintDetailV932" type="button" style="background:#2563eb">列印期間明細</button><button id="periodPrintReceiptV932" type="button" style="background:#c2410c">列印已收款彙總收據</button></div><p>收退款累計至查詢時點；不只統計區間內發生的退款。舊單缺金流、合併款無法明確分攤時，會標示待核對。</p><p id="periodMessageV932" role="status" aria-live="polite"></p><div id="periodResultV932"></div>';
 const anchor=el('med792-context');if(anchor)anchor.after(panel);else el('owners_pets').prepend(panel);
 const home=node('button','期間費用／彙總收據');home.id='homePeriodFeesV932';home.type='button';home.className='btn-secondary';home.hidden=true;el('homeNewRegistrationV931').after(home);
 const day=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(date),now=new Date();el('periodFromV932').value=day(new Date(now.getTime()-30*86400000));el('periodToV932').value=day(now);el('periodToV932').max=day(now);el('periodFromV932').max=day(now);
 let selected=null,state=null,busy=false,request=0,frames=new Set();const message=(t,error=false)=>{const target=el('periodMessageV932');target.textContent=t;target.style.color=error?'#b91c1c':'';};
 function buttons(){el('periodSearchButtonV932').disabled=busy;el('periodLoadV932').disabled=busy||!selected;el('periodPrintDetailV932').disabled=busy||!state;el('periodPrintReceiptV932').disabled=busy;}
 function resetResult(){request++;state=null;el('periodResultV932').replaceChildren();buttons();}
 function reset(){request++;selected=null;state=null;el('periodSearchV932').value='';el('periodMatchesV932').replaceChildren();el('periodResultV932').replaceChildren();el('periodSelectedV932').textContent='尚未選定寵物。';message('');for(const f of frames)f.remove();frames.clear();buttons();}
 function access(){panel.hidden=home.hidden=!allowed();if(!allowed())reset();}
 home.onclick=()=>{if(!allowed()){alert('需要收費權限');return;}switchTab('owners_pets');if(!el('owners_pets').classList.contains('active'))return;panel.open=true;panel.scrollIntoView?.({behavior:'smooth',block:'start'});el('periodSearchV932').focus({preventScroll:true});};
 async function rpc(action,data){const s=scope(),tenant=CURRENT_TENANT_ID,user=CURRENT_USER?.id;
  if(action==='search'){const {data:r,error}=await _supabase.rpc('period_fees_v932',{p_action:action,p_data:data});if(s!==scope())throw Error('登入身分已變更');if(error)throw Error(error.message);if(r?.tenant_id!==tenant)throw Error('院所回覆不符');return r;}
  const {data:{session},error}=await _supabase.auth.getSession();if(error||!session?.access_token||session.user?.id!==user||s!==scope())throw Error('登入已變更，請重新登入。');
  const response=await fetch('/api/period-reconciliation/',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,data}),cache:'no-store'});
  const result=await response.json();if(s!==scope()||CURRENT_USER?.id!==user)throw Error('登入已變更，請重新登入核對。');
  if(!response.ok){const failure=Error((result.error||'核對結果尚未確認')+'；請重新查詢。若尚未安裝核對功能，請先執行更新包內的核對 SQL。');failure.definitive=[400,403,409].includes(response.status);throw failure;}
  if(result.user_id!==user||result.data?.tenant_id!==tenant)throw Error('院所或登入回覆不符');return result.data;
 }
 async function run(fn){if(busy){message('正在處理，請稍候。');return;}if(!allowed()){message('需要本院收費權限');return;}busy=true;const token=++request,s=scope();buttons();message('正在讀取…');try{await fn(()=>token===request&&s===scope());}catch(e){if(s===scope()&&token===request)message(e.message);}finally{busy=false;buttons();}}
 function select(p){selected=p;resetResult();el('periodSelectedV932').textContent='已選定：'+p.name+'｜飼主：'+p.owner_name+'｜病歷號：'+(p.system_code||p.owner_code||'—');el('periodMatchesV932').replaceChildren();message('請選擇日期並按查詢費用。');buttons();}
 el('periodSearchButtonV932').onclick=()=>run(async valid=>{const q=el('periodSearchV932').value.trim();if(!q)throw Error('請輸入搜尋文字');selected=null;state=null;const r=await rpc('search',{query:q});if(!valid())return;el('periodMatchesV932').replaceChildren();el('periodResultV932').replaceChildren();el('periodSelectedV932').textContent='請從下列結果選定寵物。';for(const p of r.matches){const b=node('button',p.name+'（'+p.species+'）｜'+p.owner_name+'｜'+(p.system_code||p.owner_code||'—')+'｜'+(p.mobile||p.phone||''));b.type='button';b.className='btn-secondary';b.style.margin='5px';b.onclick=()=>select(p);el('periodMatchesV932').append(b);}message(r.matches.length?(r.has_more?'只顯示前50筆，請增加搜尋條件。':'請點選正確的寵物。'):'沒有找到符合的寵物。');});
 el('periodSearchV932').oninput=()=>{selected=null;resetResult();el('periodMatchesV932').replaceChildren();el('periodSelectedV932').textContent='搜尋文字已變更，請重新搜尋並選定寵物。';};
 el('periodSearchV932').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();e.stopPropagation();el('periodSearchButtonV932').click();}};
 for(const id of ['periodBasisV932','periodFromV932','periodToV932'])el(id).onchange=()=>{resetResult();message('條件已變更，請重新查詢。');};
 for(const id of ['periodFromV932','periodToV932'])el(id).onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();e.stopPropagation();if(id==='periodFromV932')el('periodToV932').focus();else el('periodLoadV932').click();}};
 function params(){if(!selected)throw Error('請先搜尋並選定寵物');const from=el('periodFromV932').value,to=el('periodToV932').value;if(!from||!to||from>to)throw Error('請選擇有效日期區間');return{pet_id:selected.id,owner_id:selected.owner_id,from,to,basis:el('periodBasisV932').value};}
 const reconciliationPending=new Map();
 function reconciliationControls(i){
  const wrap=node('div');wrap.className='card';wrap.style.cssText='border:1px solid #b9cbb9;padding:10px;margin:8px 0';
  const old=i.reconciliation,active=old&&['paid','test','stale'].includes(old.status);
  if(old){const labels={paid:'已核對歷史收款',test:'已標記測試帳單',stale:'原帳單已變更，原核對暫不生效',revoked:'已撤銷核對'};wrap.append(node('p',(labels[old.status]||old.status)+'｜管理者 '+(old.actor||'—')+'｜'+periodDateV932(old.at)+'｜原因：'+(old.reason||'—')+(old.method?'｜方式：'+old.method:'')));}
  if(CURRENT_PROFILE?.role!=='admin')return wrap;
  if(!active&&i.issue!=='舊帳單標示已付，但缺少對應金流紀錄')return wrap;
  const select=node('select');select.setAttribute('aria-label','核對方式');
  for(const [value,label] of active?[['revoke','撤銷本次核對']]:[['','請選擇處理方式'],['confirm_paid','確認歷史已收款'],['exclude_test','確認為測試帳單（排除期間彙總）']]){const option=node('option',label);option.value=value;select.append(option);}
  const amount=node('input');amount.type='number';amount.min='0.01';amount.step='0.01';amount.placeholder='實收金額';amount.setAttribute('aria-label','歷史實收金額');amount.value=String(i.total??'');
  const method=node('select');method.setAttribute('aria-label','付款方式');for(const name of ['請選擇付款方式','現金','信用卡','轉帳','行動支付','其他']){const option=node('option',name);option.value=name==='請選擇付款方式'?'':name;method.append(option);}
  const reason=node('input');reason.type='text';reason.maxLength=500;reason.placeholder=active?'請輸入撤銷原因':'請輸入核對依據或原因';reason.setAttribute('aria-label','核對原因');
  const update=()=>{amount.hidden=method.hidden=select.value!=='confirm_paid';};select.onchange=update;update();
  const save=node('button',active?'撤銷核對':'儲存管理者核對');save.type='button';save.style.cssText='background:#9a3412;color:white;margin:6px';
  const note=node('p','只用於期間費用彙總；不新增收款、不改變當日錢櫃或原帳單。');
  save.onclick=()=>run(async valid=>{
   const action=select.value,why=reason.value.trim(),sum=amount.value.trim(),payMethod=method.value;
   if(!['confirm_paid','exclude_test','revoke'].includes(action))throw Error('請選擇處理方式');
   if(why.length<2||why.length>500)throw Error('請輸入至少2個字的核對原因');
   if(action==='confirm_paid'&&(!Number.isFinite(Number(sum))||Number(sum)<=0||Number(sum)>Number(i.total)||!payMethod))throw Error('請填有效實收金額與付款方式');
   const payload={report:params(),invoice_id:i.id,request_id:crypto.randomUUID(),reason:why,expected_audit_id:old?.audit_id||''};
   if(action!=='revoke')payload.invoice_hash=i.invoice_hash;
   if(action==='confirm_paid'){payload.amount=sum;payload.method=payMethod;}
   const key=scope()+'|'+i.id,previous=reconciliationPending.get(key),fingerprint=JSON.stringify([action,{...payload,request_id:''}]);
   if(previous&&previous.fingerprint!==fingerprint)throw Error('上次核對結果尚未確認，請保留原內容重試，或重新查詢核對。');
   if(!previous&&!confirm(action==='confirm_paid'?'確定已根據紀錄核對這筆歷史收款？這不會新增當日收入。':action==='exclude_test'?'確定此筆為測試帳單，並從期間費用彙總排除？':'確定撤銷管理者核對？'))return;
   const entry=previous||{action,payload,fingerprint};reconciliationPending.set(key,entry);
   let d;try{d=await rpc(entry.action,entry.payload);}catch(error){if(error.definitive)reconciliationPending.delete(key);throw error;}if(!valid())return;reconciliationPending.delete(key);render(d);message(action==='revoke'?'已撤銷核對，請重新核對此帳單。':'管理者核對已儲存；期間費用已重新計算。');
  });
  wrap.append(select,amount,method,reason,save,note);return wrap;
 }
 function render(d){state=d;const box=el('periodResultV932');box.replaceChildren();const heading=node('h3',d.owner.name+'／'+d.pet.name+'｜'+d.from+'～'+d.to);box.append(heading);const s=d.summary;box.append(node('p','期間費用（含未付款）：'+periodMoneyV932(s.billed)+'｜可核對已收款：'+periodMoneyV932(s.paid)+'｜對應退款：'+periodMoneyV932(s.refunded)+'｜可核對實付淨額：'+periodMoneyV932(s.net)+'｜未付款：'+periodMoneyV932(s.due)+'｜待核對：'+periodMoneyV932(s.unknown)));box.append(node('p','有效帳單 '+s.invoice_count+' 張，雲端待付款 '+s.pending_count+' 筆，作廢 '+s.voided_count+' 張（不計費用）。收退款累計至 '+periodDateV932(d.as_of)+'。'));for(const w of periodWarningsV932(d)){const p=node('p',w);p.style.color='#b91c1c';box.append(p);}
  for(const i of d.invoices){const detail=node('details');detail.className='card';if(i.issue)detail.dataset.periodNeedsReview='true';detail.append(node('summary',periodDateV932(i.event_at)+'｜'+(i.test_excluded?'測試帳單（不計入期間彙總）':i.voided_at?'作廢':i.issue?'待核對':i.due>0?'未付清':i.manual_verified?'管理者核對已收款':'已付款')+'｜帳單 '+periodMoneyV932(i.total)+'｜實付淨額 '+periodMoneyV932(i.net)));detail.append(node('p','原帳單：'+i.id+'；開單 '+periodDateV932(i.created_at)));detail.append(node('p','已收 '+periodMoneyV932(i.paid)+'／退款 '+periodMoneyV932(i.refunded)+'／未付 '+periodMoneyV932(i.due)));if(i.issue){const warning=node('p',i.issue);warning.style.color='#b91c1c';detail.append(warning);}if(i.reconciliation||i.issue==='舊帳單標示已付，但缺少對應金流紀錄')detail.append(reconciliationControls(i));for(const it of i.items)detail.append(node('p',it.name+' ×'+it.quantity+'：'+periodMoneyV932(it.subtotal)));for(const pay of i.payments)detail.append(node('p','收款 '+periodDateV932(pay.date)+' '+pay.method+'：'+periodMoneyV932(pay.allocated)));for(const ref of i.refunds)detail.append(node('p','退款 '+periodDateV932(ref.date)+' '+ref.method+'：'+periodMoneyV932(ref.amount)));box.append(detail);}
  for(const q of d.pending){const detail=node('details');detail.className='card';detail.append(node('summary',periodDateV932(q.event_at)+'｜雲端待付款 '+periodMoneyV932(q.total)));detail.append(node('p','待付款單 '+q.id+'｜'+q.dispensing));for(const x of q.items)detail.append(node('p',(x.item_name||x.name)+' ×'+x.quantity+'：'+periodMoneyV932(Number(x.quantity)*Number(x.unit_price))));box.append(detail);}buttons();
 }
 el('periodLoadV932').onclick=()=>run(async valid=>{const p=params();state=null;buttons();const d=await rpc('report',p);if(!valid())return;render(d);message(d.summary.receipt_allowed?'查詢完成，可列印明細或已收款彙總收據。':'查詢完成，可列印期間明細；已收款彙總收據尚未符合核對條件。');});
 async function print(receipt){if(receipt&&!busy){const why=periodReceiptBlockedV20261027(state);if(why){message(why,true);for(const detail of el('periodResultV932').querySelectorAll('details[data-period-needs-review]'))detail.open=true;el('periodMessageV932').scrollIntoView?.({behavior:'smooth',block:'nearest'});return;}}return run(async valid=>{if(!state)throw Error('請先查詢期間費用');const previous=state.revision,d=await rpc('report',params());if(!valid())return;if(d.revision!==previous){render(d);message('帳款資料已更新，請核對新結果後再按列印。');return;}render(d);if(receipt&&!d.summary.receipt_allowed){message(periodReceiptBlockedV20261027(d),true);for(const detail of el('periodResultV932').querySelectorAll('details[data-period-needs-review]'))detail.open=true;return;}const html=periodDocumentV932(d,receipt),frame=node('iframe');frame.title=receipt?'期間已收款彙總收據列印':'期間費用明細列印';frame.style.cssText='position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0';frame.setAttribute('sandbox','allow-same-origin allow-modals');frames.add(frame);frame.onload=()=>{if(!valid()){frame.remove();frames.delete(frame);return;}try{frame.contentWindow.onafterprint=()=>{frame.remove();frames.delete(frame);};frame.contentWindow.focus();frame.contentWindow.print();message('已開啟列印視窗。未新增任何交易。');}catch(e){message('無法開啟列印：'+e.message);frame.remove();frames.delete(frame);}};frame.srcdoc=html;document.body.append(frame);setTimeout(()=>{frame.remove();frames.delete(frame);},60000);});}
 el('periodPrintDetailV932').onclick=()=>print(false);el('periodPrintReceiptV932').onclick=()=>print(true);
 const previousProfile=loadCurrentUserProfile;loadCurrentUserProfile=async function(){const r=await previousProfile.apply(this,arguments);access();return r;};
 const previousLogout=logoutSupabase;logoutSupabase=function(){reset();panel.open=false;panel.hidden=home.hidden=true;return previousLogout.apply(this,arguments);};
 access();buttons();el('genblueVersionV84').textContent=' · v94_9';
})();

