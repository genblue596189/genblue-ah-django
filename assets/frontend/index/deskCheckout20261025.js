// Each visit uses the existing cloud queue; the desk chooses the payer's pets.
let deskOwner20261025='',deskScope20261025='',deskSelected20261025=new Set(),deskListed20261025=new Set(),deskMethod20261025='現金';
function deskSaved20261025(){return JSON.parse(sessionStorage.getItem(posKeyV77('family-pending'))||'null');}
function deskReceipt20261025(result,method){
 const entries=result.invoices.map(i=>i.draft),names=entries.map(d=>d.billingPetName).join('、');
 openReceiptModal({id:result.request_id,created_at:result.created_at,checkout_type:'門診收費 ('+method+')',subtotal:result.subtotal,discount:result.discount,total_amount:result.total},escapeCheckoutText(entries[0].ownerName),escapeCheckoutText(names),[]);
 const body=document.getElementById('receiptItemsTableBody');if(!body)return;
 function line(name,qty,amount){const row=document.createElement('tr');for(const value of [name,qty,amount]){const td=document.createElement('td');td.textContent=value;row.append(td);}body.append(row);}
 for(const i of result.invoices){const d=i.draft;line(d.billingPetName+'｜帳單 '+i.invoice_id,'','');for(const l of [...d.lines,...d.medicationGroups.map(g=>({item_name:medicationGroupLabelsV64[g.kind],quantity:1,unit_price:g.price}))])line(l.item_name,l.quantity,posMoneyV77(l.quantity*l.unit_price));line(d.billingPetName+' 小計（折扣 '+posMoneyV77(d.discount)+'）','',posMoneyV77(d.total));}
}
async function deskPay20261025(method){
 if(!familyAllowedV74())throw Error('沒有收款權限');
 if(posEditV77)throw Error('請先儲存或取消明細修改，再勾選收款');
 const scope=posScopeNowV77();let request=deskSaved20261025();
 if(!request){
  const shift=await posRequireShiftV84();const selected=posStateV77.pending.filter(q=>deskSelected20261025.has(q.id));
  if(!selected.length||selected.length>20)throw Error('請勾選1至20筆帳單');
  if(selected.some(q=>q.draft.ownerId!==deskOwner20261025))throw Error('請只選同一飼主');
  const total=selected.reduce((s,q)=>s+Number(q.draft.total),0);
  if(!confirm(selected[0].draft.ownerName+'\n'+selected.map(q=>q.draft.billingPetName+'：'+posMoneyV77(q.draft.total)).join('\n')+'\n本次合計 '+posMoneyV77(total)+'（'+method+'）\n確認只收取以上勾選項目？'))return;
  const tendered=posTenderV77(method,total);
  request={id:crypto.randomUUID(),entries:selected.map(q=>({id:crypto.randomUUID(),pending_id:q.id,version:q.version})),method,shift_id:shift.id,tendered};
  sessionStorage.setItem(posKeyV77('family-pending'),JSON.stringify(request));
 }
 let result;
 try{result=await posCheckoutDjangoV7('family_pending',request);}catch(e){if(posRejectedV77(e))sessionStorage.removeItem(posKeyV77('family-pending'));deskRender20261025();throw e;}
 if(scope!==posScopeNowV77())return;
 // Preserve the returned receipt before clearing the frozen request.
 sessionStorage.setItem(posKeyV77('family-pending-receipt'),JSON.stringify({result,method:request.method}));
 sessionStorage.removeItem(posKeyV77('family-pending'));deskSelected20261025.clear();deskListed20261025.clear();deskOwner20261025='';
 for(const invoice of result.invoices){try{markServiceChargesPaid(invoice.draft.serviceIds||[],invoice.invoice_id);}catch{document.getElementById('posMessageV77').textContent='收款已完成，部分本機費用狀態未更新，請勿再次收款。';}}
 deskReceipt20261025(result,request.method);
 await Promise.allSettled([loadItems(),loadMedicines(),loadAppointments()]);await posRefreshV77({fresh:true,required:true});
}
let deskSearch20261025='';
function deskRender20261025(){
 const box=document.getElementById('posQueueV77'),state=posStateV77;if(!box||!state||!familyAllowedV74())return;
 const scope=posScopeNowV77();if(deskScope20261025!==scope){deskScope20261025=scope;deskOwner20261025='';deskSelected20261025.clear();deskSearch20261025='';deskMethod20261025='現金';}
 const rows=state.pending;
 for(const id of deskSelected20261025)if(!rows.some(q=>q.id===id&&q.draft.ownerId===deskOwner20261025))deskSelected20261025.delete(id);
 box.replaceChildren();
 const frozen=deskSaved20261025();
 if(frozen){box.append(posNodeV77('p','上次收款結果尚未確認，請核對同一筆收款。'),posButtonV77('核對上次勾選收款',()=>deskPay20261025(frozen.method)));return;}
 const search=posInputV77('search',deskSearch20261025);search.value=deskSearch20261025;search.placeholder='搜尋寵物、飼主或電話，按 Enter';search.setAttribute('aria-label','搜尋待付款');
 const query=()=>{deskSearch20261025=search.value.trim();deskRender20261025();};search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();query();}};
 box.append(search,posButtonV77('搜尋',query),posButtonV77('顯示全部',()=>{deskSearch20261025='';deskRender20261025();}),posButtonV77('更新待付款',()=>posRefreshV77({fresh:true,required:true})));
 const groups=new Map();for(const q of rows){const id=q.draft.ownerId||q.id;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(q);}
 const term=deskSearch20261025.toLocaleLowerCase();let shown=0;
 for(const [owner,entries] of groups){
  if(term&&!entries.some(q=>[q.draft.ownerName,q.draft.billingPetName,q.draft.ownerPhone,q.draft.phone].filter(Boolean).join(' ').toLocaleLowerCase().includes(term)))continue;
  shown++;
  const group=posNodeV77('section');group.style.cssText='margin:16px 0;border:1px solid var(--border-color,#ddd);border-radius:10px;padding:12px';
  const multiple=new Set(entries.map(q=>q.draft.billingPetId)).size>1&&!!entries[0].draft.ownerId;
  group.append(posNodeV77('h3',entries[0].draft.ownerName+'｜'+entries.length+' 筆待付款'));
  if(multiple)group.append(posNodeV77('p','同飼主多隻寵物：直接勾選下方項目一起付款，也可逐筆核對收款。'));
  for(const q of entries){
   const row=posNodeV77('div');row.className='pos-row-v77';
   if(multiple){const check=posInputV77('checkbox','');check.checked=deskSelected20261025.has(q.id);check.setAttribute('aria-label','合併結帳：'+q.draft.billingPetName);
    check.onchange=()=>{
     if(check.checked&&deskSelected20261025.size&&deskOwner20261025!==owner){check.checked=false;alert('只能合併同一飼主的帳單，請先取消其他飼主的勾選。');return;}
     if(check.checked){deskOwner20261025=owner;deskSelected20261025.add(q.id);}else deskSelected20261025.delete(q.id);
     deskRender20261025();
    };posLabelV77(q.draft.billingPetName+'｜小計 '+posMoneyV77(q.draft.total),check,row);
   }else row.append(posNodeV77('strong',q.draft.billingPetName+'｜小計 '+posMoneyV77(q.draft.total)));
   posProgressV854(q,row);
   row.append(posButtonV77('接手／核對明細',()=>{if(deskSelected20261025.size)throw Error('目前已勾選合併付款，請先取消勾選後再逐筆核對收款');if(posEditV77&&!confirm('放棄尚未儲存的修改？'))return;posSelectedV77=q.id;posEditV77=JSON.parse(JSON.stringify(q.draft));posRenderEditorV77(q);}));
   row.append(posDispensingControlV854(q));group.append(row);
  }box.append(group);
 }
 if(!shown)box.append(posNodeV77('p',rows.length?'沒有符合的待付款。':'目前沒有待付款帳單。'));
 const chosen=rows.filter(q=>deskSelected20261025.has(q.id));
 if(chosen.length){
  const summary=posNodeV77('section');summary.style.cssText='padding:14px;border:2px solid #57785f;border-radius:8px';
  summary.append(posNodeV77('h3','本次合併付款：'+chosen[0].draft.ownerName),posNodeV77('p',chosen.map(q=>q.draft.billingPetName+' '+posMoneyV77(q.draft.total)).join('、')),posNodeV77('p','已勾選 '+chosen.length+' 筆｜合計 '+posMoneyV77(chosen.reduce((s,q)=>s+Number(q.draft.total),0))));
  const method=posNodeV77('select');for(const m of ['現金','信用卡','轉帳','行動支付'])method.add(new Option(m,m));method.value=deskMethod20261025;method.setAttribute('aria-label','合併付款方式');method.onchange=()=>{deskMethod20261025=method.value;};
  const pay=posButtonV77('確認勾選項目並收款',()=>deskPay20261025(method.value));pay.className='btn-success';
  summary.append(method,pay,posButtonV77('取消全部勾選',()=>{deskSelected20261025.clear();deskOwner20261025='';deskRender20261025();}));box.append(summary);
 }
 const receipt=JSON.parse(sessionStorage.getItem(posKeyV77('family-pending-receipt'))||'null');if(receipt)box.append(posButtonV77('重開最近合併收據',()=>deskReceipt20261025(receipt.result,receipt.method)));
}
const deskRenderOriginal20261025=posRenderV77;
posRenderV77=function(...args){const r=deskRenderOriginal20261025.apply(this,args);deskRender20261025();return r;};
const deskFamilyOriginal20261025=renderFamilyV74;
renderFamilyV74=function(...args){const r=deskFamilyOriginal20261025.apply(this,args);document.getElementById('familyMedicalV74').hidden=true;document.getElementById('familyBillingNextV903')?.remove();const legacy=familyStateNowV74();document.getElementById('familyBillingV74').hidden=!familyAllowedV74()||!legacy?.entries.length;return r;};
const deskEditorOriginal20261025=posRenderEditorV77;
posRenderEditorV77=function(q){deskEditorOriginal20261025(q);if(q.reissue)return;const box=document.getElementById('posEditorV77');box.append(posButtonV77('取消修改／回待付款清單',()=>{posEditV77=null;posSelectedV77=null;box.replaceChildren();deskRender20261025();}));};
// Both individual and combined payments retain the existing frozen-request protections.
const deskSinglePayOriginal20261025=posPayV77;
posPayV77=async function(...args){if(deskSaved20261025())throw Error('請先核對上次合併收款');if(deskSelected20261025.size)throw Error('請先取消合併勾選，再進行單筆收款');return deskSinglePayOriginal20261025.apply(this,args);};
// Keep the doctor's existing fee entry; no family choice belongs on this screen.
document.getElementById('posStageV77').textContent='確認本隻費用並送至待付款';
const actions=document.getElementById('invoiceCheckoutActionsV902');
const deskSwitchOriginal20261025=switchTab;
switchTab=function(...args){const r=deskSwitchOriginal20261025.apply(this,args);if(actions)for(const b of actions.querySelectorAll('button'))if((b.getAttribute('onclick')||'').includes('processInvoiceCheckoutToArchive'))b.hidden=false;const presets=document.getElementById('bp80-settings-open');if(presets)presets.hidden=typeof CURRENT_PROFILE==='undefined'||CURRENT_PROFILE?.role!=='admin';return r;};
renderFamilyV74();
