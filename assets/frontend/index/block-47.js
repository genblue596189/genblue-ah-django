
// v77: cloud pending bills, atomic cash ledger and shift reconciliation.
let posStateV77=null,posScopeV77='',posBusyV77=false,posLoadingV77=false,posSelectedV77=null,posEditV77=null;
const posDenomsV77=[2000,1000,500,200,100,50,20,10,5,1];
function posScopeNowV77(){return CURRENT_USER?.id&&CURRENT_TENANT_ID?CURRENT_USER.id+'|'+CURRENT_TENANT_ID:'';}
function posMedicalV77(){return CURRENT_PROFILE?.role==='admin'||(CURRENT_PROFILE?.permission_clinical??CURRENT_PROFILE?.role==='doctor');}
function posNodeV77(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
function posButtonV77(text,fn){const b=posNodeV77('button',text);b.type='button';b.className='btn-secondary';b.onclick=()=>posActionV77(fn);return b;}
function posInputV77(type,value){const e=posNodeV77('input');e.type=type;e.value=value??'';if(type==='number')e.min='0';return e;}
function posLabelV77(label,input,parent){const l=posNodeV77('label',label+' ');l.append(input);parent.append(l);return input;}
function posMoneyV77(n){return 'NT$ '+Number(n||0).toLocaleString('zh-TW',{maximumFractionDigits:2});}
function posMethodV77(value){if(/現金|Cash/.test(value))return '現金';if(/信用卡|Credit Card/.test(value))return '信用卡';if(/轉帳/.test(value))return '轉帳';if(/行動支付|LinePay/.test(value))return '行動支付';throw Error('未付款不能列入收款，請送至待付款');}
function posTotalsV77(d){const sub=d.lines.reduce((s,l)=>s+Number(l.quantity)*Number(l.unit_price),0)+d.medicationGroups.reduce((s,g)=>s+Number(g.price),0);const discount=Number(d.discount);if(!Number.isFinite(sub)||!Number.isFinite(discount)||discount<0||discount>sub)throw Error('折扣或合計不正確');d.subtotal=sub;d.total=sub-discount;return d;}
async function posCheckoutDjangoV7(action,data,base='/api/checkout/'){
 const scope=posScopeNowV77(),tenant=String(CURRENT_TENANT_ID),userId=CURRENT_USER?.id;
 const pendingChange=['edit','cancel','dispensing'].includes(action);
 const unconfirmed=pendingChange?'待付款變更結果尚未確認，請重新載入原帳單核對，勿直接重送或另建帳單':'收款結果尚未確認，請保留帳單並核對上次收款';
 if(!scope)throw Error('請先登入');
 const {data:{session},error}=await _supabase.auth.getSession();if(error)throw error;
 if(!session||session.user.id!==userId||scope!==posScopeNowV77())throw Error('登入身分已變更，請保留帳單並核對原操作');
 const response=await fetch(base+action+'/',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'});
 const result=await response.json();
 if(scope!==posScopeNowV77())throw Error('登入身分已變更，請回原帳號核對這次操作結果');
 if(!response.ok){const e=Error(result.error||unconfirmed);if(result.code)e.code=result.code;throw e;}
 if(result.tenant_id!==tenant||result.user_id!==userId)throw Error('院所／身分回覆不符，請保留帳單並核對原操作');
 return result.data;
}
async function posRpcV77(action,data={}){const scope=posScopeNowV77();if(!scope)throw Error('請先登入');if(['stage','direct','pay','edit','cancel'].includes(action))return posCheckoutDjangoV7(action,data);if(['list','work_list_v854','finance_status','reissue_links_v854','daily_summary','bank_pending','dispensing'].includes(action))return posCheckoutDjangoV7(action,data,'/api/pos/');const {data:result,error}=await _supabase.rpc('pos_v77',{p_action:action,p_data:data});if(scope!==posScopeNowV77())throw Error('登入身分已變更');if(error){const e=Error(error.message);e.code=error.code;throw e;}return result;}
function posRejectedV77(e){return /^(GB_REQUEST_REJECTED|P0001|42501|22[0-9A-Z]{3}|23[0-9A-Z]{3}|40001|40P01)$/.test(e.code||'');}
async function posFrozenRpcV77(action,key,data){const frozen=posFrozenV77(key,data);try{const r=await posRpcV77(action,frozen);sessionStorage.removeItem(posKeyV77(key));return r;}catch(e){if(posRejectedV77(e))sessionStorage.removeItem(posKeyV77(key));throw e;}}
async function posActionV77(fn){if(posBusyV77){document.getElementById('posMessageV77').textContent='正在處理，請稍候，勿重複操作。';return;}posBusyV77=true;document.getElementById('posMessageV77').textContent='正在處理…';try{await fn();}catch(e){document.getElementById('posMessageV77').textContent=e.message;alert(e.message+'。資料保留，請核對後再操作。');}finally{posBusyV77=false;}}
let posRefreshPromiseV84=null,posRefreshPromiseScopeV84='',posRefreshErrorV84=null;
async function posRefreshV77(options={}){
 const scope=posScopeNowV77();if(!scope){posStateV77=null;if(options.required)throw Error('請先登入');return null;}
 // Join background work rather than silently returning before it completes.
 // After mutations or before payment, follow it with a fresh server read.
 if(posRefreshPromiseV84&&posRefreshPromiseScopeV84===scope){
  const result=await posRefreshPromiseV84;
  if(!options.fresh){if(options.required&&!result)throw posRefreshErrorV84||Error('無法確認當班資料，請重新更新');return result;}
  if(scope!==posScopeNowV77())throw Error('登入身分已變更');
 }
 if(posRefreshPromiseV84&&posRefreshPromiseScopeV84===scope)return posRefreshV77(options);
 posLoadingV77=true;posRefreshPromiseScopeV84=scope;
 if(posScopeV77!==scope){posStateV77=null;posSelectedV77=null;posEditV77=null;document.getElementById('posQueueV77').replaceChildren();document.getElementById('posEditorV77').replaceChildren();document.getElementById('posPaidRowsV854')?.replaceChildren();document.getElementById('posReissueRowsV854')?.replaceChildren();posPaidOffsetV854=0;posReissueOffsetV854=0;posWorkRequestV854++;}
 const task=(async()=>{
  try{
   const state=await posRpcV77('list');if(state.tenant_id!==String(CURRENT_TENANT_ID))throw Error('院所回覆不符');
   if(posScopeV77!==scope){posSelectedV77=null;posEditV77=null;posScopeV77=scope;}
   state.shift=state.shift?.id?state.shift:null;posStateV77=state;posRefreshErrorV84=null;
   posRenderV77();renderAppointmentTable(activeAppointmentsList);document.getElementById('posMessageV77').textContent='已同步雲端待付款及當班紀錄';return state;
  }catch(error){
   if(scope===posScopeNowV77()){posRefreshErrorV84=error;document.getElementById('posMessageV77').textContent='當班資料未同步：'+error.message+'；請更新資料後再收款。';}
   return null;
  }finally{if(posRefreshPromiseV84===task){posRefreshPromiseV84=null;posLoadingV77=false;}}
 })();
 posRefreshPromiseV84=task;const result=await task;
 if(options.required&&!result)throw posRefreshErrorV84||Error('無法確認當班資料，請重新更新');return result;
}
async function posRequireShiftV84(){
 const state=await posRefreshV77({fresh:true,required:true});
 if(!state?.shift?.id)throw Error('目前未開始工作，請按「今日工作」');
 return state.shift;
}

function posKeyV77(suffix){return 'genblue-pos-v77:'+posScopeNowV77()+':'+suffix;}
function posFrozenV77(key,data){const k=posKeyV77(key);const previous=JSON.parse(sessionStorage.getItem(k)||'null');if(previous)return previous;const frozen={...data,id:crypto.randomUUID()};sessionStorage.setItem(k,JSON.stringify(frozen));return frozen;}
function posReceiptV77(result,d,method,kind='clinic'){
 const id=typeof result==='string'?result:result.invoice_id;
 if(!id)return;
 openReceiptModal({id,created_at:new Date().toISOString(),checkout_type:(kind==='retail'?'商品零售':d.lines.some(l=>l.stock_kind==='item')?'門診＋商品':'門診收費')+' ('+method+')',subtotal:d.subtotal,discount:d.discount,total_amount:d.total},escapeCheckoutText(d.ownerName),escapeCheckoutText(d.billingPetName),
 [...d.lines,...d.medicationGroups.map(g=>({item_name:medicationGroupLabelsV64[g.kind]||g.kind,quantity:1,unit_price:g.price}))].map(l=>({...l,item_name:escapeCheckoutText(l.item_name),subtotal:l.quantity*l.unit_price})));
}
function posTenderV77(method,total){if(method!=='現金')return null;const text=prompt('應收 '+posMoneyV77(total)+'\n請輸入飼主交付現金（只記應收金額為收入）',String(total));if(text===null)throw Error('收款已取消');const tender=Number(text);if(!Number.isFinite(tender)||tender<total)throw Error('收到現金不足');if(!confirm('收到 '+posMoneyV77(tender)+'\n找零 '+posMoneyV77(tender-total)+'\n確認完成收款？'))throw Error('收款已取消');return tender;}
async function posStageV77(){
 if(!(posMedicalV77()||familyAllowedV74()))throw Error('沒有送出帳單權限');
 const d=collectInvoiceDraftV74();if(!d.billingAppointmentId)throw Error('請從本次掛號門診轉入收費');
 if(familyHasAppointmentV74(d.billingAppointmentId))throw Error('此帳單已在本機合併待收，請先修改明細移回收費頁');
 const frozen=posFrozenV77('stage:'+d.billingAppointmentId,{draft:JSON.parse(JSON.stringify(d))});
 let result;try{result=await posRpcV77('stage',frozen);}catch(e){if(posRejectedV77(e))sessionStorage.removeItem(posKeyV77('stage:'+d.billingAppointmentId));throw e;}if(!result.id)throw Error('未取得待付款確認');
 sessionStorage.removeItem(posKeyV77('stage:'+d.billingAppointmentId));
 // The cloud copy owns all fee details from this point.
 clearFamilyBillV74();doctorVisitV51=null;currentPetId=null;currentOwnerId=null;
 await posRefreshV77();switchTab('appointments');await loadAppointments();
 alert('已送至雲端待付款。尚未收款、尚未扣庫存；櫃台可從另一台電腦接手。');
}
async function posDirectV77(name,args){
 let activeShift;try{activeShift=await posRequireShiftV84();}catch(e){e.code=e.code||'GB_LOCAL_PREPARE';throw e;}
 const method=name==='checkout_family_v74'?posMethodV77(args.p_entries[0].p_checkout_type):
 args.p_category==='門診'?posMethodV77(args.p_checkout_type):document.getElementById('posRetailMethodV77').value;
 const total=name==='checkout_family_v74'?args.p_entries.reduce((s,e)=>s+Number(e.p_total),0):Number(args.p_total);
 const key='direct';const prior=JSON.parse(sessionStorage.getItem(posKeyV77(key))||'null');
 if(prior&&JSON.stringify(prior.payload)!==JSON.stringify({name,args}))throw Error('上一筆收款結果未確認，請先按「核對上次收款」，勿改用新帳單收費');
 let frozen=prior;if(!frozen){let tendered;try{tendered=posTenderV77(method,total);}catch(e){e.code='GB_LOCAL_PREPARE';throw e;}frozen=posFrozenV77(key,{payload:{name,args},method,shift_id:activeShift.id,tendered});}
 let result;try{result=await posRpcV77('direct',frozen);}catch(e){if(posRejectedV77(e))sessionStorage.removeItem(posKeyV77(key));throw e;}sessionStorage.removeItem(posKeyV77(key));void posRefreshV77({fresh:true}).catch(()=>{});return result;
}
async function posFamilyRpcV77(args){try{return {data:await posDirectV77('checkout_family_v74',args),error:null};}catch(e){return {data:null,error:{message:e.message,code:e.code}};}}
async function posRecoverV77(){
 const saved=JSON.parse(sessionStorage.getItem(posKeyV77('direct'))||'null');if(!saved)throw Error('沒有待核對的直接收款');
 const result=await posRpcV77('direct',saved);sessionStorage.removeItem(posKeyV77('direct'));await posRefreshV77();
 const entries=saved.payload.name==='checkout_family_v74'?saved.payload.args.p_entries:[saved.payload.args];
 const lines=entries.flatMap(e=>[...e.p_lines,...(e.p_medication_groups||[]).map(g=>({item_name:medicationGroupLabelsV64[g.kind]||g.kind,quantity:1,unit_price:g.price}))]);
 openReceiptModal({id:typeof result==='string'?result:result.invoice_id||result.request_id,created_at:new Date().toISOString(),checkout_type:saved.method,subtotal:entries.reduce((s,e)=>s+e.p_subtotal,0),discount:entries.reduce((s,e)=>s+e.p_discount,0),total_amount:entries.reduce((s,e)=>s+e.p_total,0)},'已核對收款（詳見帳單）','',lines.map(l=>({...l,item_name:escapeCheckoutText(l.item_name),subtotal:l.quantity*l.unit_price})));
 clearFamilyBillV74();document.getElementById('productCheckoutItems').replaceChildren();calculateProductTotal();
 const state=familyStateNowV74();if(state?.pending)persistFamilyV74({...state,entries:[],pending:null,requestId:null});renderFamilyV74();
 alert('上次收款已確認。請核對帳單，不需再次收取現金。');
}
async function posPayV77(q,method){
 const activeShift=await posRequireShiftV84();
 const key='pay:'+q.id;const saved=JSON.parse(sessionStorage.getItem(posKeyV77(key))||'null');
 const frozen=saved||posFrozenV77(key,{pending_id:q.id,version:q.version,method,shift_id:activeShift.id,tendered:posTenderV77(method,q.draft.total)});
 let result;try{result=await posRpcV77('pay',frozen);}catch(e){if(posRejectedV77(e))sessionStorage.removeItem(posKeyV77(key));throw e;}sessionStorage.removeItem(posKeyV77(key));
 try{markServiceChargesPaid(q.draft.serviceIds||[],typeof result==='string'?result:result.invoice_id);}catch{}
 posReceiptV77(result,q.draft,frozen.method);posSelectedV77=null;posEditV77=null;
 await Promise.allSettled([loadItems(),loadMedicines(),loadAppointments()]);await posRefreshV77();
}
function posRenderV77(){
 const s=posStateV77,can=familyAllowedV74();document.getElementById('posHomeV77').hidden=!(s&&(can||posMedicalV77()));
 document.getElementById('nav-posTabV77').style.display=can||posMedicalV77()?'':'none';document.getElementById('nav-posShiftTabV77').style.display=can?'':'none';
 if(!s)return;s.shift=s.shift?.id?s.shift:null;document.getElementById('posHomeCountV77').textContent=s.pending.length+' 筆';
 document.getElementById('posStageV77').hidden=!(can||posMedicalV77());document.getElementById('posDeskV77').hidden=!can;
 const queue=document.getElementById('posQueueV77');queue.replaceChildren();
 if(!s.pending.length)queue.append(posNodeV77('p','目前沒有雲端待付款帳單'));
 for(const q of s.pending){const row=posNodeV77('div');row.className='pos-row-v77';row.append(posNodeV77('span',(q.draft.ownerName||'飼主')+'｜'+q.draft.billingPetName+'｜'+posMoneyV77(q.draft.total)));posProgressV854(q,row);
 if(can)row.append(posButtonV77('接手／核對明細',()=>{if(posEditV77&&!confirm('放棄尚未儲存的修改？'))return;posSelectedV77=q.id;posEditV77=JSON.parse(JSON.stringify(q.draft));posRenderEditorV77(q);}));
 if(posMedicalV77()||can)row.append(posDispensingControlV854(q));queue.append(row);}
 const existing=s.pending.find(q=>q.id===posSelectedV77);if(posSelectedV77&&!existing){posSelectedV77=null;posEditV77=null;document.getElementById('posEditorV77').replaceChildren();}
 document.getElementById('posCorrectOpeningV77').hidden=CURRENT_PROFILE?.role!=='admin'||!s.shift;
 const lastEnded=s.history.find(h=>h.closed_at);const today=new Date().toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'});const endedToday=lastEnded&&new Date(lastEnded.closed_at).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'})===today;
 const shift=document.getElementById('posShiftInfoV77');shift.textContent=s.shift?'今日錢櫃工作中｜開班備用金 '+posMoneyV77(s.shift.opening)+'｜應有現金 '+posMoneyV77(s.expected)+'｜'+new Date(s.shift.opened_at).toLocaleString('zh-TW'):(endedToday?'今日工作已結束｜下班時間 '+new Date(lastEnded.closed_at).toLocaleString('zh-TW'):'尚未開班');
 document.getElementById('posOpenBoxV77').hidden=!!s.shift;document.getElementById('posCountBoxV77').hidden=!s.shift;
 document.getElementById('posMovementCardV77').hidden=!s.shift;document.getElementById('posCountCardV77').hidden=!s.shift;
 const methods=document.getElementById('posMethodsV77');methods.replaceChildren();for(const m of s.methods)methods.append(posNodeV77('p',m.method+'今日淨收款：'+posMoneyV77(m.total)));
 if(s.shift){
  const note=posNodeV77('p','計算範圍：同一工作日的已連結收款與現金異動。交班不重設備用金或清空收入；舊版尚未連結帳單需核對後納入。');methods.append(note);
  if(s.cash_parts){const c=s.cash_parts;methods.append(posNodeV77('p','應有現金＝備用金 '+posMoneyV77(c.opening)+'＋備用金更正 '+posMoneyV77(c.opening_adjust)+'＋現金實收 '+posMoneyV77(c.payment)+'－現金退款 '+posMoneyV77(c.refund)+'＋補入 '+posMoneyV77(c.in)+'－取出 '+posMoneyV77(c.out)+'＝'+posMoneyV77(s.expected)));}
  else methods.append(posNodeV77('p','請先執行 v85 當班收款結算修正 SQL，再重新同步；尚未更新時請勿完成結算。'));
 }
 posCountUpdateV77();
 const history=document.getElementById('posHistoryV77');history.replaceChildren();for(const h of s.history.filter(h=>h.closed_at)){history.append(posNodeV77('p',new Date(h.closed_at).toLocaleString('zh-TW')+'｜應有 '+posMoneyV77(h.expected)+'｜實點 '+posMoneyV77(h.counted)+'｜差額 '+posMoneyV77(h.difference)+'｜'+(h.reason||'相符')+'｜結算人 '+h.closed_by));if(h.ledger_expected!=null&&Number(h.ledger_expected)!==Number(h.expected))history.append(posNodeV77('p','依收款帳本重算：應有 '+posMoneyV77(h.ledger_expected)+'｜實點與重算差額 '+posMoneyV77(Number(h.counted)-Number(h.ledger_expected))+'。上方保留當時原結算紀錄，請核對現金去向。'));}
 const movement=document.getElementById('posMovementHistoryV77');movement.replaceChildren();for(const m of s.movements)movement.append(posNodeV77('p',new Date(m.created_at).toLocaleString('zh-TW')+'｜'+({payment:'收款',refund:'退款',in:'補入',out:'取出',opening_adjust:'備用金更正'})[m.kind]+'｜'+m.method+' '+posMoneyV77(m.amount)+'｜'+m.reason+'｜'+(m.reference||'')+'｜操作人 '+m.actor));
 const recovery=document.getElementById('posRecoverV77');recovery.hidden=!sessionStorage.getItem(posKeyV77('direct'));
}
function posRenderEditorV77(q){
 const box=document.getElementById('posEditorV77');box.replaceChildren();const d=posEditV77;if(!d)return;
 box.append(posNodeV77('h3',d.ownerName+'／'+d.billingPetName+(q.reissue?' 重開草稿｜原單 '+q.reissue.original_invoice_id:' 明細核對')+'（版本 '+q.version+'）'));
 if(q.reissue)box.append(posNodeV77('p','此草稿尚未收款或扣庫存。原單已收款時，須先核對並記錄原單實際退款，才可再次收取全額；不會自動抵扣舊款。處方用量由醫師處理，櫃台可更正費用與商品。'));
 function row(label,qty,price,onchange,remove){
  const r=posNodeV77('div');r.className='pos-row-v77';r.append(posNodeV77('span',label));const a=posInputV77('number',qty),b=posInputV77('number',price);a.step='0.01';b.step='0.01';
  a.oninput=b.oninput=()=>{onchange(Number(a.value),Number(b.value));update();};r.append(a,b);if(remove)r.append(posButtonV77('移除',remove));else a.disabled=true;box.append(r);
 }
 for(const l of d.lines)row((l.stock_kind==='item'?'【商品】':'')+l.item_name,l.quantity,l.unit_price,(n,p)=>{if(l.stock_kind==='medicine')return;l.quantity=n;l.unit_price=p;},l.stock_kind==='medicine'?null:()=>{d.lines=d.lines.filter(x=>x!==l);posRenderEditorV77(q);});
 for(const r of box.querySelectorAll('.pos-row-v77')){if(r.children[0]&&d.lines.find(l=>l.item_name===r.children[0].textContent)?.stock_kind==='medicine')r.querySelectorAll('input').forEach(i=>i.disabled=true);}
 for(const g of d.medicationGroups)row(medicationGroupLabelsV64[g.kind]||g.kind,1,g.price,(_,p)=>g.price=p,null);
 const search=posInputV77('search','');search.placeholder='輸入商品名稱後按 Enter 搜尋';
 const results=posNodeV77('select');results.append(posNodeV77('option','請先搜尋商品'));
 function find(){results.replaceChildren();for(const [id,item] of Object.entries(loadedItemsMap).filter(([,i])=>i.name.toLowerCase().includes(search.value.trim().toLowerCase())).slice(0,100)){const o=posNodeV77('option',item.name+'｜'+posMoneyV77(item.sell_price));o.value=id;results.append(o);}}
 search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();find();}};box.append(search,posButtonV77('搜尋商品',find),results,posButtonV77('加入同張帳單',async()=>{const item=loadedItemsMap[results.value];if(!item)throw Error('請先搜尋並點選商品');d.lines.push({item_name:item.name,quantity:1,unit_price:Number(item.sell_price||0),stock_kind:'item',stock_id:results.value});posRenderEditorV77(q);}));
 const discount=posInputV77('number',d.discount);discount.step='0.01';discount.oninput=()=>{d.discount=Number(discount.value);update();};posLabelV77('折扣',discount,box);const total=posNodeV77('p');box.append(total);
 function update(){try{posTotalsV77(d);total.textContent='待收 '+posMoneyV77(d.total);}catch(e){total.textContent=e.message;}}update();
 box.append(posButtonV77('儲存櫃台修改',async()=>{posTotalsV77(d);if(q.reissue)await posRpcV77('reissue_save_v854',{draft_id:q.id,version:q.version,draft:d});else await posRpcV77('edit',{id:q.id,version:q.version,draft:d});posEditV77=null;posSelectedV77=null;box.replaceChildren();await posRefreshV77();}));
 const payment=posNodeV77('select');for(const v of ['現金','信用卡','轉帳','行動支付']){const o=posNodeV77('option',v);o.value=v;payment.append(o);}box.append(payment,posButtonV77('確認收款並開收據',async()=>{if(JSON.stringify(d)!==JSON.stringify(q.draft))throw Error('請先儲存明細修改，再重新接手核對');if(q.reissue)await posReissuePayV854(q,payment.value);else await posPayV77(q,payment.value);box.replaceChildren();}));
 if(q.reissue)box.append(posButtonV77('取消重開草稿',async()=>{if(!confirm('取消這份草稿？原單作廢紀錄與退款紀錄仍保留。'))return;await posRpcV77('reissue_cancel_v854',{draft_id:q.id,version:q.version});posEditV77=null;box.replaceChildren();await posWorkLoadV854();}));
 else if(CURRENT_PROFILE?.role==='admin')box.append(posButtonV77('取消待付款（返回候診）',async()=>{if(!confirm('取消後此掛號回候診，由醫師重新處理費用。確定？'))return;await posRpcV77('cancel',{id:q.id,version:q.version});await posRefreshV77();}));
}
function posCountUpdateV77(){if(!posCountTouchedV849||posDenomsV77.every(n=>document.getElementById('posDenom'+n+'V77').value.trim()==='')){const out=document.getElementById('posCountTotalV77');out.textContent='尚未清點現金；填寫面額張數後才計算溢收／短少。';out.style.color='var(--text-main,#475569)';return null;}let sum=0;for(const n of posDenomsV77){const v=Number(document.getElementById('posDenom'+n+'V77').value||0);if(!Number.isInteger(v)||v<0){document.getElementById('posCountTotalV77').textContent='請輸入非負整數張數';return null;}sum+=n*v;}
 const diff=sum-Number(posStateV77?.day?.expected??posStateV77?.expected??0);const out=document.getElementById('posCountTotalV77');out.textContent='現金實際清點 '+posMoneyV77(sum)+'｜'+(diff>0?'溢收 ':diff<0?'短少 ':'僅現金相符 ')+posMoneyV77(Math.abs(diff));out.style.color=diff?'#dc2626':'#15803d';return sum;}
