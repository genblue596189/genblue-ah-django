
// v74: same-owner visits, durable per-tab checkout drafts and atomic family checkout.
function visitPurposeV74(notes){return String(notes||'').match(/^\[來院目的\] (看診|疫苗|回診|檢查|拿藥|急診|住院)$/m)?.[1]||'未註記';}
function purposeNotesV74(notes,control='globalVisitPurposeV74'){const purpose=document.getElementById(control)?.value||'看診';return '[來院目的] '+(['看診','疫苗','回診','檢查','拿藥','急診','住院'].includes(purpose)?purpose:'看診')+(String(notes||'').replace(/^\[來院目的\] .*\n?/gm,'').trim()?'\n'+String(notes||'').replace(/^\[來院目的\] .*\n?/gm,'').trim():'');}
let familyStateV74=null,familyScopeV74='',familyBusyV74=false,familyNextPetV74=null;
function familyAllowedV74(){return !!doctorScopeV51()&&(CURRENT_PROFILE?.role==='admin'||(CURRENT_PROFILE?.permission_checkout??(CURRENT_PROFILE?.role==='staff'||(CURRENT_PROFILE?.role==='doctor'&&CURRENT_PROFILE?.can_checkout===true))));}
function familyKeyV74(scope=doctorScopeV51()){return 'genblue-family-v74:'+scope;}
function familyStateNowV74(){
 const scope=doctorScopeV51();if(!scope)return null;
 if(scope!==familyScopeV74){familyScopeV74=scope;familyNextPetV74=null;familyStateV74={scope,entries:[],requestId:null,pending:null,lastReceipt:null};
  try{const saved=JSON.parse(sessionStorage.getItem(familyKeyV74(scope))||'null');if(saved?.scope===scope&&Array.isArray(saved.entries)&&saved.entries.length<=20)familyStateV74=saved;}catch{}}
 return familyStateV74;
}
function persistFamilyV74(state){if(!state||state.scope!==doctorScopeV51())throw Error('登入身分已變更');sessionStorage.setItem(familyKeyV74(state.scope),JSON.stringify(state));familyStateV74=state;}
function familyHasAppointmentV74(id){return !!id&&!!familyStateNowV74()?.entries.some(e=>e.billingAppointmentId===id);}
let familyInvoiceTouchedV74=false;
function familyBillHasContentV74(){
 const rows=[...document.querySelectorAll('#invoiceItemsList .list-row')];
 if(!familyInvoiceTouchedV74&&!clinicalInvoiceContext&&!clinicalMedicationGroupsV64&&!document.getElementById('invoiceOwnerSelect')?.value&&rows.length===1&&rows[0].querySelector('.invoice-name')?.value==='一般門診診察費'&&Number(rows[0].querySelector('.invoice-qty')?.value)===1&&Number(rows[0].querySelector('.invoice-price')?.value)===250&&Number(document.getElementById('invoiceDiscount')?.value||0)===0)return false;
 return rows.some(r=>r.querySelector('.invoice-name')?.value.trim());
}
function familyMessageV74(text){const p=document.getElementById('familyMessageV74');if(p)p.textContent=text;}
function familyButtonV74(label,fn,disabled=false){const b=document.createElement('button');b.type='button';b.className='btn-secondary';b.textContent=label;b.disabled=disabled;b.onclick=fn;return b;}
function familyMoneyV74(value){return 'NT$ '+Number(value).toLocaleString('zh-TW',{maximumFractionDigits:2});}
function familyPayloadV74(e,payment){return {p_tenant_id:CURRENT_TENANT_ID,p_owner_id:e.ownerId,p_pet_id:e.billingPetId,p_checkout_type:'門診收費 ('+payment+')',p_category:'門診',p_appointment_id:e.billingAppointmentId,p_subtotal:e.subtotal,p_discount:e.discount,p_total:e.total,p_lines:e.lines,...(e.medicationGroups.length?{p_medication_groups:e.medicationGroups}:{})};}
function clearFamilyBillV74(){clinicalInvoiceContext=null;clinicalMedicationGroupsV64=null;document.getElementById('invoiceItemsList').replaceChildren();document.getElementById('invoiceDiscount').value='0';currentAppointmentId=null;clearMedicalFormInputs();calculateInvoiceTotal();}
async function stageFamilyBillV74(){
 if(familyBusyV74||inventoryCheckoutBusy)return false;const scope=doctorScopeV51();familyBusyV74=true;
 try{
  if(!familyAllowedV74())throw Error('此帳號沒有結帳權限');const state=familyStateNowV74();if(state.pending)throw Error('上一批結帳結果未確認，請先重試核對');
  const draft=collectInvoiceDraftV74();if(!draft.ownerId||!draft.billingPetId||!draft.billingAppointmentId)throw Error('請從有效掛號的門診或候診列表轉入收費');
  const prior=state.entries.find(e=>e.billingAppointmentId===draft.billingAppointmentId);if(state.entries.length>=20&&!prior)throw Error('一批最多20隻寵物');if(state.entries.some(e=>e.ownerId!==draft.ownerId))throw Error('待收清單已有另一位飼主，請先完成該飼主結帳');
  if(state.entries.some(e=>(e.billingPetId===draft.billingPetId||e.billingAppointmentId===draft.billingAppointmentId)&&!(e===prior&&e.releasePending)))throw Error('這隻寵物已加入待收，請用清單的「修改明細」');
  const lookup=await _supabase.from('appointments').select('id,tenant_id,pet_id,owner_id,status').eq('tenant_id',CURRENT_TENANT_ID).eq('id',draft.billingAppointmentId).single();
  if(lookup.error)throw lookup.error;if(scope!==doctorScopeV51())return false;
  const appointment=lookup.data;if(!appointment||appointment.pet_id!==draft.billingPetId||appointment.owner_id!==draft.ownerId||!['候診中','診間看診中'].includes(appointment.status))throw Error('掛號資料不符或已結束，請核對帳單');
  const entry=JSON.parse(JSON.stringify({...draft,medicationSource:clinicalMedicationGroupsV64,releasePending:appointment.status==='診間看診中'&&doctorVisitV51?.scope===scope&&doctorVisitV51.petId===draft.billingPetId}));
  const next={...state,entries:[...state.entries.filter(e=>e!==prior),entry],requestId:state.requestId||crypto.randomUUID()};persistFamilyV74(next);
  // Store fees before releasing the claim; a failed release retains a recoverable draft.
  if(entry.releasePending){
   const verified=await clinicDjangoRpcV4('verify_clinic_visit_v51',{p_pet_id:draft.billingPetId,p_claim_id:doctorVisitV51.claimId});if(verified.error)throw verified.error;if(scope!==doctorScopeV51())return false;if(verified.data!==true)throw Error('費用已加入，但未確認原看診權；請先核對原掛號');
   const response=await _supabase.from('appointments').update({status:'候診中'}).eq('id',draft.billingAppointmentId).eq('tenant_id',CURRENT_TENANT_ID).eq('status','診間看診中').eq('clinician_id_v57',CURRENT_USER.id).select('id').single();
   if(response.error)throw Error('費用已加入，但返回候診未成功：'+response.error.message);
   if(scope!==doctorScopeV51())return false;entry.releasePending=false;persistFamilyV74(next);
  }
  if(doctorVisitV51?.scope===scope&&doctorVisitV51.petId===draft.billingPetId){doctorVisitV51=null;clinicClaimsV51.delete(draft.billingPetId);}
  clearFamilyBillV74();familyMessageV74(draft.billingPetName+'已加入合併待收，尚未收款或扣庫存。');renderFamilyV74();
  const target=familyNextPetV74;familyNextPetV74=null;if(target&&target.scope===scope)await openFamilyPetV74(target.pet);
  else {await loadAppointments();renderFamilyV74();}return true;
 }catch(e){if(scope===doctorScopeV51()){familyMessageV74(e.message);alert(e.message+'。目前資料保留。');renderFamilyV74();}return false;}
 finally{familyBusyV74=false;renderFamilyV74();}
}
function restoreFamilyBillV74(appointmentId){
 if(familyBusyV74||inventoryCheckoutBusy||!familyAllowedV74())return;
 const state=familyStateNowV74();if(state.pending){alert('結帳結果未確認，請先重試核對');return;}if(familyBillHasContentV74()){alert('請先加入或完成目前帳單，再修改清單中的明細');return;}
 const entry=state.entries.find(e=>e.billingAppointmentId===appointmentId);if(!entry)return;
 try{persistFamilyV74({...state,entries:state.entries.filter(e=>e!==entry)});}catch(e){alert('暫存未更新，原清單保留：'+e.message);return;}
 const list=document.getElementById('invoiceItemsList');list.replaceChildren();document.getElementById('invoiceOwnerSelect').value=entry.ownerId;document.getElementById('invoiceDiscount').value=entry.discount;
 clinicalInvoiceContext={tenantId:CURRENT_TENANT_ID,ownerId:entry.ownerId,petId:entry.billingPetId,petName:entry.billingPetName,appointmentId:entry.billingAppointmentId};
 currentAppointmentId=entry.billingAppointmentId;currentPetId=entry.billingPetId;currentOwnerId=entry.ownerId;currentPetName=entry.billingPetName;
 for(const [index,line] of (entry.nightBaseV93?.lines||entry.lines).entries()){
  const row=document.createElement('div');row.className='list-row';if(line.stock_id){row.dataset.medicineId=line.stock_id;row.dataset.medicineName=loadedMedicinesMap[line.stock_id]?.name||'';}
  // Original service IDs are keyed to their rows, not their position among all lines.
  const original=entry.serviceRows?.find(x=>x.index===index);if(original)row.dataset.serviceChargeId=original.id;
  for(const [cls,value,type] of [['invoice-name',line.item_name,'text'],['invoice-qty',line.quantity,'number'],['invoice-price',line.unit_price,'number']]){const input=document.createElement('input');input.className=cls;input.type=type;input.value=value;input.oninput=calculateInvoiceTotal;row.appendChild(input);}
  row.appendChild(familyButtonV74('移除',()=>{row.remove();calculateInvoiceTotal();}));list.appendChild(row);
 }
 clinicalMedicationGroupsV64=null;
 if(entry.medicationGroups.length){appendMedicationGroupsV64(entry.medicationGroups);for(const row of list.querySelectorAll('[data-medication-group-v64]'))row.querySelector('.invoice-price').value=(entry.nightBaseV93?.medicationGroups||entry.medicationGroups).find(g=>g.kind===row.dataset.medicationGroupV64).price;}
 calculateInvoiceTotal();switchTab('invoices');familyMessageV74('請修改明細後重新加入合併待收。');renderFamilyV74();
}
async function openFamilyPetV74(pet){
 const scope=doctorScopeV51();await loadAppointments();if(scope!==doctorScopeV51())return;
 const appointment=activeAppointmentsList.find(p=>p.id===pet.id&&p.status!=='已預約');
 if(familyHasAppointmentV74(appointment?.appointment_id)){alert('此寵物已在合併待收，請先於收費頁修改明細');return;}
 await startDoctorConsultationV51([pet.id,pet.microchip||'',pet.name,pet.owner_id,pet.weight||0,pet.owner_name||pet.owners?.name||'',pet.birthday||'',pet.gender||'',pet.species||'',pet.breed||''],appointment?.appointment_id||null);
 renderFamilyV74();
}
async function switchFamilyMedicalV74(){
 if(familyBusyV74||medicalSaveBusy||doctorOpeningV51)return;
 const id=document.getElementById('familyMedicalPetV74').value;
 const pet=allPetsListForDropdown.find(p=>p.id===id&&p.owner_id===currentOwnerId);if(!pet||pet.id===currentPetId)return;
 if(familyStateNowV74()?.pending){alert('請先重試並核對尚未確認的合併結帳');return;}
 if(familyStateNowV74()?.entries.some(e=>e.billingPetId===pet.id)){alert('此寵物已在合併待收，請到收費頁修改其明細');return;}
 if(!familyAllowedV74()){alert('此切換流程會保留費用，需要結帳權限；請先儲存並返回候診，由有權限者接續。');return;}
 if(familyBillHasContentV74()){const bill=clinicalInvoiceContext;switchTab('invoices');if(bill?.ownerId===currentOwnerId||bill?.ownerId===pet.owner_id){familyNextPetV74={scope:doctorScopeV51(),pet};familyMessageV74('目前費用尚未加入待收；核對藥費後按「加入同飼主合併待收」，即可接著開啟 '+pet.name+'。');}else familyMessageV74('目前尚有另一張帳單，請先核對；未清除任何明細。');return;}
 const scope=doctorScopeV51(),original=currentPetId;familyNextPetV74={scope,pet};
 await saveMedicalRecordAndDirectCheckout();if(scope!==doctorScopeV51())return;
 if(currentPetId===original||clinicalInvoiceContext?.petId!==original){familyNextPetV74=null;return;}
 familyMessageV74('切換前請確認本隻費用；填妥藥費後按「加入同飼主合併待收」，接著開啟 '+pet.name+'。');
 // Fee review happens on the billing page, including explicit prices for medications.
 renderFamilyV74();
}
async function checkoutFamilyV74(){
 if(familyBusyV74||inventoryCheckoutBusy)return;const scope=doctorScopeV51();familyBusyV74=true;inventoryCheckoutBusy=true;
 try{
  if(!familyAllowedV74())throw Error('此帳號沒有結帳權限');let state=familyStateNowV74();if(!state.entries.length)throw Error('請先把每隻寵物的帳單加入待收清單');
  if(familyBillHasContentV74())throw Error('收費頁還有一隻未加入的帳單，請先加入清單');
  if(state.entries.some(e=>e.releasePending))throw Error('原看診尚未成功返回候診，請先修改明細並重新加入以確認狀態');
  const payment=document.getElementById('invoicePaymentMethod')?.value||'現金';
  if(!state.pending){const sum=state.entries.reduce((s,e)=>s+e.total,0);if(!confirm('飼主：'+state.entries[0].ownerName+'\n'+state.entries.map(e=>e.billingPetName+'：'+familyMoneyV74(e.total)).join('\n')+'\n合計 '+familyMoneyV74(sum)+'，以'+payment+'一次收款？'))return;
   state={...state,pending:{p_tenant_id:CURRENT_TENANT_ID,p_owner_id:state.entries[0].ownerId,p_request_id:state.requestId,p_entries:state.entries.map(e=>familyPayloadV74(e,payment))}};persistFamilyV74(state);}
  const {data,error}=await posFamilyRpcV77(state.pending);
  if(scope!==doctorScopeV51())return;
  if(error){
   // PostgreSQL SQLSTATE confirms a rejected transaction; network / HTTP errors keep the payload frozen.
   if(error.code==='GB_LOCAL_PREPARE'||/^(?:P0001|42501|22[0-9A-Z]{3}|23[0-9A-Z]{3}|40001|40P01)$/.test(error.code||'')){persistFamilyV74({...state,pending:null});}
   throw error;
  }
  if(!data?.request_id||data.request_id!==state.requestId||data.owner_id!==state.entries[0].ownerId||data.invoices?.length!==state.entries.length||state.entries.some(e=>!data.invoices.some(i=>i.pet_id===e.billingPetId&&i.appointment_id===e.billingAppointmentId&&i.invoice_id)))throw Error('未取得完整帳單確認，保留同一請求供重試');
  const receipt={data,entries:state.entries,payment:state.pending.p_entries[0].p_checkout_type,created_at:new Date().toISOString()};
  // Persist the confirmation before local UI cleanup. A failed write still safely replays the same DB request.
  persistFamilyV74({...state,entries:[],pending:null,requestId:null,lastReceipt:receipt});
  for(const e of receipt.entries){const invoice=data.invoices.find(i=>i.appointment_id===e.billingAppointmentId);try{markServiceChargesPaid(e.serviceIds,invoice.invoice_id);}catch{alert('帳單已儲存，待收費暫存更新失敗；請核對帳單 '+invoice.invoice_id+'，勿重新收費。');}await finishDoctorInvoiceV57(e.billingAppointmentId);}
  showFamilyReceiptV74(receipt);familyMessageV74('整批收款、帳單、完診與庫存已完成。');
  const refreshed=await Promise.allSettled([loadItems(),loadMedicines(),loadAppointments()]);if(refreshed.some(r=>r.status==='rejected'))familyMessageV74('帳單已完成，部分畫面更新失敗；請更新資料，勿重新收費。');
 }catch(e){if(scope===doctorScopeV51()){familyMessageV74('未確認合併結帳完成：'+(e.message||String(e))+'。清單保留，可重試同一請求；請勿另建帳單。');alert(document.getElementById('familyMessageV74')?.textContent||e.message);}}
 finally{familyBusyV74=false;inventoryCheckoutBusy=false;renderFamilyV74();}
}
function showFamilyReceiptV74(receipt=familyStateNowV74()?.lastReceipt){
 if(!receipt||!familyAllowedV74())return;const {data,entries,payment,created_at}=receipt;
 openReceiptModal({id:data.request_id,created_at,checkout_type:payment,subtotal:data.subtotal,discount:data.discount,total_amount:data.total},entries[0].ownerName,entries.map(e=>e.billingPetName).join('、'),[]);
 const body=document.getElementById('receiptItemsTableBody');if(!body)return;
 function line(name,qty,amount){const row=document.createElement('tr');for(const value of [name,qty,amount]){const td=document.createElement('td');td.textContent=value;row.appendChild(td);}body.appendChild(row);}
 for(const e of entries){const invoice=data.invoices.find(i=>i.appointment_id===e.billingAppointmentId);line(e.billingPetName+'｜帳單 '+invoice.invoice_id.slice(0,8),'','');
  for(const l of [...e.lines,...e.medicationGroups.map(g=>({item_name:medicationGroupLabelsV64[g.kind],quantity:1,unit_price:g.price}))])line(l.item_name,l.quantity,familyMoneyV74(l.quantity*l.unit_price));
  line(e.billingPetName+' 小計（折扣 '+familyMoneyV74(e.discount)+'）','',familyMoneyV74(e.total));}
}
function renderFamilyV74(){
 const state=familyStateNowV74(),allowed=familyAllowedV74(),box=document.getElementById('familyQueueV74');if(!box)return;
 document.getElementById('familyBillingV74').hidden=!allowed;document.getElementById('familyHomeV74').hidden=!allowed||!state?.entries.length;
 const select=document.getElementById('familyMedicalPetV74'),previous=select.value;select.replaceChildren();const none=document.createElement('option');none.value='';none.textContent='選擇同飼主的下一隻寵物';select.appendChild(none);
 const siblings=currentOwnerId?allPetsListForDropdown.filter(p=>p.owner_id===currentOwnerId&&p.id!==currentPetId):[];
 for(const pet of siblings){const o=document.createElement('option');o.value=pet.id;const queued=state?.entries.some(e=>e.billingPetId===pet.id);o.disabled=!!queued;o.textContent=pet.name+'（'+(pet.species||'寵物')+'）'+(queued?' 已加入待收':'');select.appendChild(o);}select.value=previous;
 document.getElementById('familyMedicalV74').hidden=!allowed||!currentPetId||!siblings.length;
 box.replaceChildren();if(!allowed||!state)return;
 const locked=familyBusyV74||inventoryCheckoutBusy||!!state.pending;
 document.getElementById('familyStageV74').disabled=locked;document.getElementById('familyPayV74').disabled=familyBusyV74||inventoryCheckoutBusy||!state.entries.length;
 document.getElementById('familyPayV74').textContent=state.pending?'重試並核對同一批結帳':'整批收款並開合併收據';
 document.getElementById('familyLastReceiptV74').hidden=!state.lastReceipt;
 const summary=state.entries.length?state.entries[0].ownerName+'｜'+state.entries.length+' 隻｜合計 '+familyMoneyV74(state.entries.reduce((sum,e)=>sum+e.total,0)):'尚無合併待收帳單';
 document.getElementById('familyHomeTextV74').textContent=summary;const p=document.createElement('p');p.textContent=summary;box.appendChild(p);
 if(state.pending){const warning=document.createElement('p');warning.textContent='上一批結果尚未確認；明細與付款方式已保留，請按重試核對。';box.appendChild(warning);}
 for(const e of state.entries){const row=document.createElement('div');row.className='family-row-v74';const details=document.createElement('details'),title=document.createElement('summary');title.textContent=e.billingPetName+'｜'+familyMoneyV74(e.total)+(e.releasePending?'｜需確認返回候診':'');details.appendChild(title);
  for(const line of [...e.lines,...e.medicationGroups.map(g=>({item_name:medicationGroupLabelsV64[g.kind],quantity:1,unit_price:g.price}))]){const info=document.createElement('p');info.textContent=line.item_name+' × '+line.quantity+'＝'+familyMoneyV74(line.quantity*line.unit_price);details.appendChild(info);}
  const d=document.createElement('p');d.textContent='折扣：'+familyMoneyV74(e.discount);details.appendChild(d);row.append(details,familyButtonV74('修改明細',()=>restoreFamilyBillV74(e.billingAppointmentId),locked));box.appendChild(row);
 }
}
function setHomeVaccineExpandedV9010(expanded){
 const box=document.getElementById('homeVaccineListV74'),button=document.getElementById('homeVaccineToggleV9010');
 if(!box||!button)return;
 box.hidden=!expanded;button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'收合提醒':'展開提醒';
 if(expanded)renderHomeVaccinesV74();
}
function changeHomeVaccineRangeV9010(){setHomeVaccineExpandedV9010(false);}
function renderHomeVaccinesV74(){
 const panel=document.getElementById('homeVaccinesV74'),box=document.getElementById('homeVaccineListV74');if(!panel||!box)return;
 const allowed=!!doctorScopeV51()&&(CURRENT_PROFILE?.role==='admin'||(CURRENT_PROFILE?.permission_clinical??CURRENT_PROFILE?.role==='doctor'));panel.hidden=!allowed;box.replaceChildren();if(!allowed){setHomeVaccineExpandedV9010(false);return;}if(box.hidden)return;
 const rows=currentClinicVaccineRows(),today=vaccineToday(),days=Number(document.getElementById('homeVaccineDaysV74').value)||30;
 const reminders=vaccineReminderRows(rows,today,days,'both');const p=document.createElement('p');p.className='home-vaccine-count-v74';p.textContent='逾期／'+days+' 天內到期 · '+reminders.length+' 筆';p.title='依各寵物同名疫苗的最新紀錄計算。';box.appendChild(p);
 for(const r of reminders.slice(0,10)){
  const item=document.createElement('div');item.className='home-vaccine-item-v74';
  const heading=document.createElement('p');heading.className='home-vaccine-name-v74';heading.textContent=r.pet_name+' · '+r.vaccine_name;
  const date=document.createElement('span');date.className='home-vaccine-date-v74';date.textContent=(r.next_due_date<today?'逾期 ':'到期 ')+r.next_due_date;
  if(r.next_due_date<today){item.classList.add('is-overdue');date.style.color='#a4663f';}
  const owner=document.createElement('p');owner.className='home-vaccine-owner-v74';owner.textContent='飼主 '+r.owner_name+' · '+[r.owner_mobile,r.owner_phone].filter(Boolean).join('／');
  item.append(heading,date,owner);box.appendChild(item);
 }
 if(!rows.length){const empty=document.createElement('p');empty.textContent='尚無可顯示紀錄；可按「更新疫苗提醒」讀取。';box.appendChild(empty);}
 if(reminders.length>10)box.appendChild(familyButtonV74('查看全部提醒',()=>switchTab('vaccines')));
}
function noteManualBackupV74(tenant,scope,status,detail,snapshotAt=null){
 if(tenant!==CURRENT_TENANT_ID||scope!==backupScopeV62()||CURRENT_PROFILE?.role!=='admin')return;
 try{localStorage.setItem('genblue-manual-backup-v74:'+tenant,JSON.stringify({status,detail,at:new Date().toISOString(),snapshotAt}));}catch{}
 renderManualBackupV74();
}
function renderManualBackupV74(){
 const box=document.getElementById('manualBackupHomeV74');if(!box)return;box.hidden=true;box.textContent='';
 if(!doctorScopeV51()||CURRENT_PROFILE?.role!=='admin')return;
 try{const saved=JSON.parse(localStorage.getItem('genblue-manual-backup-v74:'+CURRENT_TENANT_ID)||'null');if(!saved)return;
  box.hidden=false;box.style.color=saved.status==='failed'?'#b45309':'#64748b';box.textContent='最近手動備份：'+new Date(saved.at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})+'｜'+(saved.status==='written'?'已寫入所選檔案，請檢查 ZIP':saved.status==='download'?'已產生並開始下載，請確認下載檔與 ZIP':saved.detail||'未完成');
 }catch{}
}
function installFamilyV74(){
 function panel(id,title,html,parent,before=null){const n=document.createElement('section');n.id=id;n.className='card family-panel-v74';n.hidden=true;const h=document.createElement('h3');h.textContent=title;n.appendChild(h);const inner=document.createElement('div');inner.innerHTML=html;n.appendChild(inner);parent.insertBefore(n,before);return n;}
 const medical=document.getElementById('medical');panel('familyMedicalV74','同飼主的其他寵物','<select id="familyMedicalPetV74"></select> <button type="button" class="btn-secondary" onclick="switchFamilyMedicalV74()">儲存病歷與費用，再切換</button><p>先確認本隻費用並加入合併待收，再開啟下一隻；每隻病歷獨立保存。</p>',medical,medical.children[1]);
 const list=document.getElementById('invoiceItemsList');panel('familyBillingV74','同飼主合併結帳','<p>確認本隻帳單後加入清單，再選下一隻。加入清單尚未收款；整批收款時才扣庫存。待收明細暫存於此分頁，重新整理可保留；關閉分頁前請完成結帳。</p><button type="button" id="familyStageV74" class="btn-secondary" onclick="stageFamilyBillV74()">加入同飼主合併待收</button><div id="familyQueueV74"></div><p id="familyMessageV74" role="status" aria-live="polite"></p><button type="button" id="familyPayV74" class="btn-success" onclick="checkoutFamilyV74()">整批收款並開合併收據</button> <button type="button" id="familyLastReceiptV74" class="btn-secondary" onclick="showFamilyReceiptV74()" hidden>重開最近合併收據</button>',list.parentElement,list);
 const home=document.getElementById('appointments');panel('familyHomeV74','同飼主待收清單','<span id="familyHomeTextV74"></span> <button type="button" class="btn-secondary" onclick="switchTab(\'invoices\')">前往合併結帳</button>',home,home.firstChild);
 const backup=document.getElementById('sb-home');if(backup){const info=document.createElement('p');info.id='manualBackupHomeV74';info.hidden=true;info.setAttribute('role','status');backup.appendChild(info);}
 panel('homeVaccinesV74','疫苗到期提醒','<div class="home-vaccine-controls-v74"><label>提醒範圍 <select id="homeVaccineDaysV74" onchange="changeHomeVaccineRangeV9010()"><option value="7">7 天</option><option value="30" selected>30 天</option><option value="90">90 天</option></select></label> <button type="button" class="btn-secondary" onclick="loadPetVaccines()">更新</button></div><button type="button" id="homeVaccineToggleV9010" class="btn-secondary" aria-controls="homeVaccineListV74" aria-expanded="false" onclick="setHomeVaccineExpandedV9010(document.getElementById(\'homeVaccineListV74\').hidden)">展開提醒</button><div id="homeVaccineListV74" role="status" aria-live="polite" hidden></div>',home.querySelector('.journal-schedule')||home,home.querySelector('.journal-schedule .journal-memo'));
}
installFamilyV74();
document.getElementById('invoiceItemsList').addEventListener('input',()=>{familyInvoiceTouchedV74=true;});
const familySwitchOriginalV74=switchTab;switchTab=function(...args){const result=familySwitchOriginalV74.apply(this,args);renderFamilyV74();if(args[0]==='appointments'){renderHomeVaccinesV74();renderManualBackupV74();}return result;};
const familyVaccinesOriginalV74=vaccineToolsRender;vaccineToolsRender=function(...args){const result=familyVaccinesOriginalV74.apply(this,args);renderHomeVaccinesV74();return result;};
const familyStartOriginalV74=startDoctorConsultationV51;startDoctorConsultationV51=async function(args,...rest){if(familyStateNowV74()?.pending||familyBillHasContentV74()){alert('請先加入或完成收費頁的帳單，再開啟下一隻寵物');return;}if(familyStateNowV74()?.entries.some(e=>e.billingPetId===args[0])){alert('此寵物已在合併待收，請先修改其明細');return;}const result=await familyStartOriginalV74.call(this,args,...rest);renderFamilyV74();return result;};
const familyDirectOriginalV74=directCheckoutFromAppointment;directCheckoutFromAppointment=function(petId,...rest){if(familyStateNowV74()?.pending||familyBillHasContentV74()||familyStateNowV74()?.entries.some(e=>e.billingPetId===petId)){alert('請先處理現有帳單；合併待收中的寵物請按「修改明細」');return;}return familyDirectOriginalV74.call(this,petId,...rest);};
const familySingleOriginalV74=processInvoiceCheckoutToArchive;processInvoiceCheckoutToArchive=async function(...args){if(familyStateNowV74()?.pending){alert('請先核對尚未確認的合併結帳');return;}if(familyHasAppointmentV74(clinicalInvoiceContext?.appointmentId||currentAppointmentId)){alert('此掛號已加入合併待收，請先修改清單中的明細');return;}return familySingleOriginalV74.apply(this,args);};
const familySaveBillOriginalV74=saveMedicalRecordAndDirectCheckout;saveMedicalRecordAndDirectCheckout=async function(...args){if(familyStateNowV74()?.pending||familyBillHasContentV74()){alert('請先加入或完成收費頁的帳單，再轉入本隻費用');return;}return familySaveBillOriginalV74.apply(this,args);};
const familyLogoutOriginalV74=logoutSupabase;logoutSupabase=function(...args){clinicalInvoiceContext=null;clinicalMedicationGroupsV64=null;document.getElementById('invoiceItemsList').replaceChildren();currentAppointmentId=null;const receiptModal=document.getElementById('receipt-modal');if(receiptModal)receiptModal.style.display='none';document.getElementById('receiptItemsTableBody')?.replaceChildren();familyInvoiceTouchedV74=false;familyNextPetV74=null;familyScopeV74='';familyStateV74=null;for(const id of ['familyMedicalV74','familyBillingV74','familyHomeV74','homeVaccinesV74'])document.getElementById(id).hidden=true;document.getElementById('familyQueueV74').replaceChildren();document.getElementById('homeVaccineListV74').replaceChildren();return familyLogoutOriginalV74.apply(this,args);};

