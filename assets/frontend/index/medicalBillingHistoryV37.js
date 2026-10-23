
let medicalBillingRequest=0,medicalBillingRows=[],medicalBillingOffset=0,medicalBillingBusy=false;
function medicalBillingScope(){return `${CURRENT_TENANT_ID}|${CURRENT_USER?.id||''}|${currentPetId||''}`;}
function medicalBillingMoney(value){if(value===null||value===undefined||value==='')return '金額未填';const n=Number(value);return Number.isFinite(n)?'NT$ '+n.toLocaleString('zh-TW',{maximumFractionDigits:2}):'金額未填';}
function renderMedicalBillingRows(hasMore){
 const box=document.getElementById('medicalBillingContent');box.replaceChildren();
 const latest=medicalBillingRows.find(i=>!i.voided_at);
 const summary=document.createElement('p');summary.style.cssText='font-weight:bold;color:#0369a1;margin:0 0 10px';
 summary.textContent=latest?`最近一筆有效門診收費：${medicalBillingMoney(latest.total_amount)}｜${new Date(latest.created_at).toLocaleString('zh-TW')}`:'目前載入的紀錄中沒有有效門診帳單。';box.appendChild(summary);
 const note=document.createElement('p');note.style.cssText='font-size:12px;color:#64748b';note.textContent='依此寵物的已結帳帳單列出，不以日期自動配對病歷；未結帳費用及舊系統病歷文字中的費用不計入。';box.appendChild(note);
 for(const invoice of medicalBillingRows){
  const entry=document.createElement('details');entry.style.cssText='border-bottom:1px dashed #cbd5e1;padding:8px 0';
  const title=document.createElement('summary');title.textContent=`${new Date(invoice.created_at).toLocaleString('zh-TW')}｜${medicalBillingMoney(invoice.total_amount)}｜${invoice.checkout_type||'門診'}｜${invoice.clinician_name_v57||'醫師未記錄'}${invoice.voided_at?'｜已作廢':''}`;if(invoice.voided_at)title.style.color='#b91c1c';entry.appendChild(title);
  const list=document.createElement('div');list.style.cssText='padding:8px;font-size:13px';
  for(const item of (invoice.invoice_items||[]).filter(x=>x.receipt_visible_v64!==false)){const row=document.createElement('p');row.style.margin='4px 0';const amount=item.subtotal??(Number(item.quantity)*Number(item.unit_price));row.textContent=`${item.item_name||'未命名項目'}｜數量 ${item.quantity??'未填'}｜單價 ${medicalBillingMoney(item.unit_price)}｜小計 ${medicalBillingMoney(amount)}`;list.appendChild(row);}
  if(!(invoice.invoice_items||[]).length){const row=document.createElement('p');row.textContent='此帳單沒有可讀取的項目明細。';list.appendChild(row);}
  const totals=document.createElement('p');totals.textContent=`原價 ${medicalBillingMoney(invoice.subtotal)}｜折扣 ${medicalBillingMoney(invoice.discount)}｜結帳金額 ${medicalBillingMoney(invoice.total_amount)}`;list.appendChild(totals);
  if(invoice.voided_at){const status=document.createElement('p');status.textContent=`作廢時間：${new Date(invoice.voided_at).toLocaleString('zh-TW')}｜原因：${invoice.void_reason||'未填'}`;list.appendChild(status);}
  entry.appendChild(list);box.appendChild(entry);
 }
 const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;margin-top:10px';
 const refresh=document.createElement('button');refresh.className='btn-secondary';refresh.textContent='重新整理';refresh.onclick=()=>loadMedicalBillingHistory(false);actions.appendChild(refresh);
 if(hasMore){const more=document.createElement('button');more.className='btn-secondary';more.textContent='載入更多';more.onclick=()=>loadMedicalBillingHistory(true);actions.appendChild(more);}box.appendChild(actions);
}
async function loadMedicalBillingHistory(append=false){
 const box=document.getElementById('medicalBillingContent');if(!box)return;
 if(!currentPetId){box.textContent='請先選擇寵物。';return;}
 if(medicalBillingBusy)return;
 const tenant=CURRENT_TENANT_ID,petId=currentPetId,scope=medicalBillingScope(),request=++medicalBillingRequest,offset=append?medicalBillingOffset:0;
 medicalBillingBusy=true;if(!append){medicalBillingRows=[];medicalBillingOffset=0;box.textContent='正在讀取此寵物的門診收費紀錄…';}
 const valid=()=>request===medicalBillingRequest&&scope===medicalBillingScope();
 try{
  const {data,error}=await _supabase.from('invoices').select('*, invoice_items(*)').eq('tenant_id',tenant).eq('pet_id',petId).or('category.eq.門診,checkout_type.like.門診收費%').order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+19);
  if(!valid())return;if(error)throw error;
  medicalBillingRows.push(...(data||[]));medicalBillingOffset=offset+(data||[]).length;renderMedicalBillingRows((data||[]).length===20);
 }catch(error){if(valid()){box.textContent='收費紀錄讀取失敗，請確認帳號具備帳單查閱權限後重試。';const retry=document.createElement('button');retry.className='btn-secondary';retry.textContent='重新讀取';retry.onclick=()=>loadMedicalBillingHistory(false);box.appendChild(retry);}}
 finally{if(valid())medicalBillingBusy=false;}
}
const billingOriginalReset=resetCurrentPetClinicalHistories;
resetCurrentPetClinicalHistories=function(){billingOriginalReset();medicalBillingRequest++;medicalBillingBusy=false;medicalBillingRows=[];medicalBillingOffset=0;const panel=document.getElementById('medicalBillingPanel');if(panel)panel.open=false;const box=document.getElementById('medicalBillingContent');if(box)box.textContent=currentPetId?'點擊展開查詢此寵物已結帳紀錄。':'請先選擇寵物。';syncMedicalHistoryButton('medicalBillingPanel');};