function posMountV77(){
 const style=posNodeV77('style');style.textContent='.pos-panel-v77{padding:16px;border:1px solid var(--border-color,#dddcd0);border-radius:12px;margin:12px 0;background:var(--card-bg,#fffdf7)}.pos-panel-v77[hidden]{display:none!important}.pos-row-v77{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}.pos-row-v77 span{min-width:200px;flex:1}.pos-row-v77 input{width:110px}.pos-panel-v77 label{display:inline-block;margin:6px}.pos-panel-v77 label input{width:110px}.pos-panel-v77 button{margin:4px}.pos-panel-v77 select{width:auto;max-width:100%}';document.head.append(style);
 const home=posNodeV77('div');home.id='posHomeV77';home.className='pos-panel-v77';home.hidden=true;
 home.append(posNodeV77('h3','櫃台待付款與交班'));const count=posNodeV77('b');count.id='posHomeCountV77';home.append(count,posButtonV77('查看待付款',async()=>{await posRefreshV77();switchTab('posTabV77');}));
 document.getElementById('appointments').prepend(home);
 const tab=posNodeV77('div');tab.id='posTabV77';tab.className='tab-content';tab.innerHTML='<div class="card pos-panel-v77"><h2>雲端待付款</h2><p>待付款不列入營業額；調劑、交付與付款分開記錄。庫存仍依原系統在收款時扣除。</p><p id="posMessageV77"></p><div id="posQueueV77"></div><div id="posEditorV77"></div><div id="posDeskV77"><h2>開班與下班結算</h2><p id="posShiftInfoV77"></p><div id="posMethodsV77"></div><div id="posOpenBoxV77"><label>開班備用金 <input id="posOpeningV77" type="number" min="0" step="0.01" value="0"></label><button id="posOpenV77" type="button" class="btn-secondary">開始今日工作（開班）</button></div><div id="posCountBoxV77"><p>請輸入各面額張數；備用金不列入營業額。</p><div id="posDenomsV77"></div><p id="posCountTotalV77"></p><label>結算／差額原因 <input id="posCloseReasonV77" type="text"></label><button id="posCloseV77" type="button" class="btn-secondary">結束今日工作</button><hr><select id="posMovementKindV77"><option value="in">補入零鈔</option><option value="out">取出現金</option><option value="refund">記錄實際退款</option></select><label>金額 <input id="posMovementAmountV77" type="number" min="0" step="0.01"></label><label>原因 <input id="posMovementReasonV77"></label><label>退款帳單／憑證 <input id="posMovementReferenceV77"></label><select id="posMovementMethodV77"><option>現金</option><option>信用卡</option><option>轉帳</option><option>行動支付</option></select><button id="posMovementV77" type="button" class="btn-secondary">記錄異動</button><p>退款在此只記錄已退還的款項；原帳單作廢與庫存退回仍由財務管理處理。請勿將作廢直接視為已退現金。</p></div><details><summary>最近下班結算紀錄</summary><div id="posHistoryV77"></div></details><details><summary>最近收款／現金異動（含操作人）</summary><div id="posMovementHistoryV77"></div></details></div></div>';
 document.getElementById('invoices').parentElement.append(tab);tab.querySelector('.card').prepend(posButtonV77('返回首頁',()=>switchTab('appointments')),posButtonV77('更新資料',posRefreshV77));
 const recover=posButtonV77('核對上次收款（不再收錢）',posRecoverV77);recover.id='posRecoverV77';recover.hidden=true;tab.querySelector('.card').prepend(recover);
 const stage=posButtonV77('儲存並送至待付款',posStageV77);stage.id='posStageV77';document.getElementById('invoiceCheckoutActionsV902').append(stage);
 const prepare=posButtonV77('儲存病歷並準備待付款費用',async()=>{if(!posMedicalV77())throw Error('沒有看診權限');await saveMedicalRecordAndDirectCheckout();});document.getElementById('medical').querySelector('.card').append(prepare);
 const retail=posNodeV77('select');retail.id='posRetailMethodV77';for(const v of ['現金','信用卡','轉帳','行動支付']){const o=posNodeV77('option',v);o.value=v;retail.append(o);}posLabelV77('商品收款方式',retail,document.getElementById('productCheckoutItems').parentElement);
 const transfer=posNodeV77('option','轉帳');transfer.value='轉帳';document.getElementById('invoicePaymentMethod').append(transfer);
 for(const n of posDenomsV77){const input=posInputV77('number',0);input.id='posDenom'+n+'V77';input.step='1';input.oninput=()=>{posCountTouchedV849=true;posCountUpdateV77();};posLabelV77(n+' 元',input,document.getElementById('posDenomsV77'));}
 document.getElementById('posOpenV77').onclick=()=>posActionV77(async()=>{const amount=Number(document.getElementById('posOpeningV77').value);const opened=await posFrozenRpcV77('open','open',{amount});if(!opened?.id)throw Error('未取得開班確認');sessionStorage.removeItem(posKeyV77('open'));const state=await posRefreshV77({fresh:true,required:true});if(state.shift?.id!==opened.id)throw Error('開班已送出，但當班資料尚未確認，請按更新資料核對，不要再次開班');alert('開班成功，本班可持續收款，直到結束今日工作。');});
 const correct=posButtonV77('更正開班備用金（留存紀錄）',async()=>{if(CURRENT_PROFILE?.role!=='admin')throw Error('需管理者權限');const text=prompt('請輸入更正後的開班備用金');if(text===null)return;const reason=prompt('請填寫更正原因');if(reason===null)return;await posFrozenRpcV77('opening_correct','correct',{shift_id:posStateV77.shift.id,amount:Number(text),reason});await posRefreshV77();});correct.id='posCorrectOpeningV77';document.getElementById('posCountBoxV77').prepend(correct);
 document.getElementById('posCloseV77').onclick=()=>posActionV77(posEndWorkV842);
 document.getElementById('posMovementV77').onclick=()=>posActionV77(async()=>{const request=posFrozenV77('movement',{shift_id:posStateV77.shift.id,kind:document.getElementById('posMovementKindV77').value,amount:Number(document.getElementById('posMovementAmountV77').value),method:document.getElementById('posMovementMethodV77').value,reason:document.getElementById('posMovementReasonV77').value.trim(),reference:document.getElementById('posMovementReferenceV77').value.trim()});try{await posRpcV77('movement',request);}catch(e){if(posRejectedV77(e))sessionStorage.removeItem(posKeyV77('movement'));throw e;}sessionStorage.removeItem(posKeyV77('movement'));document.getElementById('posMovementAmountV77').value='';await posRefreshV77();});
}
async function posEndWorkV842(){
 const activeShift=await posRequireShiftV84();const counted=posCountUpdateV77();if(counted===null)return;
 const reason=document.getElementById('posCloseReasonV77').value.trim();
 if(!posStateV77.cash_parts)throw Error('請先執行 v85 當班收款結算修正 SQL，再重新同步');
 if(counted!==Number(posStateV77.expected)&&!reason)throw Error('現金有差額，請先填寫結算原因');
 const pendingCount=posStateV77.pending.length;
 const message='結束今日工作？\n系統應有現金：'+posMoneyV77(posStateV77.expected)+'\n實際清點現金：'+posMoneyV77(counted)+'\n結束後本班不能再收款，需重新開班才能繼續。'+(pendingCount?'\n尚有 '+pendingCount+' 筆待付款，會保留到下次處理。':'');
 if(!confirm(message))return;
 const denominations=Object.fromEntries(posDenomsV77.map(n=>[String(n),Number(document.getElementById('posDenom'+n+'V77').value)]));
 const ended=await posRpcV77('close',{shift_id:activeShift.id,counted,denominations,reason});
 if(ended?.id!==activeShift.id||!ended.closed_at)throw Error('尚未取得下班結算確認，請更新資料核對，勿再次結算');
 posStateV77={...posStateV77,shift:null,expected:0,methods:[],history:[ended,...posStateV77.history.filter(h=>h.id!==ended.id)]};
 for(const n of posDenomsV77)document.getElementById('posDenom'+n+'V77').value='0';posRenderV77();
 await posRefreshV77({fresh:true});
 alert('今日工作已結束。\n下班時間：'+new Date(ended.closed_at).toLocaleString('zh-TW')+'\n本班收款已停止；下次收款前請重新開班。');
}
function posSplitPagesV77(){
 const tab=document.getElementById('posTabV77'),desk=document.getElementById('posDeskV77');
 const shiftTab=posNodeV77('div');shiftTab.id='posShiftTabV77';shiftTab.className='tab-content';
 document.getElementById('invoices').parentElement.append(shiftTab);
 const toolbar=posNodeV77('div');toolbar.className='card pos-panel-v77';toolbar.append(posNodeV77('h2','開班與下班結算'),posNodeV77('p','開始工作時開班；下班前清點現金，再按「結束今日工作」。'),posButtonV77('回待付款',()=>switchTab('posTabV77')),posButtonV77('更新當班資料',posRefreshV77));
 shiftTab.append(toolbar,desk);
 const headings=[...desk.querySelectorAll(':scope > h2')];for(const h of headings)h.remove();
 const card=(title,id)=>{const c=posNodeV77('section');c.className='card pos-panel-v77';if(id)c.id=id;c.append(posNodeV77('h3',title));return c;};
 const summary=card('開班與當班收款');summary.append(document.getElementById('posShiftInfoV77'),document.getElementById('posMethodsV77'),document.getElementById('posOpenBoxV77'),document.getElementById('posCorrectOpeningV77'));
 const countBox=document.getElementById('posCountBoxV77'),note=countBox.lastElementChild;
 const movement=card('現金補入、取出與退款','posMovementCardV77'),form=posNodeV77('div');form.className='pos-form-grid-v77';
 for(const id of ['posMovementKindV77','posMovementAmountV77','posMovementReasonV77','posMovementReferenceV77','posMovementMethodV77']){
  const input=document.getElementById(id),label=input.closest('label')||posNodeV77('label',({posMovementKindV77:'異動類型',posMovementMethodV77:'付款方式'})[id]||'');
  if(!input.closest('label'))label.append(input);form.append(label);
 }
 movement.append(form,document.getElementById('posMovementV77'),note);
 countBox.querySelector('hr')?.remove();
 const count=card('下班結算：清點錢櫃現金','posCountCardV77');count.append(countBox);
 const history=card('下班結算與現金紀錄');for(const details of [...desk.querySelectorAll(':scope > details')])history.append(details);
 desk.replaceChildren(summary,movement,count,history);
 const waitCard=tab.querySelector('.card');waitCard.append(posButtonV77('前往開班／下班結算',()=>switchTab('posShiftTabV77')));
 const home=document.getElementById('posHomeV77');home.querySelector('h3').textContent='待付款';
 home.append(posButtonV77('開班／下班結算',()=>switchTab('posShiftTabV77')));
 let nav=document.getElementById('nav-appointments')||document.getElementById('nav-invoices');
 for(const [id,label] of [['posTabV77','💳 待付款'],['posShiftTabV77','🧮 開班／下班結算']]){
  const li=posNodeV77('li',label);li.id='nav-'+id;li.style.display='none';li.onclick=()=>{switchTab(id);posRefreshV77();};nav.parentElement.insertBefore(li,nav.nextSibling);nav=li;
 }
 const style=posNodeV77('style');style.id='posCompactStyleV84';style.textContent='#posHomeV77{display:flex;align-items:center;flex-wrap:wrap;gap:8px;background:transparent;border:0;border-radius:0;box-shadow:none;padding:0;margin:8px 0 12px;min-height:32px}#posHomeV77 h3{font-size:14px;line-height:1.4;margin:0 4px 0 0;color:var(--ink,var(--text-main));font-weight:600}#posHomeV77 b{font-size:13px;line-height:1.4;margin-right:4px;color:var(--text-main)}#posHomeV77 button{padding:5px 10px;font-size:12px;line-height:1.4;min-height:30px;margin:0;border-radius:7px}#posDeskV77 .card{margin:0 0 16px}#posTabV77 .card{max-width:1200px}#posShiftTabV77{max-width:1200px}.pos-form-grid-v77{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.pos-form-grid-v77 label{display:flex;flex-direction:column;gap:6px;margin:0}.pos-form-grid-v77 input,.pos-form-grid-v77 select{width:100%!important;box-sizing:border-box}#posDenomsV77{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}#posDenomsV77 label{display:flex;flex-direction:column;gap:5px;margin:0}#posDenomsV77 input{width:100%;box-sizing:border-box}#posCountTotalV77{font-size:1.15rem;font-weight:700;margin:20px 0}@media(max-width:900px){#posDenomsV77{grid-template-columns:repeat(3,minmax(0,1fr))}.pos-form-grid-v77{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){#posDenomsV77{grid-template-columns:repeat(2,minmax(0,1fr))}.pos-form-grid-v77{grid-template-columns:1fr}}';document.head.append(style);
}
posMountV77();posSplitPagesV77();
const posVersionV84=posNodeV77('span',' · v85_6');posVersionV84.id='genblueVersionV84';document.querySelector('.journal-side-foot')?.append(posVersionV84);
const posSwitchOriginalV77=switchTab;
switchTab=function(tab,...args){
 if(tab==='posShiftTabV77'&&!familyAllowedV74()){alert('此帳號沒有開班／下班結算權限');return;}
 if(tab==='posTabV77'&&!(familyAllowedV74()||posMedicalV77())){alert('此帳號沒有待付款權限');return;}
 return posSwitchOriginalV77.call(this,tab,...args);
};
// All existing direct checkout routes now pass the shift ledger transaction.
let inventoryRefreshAfterCheckoutV1=null;
function refreshInventoryAfterCheckoutV1(scope){
 const uiScope=clinicRefreshScopeV50();
 return Promise.allSettled([loadItems({preserveDrafts:true,scope:uiScope}),loadMedicines({preserveDrafts:true,scope:uiScope})]).then(results=>{
  const ok=results.every(r=>r.status==='fulfilled')&&scope===posScopeNowV77();
  if(!ok&&scope===posScopeNowV77())alert('結帳已成功，但商品或藥品清單更新失敗。請先更新資料；不需重新結帳。');
  return ok;
 });
}
commitInventoryCheckout=async function(args){
 if(inventoryCheckoutBusy)return null;inventoryCheckoutBusy=true;const scope=posScopeNowV77();
 try{
  if(inventoryRefreshAfterCheckoutV1){let refreshed=await inventoryRefreshAfterCheckoutV1;if(!refreshed&&scope===posScopeNowV77()){inventoryRefreshAfterCheckoutV1=refreshInventoryAfterCheckoutV1(scope);refreshed=await inventoryRefreshAfterCheckoutV1;}if(!refreshed)throw Error('庫存清單更新失敗，請更新商品與藥品資料後再收款');if(scope!==posScopeNowV77())return null;}
  const name=args.p_category==='門診'?(args.p_medication_groups?'checkout_clinic_medicine_groups_v64':'checkout_clinic_doctor_v57'):'checkout_with_inventory';
  let request=JSON.parse(sessionStorage.getItem(posKeyV77('direct'))||'null');
  const actual={...args};if(args.p_category==='門診')actual.p_request_id=request?.payload?.args?.p_request_id||crypto.randomUUID();
  const result=await posDirectV77(name,actual);if(scope!==posScopeNowV77())return null;
  inventoryRefreshAfterCheckoutV1=refreshInventoryAfterCheckoutV1(scope);
  return typeof result==='string'?result:result.invoice_id;
 }catch(e){alert('收款尚未確認：'+e.message+'。若已交付現金，請核對上次收款，勿重新建帳。');return null;}finally{inventoryCheckoutBusy=false;}
};
const posRenderAppointmentsOriginalV77=renderAppointmentTable;
renderAppointmentTable=function(rows){const pending=new Set((posStateV77?.pending||[]).map(q=>q.appointment_id));return posRenderAppointmentsOriginalV77(rows.filter(r=>!pending.has(r.appointment_id)));};
setInterval(()=>{if(posScopeNowV77()&&!posBusyV77)posRefreshV77();},30000);
window.addEventListener('focus',()=>{if(posScopeNowV77()&&!posBusyV77)posRefreshV77();});
const posLoadProfileOriginalV77=loadCurrentUserProfile;
loadCurrentUserProfile=async function(...args){const result=await posLoadProfileOriginalV77.apply(this,args);await posRefreshV77();return result;};

