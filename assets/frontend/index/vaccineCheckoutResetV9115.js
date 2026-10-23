
function clearPaidVaccineFormV9115(petIds){
 const value=id=>document.getElementById(id)?.value||'',petId=value('selectedVacPetId');
 if(vaccineRecordSaveBusy||!petId||!petIds.includes(petId))return false;
 // Do not erase a new vaccine entry that is already being filled.
 if(value('vacTypeSelect')||value('vacServiceFee')||value('vacNotes')||value('rabiesTag')||document.getElementById('rabiesRecordEnabled')?.checked)return false;
 for(const id of ['vacPetSearchInput','selectedVacPetId','vacTypeSelect','vacAdministeredDate','vacNextDueDate','vacServiceFee','vacNotes'])document.getElementById(id).value='';
 clearRabiesFields();
 const hint=document.getElementById('vaccineDueHintV9114');if(hint)hint.textContent='選擇疫苗後依本次施打日期帶入，可手動修改。';
 return true;
}
const vaccineMarkPaidOriginalV9115=markServiceChargesPaid;
markServiceChargesPaid=function(ids,invoiceId){
 const tenant=CURRENT_TENANT_ID;
 const petIds=[...new Set(readServiceDrafts().filter(x=>x.tenantId===tenant&&x.kind==='vaccine'&&ids.includes(x.id)).map(x=>x.petId))];
 const result=vaccineMarkPaidOriginalV9115.apply(this,arguments);
 if(tenant===CURRENT_TENANT_ID)clearPaidVaccineFormV9115(petIds);
 return result;
};
document.getElementById('genblueVersionV84').textContent=' · v91.16';
