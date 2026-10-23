
let paidFilterScopeV907='',paidDateV907='',paidHistoryModeV907=false;
function paidTodayV907(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());}
function paidDayV907(value){const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(date):'';}
function paidFilterResetV907(force=false){
 const scope=posScopeNowV77(),today=paidTodayV907();if(!force&&scope===paidFilterScopeV907&&today===paidDateV907)return;
 paidFilterScopeV907=scope;paidDateV907=today;paidHistoryModeV907=false;posPaidOffsetV854=0;
 for(const id of ['paidHistoryFromV907','paidHistoryToV907'])document.getElementById(id).value=today;
}
function paidProgressMatchesV907(q,invoices,from,to){
 // Prefer recorded invoice identity. Never treat draft creation or dispensing updates as payment time.
 const ids=[q.invoice_id,q.paid_invoice_id,q.invoice?.id,q.payment?.invoice_id,q.receipt?.invoice_id,q.result?.invoice_id].filter(Boolean),links=invoices.filter(inv=>ids.includes(inv.id));
 if(ids.length)return links.some(inv=>!inv.voided_at&&paidDayV907(inv.created_at)>=from&&paidDayV907(inv.created_at)<=to);
 if(links.length)return links.some(inv=>!inv.voided_at&&paidDayV907(inv.created_at)>=from&&paidDayV907(inv.created_at)<=to);
 const date=paidDayV907(q.paid_at||q.paidAt||q.payment?.paid_at||null);
 return !!date&&date>=from&&date<=to;
}
async function paidInvoicesV907(from,to,scope,req,offset=null){
 const lower=new Date(from+'T00:00:00+08:00'),upper=new Date(to+'T00:00:00+08:00');upper.setUTCDate(upper.getUTCDate()+1);
 const rows=[];let start=offset??0;
 for(;;){const limit=offset===null?1000:51;const {data,error}=await _supabase.from('invoices').select('id,tenant_id,owner_id,pet_id,created_at,checkout_type,total_amount,voided_at,owners(name,mobile,phone,owner_code,system_code)').eq('tenant_id',CURRENT_TENANT_ID).is('voided_at',null).gte('created_at',lower.toISOString()).lt('created_at',upper.toISOString()).order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+limit-1);
  if(scope!==posScopeNowV77()||req!==posWorkRequestV854)return null;if(error)throw error;
  rows.push(...(data||[]));if(offset!==null||(data||[]).length<limit)break;start+=limit;
 }return rows;
}
function paidHistoryPagesV907(parent,offset,hasNext){
 const actions=posNodeV77('div');actions.style.cssText='display:flex;gap:8px;margin:10px 0';
 const prev=posButtonV77('上一頁',async()=>{posPaidOffsetV854=Math.max(0,offset-50);await posWorkLoadV854();});prev.disabled=offset===0;
 const next=posButtonV77('下一頁',async()=>{posPaidOffsetV854=offset+50;await posWorkLoadV854();});next.disabled=!hasNext;
 if(offset||hasNext){actions.append(prev,next);parent.append(actions);}
}
async function posWorkLoadV854(){
 paidFilterResetV907();const scope=posScopeNowV77(),req=++posWorkRequestV854,box=document.getElementById('posPaidRowsV854'),drafts=document.getElementById('posReissueRowsV854');
 if(!scope||!(familyAllowedV74()||posMedicalV77())){box.replaceChildren();drafts.replaceChildren();return;}
 const mode=paidHistoryModeV907,from=mode?document.getElementById('paidHistoryFromV907').value:paidDateV907,to=mode?document.getElementById('paidHistoryToV907').value:paidDateV907;
 const valid=()=>scope===posScopeNowV77()&&req===posWorkRequestV854;
 box.textContent='正在讀取'+(mode?'日期區間':'今日')+'已付款紀錄…';
 try{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw Error('請填正確起訖日期，開始日不能晚於結束日');
  const invoices=await paidInvoicesV907(from,to,scope,req,mode?posPaidOffsetV854:null);if(!valid()||!invoices)return;
  let reply=await posRpcV77('work_list_v854',{offset:0,reissue_offset:posReissueOffsetV854});if(!valid())return;
  if(reply.tenant_id!==String(CURRENT_TENANT_ID)||reply.version!==854||!Array.isArray(reply.paid)||!Array.isArray(reply.reissues))throw Error('進度資料版本或院所不符，請確認既有 v85_4 SQL');
  const allPaid=[...reply.paid];
  if(!mode)for(let offset=50;offset<Number(reply.paid_total);offset+=50){const next=await posRpcV77('work_list_v854',{offset,reissue_offset:posReissueOffsetV854});if(!valid())return;if(next.tenant_id!==String(CURRENT_TENANT_ID)||next.version!==854||!Array.isArray(next.paid))throw Error('進度資料回覆不完整');allPaid.push(...next.paid);}
  box.replaceChildren();drafts.replaceChildren();
  if(mode){
   const rows=invoices.slice(0,50);document.getElementById('posPaidSummaryV854').textContent='已結帳紀錄查詢（'+from+'～'+to+'，本頁 '+rows.length+' 筆）';
   const ids=[...new Set(rows.map(i=>i.pet_id).filter(Boolean))],pets=new Map();
   if(ids.length){const {data,error}=await _supabase.from('pets').select('id,name').eq('tenant_id',CURRENT_TENANT_ID).in('id',ids);if(!valid())return;if(error)throw error;for(const p of data||[])pets.set(p.id,p.name);}
   if(!valid())return;
   for(const inv of rows){const row=posNodeV77('div');row.className='pos-row-v77';const owner=inv.owners,code=[owner?.system_code?'新:'+owner.system_code:'',owner?.owner_code?'舊:'+owner.owner_code:''].filter(Boolean).join('／');
    row.append(posNodeV77('span',new Date(inv.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+'｜'+(code?'['+code+'] ':'')+(owner?.name||'未指定飼主')+'｜'+(pets.get(inv.pet_id)||'未指定寵物')+'｜'+posMoneyV77(inv.total_amount)),posNodeV77('span',inv.checkout_type||'已結帳'),posNodeV77('span','帳單：'+inv.id));box.append(row);
   }
   if(!rows.length)box.append(posNodeV77('p','此日期區間沒有有效的已結帳紀錄。'));
   box.append(posNodeV77('p','此處查詢正式帳單；不推測未提供的歷史調劑或交付狀態。'));
   paidHistoryPagesV907(box,posPaidOffsetV854,invoices.length>50);
  }else{
   const paid=[...new Map(allPaid.filter(q=>paidProgressMatchesV907(q,invoices,from,to)).map(q=>[q.id,q])).values()];
   document.getElementById('posPaidSummaryV854').textContent='今日已付款／交付進度（'+paid.length+' 筆，點此展開）';
   const offset=Math.min(posPaidOffsetV854,Math.max(0,Math.floor((paid.length-1)/50)*50));posPaidOffsetV854=offset;
   for(const q of paid.slice(offset,offset+50)){const row=posNodeV77('div');row.className='pos-row-v77';row.append(posNodeV77('span',(q.draft.ownerName||'飼主')+'｜'+q.draft.billingPetName+'｜'+posMoneyV77(q.draft.total)));posProgressV854(q,row);row.append(posDispensingControlV854(q));box.append(row);}
   if(!paid.length)box.append(posNodeV77('p','今日沒有已付款／交付進度。之前已結帳的資料可用上方日期查詢。'));
   paidHistoryPagesV907(box,offset,offset+50<paid.length);
  }
  const card=document.getElementById('posReissueCardV854');card.hidden=!reply.reissue_total;document.getElementById('posReissueSummaryV854').textContent='重新開立草稿（'+reply.reissue_total+' 筆，尚未收款）';
  for(const r of reply.reissues){const row=posNodeV77('div');row.className='pos-row-v77';const a=r.after_data;row.append(posNodeV77('span',a.draft.ownerName+'｜'+a.draft.billingPetName+'｜'+posMoneyV77(a.draft.total)+'｜原單 '+a.original_invoice_id),posButtonV77('接手重開草稿',()=>posReissueEditorV854({...a,id:r.id})));drafts.append(row);}
  if(reply.reissue_total>50||posReissueOffsetV854){const prev=posButtonV77('上一頁',async()=>{posReissueOffsetV854=Math.max(0,posReissueOffsetV854-50);await posWorkLoadV854();}),next=posButtonV77('下一頁',async()=>{posReissueOffsetV854+=50;await posWorkLoadV854();});prev.disabled=!posReissueOffsetV854;next.disabled=posReissueOffsetV854+50>=reply.reissue_total;drafts.append(prev,next);}
 }catch(e){if(valid()){box.replaceChildren(posNodeV77('p','紀錄讀取失敗：'+e.message));drafts.replaceChildren();}}
}
function paidHistoryMountV907(){
 const box=posNodeV77('div');box.id='paidHistoryFiltersV907';const paid=document.getElementById('posPaidRowsV854');
 for(const [id,label] of [['paidHistoryFromV907','開始日期'],['paidHistoryToV907','結束日期']]){const input=posInputV77('date','');input.id=id;posLabelV77(label,input,box);}
 const query=()=>{paidHistoryModeV907=true;posPaidOffsetV854=0;return posWorkLoadV854();};
 box.append(posButtonV77('查詢已結帳紀錄',query),posButtonV77('只看今日進度',async()=>{paidFilterResetV907(true);await posWorkLoadV854();}));
 box.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();void posActionV77(query);}};paid.before(box);paidFilterResetV907(true);
 paid.parentElement.ontoggle=()=>{if(paid.parentElement.open){paidFilterResetV907(true);void posWorkLoadV854();}};
 document.getElementById('genblueVersionV84').textContent=' · v90.7';
}
paidHistoryMountV907();