const posLogoutOriginalV77=logoutSupabase;logoutSupabase=async function(...args){posStateV77=null;posScopeV77='';posSelectedV77=null;posEditV77=null;document.getElementById('posQueueV77').replaceChildren();document.getElementById('posEditorV77').replaceChildren();document.getElementById('posPaidRowsV854')?.replaceChildren();document.getElementById('posReissueRowsV854')?.replaceChildren();posPaidOffsetV854=0;posReissueOffsetV854=0;posWorkRequestV854++;document.getElementById('posHomeV77').hidden=true;return posLogoutOriginalV77.apply(this,args);};

// v84_6: one daily drawer, handovers, verification and subsequent bank settlement.
let posFormRevisionV845=null,posBankOffsetV845=0,posCountTouchedV849=false,posCountScopeV849='',posRestoredProofV849='';
const posMethodsV845=['現金','信用卡','轉帳','行動支付'];
// v85_6: saved counts belong to history, never a new count form.
function posClearCountFormV856(){
 for(const n of posDenomsV77)document.getElementById('posDenom'+n+'V77').value='';
 for(let idx=1;idx<4;idx++){document.getElementById('posActualV845_'+idx).value='';document.getElementById('posEvidenceV845_'+idx).value='';}
 document.getElementById('posCloseReasonV77').value='';document.getElementById('posRecipientV845').value='';
 posCountTouchedV849=false;posRestoredProofV849='';posCountUpdateV77();
}

