
// v75.2: scoped, read-only previous paid outpatient charges next to prescription entry.
let previousChargeRequestV75_2=0,previousChargeStateV75_2=null;
function previousChargeScopeV75_2(){return JSON.stringify([doctorScopeV51(),currentPetId]);}
function clearPreviousChargesV75_2(){previousChargeRequestV75_2++;previousChargeStateV75_2=null;const box=document.getElementById('previousChargeBodyV75_2');if(box)box.textContent=currentPetId?'開啟看診後顯示此寵物的過去收費。':'請先選擇寵物。';}
function previousChargeDateV75_2(value){const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'}):'日期未記錄';}
function previousChargeItemsV75_2(invoice){return (Array.isArray(invoice.invoice_items)?invoice.invoice_items:[]).filter(item=>item.receipt_visible_v64!==false);}
function previousChargeLineAmountV75_2(item){return item.subtotal??(Number(item.quantity)*Number(item.unit_price));}
function renderPreviousChargesV75_2(rows){
 const box=document.getElementById('previousChargeBodyV75_2');box.replaceChildren();
 if(!rows.length){box.textContent='這隻寵物尚無可查閱的有效門診結帳紀錄。';return;}
 const latest=rows[0],summary=document.createElement('p');summary.className='previous-charge-latest-v75';summary.textContent='上次實收 '+medicalBillingMoney(latest.total_amount)+' · '+previousChargeDateV75_2(latest.created_at)+' · '+(latest.clinician_name_v57||'醫師未記錄');box.append(summary);
 const fees=previousChargeItemsV75_2(latest).filter(item=>item.medicine_group_v64);
 if(fees.length){const p=document.createElement('p');p.className='previous-charge-fees-v75';p.textContent='上次藥費：'+fees.map(item=>(item.item_name||'藥費')+' '+medicalBillingMoney(previousChargeLineAmountV75_2(item))).join('／');box.append(p);}
 const list=document.createElement('div');list.className='previous-charge-list-v75';
 for(const invoice of rows){
  const entry=document.createElement('details'),title=document.createElement('summary');title.textContent=previousChargeDateV75_2(invoice.created_at)+' · '+medicalBillingMoney(invoice.total_amount)+' · '+(invoice.clinician_name_v57||'醫師未記錄')+'（明細）';entry.append(title);
  const items=previousChargeItemsV75_2(invoice);
  for(const item of items){const p=document.createElement('p');p.textContent=(item.item_name||'未命名項目')+'｜'+(item.quantity??'未填')+' × '+medicalBillingMoney(item.unit_price)+'＝'+medicalBillingMoney(previousChargeLineAmountV75_2(item));entry.append(p);}
  if(!items.length){const p=document.createElement('p');p.textContent='此帳單未提供可查閱的項目明細。';entry.append(p);}
  const totals=document.createElement('p');totals.textContent='原價 '+medicalBillingMoney(invoice.subtotal)+' · 折扣 '+medicalBillingMoney(invoice.discount)+' · 實收 '+medicalBillingMoney(invoice.total_amount);entry.append(totals);list.append(entry);
 }
 box.append(list);
}
async function loadPreviousChargesV75_2(force=false){
 const box=document.getElementById('previousChargeBodyV75_2');if(!box)return;
 if(!currentPetId||!doctorScopeV51()){clearPreviousChargesV75_2();return;}
 if(!familyAllowedV74()){clearPreviousChargesV75_2();box.textContent='此帳號未啟用收費查閱權限；可請管理者在員工權限設定中確認。';return;}
 const tenant=CURRENT_TENANT_ID,pet=currentPetId,scope=previousChargeScopeV75_2();
 if(!force&&previousChargeStateV75_2?.scope===scope&&(previousChargeStateV75_2.busy||previousChargeStateV75_2.ready))return;
 const request=++previousChargeRequestV75_2,state={scope,busy:true,ready:false,rows:[]};previousChargeStateV75_2=state;box.textContent='正在讀取過去收費…';
 const valid=()=>request===previousChargeRequestV75_2&&scope===previousChargeScopeV75_2()&&state===previousChargeStateV75_2&&familyAllowedV74();
 try{
  const {data,error}=await _supabase.from('invoices').select('*, invoice_items(*)').eq('tenant_id',tenant).eq('pet_id',pet).is('voided_at',null).or('category.eq.門診,checkout_type.like.門診收費%').order('created_at',{ascending:false}).order('id',{ascending:false}).range(0,4);
  if(!valid())return;if(error)throw error;
  state.rows=(data||[]).filter(invoice=>invoice.tenant_id===tenant&&invoice.pet_id===pet&&!invoice.voided_at&&(invoice.category==='門診'||String(invoice.checkout_type||'').startsWith('門診收費')));state.ready=true;renderPreviousChargesV75_2(state.rows);
 }catch(error){if(valid())box.textContent='過去收費暫時無法讀取，請按「更新」重試。';}
 finally{if(valid())state.busy=false;}
}
function openPreviousChargeHistoryV75_2(){
 const panel=document.getElementById('medicalBillingPanel');if(!panel)return;panel.open=true;syncMedicalHistoryButton(panel.id);void loadMedicalBillingHistory(false);panel.scrollIntoView({block:'nearest',behavior:'smooth'});
}
const previousChargeResetOriginalV75_2=resetCurrentPetClinicalHistories;
resetCurrentPetClinicalHistories=function(...args){clearPreviousChargesV75_2();return previousChargeResetOriginalV75_2.apply(this,args);};
const previousChargeHistoryOriginalV75_2=loadAllMedicalRecords;
loadAllMedicalRecords=function(petId,...args){if(petId===currentPetId)void loadPreviousChargesV75_2();return previousChargeHistoryOriginalV75_2.call(this,petId,...args);};
const previousChargeSwitchOriginalV75_2=switchTab;
switchTab=function(...args){const result=previousChargeSwitchOriginalV75_2.apply(this,args);if(args[0]==='medical'&&document.getElementById('medical')?.classList.contains('active'))void loadPreviousChargesV75_2();return result;};
const previousChargeBillingOriginalV75_2=loadMedicalBillingHistory;
loadMedicalBillingHistory=async function(append=false){const result=await previousChargeBillingOriginalV75_2.call(this,append);if(!append)void loadPreviousChargesV75_2(true);return result;};
const previousChargeLogoutOriginalV75_2=logoutSupabase;
logoutSupabase=function(...args){clearPreviousChargesV75_2();const result=previousChargeLogoutOriginalV75_2.apply(this,args);clearPreviousChargesV75_2();return result;};

