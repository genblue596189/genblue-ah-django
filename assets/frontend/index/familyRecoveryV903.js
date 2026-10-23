
// v90.3: recover one family draft independently, without deleting registration or clinical history.
const clearFamilyBillBeforeV903=clearFamilyBillV74;
clearFamilyBillV74=function(...args){const r=clearFamilyBillBeforeV903.apply(this,args);document.getElementById('invoiceOwnerSelect').value='';familyInvoiceTouchedV74=false;return r;};
async function familyRestoreOneV903(id){
 if(familyBusyV74||inventoryCheckoutBusy)return;
 const state=familyStateNowV74();if(!state||state.pending){alert('收款結果尚未確認，請先核對同一筆收款，不能拆單。');return;}
 const entry=state.entries.find(e=>e.billingAppointmentId===id);if(!entry)return;
 const scope=doctorScopeV51();
 if(familyBillHasContentV74()){
  const owner=clinicalInvoiceContext?.ownerId||document.getElementById('invoiceOwnerSelect').value;
  if(owner!==entry.ownerId){alert('目前帳單是另一位飼主，請先完成該帳單；所有明細保留。');return;}
  const current=clinicalInvoiceContext?.appointmentId||currentAppointmentId;
  if(current===id){alert('這隻寵物同時有清單及編輯中的費用，請先核對目前帳單，避免覆蓋。');return;}
  const next=familyNextPetV74;familyNextPetV74=null;
  if(!await stageFamilyBillV74()){familyNextPetV74=next;return;}
  if(scope!==doctorScopeV51())return;
 }
 restoreFamilyBillV74(id);familyNextPetV74=null;
 if(clinicalInvoiceContext?.appointmentId===id)familyMessageV74('已取出 '+entry.billingPetName+' 的帳單。可修改、個別結帳或重新加入合併待收；其他寵物的明細仍保留。');
}
async function familyOpenNextV903(){
 const id=document.getElementById('familyBillingPetV903').value;
 const state=familyStateNowV74(),owner=clinicalInvoiceContext?.ownerId||state?.entries[0]?.ownerId||document.getElementById('invoiceOwnerSelect').value;
 const pet=allPetsListForDropdown.find(p=>p.id===id&&p.owner_id===owner);if(!pet)return;
 if(state?.pending){alert('請先核對尚未確認的收款');return;}
 const queued=state?.entries.find(e=>e.billingPetId===id);if(queued)return familyRestoreOneV903(queued.billingAppointmentId);
 if(familyBillHasContentV74()){
  familyNextPetV74={scope:doctorScopeV51(),pet};await stageFamilyBillV74();
 }else await openFamilyPetV74(pet);
}
function familyReturnOneV903(id){
 const state=familyStateNowV74();if(!state||familyBusyV74||inventoryCheckoutBusy)return;
 if(state.pending){alert('收款結果尚未確認，不能移除；請先核對上次收款。');return;}
 const entry=state.entries.find(e=>e.billingAppointmentId===id);if(!entry)return;
 if(entry.releasePending){alert('這筆掛號尚未確認返回候診。請先按「修改明細／個別結帳」，核對後重新加入待收。');return;}
 if(!confirm('將 '+entry.billingPetName+' 移出合併待收？\n只移除本分頁的合併費用草稿；掛號、已儲存病歷與其他寵物帳单保留。若要保留完整費用，請改按「修改明細／個別結帳」。'))return;
 try{persistFamilyV74({...state,entries:state.entries.filter(e=>e!==entry),requestId:crypto.randomUUID()});familyNextPetV74=null;familyMessageV74(entry.billingPetName+'已移出合併待收；可從候診重新開啟。');renderFamilyV74();void loadAppointments();}catch(e){alert('清單未更新：'+e.message+'，原資料保留。');}
}
const renderFamilyBeforeV903=renderFamilyV74;
renderFamilyV74=function(...args){
 const r=renderFamilyBeforeV903.apply(this,args),state=familyStateNowV74(),panel=document.getElementById('familyBillingV74');if(!panel||!familyAllowedV74())return r;
 let toolbar=document.getElementById('familyBillingNextV903');
 if(!toolbar){toolbar=document.createElement('div');toolbar.id='familyBillingNextV903';toolbar.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0';const label=document.createElement('label');label.textContent='同飼主其他寵物 ';const select=document.createElement('select');select.id='familyBillingPetV903';label.append(select);toolbar.append(label,familyButtonV74('核對並加入目前帳單，再開下一隻',familyOpenNextV903));document.getElementById('familyStageV74').after(toolbar);}
 const select=document.getElementById('familyBillingPetV903'),old=select.value,owner=clinicalInvoiceContext?.ownerId||state?.entries[0]?.ownerId||document.getElementById('invoiceOwnerSelect').value;
 select.replaceChildren(new Option('選擇下一隻；已待收者可取出修改',''));
 for(const pet of allPetsListForDropdown.filter(p=>p.owner_id===owner&&p.id!==clinicalInvoiceContext?.petId)){const queued=state?.entries.some(e=>e.billingPetId===pet.id);select.add(new Option(pet.name+(queued?'（已待收，可取出修改）':''),pet.id));}select.value=old;
 const locked=familyBusyV74||inventoryCheckoutBusy||!!state?.pending;toolbar.querySelectorAll('button,select').forEach(e=>e.disabled=locked);
 const rows=document.querySelectorAll('#familyQueueV74 .family-row-v74');rows.forEach((row,index)=>{const entry=state?.entries[index];if(!entry)return;const edit=row.querySelector('button');if(edit){edit.textContent='修改明細／個別結帳';edit.onclick=()=>familyRestoreOneV903(entry.billingAppointmentId);}row.append(familyButtonV74('移出合併待收',()=>familyReturnOneV903(entry.billingAppointmentId),locked));});
 return r;
};
// Going back to the same uncollected bill must show that bill, not claim a new visit.
const familyStartBeforeV903=startDoctorConsultationV51;
startDoctorConsultationV51=async function(args,...rest){
 const entry=familyStateNowV74()?.entries.find(e=>e.billingPetId===args[0]);if(entry){await familyRestoreOneV903(entry.billingAppointmentId);return;}
 if(familyBillHasContentV74()&&clinicalInvoiceContext?.petId===args[0]){switchTab('invoices');familyMessageV74('本隻已儲存病歷並轉入收費；請直接核對這張帳單，可個別結帳或加入合併待收。');return;}
 return familyStartBeforeV903.call(this,args,...rest);
};
document.getElementById('genblueVersionV84').textContent=' · v90.3';