function posTaipeiDateV845(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());}
function posReconcileRenderV845(){
 const state=posStateV77,day=state?.day,ready=state?.schema_version===850,review=state?.shift||state?.review_shift,closedReview=!state?.shift&&!!state?.review_shift;
 const card=document.getElementById('posVerifyCardV845');card.hidden=!review;
 document.getElementById('posCountCardV77').hidden=!review;document.getElementById('posCountBoxV77').hidden=!review;
 document.getElementById('posCountCardV77').querySelector('h3').textContent=closedReview?'下班後補核對：清點今日錢櫃現金':'交班／最終下班：清點錢櫃現金';
 document.getElementById('posCloseReasonV77').placeholder=closedReview?'必填：下班後補核對原因與憑證':'';
 document.getElementById('posOpenBoxV77').hidden=!!review;
 document.getElementById('posRecipientV845').closest('label').hidden=closedReview;
 document.getElementById('posConfirmIncomeV846').textContent=closedReview?'補核對並確認今日入帳（保留原下班紀錄）':'確認今日入帳（更新財務報表）';
 document.getElementById('posCloseV77').disabled=!ready||closedReview;document.getElementById('posCloseV77').hidden=closedReview;
 document.getElementById('posHandoverV845').disabled=!ready||closedReview;document.getElementById('posHandoverV845').hidden=closedReview;
 const history=document.getElementById('posHandoverHistoryV845');history.replaceChildren();
 for(const event of state.handover_history||[]){const a=event.after_data;if(event.action==='today_work_v85'){history.append(posNodeV77('p',new Date(event.created_at).toLocaleString('zh-TW')+'｜恢復今日工作｜操作人 '+event.actor+'｜保留原下班時間 '+new Date(a.original_closed_at).toLocaleString('zh-TW')+'｜原實點 '+posMoneyV77(a.original_counted)+'｜原應有 '+posMoneyV77(a.original_expected)+'｜原差額 '+posMoneyV77(a.original_difference)));continue;}history.append(posNodeV77('p',new Date(event.created_at).toLocaleString('zh-TW')+'｜'+(event.action==='end_day_v845'?'最終下班':event.action==='confirm_income_v846'?(a.supplement_after_close?'下班後補核對入帳':'確認今日入帳'):'中途交班')+'｜工作日 '+a.business_date+'｜操作人 '+event.actor+(a.recipient?'｜接班人 '+a.recipient:'')+'｜現金差額 '+posMoneyV77(a.cash_difference)+'｜未相符付款方式 '+a.unresolved_methods+'｜'+(a.reason||'核對相符')));}
 if(!review){posFormRevisionV845=null;return;}
 if(!ready){document.getElementById('posVerifyStatusV845').textContent='請先執行 v85 每日錢櫃與收款核對 SQL，再更新資料。';return;}
 const countScope=posScopeNowV77()+'|'+day.business_date+'|'+(closedReview?'closed:':'active:')+review.id;
 if(posCountScopeV849!==countScope){posCountScopeV849=countScope;posClearCountFormV856();}
 const changed=posFormRevisionV845!==day.revision;
 const first=posFormRevisionV845===null;posFormRevisionV845=day.revision;
 document.getElementById('posVerifyStatusV845').textContent='工作日 '+day.business_date+(closedReview?'｜今日已下班；管理者可補核對，原下班時間及清點紀錄保留。':'｜交班不關閉錢櫃，金額繼續累計。')+(changed&&!first?'收款或核對資料已更新，請重新填寫非現金核對金額。':'');
 if(closedReview){const c=day.cash_parts;document.getElementById('posShiftInfoV77').textContent='今日已下班；急診或繼續營業請按上方「今日工作」｜應有現金 '+posMoneyV77(day.expected)+'（備用金 '+posMoneyV77(c.opening)+'＋現金收款 '+posMoneyV77(c.payment)+'－退款 '+posMoneyV77(c.refund)+'＋補入 '+posMoneyV77(c.in)+'－取出 '+posMoneyV77(c.out)+'＋備用金更正 '+posMoneyV77(c.opening_adjust)+'）';}
 for(let idx=0;idx<4;idx++){
  const method=posMethodsV845[idx],m=day.methods.find(x=>x.method===method)||{total:0,verified:0,pending_count:0};
  document.getElementById('posMethodSystemV845_'+idx).textContent=(idx===0?'錢櫃應有 '+posMoneyV77(day.expected)+'；':'')+'今日淨收款 '+posMoneyV77(m.total)+'｜已核對 '+posMoneyV77(m.verified)+(m.pending_count?'｜待核對 '+m.pending_count+' 筆':'');
  if(idx>0&&changed){document.getElementById('posActualV845_'+idx).value=!closedReview&&Number(m.total)===0?'0':'';document.getElementById('posEvidenceV845_'+idx).value='';}
 }
 posDrawerReviewV849(state.drawer_review);posDifferencesV845();
 const rows=document.getElementById('posUnverifiedV845');rows.replaceChildren();
 const pending=day.receipts.filter(r=>!r.verified);rows.closest('details').hidden=pending.length===0;rows.append(posNodeV77('p','今日已收款、待核對 '+pending.length+' 筆；下方為金流紀錄，合併收款只列一筆。'));
 for(const r of pending)rows.append(posNodeV77('p',new Date(r.created_at).toLocaleString('zh-TW')+'｜'+r.method+'｜'+(r.kind==='refund'?'退款 ':'收款 ')+posMoneyV77(r.amount)+'｜帳單／請求 '+r.reference+((r.invoices||[]).some(i=>i.voided_at)?'｜含已作廢帳單，請核對是否已實際退款':'')));
 const legacy=document.getElementById('posLegacyV845');legacy.replaceChildren();legacy.hidden=day.legacy.length===0;
 if(day.legacy.length)legacy.append(posNodeV77('p','今日有 '+day.legacy.length+' 筆舊版已收帳單尚未連結錢櫃。管理者須逐筆確認實際付款方式後納入，才可完成交班／下班。這不會重新收款或扣庫存。'));
 for(const inv of day.legacy){const row=posNodeV77('div');row.className='pos-row-v77';row.append(posNodeV77('span',new Date(inv.created_at).toLocaleString('zh-TW')+'｜'+inv.checkout_type+'｜'+posMoneyV77(inv.total_amount)+'｜'+inv.id.slice(0,8)));
  const select=posNodeV77('select');select.append(posNodeV77('option','請選實際付款方式'));select.options[0].value='';for(const m of posMethodsV845){const o=posNodeV77('option',m);o.value=m;select.append(o);}try{select.value=posMethodV77(inv.checkout_type);}catch{}
  row.append(select);if(CURRENT_PROFILE?.role==='admin')row.append(posButtonV77('核對舊款並納入',async()=>{
   if(!select.value)throw Error('請選擇實際付款方式');const reason=prompt('請填寫舊款納入原因／憑證；確認該款已實際收到');if(!reason?.trim())return;
   if(!confirm('納入既有帳單 '+inv.id+'\n'+select.value+' '+posMoneyV77(inv.total_amount)+'\n只連結錢櫃，不再次收款或扣庫存。'))return;
   await posFrozenRpcV77('adopt_legacy','adopt:'+inv.id,{invoice_id:inv.id,method:select.value,reason:reason.trim(),shift_id:review.id,revision:day.revision});await posRefreshV77({fresh:true,required:true});
  }));legacy.append(row);
 }

}
function posDifferencesV845(){const day=posStateV77?.day;if(!day)return;const count=posCountUpdateV77();for(let idx=0;idx<4;idx++){const e=document.getElementById('posDifferenceV845_'+idx);if(!e)return;const method=posMethodsV845[idx],actual=idx===0?count:document.getElementById('posActualV845_'+idx).value;const total=idx===0?Number(day.expected):Number(day.methods.find(x=>x.method===method)?.total||0);if(actual===null||actual===''){e.textContent='尚未填寫';continue;}const diff=Number(actual)-total;e.textContent='差額 '+posMoneyV77(diff)+(diff?'｜待處理':'｜相符');e.style.color=diff?'#dc2626':'#15803d';}}
async function posReconcileV845(mode){
 const revision=posFormRevisionV845;await posRefreshV77({fresh:true,required:true});
 const active=posStateV77.shift||(mode==='confirm'?posStateV77.review_shift:null),day=posStateV77.day;
 if(!active)throw Error('沒有可核對的今日錢櫃；新收款仍須先開班');
 const closedReview=!posStateV77.shift;
 if(closedReview&&CURRENT_PROFILE?.role!=='admin')throw Error('下班後補核對須由管理者處理');
 if(posStateV77.schema_version!==850||!day)throw Error('請先執行 v85 每日錢櫃與收款核對 SQL');
 if(revision!==day.revision)throw Error('收款或核對資料已更新，請重新核對');
 if(day.legacy.length)throw Error('請先由管理者核對並納入今日舊版已收帳單');
 const counted=posCountUpdateV77();if(counted===null)throw Error('尚未清點現金，不能把未填寫當成零元完成核對');
 const actual={'現金':counted},evidence={};for(let idx=1;idx<4;idx++){const input=document.getElementById('posActualV845_'+idx),value=input.value;if(value===''||!Number.isFinite(Number(value)))throw Error('請填寫 '+posMethodsV845[idx]+' 實際核對金額');actual[posMethodsV845[idx]]=Number(value);evidence[posMethodsV845[idx]]=document.getElementById('posEvidenceV845_'+idx).value.trim();}
 const recipient=document.getElementById('posRecipientV845').value.trim(),reason=document.getElementById('posCloseReasonV77').value.trim();if(mode==='handover'&&!recipient)throw Error('請填寫接班人');
 if(closedReview&&!reason)throw Error('請填寫下班後補核對原因與憑證，原下班紀錄會保留');
 let unmatched=0;for(const method of posMethodsV845){const total=method==='現金'?Number(day.expected):Number(day.methods.find(x=>x.method===method)?.total||0);if(actual[method]!==total)unmatched++;else if(method!=='現金'&&day.receipts.some(r=>r.method===method&&!r.verified)&&!evidence[method])throw Error('請填寫 '+method+' 的交易／入帳核對憑證');}
 if(mode==='confirm'&&unmatched)throw Error('確認今日入帳須各付款方式全部相符；未到帳款項請先保留待核對');
 if(unmatched&&!reason)throw Error('有核對差額，請填原因；未相符款項會繼續待核對');
 const denominations=Object.fromEntries(posDenomsV77.map(n=>[String(n),Number(document.getElementById('posDenom'+n+'V77').value)]));
 if(!confirm((mode==='handover'?'確認交班給 '+recipient+'？錢櫃保持開啟、金額繼續累計。':mode==='confirm'?(closedReview?'確認下班後補核對？款項將列入財務已確認收入，保留原下班紀錄，不重新開班。':'確認今日入帳？款項將列入財務已確認收入，錢櫃保持開啟。'):'結束今日工作？若之後有急診，按「今日工作」即可恢復原錢櫃。')+'\n'+posMethodsV845.map(m=>m+'核對：'+posMoneyV77(actual[m])).join('\n')+(unmatched?'\n有 '+unmatched+' 種付款方式未相符，保留待處理。':'\n各付款方式相符，待核對款項轉為已確認。')+(posStateV77.pending.length?'\n尚未收款 '+posStateV77.pending.length+' 筆，保留到後續處理。':'')))return;
 const result=await posFrozenRpcV77('reconcile','reconcile',{shift_id:active.id,revision:day.revision,mode,actual,evidence,denominations,recipient,reason});
 if(mode==='end_day'||closedReview)posClearCountFormV856();
 await posRefreshV77({fresh:true,required:true});await posBankLoadV845(true);
 if(typeof fetchFinancialReport==='function'&&document.getElementById('reportStartDate').value)await fetchFinancialReport();
 const summary=await posDailySummaryV846();
 alert(mode==='handover'?'交班已保存，錢櫃與今日累計繼續使用。':mode==='confirm'?'今日入帳已確認，財務報表已更新。'+(summary?'\n今日門診＋商品合計：'+posMoneyV77(summary.summary.confirmed_total):''):'今日工作已結束。未相符款項保留待核對，沒有改寫收入。');return result;
}
async function posBankLoadV845(reset=false){if(reset)posBankOffsetV845=0;const result=await posRpcV77('bank_pending',{offset:posBankOffsetV845});const box=document.getElementById('posBankPendingV845');box.replaceChildren();if(!result.total){box.append(posNodeV77('p','目前沒有需處理的款項。'));return;}box.append(posNodeV77('p','跨日待核對／待入帳 '+result.total+' 筆｜本頁 '+result.rows.length+' 筆'));
 for(const r of result.rows){const row=posNodeV77('div');row.className='pos-row-v77';row.append(posNodeV77('span',new Date(r.created_at).toLocaleString('zh-TW')+'｜'+r.method+'｜'+(r.kind==='refund'?'退款出帳 ':'收款入帳 ')+posMoneyV77(r.amount)+'｜'+r.reference),posButtonV77(r.method==='現金'?'核對舊日現金（管理者）':'核對實際入帳',async()=>{
  if(r.method==='現金'&&CURRENT_PROFILE?.role!=='admin')throw Error('舊日現金須由管理者查明差異並核對');const amount=prompt((r.method==='現金'?'請查明原結算差異並輸入實際收到現金：':'請依銀行／平台紀錄輸入實際')+(r.kind==='refund'?'退款出帳':'入帳')+'金額（以正數填寫）');if(amount===null)return;const settled_date=prompt('實際入帳日期（YYYY-MM-DD）',posTaipeiDateV845());if(settled_date===null)return;const evidence=prompt(r.method==='現金'?'請填原現金差異查明結果及收款憑證（不改寫舊清點紀錄）':'請填交易序號或入帳核對憑證');if(!evidence?.trim())return;
  await posFrozenRpcV77('verify_bank','bank:'+r.id,{movement_id:r.id,amount:Number(amount),settled_date,evidence:evidence.trim()});await posRefreshV77({fresh:true});await posBankLoadV845(true);if(document.getElementById('reportStartDate').value)await fetchFinancialReport();
 }));box.append(row);}
 const previous=posButtonV77('上一頁',async()=>{posBankOffsetV845=Math.max(0,posBankOffsetV845-50);await posBankLoadV845();});previous.disabled=posBankOffsetV845===0;const next=posButtonV77('下一頁',async()=>{posBankOffsetV845+=50;await posBankLoadV845();});next.disabled=posBankOffsetV845+50>=result.total;box.append(previous,next);
}
function posMountV845(){
 const desk=document.getElementById('posDeskV77'),card=posNodeV77('section');card.id='posVerifyCardV845';card.className='card pos-panel-v77';card.append(posNodeV77('h3','今日各付款方式核對'),posNodeV77('p','現金依面額清點；刷卡、轉帳與行動支付填實際入帳淨額及憑證。尚未入帳填實際已入帳淨額（退款多於收款可為負數），差額留待處理。'),posNodeV77('p'));card.lastChild.id='posVerifyStatusV845';
 const grid=posNodeV77('div');grid.className='pos-form-grid-v77';for(let idx=0;idx<4;idx++){const section=posNodeV77('div');section.append(posNodeV77('h4',posMethodsV845[idx]));const system=posNodeV77('p');system.id='posMethodSystemV845_'+idx;section.append(system);
  if(idx>0){const input=posInputV77('number','');input.id='posActualV845_'+idx;input.removeAttribute('min');input.step='0.01';input.oninput=posDifferencesV845;posLabelV77('實際核對淨額',input,section);const evidence=posInputV77('text','');evidence.id='posEvidenceV845_'+idx;posLabelV77('交易／入帳核對憑證',evidence,section);}else section.append(posNodeV77('p','實際金額由下方面額清點計算，不包含刷卡或轉帳。'));
  const diff=posNodeV77('p');diff.id='posDifferenceV845_'+idx;section.append(diff);grid.append(section);
 }card.append(grid);desk.insertBefore(card,document.getElementById('posCountCardV77'));
 const count=document.getElementById('posCountBoxV77');const recipient=posInputV77('text','');recipient.id='posRecipientV845';posLabelV77('接班人（中途交班必填）',recipient,count);const handover=posButtonV77('確認交班（錢櫃繼續）',()=>posReconcileV845('handover'));handover.id='posHandoverV845';count.append(handover);
 document.getElementById('posCloseV77').onclick=()=>posActionV77(()=>posReconcileV845('end_day'));
 document.getElementById('posCountCardV77').querySelector('h3').textContent='交班／最終下班：清點錢櫃現金';
 for(const n of posDenomsV77)document.getElementById('posDenom'+n+'V77').oninput=()=>{posCountTouchedV849=true;posDifferencesV845();};
 const receipts=posNodeV77('details');receipts.append(posNodeV77('summary','今日尚未核對的收款／退款'));const pending=posNodeV77('div');pending.id='posUnverifiedV845';receipts.append(pending);card.append(receipts);const legacy=posNodeV77('div');legacy.id='posLegacyV845';card.append(legacy);
 const hist=posNodeV77('details');hist.append(posNodeV77('summary','交班與最終下班核對紀錄'));const hb=posNodeV77('div');hb.id='posHandoverHistoryV845';hist.append(hb);desk.append(hist);
 const bank=posNodeV77('section');bank.className='card pos-panel-v77';bank.append(posNodeV77('h3','跨日待核對／非現金待入帳'),posButtonV77('讀取待入帳款項',()=>posBankLoadV845(true)));const bb=posNodeV77('div');bb.id='posBankPendingV845';bank.append(bb);desk.append(bank);
 const nav=document.getElementById('nav-posShiftTabV77');nav.textContent='🧮 開班／交班／下班';document.getElementById('posShiftTabV77').querySelector('h2').textContent='開班／交班／下班核對';document.getElementById('posShiftTabV77').querySelector('.card > p').textContent='每天開班一次；中途交班延續錢櫃，最後下班彙總今日收款並核對入帳。';
 document.getElementById('statGrandTotal').previousElementSibling.textContent='本期已核對確認收入（依帳單日期）';

}
posMountV845();
const posRenderBeforeV845=posRenderV77;posRenderV77=function(){posRenderBeforeV845();posReconcileRenderV845();};
posEndWorkV842=()=>posReconcileV845('end_day');
// Preserve verification requests across ambiguous network failures, including final closure.
const posFrozenBeforeV845=posFrozenRpcV77;
posFrozenRpcV77=async function(action,key,data){
 if(!['reconcile','verify_bank','adopt_legacy','today_work','reissue_prepare_v854','reissue_pay_v854'].includes(action))return posFrozenBeforeV845(action,key,data);
 const registryKey=posKeyV77('verification-retries'),registry=JSON.parse(sessionStorage.getItem(registryKey)||'[]');
 if(!registry.some(r=>r.key===key))registry.push({action,key});sessionStorage.setItem(registryKey,JSON.stringify(registry));
 try{const result=await posFrozenBeforeV845(action,key,data);sessionStorage.setItem(registryKey,JSON.stringify(registry.filter(r=>r.key!==key)));return result;}
 catch(error){if(posRejectedV77(error))sessionStorage.setItem(registryKey,JSON.stringify(registry.filter(r=>r.key!==key)));throw error;}
};
document.getElementById('posShiftTabV77').querySelector('.card').append(posButtonV77('核對上次交班／入帳請求（不重收款）',async()=>{
 const key=posKeyV77('verification-retries'),registry=JSON.parse(sessionStorage.getItem(key)||'[]');if(!registry.length)throw Error('沒有未確認的核對請求');
 for(const entry of [...registry]){const saved=JSON.parse(sessionStorage.getItem(posKeyV77(entry.key))||'null');if(saved)await posRpcV77(entry.action,saved);sessionStorage.removeItem(posKeyV77(entry.key));registry.splice(registry.findIndex(r=>r.key===entry.key),1);sessionStorage.setItem(key,JSON.stringify(registry));}
 await posRefreshV77({fresh:true,required:true});await posBankLoadV845(true);if(document.getElementById('reportStartDate').value)await fetchFinancialReport();alert('上次核對結果已確認，不需重複收款或重新開班。');
}));

