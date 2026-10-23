
// v90: read-only owner purchase history; use the existing authoritative product split.
let purchaseRequestV90=0,purchaseStateV90=null,purchaseLimitV90=50;
function purchaseScopeV90(){return JSON.stringify([doctorScopeV51(),currentOwnerId,currentPetId]);}
function purchaseDayV90(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');}
function purchaseResetV90(){
 purchaseRequestV90++;purchaseStateV90=null;purchaseLimitV90=50;
 const panel=document.getElementById('medicalPurchasesV90');if(!panel)return;panel.open=false;
 for(const id of ['purchaseKeywordV90','purchaseFromV90','purchaseToV90'])document.getElementById(id).value='';
 document.getElementById('purchasePetV90').value='owner';document.getElementById('purchaseResultsV90').replaceChildren();
 document.getElementById('purchaseStatusV90').textContent='點此展開查詢目前飼主的過往商品購買紀錄。';document.getElementById('purchaseMoreV90').hidden=true;
}
function purchaseRowsV90(invoices,statuses,tenant,owner){
 const map=new Map(statuses.map(s=>[s.invoice_id,s]));return invoices.flatMap(inv=>{
  if(inv.tenant_id!==tenant||inv.owner_id!==owner||inv.voided_at)return [];
  const status=map.get(inv.id),split=status?.revenue_split;
  if(!status||split?.version!==853)throw Error('商品分類資料不完整，請確認既有 v85_3 商品收入分類已安裝');
  if(status.state==='unpaid'||status.state==='voided'||status.status==='unpaid'||status.status==='voided'||!split.has_product)return [];
  if(!Array.isArray(split.product_lines)||!split.product_lines.length)throw Error('商品帳單缺少商品明細，請先到帳款查詢核對');
  return split.product_lines.map(item=>({invoice:inv,item,refund:Number(status.confirmed_refunds||0)>0}));
 });
}
function purchaseRenderV90(){
 const state=purchaseStateV90;if(!state||state.scope!==purchaseScopeV90()||!state.ready||!familyAllowedV74())return;
 const keyword=document.getElementById('purchaseKeywordV90').value.trim().toLocaleLowerCase(),from=document.getElementById('purchaseFromV90').value,to=document.getElementById('purchaseToV90').value,petOnly=document.getElementById('purchasePetV90').value==='pet';
 const box=document.getElementById('purchaseResultsV90'),message=document.getElementById('purchaseStatusV90');box.replaceChildren();document.getElementById('purchaseMoreV90').hidden=true;
 if(from&&to&&from>to){message.textContent='開始日期不能晚於結束日期。';return;}
 const rows=state.rows.filter(r=>{const day=purchaseDayV90(r.invoice.created_at);return (!keyword||String(r.item.item_name||r.item.name||'').toLocaleLowerCase().includes(keyword))&&(!from||day>=from)&&(!to||day<=to)&&(!petOnly||r.invoice.pet_id===currentPetId);});
 message.textContent=rows.length?'共 '+rows.length+' 筆商品明細，依購買時間由新到舊。顯示 '+Math.min(rows.length,purchaseLimitV90)+' 筆。':'沒有符合條件的商品購買紀錄。';
 if(!rows.length)return;
 const table=posNodeV77('table'),head=posNodeV77('thead'),hr=posNodeV77('tr');for(const title of ['購買日期','商品名稱','數量','單價','商品小計','寵物／備註'])hr.append(posNodeV77('th',title));head.append(hr);table.append(head);const body=posNodeV77('tbody');
 for(const r of rows.slice(0,purchaseLimitV90)){const i=r.item,inv=r.invoice,price=i.unit_price??i.price,amount=i.subtotal??i.line_total??(price!=null&&i.quantity!=null?Number(price)*Number(i.quantity):null),pet=state.pets.get(inv.pet_id)||(!inv.pet_id?'未指定寵物':inv.pet_id===currentPetId?currentPetName:'寵物未記錄'),tr=posNodeV77('tr');
  for(const text of [new Date(inv.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),i.item_name||i.name||'未命名商品',i.quantity??'未記錄',medicalBillingMoney(price),medicalBillingMoney(amount),pet+(r.refund?'｜此帳單有退款，請核對帳款':'' )])tr.append(posNodeV77('td',String(text)));body.append(tr);
 }table.append(body);box.append(table);document.getElementById('purchaseMoreV90').hidden=rows.length<=purchaseLimitV90;
}
async function purchaseLoadV90(force=false){
 const scope=purchaseScopeV90(),panel=document.getElementById('medicalPurchasesV90'),message=document.getElementById('purchaseStatusV90');
 if(!panel||!currentOwnerId||!currentPetId||!doctorScopeV51()){purchaseResetV90();return;}
 if(!familyAllowedV74()){purchaseRequestV90++;purchaseStateV90=null;document.getElementById('purchaseResultsV90').replaceChildren();message.textContent='此帳號未啟用帳單查閱權限，請管理者確認收費權限設定。';return;}
 if(!force&&purchaseStateV90?.scope===scope){if(purchaseStateV90.ready)purchaseRenderV90();if(purchaseStateV90.ready||purchaseStateV90.busy)return;}
 const request=++purchaseRequestV90,tenant=CURRENT_TENANT_ID,owner=currentOwnerId,state={scope,busy:true,ready:false,rows:[],pets:new Map()};purchaseStateV90=state;purchaseLimitV90=50;document.getElementById('purchaseResultsV90').replaceChildren();document.getElementById('purchaseMoreV90').hidden=true;message.textContent='正在讀取此飼主的商品購買紀錄…';
 const valid=()=>request===purchaseRequestV90&&scope===purchaseScopeV90()&&purchaseStateV90===state&&familyAllowedV74();
 try{
  for(let offset=0;;offset+=100){
   const {data,error}=await _supabase.from('invoices').select('id,tenant_id,owner_id,pet_id,created_at,voided_at').eq('tenant_id',tenant).eq('owner_id',owner).is('voided_at',null).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+99);
   if(!valid())return;if(error)throw error;const invoices=data||[];
   if(invoices.length){const reply=await posRpcV77('finance_status',{invoice_ids:invoices.map(i=>i.id)});if(!valid())return;
    if(reply.tenant_id!==String(tenant)||!Array.isArray(reply.statuses)||reply.statuses.length!==invoices.length||invoices.some(i=>!reply.statuses.some(s=>s.invoice_id===i.id)))throw Error('帳單查詢回覆不完整');
    state.rows.push(...purchaseRowsV90(invoices,reply.statuses,tenant,owner));
   }message.textContent='正在查詢…已檢查 '+(offset+invoices.length)+' 張帳單。';if(invoices.length<100)break;
  }
  const ids=[...new Set(state.rows.map(r=>r.invoice.pet_id).filter(Boolean))];
  for(let n=0;n<ids.length;n+=100){const {data,error}=await _supabase.from('pets').select('id,name').eq('tenant_id',tenant).in('id',ids.slice(n,n+100));if(!valid())return;if(error)throw error;for(const p of data||[])state.pets.set(p.id,p.name);}
  if(!valid())return;state.ready=true;purchaseRenderV90();
 }catch(e){if(valid()){state.rows=[];message.textContent='購買紀錄尚未讀取完成：'+e.message+'。請按「更新紀錄」重試。';}}
 finally{if(valid())state.busy=false;}
}
function purchaseMountV90(){
 const anchor=document.getElementById('previousChargeReferenceV75_2');if(!anchor)return;
 const panel=posNodeV77('details');panel.id='medicalPurchasesV90';panel.append(posNodeV77('summary','🛍 過往商品購買紀錄（點此展開）'));
 const note=posNodeV77('p','查詢目前飼主旗下全部寵物及未指定寵物的商品購買，包含門診追加商品。已作廢帳單不列入；商品小計為折扣前金額，退款提示以整張帳單為準。');note.style.cssText='font-size:12px;color:#7b886f;margin:8px 0';panel.append(note);
 const filters=posNodeV77('div');filters.id='purchaseFiltersV90';
 const keyword=posInputV77('search','');keyword.id='purchaseKeywordV90';keyword.placeholder='輸入商品名稱，按 Enter';posLabelV77('商品名稱',keyword,filters);
 for(const [id,label] of [['purchaseFromV90','開始日期'],['purchaseToV90','結束日期']]){const input=posInputV77('date','');input.id=id;posLabelV77(label,input,filters);}
 const select=posNodeV77('select');select.id='purchasePetV90';for(const [value,text] of [['owner','此飼主全部購買'],['pet','只看目前寵物']]){const o=posNodeV77('option',text);o.value=value;select.append(o);}posLabelV77('查詢範圍',select,filters);
 const button=(text,fn)=>{const b=posNodeV77('button',text);b.type='button';b.className='btn-secondary';b.onclick=fn;return b;};
 const search=()=>{purchaseLimitV90=50;void purchaseLoadV90();};filters.append(button('查詢',search),button('清除條件',()=>{for(const id of ['purchaseKeywordV90','purchaseFromV90','purchaseToV90'])document.getElementById(id).value='';select.value='owner';search();}),button('更新紀錄',()=>purchaseLoadV90(true)));
 filters.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search();}};select.onchange=search;panel.append(filters);
 const status=posNodeV77('p');status.id='purchaseStatusV90';status.setAttribute('role','status');status.setAttribute('aria-live','polite');const result=posNodeV77('div');result.id='purchaseResultsV90';panel.append(status,result);
 const more=button('顯示更多商品',()=>{purchaseLimitV90+=50;purchaseRenderV90();});more.id='purchaseMoreV90';more.hidden=true;panel.append(more);anchor.after(panel);panel.ontoggle=()=>{if(panel.open)void purchaseLoadV90();};purchaseResetV90();
}
const purchaseResetOriginalV90=resetCurrentPetClinicalHistories;resetCurrentPetClinicalHistories=function(...args){purchaseResetV90();return purchaseResetOriginalV90.apply(this,args);};
const purchaseClearOriginalV90=clearMedicalFormInputs;clearMedicalFormInputs=function(...args){purchaseResetV90();return purchaseClearOriginalV90.apply(this,args);};
const purchaseLogoutOriginalV90=logoutSupabase;logoutSupabase=function(...args){purchaseResetV90();return purchaseLogoutOriginalV90.apply(this,args);};
const purchaseSwitchOriginalV90=switchTab;switchTab=function(...args){const result=purchaseSwitchOriginalV90.apply(this,args);if(args[0]==='medical'&&purchaseStateV90&&purchaseStateV90.scope!==purchaseScopeV90())purchaseResetV90();return result;};
purchaseMountV90();document.getElementById('genblueVersionV84').textContent=' · v90';