// v84_6: explicit posting confirmation and automatic daily clinic/product totals.
let posSummaryRequestV846=0;
async function posDailySummaryV846(){
 const scope=posScopeNowV77(),request=++posSummaryRequestV846,box=document.getElementById('posDailySummaryBodyV846');
 document.getElementById('posConfirmIncomeV846').disabled=true;
 if(!familyAllowedV74()){box.replaceChildren();return null;}
 try{const reply=await posRpcV77('daily_summary');if(request!==posSummaryRequestV846||scope!==posScopeNowV77())return null;
  if(reply.tenant_id!==String(CURRENT_TENANT_ID)||!reply.summary)throw Error('今日總結回覆不完整');if(reply.revenue_version!==853)throw Error('請先執行 v85_3 門診商品收入分類 SQL');
  box.replaceChildren();box.append(posNodeV77('p','工作日：'+reply.business_date));
  const grid=posNodeV77('div');grid.className='pos-form-grid-v77';
  for(const [label,key] of [['門診收入','clinic_total'],['商品收入','product_total'],['今日合計','total'],['已入帳','confirmed_total'],['待處理','pending_total']]){if(key==='pending_total'&&!Number(reply.summary.pending_total)&&!Number(reply.summary.pending_count))continue;const cell=posNodeV77('div');cell.append(posNodeV77('span',label),posNodeV77('strong',posMoneyV77(reply.summary[key])));grid.append(cell);}box.append(grid);
  const status=posNodeV77('p',reply.income_complete?'✓ 今日帳單收入已確認入帳':'今日入帳尚未完成｜未確認帳單 '+reply.summary.pending_count+' 筆｜未核對金流 '+reply.unverified_movements+' 筆｜未連結舊帳單 '+reply.summary.legacy_count+' 筆');status.style.fontWeight='700';status.style.color=reply.income_complete?'#15803d':'#b45309';box.append(status);
  if(Number(reply.pending_refunds))box.append(posNodeV77('p','尚未核對退款：'+posMoneyV77(reply.pending_refunds)+'；請核對後才完成收入流程。'));
  box.append(posNodeV77('p',reply.work_state==='active'?'今日工作中；最後離開時按「結束今日工作」。':reply.end_day?'下班已結算：'+new Date(reply.end_day.closed_at).toLocaleString('zh-TW')+'｜現金差額 '+posMoneyV77(reply.end_day.cash_difference):(reply.drawer_review?.original_closed_at?'錢櫃已下班：'+new Date(reply.drawer_review.original_closed_at).toLocaleString('zh-TW')+'。原下班清點紀錄保留。':'今日尚未完成最終下班結算。確認入帳不會關閉錢櫃。')));
  if(reply.summary.legacy_count)box.append(posNodeV77('p','較早尚未連結錢櫃的帳單已包含在全天總額內。請到下方「今日各付款方式核對」逐筆選擇實際付款方式並按「核對舊款並納入」，再確認今日入帳。'));
  if(Number(reply.summary.pending_count))box.append(posNodeV77('p','待處理款項請在下方核對後入帳。'));
  document.getElementById('posConfirmIncomeV846').disabled=!(posStateV77?.shift||(posStateV77?.review_shift&&CURRENT_PROFILE?.role==='admin'))||posStateV77?.schema_version!==850||(reply.income_complete&&reply.drawer_review?.count_current===true);
  box.append(posNodeV77('p',reply.drawer_review?.count_current?'✓ 錢櫃核對相符':'現金尚未完成清點；下班前請清點。'));
  const invoiceCard=document.getElementById('posInvoiceReviewV852');if(invoiceCard?.open)posActionV77(()=>posInvoiceReviewV847());
  return reply;
 }catch(error){if(request===posSummaryRequestV846&&scope===posScopeNowV77()){box.replaceChildren(posNodeV77('p','今日總結尚未讀取：'+error.message+'；請執行包內 sql_v85_3_門診商品收入分類.sql，再更新當班資料。'));document.getElementById('posConfirmIncomeV846').disabled=true;}return null;}
}
function posMountV846(){
 const card=posNodeV77('section');card.id='posDailySummaryV846';card.className='card pos-panel-v77';card.append(posNodeV77('h3','今日門診＋商品收入總結'));const body=posNodeV77('div');body.id='posDailySummaryBodyV846';card.append(body);
 const confirm=posButtonV77('確認今日入帳（更新財務報表）',()=>posReconcileV845('confirm'));confirm.id='posConfirmIncomeV846';confirm.disabled=true;card.append(confirm,posButtonV77('更新今日總結',posDailySummaryV846));
 const desk=document.getElementById('posDeskV77');desk.insertBefore(card,desk.firstChild);
 const style=posNodeV77('style');style.textContent='#posDailySummaryV846 .pos-form-grid-v77>div{display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid var(--border-color,#ddd);border-radius:8px}#posDailySummaryV846 strong{font-size:1.15rem}#reportAllTotalV846,#reportPendingV845,#reportLegacyV845,#reportRefundPendingV845{font-size:1rem!important;margin:8px 0}#statGrandTotal~p{font-size:.95rem}';document.head.append(style);
}
posMountV846();
const posRenderBeforeV846=posRenderV77;posRenderV77=function(){posRenderBeforeV846();posDailySummaryV846();};

// v84_7: all billing review and corrections stay on the drawer page.
let posInvoiceOffsetV847=0,posInvoiceRequestV847=0;
async function posInvoiceReviewV847(reset=false){
 if(!familyAllowedV74())throw Error('沒有帳款查詢與處理權限');
 if(reset)posInvoiceOffsetV847=0;const scope=posScopeNowV77(),request=++posInvoiceRequestV847;
 const start=document.getElementById('posInvoiceStartV847').value,end=document.getElementById('posInvoiceEndV847').value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)throw Error('請填正確的查詢起訖日期');
 const lower=new Date(start+'T00:00:00+08:00'),upper=new Date(new Date(end+'T00:00:00+08:00').getTime()+86400000);
 const {data,error}=await _supabase.from('invoices').select('id,created_at,checkout_type,total_amount,voided_at,void_reason').eq('tenant_id',CURRENT_TENANT_ID).gte('created_at',lower.toISOString()).lt('created_at',upper.toISOString()).order('created_at',{ascending:false}).order('id',{ascending:false}).range(posInvoiceOffsetV847,posInvoiceOffsetV847+50);
 if(error)throw Error(error.message);if(scope!==posScopeNowV77()||request!==posInvoiceRequestV847)return;
 const rows=(data||[]).slice(0,50);
 const [statuses,links]=rows.length?await Promise.all([posRpcV77('finance_status',{invoice_ids:rows.map(r=>r.id)}),posRpcV77('reissue_links_v854',{invoice_ids:rows.map(r=>r.id)})]):[{statuses:[]},{tenant_id:String(CURRENT_TENANT_ID),rows:[]}];
 if(scope!==posScopeNowV77()||request!==posInvoiceRequestV847)return;
 if(statuses.statuses.length!==rows.length)throw Error('帳單核對狀態不完整');
 if(links.tenant_id!==String(CURRENT_TENANT_ID))throw Error('新舊單院所回覆不符');
 const map=new Map(statuses.statuses.map(r=>[r.invoice_id,r])),box=document.getElementById('posInvoiceRowsV847');box.replaceChildren();
 box.append(posNodeV77('p','第 '+(posInvoiceOffsetV847+1)+'–'+(posInvoiceOffsetV847+rows.length)+' 筆；作廢保留原單並回補庫存，實際退款仍需另外記錄。'));
 for(const inv of rows){
  const row=posNodeV77('details');row.className='pos-invoice-detail-v852';
  const state=map.get(inv.id)?.state;const split=map.get(inv.id)?.revenue_split;
  row.append(posNodeV77('summary',new Date(inv.created_at).toLocaleString('zh-TW')+'｜'+(split?.has_product&&split?.has_clinic?'門診＋商品':inv.checkout_type)+'｜'+posMoneyV77(inv.total_amount)+'｜'+(({verified:'已確認入帳',pending:'已收款待核對',unlinked:'舊帳單未連結',unpaid:'待收款',voided:'已作廢'})[state]||'待核對')+'｜帳單 '+inv.id));
  const detail=posNodeV77('div');detail.append(posNodeV77('p','展開後讀取收費明細。'));row.append(detail);
  row.ontoggle=()=>{if(row.open)return posActionV77(()=>posInvoiceDetailV852({...inv,verificationV845:map.get(inv.id)},detail,scope,request));};
  const actions=posNodeV77('div');actions.className='pos-invoice-actions-v852';
  if(inv.voided_at){actions.append(posNodeV77('p','作廢原因：'+(inv.void_reason||'—')),posButtonV77('重新開立（帶入草稿）',()=>posReissuePrepareV854(inv.id)));}
  if(!inv.voided_at)actions.append(posButtonV77('作廢原帳單',async()=>{
   const result=await voidInvoice(inv.id,{refresh:false});
   if(!result||scope!==posScopeNowV77())return;
   // Server has confirmed the void. Update this card before any refresh requests.
   inv.voided_at=new Date().toISOString();inv.void_reason=result.reason;
   const heading=row.querySelector('summary');
   if(heading)heading.textContent=heading.textContent.replace(/已確認入帳|已收款待核對|舊帳單未連結|待收款|待核對/,'已作廢');
   row.open=false;
   actions.replaceChildren(posNodeV77('p','作廢原因：'+result.reason),posButtonV77('重新開立（帶入草稿）',()=>posReissuePrepareV854(inv.id)),copy);
   document.getElementById('posMessageV77').textContent='帳單已作廢並回補庫存。退款需另行處理；正在更新資料…';
   const updates=await Promise.allSettled([posRefreshV77({fresh:true,required:true}),posInvoiceReviewV847(),loadItems(),loadMedicines()]);
   if(scope===posScopeNowV77())document.getElementById('posMessageV77').textContent=updates.some(r=>r.status==='rejected')?'作廢已完成，部分畫面更新失敗，請更新資料；勿重複作廢或退款。':'帳單已作廢，資料已更新。實際退款請依原付款方式另行記錄。';
  }));
  for(const link of links.rows.filter(l=>String(l.original_invoice_id)===String(inv.id)||String(l.new_invoice_id)===String(inv.id))){const message=String(link.new_invoice_id)===String(inv.id)?'由原單 '+link.original_invoice_id+' 重新開立':'重開狀態：'+({draft:'草稿，尚未收款',paid:'已完成新單',cancelled:'草稿已取消'}[link.state]||link.state)+(link.new_invoice_id?'｜新單 '+link.new_invoice_id:'');row.append(posNodeV77('p',message+'｜原因：'+link.reason));}

  const copy=posButtonV77('填入退款帳單號',()=>{document.getElementById('posMovementReferenceV77').value=inv.id;document.getElementById('posMovementKindV77').value='refund';document.getElementById('posMovementAmountV77').value=String(inv.total_amount);document.getElementById('posMovementCardV77').scrollIntoView?.({behavior:'smooth',block:'start'});alert('已填入原帳單號與原金額，尚未退款或寫入紀錄。請確認實際退款方式、金額與原因後再記錄。');});copy.disabled=!posStateV77?.shift;actions.append(copy);row.append(actions);box.append(row);
 }
 if(!rows.length)box.replaceChildren(posNodeV77('p','此日期沒有帳單。'));
 const prev=posButtonV77('上一頁',async()=>{posInvoiceOffsetV847=Math.max(0,posInvoiceOffsetV847-50);await posInvoiceReviewV847();});prev.disabled=posInvoiceOffsetV847===0;
 const next=posButtonV77('下一頁',async()=>{posInvoiceOffsetV847+=50;await posInvoiceReviewV847();});next.disabled=(data||[]).length<=50;box.append(prev,next);
}
async function posInvoiceDetailV852(inv,box,scope,request){
 if(box.dataset.loading==='1'||box.dataset.loaded==='1')return;
 if(!familyAllowedV74()||scope!==posScopeNowV77()||request!==posInvoiceRequestV847)return;
 box.dataset.loading='1';box.replaceChildren(posNodeV77('p','正在讀取收費明細…'));
 try{
  const {data,error}=await _supabase.from('invoices').select('*, owners(id,name,mobile,phone,owner_code,system_code), invoice_items(*)').eq('tenant_id',CURRENT_TENANT_ID).eq('id',inv.id).single();
  if(error)throw Error(error.message);
  if(scope!==posScopeNowV77()||request!==posInvoiceRequestV847||!familyAllowedV74())return;
  if(data?.pet_id){const petReply=await _supabase.from('pets').select('id,name').eq('tenant_id',CURRENT_TENANT_ID).eq('id',data.pet_id).maybeSingle();if(petReply.error)throw Error(petReply.error.message);data.pets=petReply.data;}
  if(scope!==posScopeNowV77()||request!==posInvoiceRequestV847||!familyAllowedV74())return;
  if(!data||String(data.id)!==String(inv.id)||String(data.tenant_id)!==String(CURRENT_TENANT_ID))throw Error('帳單資料不符');
  box.replaceChildren();
  box.append(posNodeV77('p','飼主：'+(data.owners?.name||'散客／未指定')+'｜寵物：'+(data.pets?.name||'—')));
  const revenue=posRevenueV853(inv,inv.verificationV845?.confirmed_refunds||0);box.append(posNodeV77('p','門診金額：'+posMoneyV77(revenue.clinic_total)+'｜商品金額：'+posMoneyV77(revenue.product_total)+(inv.verificationV845?.confirmed_refunds?'（已扣核對退款）':'')+'；整單折扣按比例分攤。'));
  const table=posNodeV77('table');table.className='pos-invoice-table-v852';const head=posNodeV77('tr');
  for(const label of ['收費項目','數量','單價','小計'])head.append(posNodeV77('th',label));table.append(head);
  for(const item of data.invoice_items||[]){const line=posNodeV77('tr');for(const value of [item.item_name||'未命名項目',String(item.quantity??'—'),posMoneyV77(item.unit_price??item.price??0),posMoneyV77(item.subtotal??Number(item.quantity)*Number(item.unit_price??item.price??0))])line.append(posNodeV77('td',value));table.append(line);}
  if(data.invoice_items?.length)box.append(table);else box.append(posNodeV77('p','此帳單沒有收費項目明細。'));
  box.append(posNodeV77('p','帳單實收合計：'+posMoneyV77(data.total_amount)+'｜付款資訊：'+(data.checkout_type||'—')));
  if(data.voided_at)box.append(posNodeV77('p','作廢時間：'+new Date(data.voided_at).toLocaleString('zh-TW')+'｜原因：'+(data.void_reason||'—')));
  box.dataset.loaded='1';
 }catch(error){if(scope===posScopeNowV77()&&request===posInvoiceRequestV847){box.replaceChildren(posNodeV77('p','明細讀取失敗：'+error.message),posButtonV77('重新讀取明細',()=>posInvoiceDetailV852(inv,box,scope,request)));}}
 finally{box.dataset.loading='0';}
}
function posMountV847(){
 const card=posNodeV77('details');card.id='posInvoiceReviewV852';card.className='pos-invoice-review-v852';card.append(posNodeV77('summary','逐筆帳款明細／作廢（點此展開）'));
 card.append(posNodeV77('p','先展開個別帳單查看項目。記錯帳或需重開時，請作廢原單後重新開立；原單及原因會保留。作廢會回補已扣庫存，實際退款請另行記錄。'));
 const form=posNodeV77('div');form.className='pos-form-grid-v77';for(const [id,label] of [['posInvoiceStartV847','起始日期'],['posInvoiceEndV847','結束日期']]){const input=posInputV77('date',posTaipeiDateV845());input.id=id;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();posActionV77(()=>posInvoiceReviewV847(true));}};posLabelV77(label,input,form);}card.append(form,posButtonV77('查詢帳單',()=>posInvoiceReviewV847(true)));const rows=posNodeV77('div');rows.id='posInvoiceRowsV847';card.append(rows);document.getElementById('posDailySummaryV846').append(card);
 card.ontoggle=()=>{if(card.open)return posActionV77(()=>posInvoiceReviewV847(true));};
 const style=posNodeV77('style');style.textContent='.pos-invoice-review-v852{margin-top:14px;border-top:1px solid var(--border-color,#ddd);padding-top:12px;background:transparent}.pos-invoice-review-v852>summary,.pos-invoice-detail-v852>summary{cursor:pointer;font-weight:600;font-size:.95rem;overflow-wrap:anywhere}.pos-invoice-detail-v852{margin:10px 0;padding:10px;border:1px solid var(--border-color,#ddd);border-radius:8px;background:transparent}.pos-invoice-detail-v852 p{font-size:.9rem}.pos-invoice-actions-v852{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.pos-invoice-table-v852{width:100%;font-size:.9rem;border-collapse:collapse}.pos-invoice-table-v852 th,.pos-invoice-table-v852 td{padding:7px 5px;border-bottom:1px solid var(--border-color,#ddd);text-align:left;overflow-wrap:anywhere}.pos-invoice-review-v852 button{font-size:.85rem;padding:8px 12px}';document.head.append(style);
 document.getElementById('statGrandTotal').parentElement.append(posNodeV77('p','本頁僅查詢已確認入帳的營收。收款核對、確認入帳、退款及作廢均在「今日工作」處理。'));
}
posMountV847();

// v85: show the saved count separately from an untouched new count.
function posDrawerReviewV849(review){
 const box=document.getElementById('posDrawerExplanationV849');if(!box)return;box.replaceChildren();box.append(posNodeV77('summary','錢櫃計算與核對紀錄'));
 if(!review)return;
 const c=review.cash_parts;
 box.append(posNodeV77('p','錢櫃應有現金 '+posMoneyV77(review.expected)+'＝備用金 '+posMoneyV77(c.opening)+'＋現金實收 '+posMoneyV77(c.payment)+'－現金退款 '+posMoneyV77(c.refund)+'＋補入 '+posMoneyV77(c.in)+'－取出 '+posMoneyV77(c.out)+'＋備用金更正 '+posMoneyV77(c.opening_adjust)));
 box.append(posNodeV77('p','現金帳單淨額 '+posMoneyV77(review.valid_cash_invoice_net)+'｜現金金流淨額 '+posMoneyV77(review.cash_net)+'｜兩者差額 '+posMoneyV77(review.cash_ledger_invoice_difference)+'（備用金另計，金流保留已收及已退紀錄）'));
 for(const inv of review.voided_payments||[])box.append(posNodeV77('p','已作廢帳單 '+inv.invoice_id+'｜原帳款 '+posMoneyV77(inv.amount)+'｜'+inv.payment_method+'｜已記錄同付款方式退款 '+posMoneyV77(inv.recorded_refunds)+'｜原因：'+(inv.void_reason||'—')+'。作廢不等於已退款，請核對實際款項及退款紀錄。'));
 const saved=review.saved,data=saved?.data;
 if(data){box.append(posNodeV77('p','上次保存清點：'+new Date(saved.created_at).toLocaleString('zh-TW')+'｜實點 '+posMoneyV77(data.actual?.['現金'])+'｜當時應有 '+posMoneyV77(data.expected)+'｜差額 '+posMoneyV77(data.cash_difference)+'｜操作人 '+saved.actor+(review.count_current?'｜目前金流仍相符':'｜歷史紀錄；目前金流需重新清點核對')));
  // Keep saved denominations in the audit record; do not fill them into editable fields.
 
 }else if(review.original_closed_at){box.append(posNodeV77('p','原下班清點：'+new Date(review.original_closed_at).toLocaleString('zh-TW')+'｜當時實點 '+posMoneyV77(review.original_counted)+'｜當時應有 '+posMoneyV77(review.original_expected)+'｜原差額 '+posMoneyV77(review.original_difference)+'。這是原始紀錄，不能當成補入較早帳款後的新清點結果。'));}
}
const drawerExplanationV849=posNodeV77('details');drawerExplanationV849.id='posDrawerExplanationV849';document.getElementById('posVerifyCardV845').insertBefore(drawerExplanationV849,document.getElementById('posVerifyStatusV845'));

// v85: one visible work button handles morning start, active work and emergency return.
async function posTodayWorkV85(){
 const state=await posRefreshV77({fresh:true,required:true});if(state.schema_version!==850)throw Error('請先執行包內 v85 SQL');
 let amount=0;
 if(!state.shift&&!state.review_shift){const value=prompt('今日首次開始工作：請輸入實際開班備用金（不列入營收）','0');if(value===null)return;if(!value.trim()||!Number.isFinite(Number(value))||Number(value)<0)throw Error('備用金須為非負金額');amount=Number(value);}
 const result=await posFrozenRpcV77('today_work','today-work',{amount});
 const updated=await posRefreshV77({fresh:true,required:true});if(updated.shift?.id!==result.id)throw Error('工作狀態已變更，請重新整理後核對');
 switchTab('posShiftTabV77');document.getElementById('posMessageV77').textContent=result.mode==='resumed'?'已恢復今日工作，沿用原錢櫃與備用金。':result.mode==='started'?'今日工作已開始。':'今日工作進行中。';
 document.getElementById('posShiftInfoV77').scrollIntoView?.({behavior:'smooth',block:'center'});
 return result;
}
function posSimpleWorkMountV85(){
 const header=document.getElementById('posShiftTabV77').querySelector('.card'),button=document.getElementById('posOpenV77');button.textContent='今日工作';button.onclick=()=>posActionV77(posTodayWorkV85);button.className='btn-success';header.insertBefore(button,header.querySelector('button'));
 document.getElementById('posShiftTabV77').querySelector('h2').textContent='今日工作';document.getElementById('nav-posShiftTabV77').textContent='🧮 今日工作';header.querySelector('p').textContent='開始營業或下班後急診，按「今日工作」。最後離開時，清點並按「結束今日工作」。';
 for(const b of header.querySelectorAll('button'))if(b.textContent==='更新當班資料')b.textContent='重新整理';
 const tools=posNodeV77('details');tools.append(posNodeV77('summary','其他工具'));for(const b of [...header.querySelectorAll('button')])if(b.textContent.includes('核對上次交班'))tools.append(b);header.append(tools);
 const bank=document.getElementById('posBankPendingV845').parentElement,details=posNodeV77('details');details.className=bank.className;details.append(posNodeV77('summary','其他日期的帳款'));while(bank.firstChild)details.append(bank.firstChild);details.querySelector('h3')?.remove();bank.replaceWith(details);
 for(const b of document.getElementById('posHomeV77').querySelectorAll('button'))if(b.textContent.includes('開班／下班結算')){b.textContent='今日工作';b.onclick=()=>posActionV77(posTodayWorkV85);}
 const style=posNodeV77('style');style.textContent='#posOpenBoxV77{display:none!important}#posOpenV77{padding:10px 24px;font-size:1rem}#posShiftTabV77 details[hidden],#posLegacyV845[hidden]{display:none!important}';document.head.append(style);
}
posSimpleWorkMountV85();

// v85_3: one invoice/payment, independent medical and product revenue.
function posRevenueV853(invoice,refund=0){
 const split=invoice.verificationV845?.revenue_split;
 if(!split||split.version!==853)throw Error('請先執行 v85_3 門診與商品收入分類 SQL，再更新資料');
 const total=Math.max(0,Number(invoice.total_amount||0)-Number(refund||0));
 const product=split.net_product_total!==undefined?Number(split.net_product_total):Math.round((total*Number(split.product_ratio)+Number.EPSILON)*100)/100;
 return {...split,product_total:product,clinic_total:split.net_clinic_total!==undefined?Number(split.net_clinic_total):Math.round((total-product+Number.EPSILON)*100)/100};
}

// v85_4: prescription progress survives payment; reissue drafts are cloud-backed.
let posWorkRequestV854=0,posPaidOffsetV854=0,posReissueOffsetV854=0;
function posHasDrugsV854(q){return (q.draft.medicationGroups||[]).some(g=>g.drugs?.length)||(q.draft.lines||[]).some(l=>l.stock_kind==='medicine');}
function posProgressV854(q,parent){
 const rx=posHasDrugsV854(q),paid=q.state==='paid';
 parent.append(posNodeV77('span','付款：'+(paid?'已付款':'待收款')),posNodeV77('span',rx?'調劑：'+(q.dispensing==='未調劑'?'未調劑':'已調劑'):'調劑：無處方藥'),posNodeV77('span',rx?'交付：'+(q.dispensing==='已交付'?'已交付':'尚未交付'):'交付：無處方藥'));
}
function posDispensingControlV854(q){
 const select=posNodeV77('select');for(const value of ['未調劑','已調劑','已交付']){const o=posNodeV77('option',value);o.value=value;select.append(o);}select.value=q.dispensing;select.setAttribute('aria-label','處方調劑與交付狀態');select.disabled=!posHasDrugsV854(q);
 select.onchange=()=>posActionV77(async()=>{const order=['未調劑','已調劑','已交付'];let reason='';if(order.indexOf(select.value)<order.indexOf(q.dispensing)){if(CURRENT_PROFILE?.role!=='admin'){select.value=q.dispensing;throw Error('退回較早進度須管理者處理');}reason=prompt('請填寫退回較早調劑／交付進度的原因')||'';if(reason.trim().length<2){select.value=q.dispensing;throw Error('請填寫至少兩字的更正原因');}}try{await posRpcV77('dispensing',{id:q.id,version:q.version,value:select.value,reason});await posRefreshV77({fresh:true,required:true});}catch(e){select.value=q.dispensing;throw e;}});return select;
}
async function posWorkLoadV854(){
 const scope=posScopeNowV77(),req=++posWorkRequestV854,box=document.getElementById('posPaidRowsV854'),drafts=document.getElementById('posReissueRowsV854');
 if(!scope||!(familyAllowedV74()||posMedicalV77())){box.replaceChildren();drafts.replaceChildren();return;}
 try{const reply=await posRpcV77('work_list_v854',{offset:posPaidOffsetV854,reissue_offset:posReissueOffsetV854});if(scope!==posScopeNowV77()||req!==posWorkRequestV854)return;
  if(reply.tenant_id!==String(CURRENT_TENANT_ID)||reply.version!==854)throw Error('請先執行 v85_4 SQL');
  box.replaceChildren();drafts.replaceChildren();document.getElementById('posPaidSummaryV854').textContent='已付款／交付進度（'+reply.paid_total+' 筆，點此展開）';
  for(const q of reply.paid){const row=posNodeV77('div');row.className='pos-row-v77';row.append(posNodeV77('span',(q.draft.ownerName||'飼主')+'｜'+q.draft.billingPetName+'｜'+posMoneyV77(q.draft.total)));posProgressV854(q,row);row.append(posDispensingControlV854(q));box.append(row);}
  if(!reply.paid.length)box.append(posNodeV77('p','目前沒有待交付或今日已付款的帳單。'));
  function pages(parent,offset,total,update){const prev=posButtonV77('上一頁',async()=>{update(Math.max(0,offset-50));await posWorkLoadV854();});prev.disabled=!offset;const next=posButtonV77('下一頁',async()=>{update(offset+50);await posWorkLoadV854();});next.disabled=offset+50>=total;if(total>50||offset)parent.append(prev,next);}
  pages(box,posPaidOffsetV854,reply.paid_total,x=>posPaidOffsetV854=x);
  const draftCard=document.getElementById('posReissueCardV854');draftCard.hidden=!reply.reissue_total;document.getElementById('posReissueSummaryV854').textContent='重新開立草稿（'+reply.reissue_total+' 筆，尚未收款）';
  for(const r of reply.reissues){const row=posNodeV77('div');row.className='pos-row-v77';const a=r.after_data;row.append(posNodeV77('span',a.draft.ownerName+'｜'+a.draft.billingPetName+'｜'+posMoneyV77(a.draft.total)+'｜原單 '+a.original_invoice_id),posButtonV77('接手重開草稿',()=>posReissueEditorV854({...a,id:r.id})));drafts.append(row);}
  pages(drafts,posReissueOffsetV854,reply.reissue_total,x=>posReissueOffsetV854=x);
 }catch(e){if(scope===posScopeNowV77()&&req===posWorkRequestV854){box.replaceChildren(posNodeV77('p','進度讀取失敗：'+e.message));drafts.replaceChildren();}}
}
function posReissueEditorV854(root){
 if(root.state!=='draft'){alert(root.new_invoice_id?'此原單已重開，新的帳單號：'+root.new_invoice_id:'草稿已結束');return;}
 if(posEditV77&&!confirm('放棄目前尚未儲存的修改，接手重開草稿？'))return;
 posSelectedV77=null;posEditV77=JSON.parse(JSON.stringify(root.draft));posRenderEditorV77({id:root.id,version:root.version,draft:root.draft,reissue:root});document.getElementById('posEditorV77').scrollIntoView?.({behavior:'smooth',block:'start'});
}
async function posReissuePrepareV854(invoiceId){
 const reason=prompt('請填寫重新開立原因；只建立草稿，尚未收款或扣庫存');if(reason===null)return;if(reason.trim().length<2)throw Error('請填寫至少兩字的原因');
 const reply=await posFrozenRpcV77('reissue_prepare_v854','reissue-prepare:'+invoiceId,{invoice_id:invoiceId,reason:reason.trim()});
 await posWorkLoadV854();switchTab('posTabV77');posReissueEditorV854(reply);
}
async function posReissuePayV854(q,method){
 const key='reissue-pay:'+q.id,scope=posScopeNowV77();const shift=await posRequireShiftV84();
 const pending=JSON.parse(sessionStorage.getItem(posKeyV77(key))||'null');
 const request=pending||posFrozenV77(key,{draft_id:q.id,version:q.version,method,shift_id:shift.id,tendered:posTenderV77(method,q.draft.total)});
 const result=await posFrozenRpcV77('reissue_pay_v854',key,request);if(scope!==posScopeNowV77())throw Error('登入身分已變更');sessionStorage.removeItem(posKeyV77(key));posReceiptV77(result,q.draft,request.method,q.reissue.kind);posEditV77=null;posSelectedV77=null;await posRefreshV77({fresh:true,required:true});await posInvoiceReviewV847();
}
function posWorkMountV854(){
 const paid=posNodeV77('details');paid.className='pos-progress-card-v854';const title=posNodeV77('summary','已付款／交付進度（點此展開）');title.id='posPaidSummaryV854';paid.append(title);const rows=posNodeV77('div');rows.id='posPaidRowsV854';paid.append(rows);
 const reissues=posNodeV77('details');reissues.id='posReissueCardV854';reissues.className='pos-progress-card-v854';reissues.hidden=true;const head=posNodeV77('summary','重新開立草稿');head.id='posReissueSummaryV854';reissues.append(head);const dr=posNodeV77('div');dr.id='posReissueRowsV854';reissues.append(dr);document.getElementById('posQueueV77').after(paid,reissues);
 const style=posNodeV77('style');style.textContent='.pos-progress-card-v854{margin:12px 0;padding:10px;border:1px solid var(--border-color,#ddd);border-radius:8px;background:transparent}.pos-progress-card-v854>summary{cursor:pointer;font-weight:600}.pos-progress-card-v854[hidden]{display:none!important}#posQueueV77 .pos-row-v77>span:not(:first-child),#posPaidRowsV854 .pos-row-v77>span:not(:first-child){font-size:.85rem;padding:4px 7px;border:1px solid var(--border-color,#ddd);border-radius:6px}';document.head.append(style);
}
posWorkMountV854();
const posRenderBeforeV854=posRenderV77;posRenderV77=function(){posRenderBeforeV854();posWorkLoadV854();};
